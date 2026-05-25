import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import { hasCapability, LspSession } from "../../src/lsp/session.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(__dirname, "../fixtures/fake-lsp-server.ts");
const rootPath = resolve(__dirname, "../..", "test-workspace");
const rootUri = pathToFileURL(rootPath).toString();

describe("LspSession", () => {
  it("initializes a stdio LSP server, stores capabilities, and shuts down cleanly", async () => {
    const session = new LspSession({
      command: process.execPath,
      args: ["--import", "tsx", fixturePath],
      rootUri,
      workspaceFolders: [{ uri: rootUri, name: "test-workspace" }],
      initializationOptions: { fixture: true },
    });

    await session.start();

    expect(session.capabilities).toMatchObject({
      hoverProvider: true,
      completionProvider: { resolveProvider: true },
      workspace: { workspaceFolders: { supported: true } },
    });
    expect(session.hasCapability("hoverProvider")).toBe(true);
    expect(session.hasCapability(["completionProvider", "resolveProvider"])).toBe(true);
    expect(hasCapability(session.capabilities, "workspace.workspaceFolders.supported")).toBe(true);

    await session.shutdown();

    const stderrEvents = session.getStderr().map((line) => JSON.parse(line));
    expect(stderrEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          method: "initialize",
          params: expect.objectContaining({
            processId: process.pid,
            rootUri,
            initializationOptions: { fixture: true },
            workspaceFolders: [{ uri: rootUri, name: "test-workspace" }],
            capabilities: expect.objectContaining({
              textDocument: expect.any(Object),
              workspace: expect.any(Object),
              window: expect.any(Object),
            }),
          }),
        }),
        { method: "initialized" },
        { method: "shutdown", initialized: true },
        { method: "exit", shutdown: true },
      ]),
    );
    expect(session.status.state).toBe("exited");

    await expect(session.shutdown()).resolves.toBeUndefined();
  });

  it("preserves an explicit null workspaceFolders initialize option", async () => {
    const session = new LspSession({
      command: process.execPath,
      args: ["--import", "tsx", fixturePath],
      rootUri,
      workspaceFolders: null,
    });

    await session.start();
    await session.shutdown();

    const initializeEvent = session
      .getStderr()
      .map((line) => JSON.parse(line))
      .find((event) => event.method === "initialize");
    expect(initializeEvent.params.workspaceFolders).toBeNull();
  });

  it("bounds shutdown waiting when the server ignores exit", async () => {
    const session = new LspSession({
      command: process.execPath,
      args: ["--import", "tsx", fixturePath],
      env: { ...process.env, FAKE_LSP_IGNORE_EXIT: "1" },
      rootUri,
      exitTimeoutMs: 25,
    });

    await session.start();
    await expect(session.shutdown()).resolves.toBeUndefined();

    const stderrEvents = session.getStderr().map((line) => JSON.parse(line));
    expect(stderrEvents).toEqual(
      expect.arrayContaining([
        { method: "shutdown", initialized: true },
        { method: "exit", shutdown: true },
      ]),
    );
    expect(session.status.state).toBe("exited");
  });

  it("cleans up transport when initialize fails", async () => {
    const session = new LspSession({
      command: process.execPath,
      args: ["--import", "tsx", fixturePath],
      env: { ...process.env, FAKE_LSP_FAIL_INITIALIZE: "1" },
      rootUri,
    });

    await expect(session.start()).rejects.toThrow("initialize failed by fixture request");
    expect(session.status.state).toBe("exited");
  });

  it("bounds shutdown request waiting and still disposes transport", async () => {
    const session = new LspSession({
      command: process.execPath,
      args: ["--import", "tsx", fixturePath],
      env: { ...process.env, FAKE_LSP_IGNORE_SHUTDOWN: "1" },
      rootUri,
      shutdownTimeoutMs: 25,
      exitTimeoutMs: 25,
    });

    await session.start();
    await expect(session.shutdown()).resolves.toBeUndefined();
    expect(session.status.state).toBe("exited");
  });

  it("rejects restart after shutdown", async () => {
    const session = new LspSession({
      command: process.execPath,
      args: ["--import", "tsx", fixturePath],
      rootUri,
    });

    await session.start();
    await session.shutdown();

    await expect(session.start()).rejects.toThrow("LSP session cannot be restarted after shutdown");
  });

  it("does not advertise unsupported dynamic, refresh, or configuration capabilities", async () => {
    const session = new LspSession({
      command: process.execPath,
      args: ["--import", "tsx", fixturePath],
      rootUri,
    });

    await session.start();
    await session.shutdown();

    const initializeEvent = session
      .getStderr()
      .map((line) => JSON.parse(line))
      .find((event) => event.method === "initialize");
    expect(JSON.stringify(initializeEvent.params.capabilities)).not.toContain(
      "dynamicRegistration",
    );
    expect(initializeEvent.params.capabilities.workspace.configuration).toBeUndefined();
    expect(initializeEvent.params.capabilities.workspace.semanticTokens).toBeUndefined();
    expect(initializeEvent.params.capabilities.workspace.codeLens).toBeUndefined();
    expect(initializeEvent.params.capabilities.workspace.applyEdit).toBeUndefined();
    expect(initializeEvent.params.capabilities.workspace.fileOperations).toBeUndefined();
    expect(initializeEvent.params.capabilities.window.workDoneProgress).toBeUndefined();
    expect(initializeEvent.params.capabilities.window.showDocument).toBeUndefined();
    expect(initializeEvent.params.capabilities.window.showMessage).toBeUndefined();
  });

  it("shares one startup attempt across concurrent start calls", async () => {
    const tempDir = await mkdtemp(resolve(tmpdir(), "lsp-session-"));
    const eventLog = resolve(tempDir, "events.jsonl");
    const session = new LspSession({
      command: process.execPath,
      args: ["--import", "tsx", fixturePath],
      env: { ...process.env, FAKE_LSP_EVENT_LOG: eventLog },
      rootUri,
    });

    await Promise.all([session.start(), session.start(), session.start()]);
    await session.shutdown();

    const events = (await readFile(eventLog, "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(events.filter((event) => event.method === "initialize")).toHaveLength(1);
  });
});
