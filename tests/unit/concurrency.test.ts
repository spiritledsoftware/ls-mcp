import { PassThrough } from "node:stream";

import { describe, expect, it } from "vitest";
import {
  createMessageConnection,
  StreamMessageReader,
  StreamMessageWriter,
} from "vscode-jsonrpc/node.js";

import {
  LspRequestCancelledError,
  LspRequestTimeoutError,
  LspSession,
} from "../../src/lsp/session.js";
import type { LspTransport } from "../../src/lsp/transport.js";

const rootUri = "file:///workspace";

describe("LspSession request concurrency", () => {
  it("limits concurrent requests per server", async () => {
    const server = createInMemoryServer();
    let active = 0;
    let maxActive = 0;
    const releaseQueue: Array<() => void> = [];

    server.connection.onRequest("test/slow", async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise<void>((resolve) => releaseQueue.push(resolve));
      active -= 1;
      return { ok: true };
    });

    const session = new LspSession({
      rootUri,
      transport: server.transport,
      maxConcurrentRequestsPerServer: 2,
    });
    await session.start();

    const requests = [
      session.sendRequest("test/slow"),
      session.sendRequest("test/slow"),
      session.sendRequest("test/slow"),
      session.sendRequest("test/slow"),
    ];
    await waitUntil(() => releaseQueue.length === 2);
    expect(maxActive).toBe(2);

    releaseQueue.splice(0).forEach((release) => {
      release();
    });
    await waitUntil(() => releaseQueue.length === 2);
    expect(maxActive).toBe(2);

    releaseQueue.splice(0).forEach((release) => {
      release();
    });
    await expect(Promise.all(requests)).resolves.toEqual([
      { ok: true },
      { ok: true },
      { ok: true },
      { ok: true },
    ]);
    await session.shutdown();
    server.connection.dispose();
  });

  it("does not send an already-aborted request", async () => {
    const server = createInMemoryServer();
    let requestCount = 0;
    server.connection.onRequest("test/abort", () => {
      requestCount += 1;
      return { sent: true };
    });
    const session = new LspSession({ rootUri, transport: server.transport });
    await session.start();
    const controller = new AbortController();
    controller.abort();

    await expect(
      session.sendRequest("test/abort", undefined, { signal: controller.signal }),
    ).rejects.toMatchObject({
      name: "LspRequestCancelledError",
      code: "LSP_REQUEST_CANCELLED",
      method: "test/abort",
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(requestCount).toBe(0);
    await session.shutdown();
    server.connection.dispose();
  });

  it("removes aborted queued requests and lets the next queued request proceed", async () => {
    const server = createInMemoryServer();
    const started: string[] = [];
    const releaseQueue: Array<() => void> = [];
    server.connection.onRequest("test/queued", async (params) => {
      const name = String((params as { name: string }).name);
      started.push(name);
      await new Promise<void>((resolve) => releaseQueue.push(resolve));
      return { name };
    });
    const session = new LspSession({
      rootUri,
      transport: server.transport,
      maxConcurrentRequestsPerServer: 1,
    });
    await session.start();
    const controller = new AbortController();

    const first = session.sendRequest("test/queued", { name: "first" });
    await waitUntil(() => started.includes("first"));
    const second = session.sendRequest(
      "test/queued",
      { name: "second" },
      { signal: controller.signal },
    );
    const third = session.sendRequest("test/queued", { name: "third" });
    controller.abort();

    await expect(second).rejects.toBeInstanceOf(LspRequestCancelledError);
    releaseQueue.shift()?.();
    await waitUntil(() => started.includes("third"));
    releaseQueue.shift()?.();

    await expect(first).resolves.toEqual({ name: "first" });
    await expect(third).resolves.toEqual({ name: "third" });
    expect(started).toEqual(["first", "third"]);
    await session.shutdown();
    server.connection.dispose();
  });

  it("lets queued requests proceed after an active request fails", async () => {
    const server = createInMemoryServer();
    server.connection.onRequest("test/fails", () => {
      throw new Error("boom");
    });
    server.connection.onRequest("test/after", () => ({ ok: true }));
    const session = new LspSession({
      rootUri,
      transport: server.transport,
      maxConcurrentRequestsPerServer: 1,
    });
    await session.start();

    const first = session.sendRequest("test/fails");
    const second = session.sendRequest("test/after");

    await expect(first).rejects.toThrow("boom");
    await expect(second).resolves.toEqual({ ok: true });
    await session.shutdown();
    server.connection.dispose();
  });

  it("lets queued requests proceed after an active request times out", async () => {
    const server = createInMemoryServer();
    server.connection.onRequest("test/hangs", () => new Promise(() => {}));
    server.connection.onRequest("test/after", () => ({ ok: true }));
    const session = new LspSession({
      rootUri,
      transport: server.transport,
      maxConcurrentRequestsPerServer: 1,
      requestTimeoutMs: 10,
    });
    await session.start();

    const first = session.sendRequest("test/hangs");
    const second = session.sendRequest("test/after");

    await expect(first).rejects.toBeInstanceOf(LspRequestTimeoutError);
    await expect(second).resolves.toEqual({ ok: true });
    await session.shutdown();
    server.connection.dispose();
  });

  it("lets queued requests proceed after an active request is aborted", async () => {
    const server = createInMemoryServer();
    server.connection.onRequest("test/hangs", () => new Promise(() => {}));
    server.connection.onRequest("test/after", () => ({ ok: true }));
    const session = new LspSession({
      rootUri,
      transport: server.transport,
      maxConcurrentRequestsPerServer: 1,
    });
    await session.start();
    const controller = new AbortController();

    const first = session.sendRequest("test/hangs", undefined, { signal: controller.signal });
    const second = session.sendRequest("test/after");
    controller.abort();

    await expect(first).rejects.toBeInstanceOf(LspRequestCancelledError);
    await expect(second).resolves.toEqual({ ok: true });
    await session.shutdown();
    server.connection.dispose();
  });
});

function createInMemoryServer() {
  const clientToServer = new PassThrough();
  const serverToClient = new PassThrough();
  const connection = createMessageConnection(
    new StreamMessageReader(clientToServer),
    new StreamMessageWriter(serverToClient),
  );
  connection.onRequest("initialize", () => ({ capabilities: {} }));
  connection.onRequest("shutdown", () => null);
  connection.listen();

  const transport: LspTransport = {
    command: "memory-lsp",
    args: [],
    reader: new StreamMessageReader(serverToClient),
    writer: new StreamMessageWriter(clientToServer),
    status: { state: "running", exitCode: null, signal: null },
    exit: new Promise(() => {}),
    getStderr: () => [],
    async dispose() {},
  };
  return { connection, transport };
}

async function waitUntil(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("Timed out waiting for condition");
}
