import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { DiagnosticStore } from "../../src/lsp/diagnosticStore.js";
import { DocumentStore, filePathToUri } from "../../src/lsp/documentStore.js";
import { LspRequestTimeoutError, type LspRequestOptions } from "../../src/lsp/session.js";
import { LspSessionManager } from "../../src/lsp/sessionManager.js";
import type { AcquiredLspSession, ManagedLspSession } from "../../src/lsp/sessionManager.js";
import {
  createDiagnosticsToolHandler,
  lspDiagnosticsTool,
} from "../../src/tools/diagnosticTools.js";

interface FakeSession extends ManagedLspSession {
  requests: { method: string; params: unknown }[];
  requestOptions: Array<LspRequestOptions | undefined>;
  notifications: { method: string; params: unknown }[];
  publish(uri: string, diagnostics: unknown[]): void;
}

function createSession(
  options: {
    capabilities?: Record<string, unknown>;
    responses?: Record<string, unknown>;
    requestErrors?: Record<string, Error>;
  } = {},
): FakeSession {
  const handlers = new Map<string, (params: unknown) => void>();
  return {
    capabilities: options.capabilities ?? {},
    requests: [],
    notifications: [],
    requestOptions: [],
    async start() {},
    async shutdown() {},
    onNotification(method, handler) {
      handlers.set(method, handler);
      return { dispose: () => handlers.delete(method) };
    },
    async sendNotification(method, params) {
      this.notifications.push({ method, params });
      if (method === "textDocument/didOpen" && options.responses?.publishOnOpen) {
        const uri = (params as { textDocument: { uri: string } }).textDocument.uri;
        queueMicrotask(() => this.publish(uri, options.responses?.publishOnOpen as unknown[]));
      }
    },
    async sendRequest<T = unknown>(
      method: string,
      params?: unknown,
      requestOptions?: LspRequestOptions,
    ): Promise<T> {
      this.requests.push({ method, params });
      this.requestOptions.push(requestOptions);
      const error = options.requestErrors?.[method];
      if (error) {
        throw error;
      }
      return options.responses?.[method] as T;
    },
    publish(uri, diagnostics) {
      handlers.get("textDocument/publishDiagnostics")?.({ uri, diagnostics });
    },
  };
}

function acquired(serverId: string, session: ManagedLspSession, workspaceRoot: string) {
  return {
    serverId,
    workspaceRoot,
    session,
    languageIds: ["typescript"],
    extensions: [".ts"],
  } satisfies AcquiredLspSession;
}

async function createWorkspaceFile() {
  const workspaceRoot = await mkdtemp(resolve(tmpdir(), "lsp-mcp-diagnostics-"));
  const filePath = resolve(workspaceRoot, "app.ts");
  await writeFile(filePath, "const value: string = 1;\n", "utf8");
  return { workspaceRoot, filePath };
}

function createHandler(sessions: AcquiredLspSession[], waitMs = 25) {
  return createDiagnosticsToolHandler({
    sessionManager: {
      getSessionsForFile: vi.fn(async () => sessions),
      getSessionsForWorkspace: vi.fn(async () => sessions),
    },
    documentStore: new DocumentStore(),
    diagnosticStore: new DiagnosticStore(),
    diagnosticsWaitMs: waitMs,
  });
}

describe("lsp_diagnostics", () => {
  it("returns cached push diagnostics for push-only servers", async () => {
    const { workspaceRoot, filePath } = await createWorkspaceFile();
    const session = createSession();
    const store = new DiagnosticStore();
    store.watchSession("ts", session);
    session.publish(filePathToUri(filePath), [
      {
        range: { start: { line: 0, character: 6 }, end: { line: 0, character: 11 } },
        severity: 1,
        message: "Type mismatch",
        source: "fake-ts",
      },
    ]);
    const handler = createDiagnosticsToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => [acquired("ts", session, workspaceRoot)]),
        getSessionsForWorkspace: vi.fn(async () => []),
      },
      documentStore: new DocumentStore(),
      diagnosticStore: store,
      diagnosticsWaitMs: 25,
    });

    const result = await handler({ workspaceRoot, filePath });

    expect(result).toMatchObject({
      ok: true,
      results: {
        ts: {
          ok: true,
          mode: "push-cache",
          uri: filePathToUri(filePath),
          filePath,
          diagnostics: [
            {
              range: { start: { line: 1, character: 7 }, end: { line: 1, character: 12 } },
              severity: 1,
              message: "Type mismatch",
              source: "fake-ts",
            },
          ],
        },
      },
    });
  });

  it("uses textDocument diagnostic pull when supported", async () => {
    const { workspaceRoot, filePath } = await createWorkspaceFile();
    const session = createSession({
      capabilities: {
        diagnosticProvider: { interFileDependencies: false, workspaceDiagnostics: false },
      },
      responses: {
        "textDocument/diagnostic": {
          kind: "full",
          items: [
            {
              range: { start: { line: 1, character: 0 }, end: { line: 1, character: 5 } },
              message: "Pulled diagnostic",
            },
          ],
        },
      },
    });
    const handler = createHandler([acquired("ts", session, workspaceRoot)]);

    const result = await handler({ workspaceRoot, filePath });

    expect(session.requests).toEqual([
      {
        method: "textDocument/diagnostic",
        params: { textDocument: { uri: filePathToUri(filePath) } },
      },
    ]);
    expect(result.results.ts).toMatchObject({
      ok: true,
      mode: "pull",
      diagnostics: [
        { range: { start: { line: 2, character: 1 }, end: { line: 2, character: 6 } } },
      ],
    });
  });

  it("passes tool cancellation signal to diagnostic pull requests", async () => {
    const { workspaceRoot, filePath } = await createWorkspaceFile();
    const signal = new AbortController().signal;
    const session = createSession({
      capabilities: { diagnosticProvider: true },
      responses: { "textDocument/diagnostic": { kind: "full", items: [] } },
    });
    const handler = createHandler([acquired("ts", session, workspaceRoot)]);

    await handler({ workspaceRoot, filePath }, { signal });

    expect(session.requestOptions[0]).toEqual({ signal });
  });

  it("preserves structured timeout errors", async () => {
    const { workspaceRoot, filePath } = await createWorkspaceFile();
    const session = createSession({
      capabilities: { diagnosticProvider: true },
      requestErrors: {
        "textDocument/diagnostic": new LspRequestTimeoutError("textDocument/diagnostic", 30),
      },
    });
    const handler = createHandler([acquired("ts", session, workspaceRoot)]);

    const result = await handler({ workspaceRoot, filePath });

    expect(result.results.ts).toMatchObject({
      ok: false,
      error: expect.stringContaining("timed out"),
      code: "LSP_REQUEST_TIMEOUT",
      method: "textDocument/diagnostic",
      timeoutMs: 30,
    });
  });

  it("opens the document before pull diagnostics requests", async () => {
    const { workspaceRoot, filePath } = await createWorkspaceFile();
    const session = createSession({
      capabilities: { diagnosticProvider: true },
      responses: { "textDocument/diagnostic": { kind: "full", items: [] } },
    });
    const handler = createHandler([acquired("ts", session, workspaceRoot)]);

    await handler({ workspaceRoot, filePath });

    expect(session.notifications[0]).toMatchObject({ method: "textDocument/didOpen" });
    expect(session.requests[0]).toMatchObject({ method: "textDocument/diagnostic" });
  });

  it("normalizes related diagnostic location ranges with uri and filePath metadata", async () => {
    const { workspaceRoot, filePath } = await createWorkspaceFile();
    const session = createSession({
      capabilities: { diagnosticProvider: true },
      responses: {
        "textDocument/diagnostic": {
          kind: "full",
          items: [
            {
              range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
              message: "Related issue",
              relatedInformation: [
                {
                  location: {
                    uri: filePathToUri(filePath),
                    range: { start: { line: 2, character: 1 }, end: { line: 2, character: 6 } },
                  },
                  message: "Related location",
                },
              ],
            },
          ],
        },
      },
    });
    const handler = createHandler([acquired("ts", session, workspaceRoot)]);

    const result = await handler({ workspaceRoot, filePath });

    expect(result.results.ts).toMatchObject({
      ok: true,
      diagnostics: [
        {
          range: { start: { line: 1, character: 1 }, end: { line: 1, character: 6 } },
          relatedInformation: [
            {
              location: {
                uri: filePathToUri(filePath),
                filePath,
                range: { start: { line: 3, character: 2 }, end: { line: 3, character: 7 } },
              },
            },
          ],
        },
      ],
    });
  });

  it("resolves relative diagnostic file paths against workspaceRoot", async () => {
    const { workspaceRoot, filePath } = await createWorkspaceFile();
    const session = createSession({
      capabilities: { diagnosticProvider: true },
      responses: { "textDocument/diagnostic": { kind: "full", items: [] } },
    });
    const handler = createHandler([acquired("ts", session, workspaceRoot)]);

    const result = await handler({ workspaceRoot, filePath: "app.ts" });

    expect(session.notifications[0]).toMatchObject({
      method: "textDocument/didOpen",
      params: { textDocument: { uri: filePathToUri(filePath) } },
    });
    expect(session.requests[0]).toEqual({
      method: "textDocument/diagnostic",
      params: { textDocument: { uri: filePathToUri(filePath) } },
    });
    expect(result.results.ts).toMatchObject({ ok: true, filePath });
  });

  it("opens a document and reports empty diagnostics after bounded push wait timeout", async () => {
    const { workspaceRoot, filePath } = await createWorkspaceFile();
    const session = createSession();
    const handler = createHandler([acquired("ts", session, workspaceRoot)], 5);

    const result = await handler({ workspaceRoot, filePath });

    expect(session.notifications[0]).toMatchObject({ method: "textDocument/didOpen" });
    expect(result.results.ts).toMatchObject({ ok: true, mode: "push-wait", diagnostics: [] });
  });

  it("uses configured diagnostics wait timeout when no explicit handler timeout is provided", async () => {
    vi.useFakeTimers();
    const { workspaceRoot, filePath } = await createWorkspaceFile();
    const session = createSession();
    const waitFor = vi.fn(async () => undefined);
    const store = new DiagnosticStore();
    store.waitFor = waitFor;
    const handler = createDiagnosticsToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => [acquired("ts", session, workspaceRoot)]),
        getSessionsForWorkspace: vi.fn(async () => []),
      },
      documentStore: new DocumentStore(),
      diagnosticStore: store,
      config: { sessions: { diagnosticsWaitMs: 123 } },
    });

    await handler({ workspaceRoot, filePath });

    expect(waitFor).toHaveBeenCalledWith("ts", filePathToUri(filePath), 123);
    vi.useRealTimers();
  });

  it("preserves partial failures per server", async () => {
    const { workspaceRoot, filePath } = await createWorkspaceFile();
    const good = createSession({
      capabilities: { diagnosticProvider: true },
      responses: { "textDocument/diagnostic": { kind: "full", items: [] } },
    });
    const bad = createSession({
      capabilities: { diagnosticProvider: true },
      requestErrors: { "textDocument/diagnostic": new Error("diagnostics exploded") },
    });
    const handler = createHandler([
      acquired("good", good, workspaceRoot),
      acquired("bad", bad, workspaceRoot),
    ]);

    const result = await handler({ workspaceRoot, filePath });

    expect(result.ok).toBe(false);
    expect(result.results.good).toMatchObject({ ok: true, mode: "pull", diagnostics: [] });
    expect(result.results.bad).toEqual({ ok: false, error: "diagnostics exploded" });
  });

  it("preserves partial failures when one matching server fails acquisition", async () => {
    const { workspaceRoot, filePath } = await createWorkspaceFile();
    const good = createSession({
      capabilities: { diagnosticProvider: true },
      responses: { "textDocument/diagnostic": { kind: "full", items: [] } },
    });
    const manager = new LspSessionManager({
      config: {
        lsp: {
          servers: {
            good: { command: "good-ls", extensions: [".ts"] },
            bad: { command: "bad-ls", extensions: [".ts"] },
          },
        },
      },
      commandResolver: async ({ serverId, server }) => ({
        status: "ready" as const,
        source: "configured" as const,
        command: server.command ?? serverId,
        args: [],
      }),
      sessionFactory: (options) => {
        if (options.command === "bad-ls") {
          return {
            async start() {
              throw new Error("bad failed to start");
            },
            async shutdown() {},
            onNotification() {
              return { dispose() {} };
            },
            async sendNotification() {},
            async sendRequest<T>() {
              return undefined as T;
            },
          };
        }
        return good;
      },
    });
    const handler = createDiagnosticsToolHandler({
      sessionManager: manager,
      documentStore: new DocumentStore(),
      diagnosticStore: new DiagnosticStore(),
      diagnosticsWaitMs: 5,
    });

    const result = await handler({ workspaceRoot, filePath });

    expect(result.ok).toBe(false);
    expect(result.results.good).toMatchObject({ ok: true, mode: "pull", diagnostics: [] });
    expect(result.results.bad).toEqual({ ok: false, error: "bad failed to start" });
  });

  it("reports unsupported workspace diagnostics when no file path is provided", async () => {
    const { workspaceRoot } = await createWorkspaceFile();
    const session = createSession();
    const handler = createHandler([acquired("ts", session, workspaceRoot)]);

    const result = await handler({ workspaceRoot });

    expect(result).toEqual({
      ok: false,
      results: {
        ts: {
          ok: false,
          error:
            "Workspace diagnostics require filePath unless the server supports workspace/diagnostic",
        },
      },
    });
  });

  it("exports an importable lsp_diagnostics tool descriptor", () => {
    expect(lspDiagnosticsTool.name).toBe("lsp_diagnostics");
    expect(lspDiagnosticsTool.inputSchema.parse({ workspaceRoot: "/workspace" })).toEqual({
      workspaceRoot: "/workspace",
    });
  });
});
