import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import { DocumentStore, filePathToUri } from "../../src/lsp/documentStore.js";
import { LspSession } from "../../src/lsp/session.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(__dirname, "../fixtures/fake-lsp-server.ts");

describe("document open synchronization", () => {
  it("sends didOpen through a real LSP session before later requests", async () => {
    const tempDir = await mkdtemp(resolve(tmpdir(), "document-open-"));
    const eventLog = resolve(tempDir, "events.jsonl");
    const filePath = resolve(tempDir, "example.ts");
    await writeFile(filePath, "const value = 1;\n");
    const session = new LspSession({
      command: process.execPath,
      args: ["--import", "tsx", fixturePath],
      env: { ...process.env, FAKE_LSP_EVENT_LOG: eventLog },
      rootUri: pathToFileURL(tempDir).toString(),
    });
    const store = new DocumentStore();

    await session.start();
    await store.ensureDocumentOpen({ session, filePath, languageId: "typescript" });
    await session.shutdown();

    const events = await readEvents(eventLog);
    const didOpenIndex = events.findIndex((event) => event.method === "textDocument/didOpen");
    const shutdownIndex = events.findIndex((event) => event.method === "shutdown");
    expect(didOpenIndex).toBeGreaterThan(-1);
    expect(didOpenIndex).toBeLessThan(shutdownIndex);
    expect(events[didOpenIndex].params).toEqual({
      textDocument: {
        uri: filePathToUri(filePath),
        languageId: "typescript",
        version: 1,
        text: "const value = 1;\n",
      },
    });
  });

  it("sends didChange after opened disk content changes", async () => {
    const tempDir = await mkdtemp(resolve(tmpdir(), "document-change-"));
    const eventLog = resolve(tempDir, "events.jsonl");
    const filePath = resolve(tempDir, "example.ts");
    await writeFile(filePath, "const value = 1;\n");
    const session = new LspSession({
      command: process.execPath,
      args: ["--import", "tsx", fixturePath],
      env: { ...process.env, FAKE_LSP_EVENT_LOG: eventLog },
      rootUri: pathToFileURL(tempDir).toString(),
    });
    const store = new DocumentStore();

    await session.start();
    await store.ensureDocumentOpen({ session, filePath, languageId: "typescript" });
    await writeFile(filePath, "const value = 2;\n");
    await store.ensureDocumentOpen({ session, filePath, languageId: "typescript" });
    await session.shutdown();

    const events = await readEvents(eventLog);
    expect(events.map((event) => event.method)).toEqual(
      expect.arrayContaining(["textDocument/didOpen", "textDocument/didChange"]),
    );
    const didChange = events.find((event) => event.method === "textDocument/didChange");
    expect(didChange?.params).toEqual({
      textDocument: { uri: filePathToUri(filePath), version: 2 },
      contentChanges: [{ text: "const value = 2;\n" }],
    });
  });
});

async function readEvents(eventLog: string): Promise<Array<{ method: string; params?: unknown }>> {
  return (await readFile(eventLog, "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
}
