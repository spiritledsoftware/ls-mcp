import { describe, expect, it, vi } from "vitest";

import type { AcquiredLspSession, ManagedLspSession } from "../../src/lsp/sessionManager.js";
import { LspRequestTimeoutError, type LspRequestOptions } from "../../src/lsp/session.js";
import { createRawToolHandler } from "../../src/tools/rawTools.js";

interface FakeSession extends ManagedLspSession {
  notifications: { method: string; params: unknown }[];
  requests: { method: string; params: unknown }[];
  requestOptions: Array<LspRequestOptions | undefined>;
}

function createSession(response: unknown = { ok: true }): FakeSession {
  return {
    capabilities: {},
    notifications: [],
    requests: [],
    requestOptions: [],
    async start() {},
    async shutdown() {},
    onNotification() {
      return { dispose() {} };
    },
    async sendNotification(method: string, params?: unknown) {
      this.notifications.push({ method, params });
    },
    async sendRequest<T = unknown>(
      method: string,
      params?: unknown,
      options?: LspRequestOptions,
    ): Promise<T> {
      this.requests.push({ method, params });
      this.requestOptions.push(options);
      return response as T;
    },
  };
}

function failingRequestSession(error: Error): FakeSession {
  const session = createSession();
  session.sendRequest = async function sendRequest(
    method: string,
    params?: unknown,
    options?: LspRequestOptions,
  ) {
    this.requests.push({ method, params });
    this.requestOptions.push(options);
    throw error;
  };
  return session;
}

function acquired(serverId: string, session: ManagedLspSession): AcquiredLspSession {
  return {
    serverId,
    workspaceRoot: "/workspace",
    session,
    languageIds: ["typescript"],
    extensions: [".ts"],
  };
}

function successfulAcquisition(serverId: string, session: ManagedLspSession) {
  return { ok: true as const, value: acquired(serverId, session) };
}

function failedAcquisition(serverId: string, error: string) {
  return { ok: false as const, value: { serverId, error } };
}

describe("raw LSP request and notify tools", () => {
  it("sends raw request method and params unchanged", async () => {
    const params = { textDocument: { uri: "file:///workspace/app.ts" }, position: { line: 0 } };
    const session = createSession({ hover: true });
    const handler = createRawToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => [acquired("ts", session)]),
        getSessionsForFileSettled: vi.fn(async () => [successfulAcquisition("ts", session)]),
        getSessionsForWorkspace: vi.fn(async () => []),
        getSessionsForWorkspaceSettled: vi.fn(async () => []),
      },
    });

    const result = await handler("lsp_request", {
      workspaceRoot: "/workspace",
      filePath: "/workspace/app.ts",
      serverId: "ts",
      method: "textDocument/hover",
      params,
    });

    expect(session.requests).toEqual([{ method: "textDocument/hover", params }]);
    expect(result).toEqual({ ok: true, results: { ts: { ok: true, result: { hover: true } } } });
  });

  it("passes tool cancellation signal to raw LSP requests", async () => {
    const signal = new AbortController().signal;
    const session = createSession({ hover: true });
    const handler = createRawToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => [acquired("ts", session)]),
        getSessionsForFileSettled: vi.fn(async () => [successfulAcquisition("ts", session)]),
        getSessionsForWorkspace: vi.fn(async () => []),
        getSessionsForWorkspaceSettled: vi.fn(async () => []),
      },
    });

    await handler(
      "lsp_request",
      {
        workspaceRoot: "/workspace",
        filePath: "/workspace/app.ts",
        method: "textDocument/hover",
        params: {},
      },
      { signal },
    );

    expect(session.requestOptions[0]).toEqual({ signal });
  });

  it("preserves structured timeout errors", async () => {
    const failure = failingRequestSession(new LspRequestTimeoutError("workspace/symbol", 50));
    const handler = createRawToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => []),
        getSessionsForFileSettled: vi.fn(async () => []),
        getSessionsForWorkspace: vi.fn(async () => [acquired("ts", failure)]),
        getSessionsForWorkspaceSettled: vi.fn(async () => [successfulAcquisition("ts", failure)]),
      },
    });

    const result = await handler("lsp_request", {
      workspaceRoot: "/workspace",
      method: "workspace/symbol",
      params: { query: "Widget" },
    });

    expect(result.results.ts).toMatchObject({
      ok: false,
      error: expect.stringContaining("timed out"),
      code: "LSP_REQUEST_TIMEOUT",
      method: "workspace/symbol",
      timeoutMs: 50,
    });
  });

  it("returns structured execute-command acquisition failures instead of throwing", async () => {
    const handler = createRawToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => {
          throw new LspRequestTimeoutError("initialize", 25);
        }),
        getSessionsForFileSettled: vi.fn(async () => []),
        getSessionsForWorkspace: vi.fn(async () => []),
        getSessionsForWorkspaceSettled: vi.fn(async () => []),
      },
    });

    const result = await handler("lsp_execute_command", {
      workspaceRoot: "/workspace",
      filePath: "/workspace/app.ts",
      command: "doThing",
    });

    expect(result).toMatchObject({
      ok: false,
      results: {
        acquisition: {
          ok: false,
          error: expect.stringContaining("timed out"),
          code: "LSP_REQUEST_TIMEOUT",
          method: "initialize",
          timeoutMs: 25,
        },
      },
    });
  });

  it("normalizes command allowlist aliases before executing canonical server commands", async () => {
    const session = createSession({ fixed: true });
    const resolveServerId = vi.fn((serverId: string) =>
      serverId === "typescript" ? "typescript-language-server" : serverId,
    );
    const handler = createRawToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => [acquired("typescript-language-server", session)]),
        getSessionsForWorkspace: vi.fn(async () => []),
        resolveServerId,
      },
      config: { commands: { allow: { typescript: ["source.fixAll.ts"] } } },
    });

    const result = await handler("lsp_execute_command", {
      workspaceRoot: "/workspace",
      filePath: "/workspace/app.ts",
      serverId: "typescript",
      command: "source.fixAll.ts",
    });

    expect(resolveServerId).toHaveBeenCalledWith("typescript");
    expect(session.requests).toEqual([
      { method: "workspace/executeCommand", params: { command: "source.fixAll.ts" } },
    ]);
    expect(result.results["typescript-language-server"]).toEqual({
      ok: true,
      result: { fixed: true },
    });
  });

  it("sends raw notify method and params unchanged", async () => {
    const params = { uri: "file:///workspace/app.ts", type: 1, message: "hello" };
    const session = createSession();
    const handler = createRawToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => [acquired("ts", session)]),
        getSessionsForFileSettled: vi.fn(async () => [successfulAcquisition("ts", session)]),
        getSessionsForWorkspace: vi.fn(async () => []),
        getSessionsForWorkspaceSettled: vi.fn(async () => []),
      },
    });

    const result = await handler("lsp_notify", {
      workspaceRoot: "/workspace",
      filePath: "/workspace/app.ts",
      method: "window/showMessage",
      params,
    });

    expect(session.notifications).toEqual([{ method: "window/showMessage", params }]);
    expect(result).toEqual({ ok: true, results: { ts: { ok: true, result: null } } });
  });

  it("aggregates omitted serverId across matching file servers", async () => {
    const first = createSession({ first: true });
    const second = createSession({ second: true });
    const handler = createRawToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => [
          acquired("first", first),
          acquired("second", second),
        ]),
        getSessionsForFileSettled: vi.fn(async () => [
          successfulAcquisition("first", first),
          successfulAcquisition("second", second),
        ]),
        getSessionsForWorkspace: vi.fn(async () => []),
        getSessionsForWorkspaceSettled: vi.fn(async () => []),
      },
    });

    const result = await handler("lsp_request", {
      workspaceRoot: "/workspace",
      filePath: "/workspace/app.ts",
      method: "textDocument/documentSymbol",
      params: { textDocument: { uri: "file:///workspace/app.ts" } },
    });

    expect(result).toEqual({
      ok: true,
      results: {
        first: { ok: true, result: { first: true } },
        second: { ok: true, result: { second: true } },
      },
    });
  });

  it("preserves successful request result when another server fails", async () => {
    const success = createSession({ symbols: [] });
    const failure = failingRequestSession(new Error("server exploded"));
    const handler = createRawToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => [
          acquired("success", success),
          acquired("failure", failure),
        ]),
        getSessionsForFileSettled: vi.fn(async () => [
          successfulAcquisition("success", success),
          successfulAcquisition("failure", failure),
        ]),
        getSessionsForWorkspace: vi.fn(async () => []),
        getSessionsForWorkspaceSettled: vi.fn(async () => []),
      },
    });

    const result = await handler("lsp_request", {
      workspaceRoot: "/workspace",
      filePath: "/workspace/app.ts",
      method: "textDocument/documentSymbol",
      params: { textDocument: { uri: "file:///workspace/app.ts" } },
    });

    expect(result).toEqual({
      ok: false,
      results: {
        success: { ok: true, result: { symbols: [] } },
        failure: { ok: false, error: "server exploded" },
      },
    });
  });

  it("uses workspace-level server acquisition when filePath is omitted", async () => {
    const session = createSession({ workspace: true });
    const getSessionsForWorkspace = vi.fn(async () => [acquired("ts", session)]);
    const getSessionsForWorkspaceSettled = vi.fn(async () => [
      successfulAcquisition("ts", session),
    ]);
    const handler = createRawToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => []),
        getSessionsForFileSettled: vi.fn(async () => []),
        getSessionsForWorkspace,
        getSessionsForWorkspaceSettled,
      },
    });

    const result = await handler("lsp_request", {
      workspaceRoot: "/workspace",
      method: "workspace/symbol",
      params: { query: "Widget" },
    });

    expect(getSessionsForWorkspace).not.toHaveBeenCalled();
    expect(getSessionsForWorkspaceSettled).toHaveBeenCalledWith({
      workspaceRoot: "/workspace",
      serverId: undefined,
    });
    expect(session.requests).toEqual([{ method: "workspace/symbol", params: { query: "Widget" } }]);
    expect(result.results.ts).toEqual({ ok: true, result: { workspace: true } });
  });

  it("returns request acquisition failures alongside successful settled sessions", async () => {
    const success = createSession({ symbols: [] });
    const handler = createRawToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => {
          throw new Error("should use settled acquisition");
        }),
        getSessionsForFileSettled: vi.fn(async () => [
          successfulAcquisition("success", success),
          failedAcquisition("broken", "failed to start broken"),
        ]),
        getSessionsForWorkspace: vi.fn(async () => []),
        getSessionsForWorkspaceSettled: vi.fn(async () => []),
      },
    });

    const result = await handler("lsp_request", {
      workspaceRoot: "/workspace",
      filePath: "/workspace/app.ts",
      method: "textDocument/documentSymbol",
      params: { textDocument: { uri: "file:///workspace/app.ts" } },
    });

    expect(success.requests).toEqual([
      {
        method: "textDocument/documentSymbol",
        params: { textDocument: { uri: "file:///workspace/app.ts" } },
      },
    ]);
    expect(result).toEqual({
      ok: false,
      results: {
        success: { ok: true, result: { symbols: [] } },
        broken: { ok: false, error: "failed to start broken" },
      },
    });
  });

  it("returns notify acquisition failures alongside successful settled workspace sessions", async () => {
    const success = createSession();
    const handler = createRawToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => []),
        getSessionsForFileSettled: vi.fn(async () => []),
        getSessionsForWorkspace: vi.fn(async () => {
          throw new Error("should use settled acquisition");
        }),
        getSessionsForWorkspaceSettled: vi.fn(async () => [
          failedAcquisition("broken", "failed to start broken"),
          successfulAcquisition("success", success),
        ]),
      },
    });

    const params = { type: 3, message: "indexing" };
    const result = await handler("lsp_notify", {
      workspaceRoot: "/workspace",
      method: "window/logMessage",
      params,
    });

    expect(success.notifications).toEqual([{ method: "window/logMessage", params }]);
    expect(result).toEqual({
      ok: false,
      results: {
        broken: { ok: false, error: "failed to start broken" },
        success: { ok: true, result: null },
      },
    });
  });
});
