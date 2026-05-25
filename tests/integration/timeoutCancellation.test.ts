import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import {
  LspRequestCancelledError,
  LspRequestTimeoutError,
  LspSession,
} from "../../src/lsp/session.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(__dirname, "../fixtures/fake-lsp-server.ts");
const rootPath = resolve(__dirname, "../..", "test-workspace");
const rootUri = pathToFileURL(rootPath).toString();

describe("LspSession timeouts and cancellation", () => {
  it("sends cancellation and returns a structured timeout error", async () => {
    const tempDir = await mkdtemp(resolve(tmpdir(), "lsp-timeout-"));
    const eventLog = resolve(tempDir, "events.jsonl");
    const session = new LspSession({
      command: process.execPath,
      args: ["--import", "tsx", fixturePath],
      env: {
        ...process.env,
        FAKE_LSP_EVENT_LOG: eventLog,
        FAKE_LSP_HANG_METHODS: "test/hang",
      },
      rootUri,
      requestTimeoutMs: 25,
    });

    await session.start();
    await expect(session.sendRequest("test/hang")).rejects.toMatchObject({
      name: "LspRequestTimeoutError",
      code: "LSP_REQUEST_TIMEOUT",
      method: "test/hang",
      timeoutMs: 25,
    });
    expect(session.status.state).toBe("running");
    await session.shutdown();

    const events = await readEvents(eventLog);
    expect(events).toEqual(
      expect.arrayContaining([expect.objectContaining({ method: "$/cancelRequest" })]),
    );
  });

  it("sends LSP cancellation when an active request is aborted", async () => {
    const tempDir = await mkdtemp(resolve(tmpdir(), "lsp-abort-"));
    const eventLog = resolve(tempDir, "events.jsonl");
    const controller = new AbortController();
    const session = new LspSession({
      command: process.execPath,
      args: ["--import", "tsx", fixturePath],
      env: {
        ...process.env,
        FAKE_LSP_EVENT_LOG: eventLog,
        FAKE_LSP_HANG_METHODS: "test/hang",
      },
      rootUri,
      requestTimeoutMs: 1_000,
    });

    await session.start();
    const request = session.sendRequest("test/hang", undefined, { signal: controller.signal });
    await waitForEvent(eventLog, "test/hang");
    controller.abort();

    await expect(request).rejects.toMatchObject({
      name: "LspRequestCancelledError",
      code: "LSP_REQUEST_CANCELLED",
      method: "test/hang",
    });
    await session.shutdown();

    const events = await readEvents(eventLog);
    expect(events).toEqual(
      expect.arrayContaining([expect.objectContaining({ method: "$/cancelRequest" })]),
    );
  });

  it("does not record caller cancellation as server failure", async () => {
    const controller = new AbortController();
    const session = new LspSession({
      command: process.execPath,
      args: ["--import", "tsx", fixturePath],
      env: { ...process.env, FAKE_LSP_HANG_METHODS: "test/hang" },
      rootUri,
      requestTimeoutMs: 1_000,
    });

    await session.start();
    const request = session.sendRequest("test/hang", undefined, { signal: controller.signal });
    controller.abort();

    await expect(request).rejects.toBeInstanceOf(LspRequestCancelledError);
    expect(session.health.consecutiveFailures).toBe(0);
    expect(session.health.lastError).toBeUndefined();
    await session.shutdown();
  });

  it("keeps an otherwise healthy server alive after a timeout", async () => {
    const session = new LspSession({
      command: process.execPath,
      args: ["--import", "tsx", fixturePath],
      env: { ...process.env, FAKE_LSP_HANG_METHODS: "test/hang" },
      rootUri,
      requestTimeoutMs: 25,
    });

    await session.start();
    await expect(session.sendRequest("test/hang")).rejects.toBeInstanceOf(LspRequestTimeoutError);
    await expect(session.sendRequest("test/echo", { ok: true })).resolves.toEqual({ ok: true });
    expect(session.status.state).toBe("running");
    await session.shutdown();
  });

  it("uses the workspace timeout for workspace requests", async () => {
    const session = new LspSession({
      command: process.execPath,
      args: ["--import", "tsx", fixturePath],
      env: { ...process.env, FAKE_LSP_HANG_METHODS: "workspace/symbol" },
      rootUri,
      requestTimeoutMs: 20,
      workspaceRequestTimeoutMs: 75,
    });

    await session.start();
    await expect(
      session.sendRequest("workspace/symbol", { query: "Widget" }),
    ).rejects.toMatchObject({
      method: "workspace/symbol",
      timeoutMs: 75,
    });
    await session.shutdown();
  });

  it("updates health fields on failures, stderr, and exits", async () => {
    const session = new LspSession({
      command: process.execPath,
      args: ["--import", "tsx", fixturePath],
      env: { ...process.env, FAKE_LSP_FAIL_METHODS: "test/fail" },
      rootUri,
    });

    await session.start();
    await expect(session.sendRequest("test/fail")).rejects.toThrow("failed by fixture request");
    expect(session.health).toMatchObject({
      consecutiveFailures: 1,
      restartCount: 0,
      lastExitCode: null,
      lastExitSignal: null,
    });
    expect(session.health.lastStderr.some((line) => line.includes("test/fail"))).toBe(true);
    expect(session.health.lastError).toContain("failed by fixture request");

    await session.shutdown();
    expect(session.health.lastExitCode).toBe(0);
    expect(session.health.lastExitSignal).toBeNull();
  });
});

async function readEvents(filePath: string): Promise<Array<Record<string, unknown>>> {
  return (await readFile(filePath, "utf8"))
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function waitForEvent(filePath: string, method: string): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const events = await readEvents(filePath).catch(() => []);
    if (events.some((event) => event.method === method)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error(`Timed out waiting for ${method}`);
}
