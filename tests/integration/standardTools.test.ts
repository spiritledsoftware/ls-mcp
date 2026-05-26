import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { DocumentStore } from "../../src/lsp/documentStore.js";
import { ServerResolutionError } from "../../src/lsp/serverIdentity.js";
import { LspRequestTimeoutError } from "../../src/lsp/session.js";
import type { AcquiredLspSession, ManagedLspSession } from "../../src/lsp/sessionManager.js";
import type { LspRequestOptions } from "../../src/lsp/session.js";
import { createStandardToolHandler } from "../../src/tools/standardTools.js";

interface FakeSession extends ManagedLspSession {
  requests: { method: string; params: unknown }[];
  requestOptions: Array<LspRequestOptions | undefined>;
  notifications: { method: string; params: unknown }[];
  responses: Record<string, unknown>;
}

function createSession(responses: Record<string, unknown>, capabilities: Record<string, unknown>) {
  const session: FakeSession = {
    capabilities,
    requests: [],
    requestOptions: [],
    notifications: [],
    async start() {},
    async shutdown() {},
    onNotification() {
      return { dispose() {} };
    },
    async sendNotification(method, params) {
      this.notifications.push({ method, params });
    },
    async sendRequest<T = unknown>(
      method: string,
      params?: unknown,
      options?: LspRequestOptions,
    ): Promise<T> {
      this.requests.push({ method, params });
      this.requestOptions.push(options);
      const response = this.responses[method];
      if (response instanceof Error) {
        throw response;
      }
      return response as T;
    },
    responses,
  };
  return session;
}

function acquired(
  serverId: string,
  session: ManagedLspSession,
  workspaceRoot = "/workspace",
): AcquiredLspSession {
  return {
    serverId,
    workspaceRoot,
    session,
    languageIds: ["typescript"],
    extensions: [".ts"],
  };
}

function serverResolutionError(
  serverId: string,
  code: "unknown_server" | "ambiguous_server" = "unknown_server",
) {
  return new ServerResolutionError({
    code,
    serverId,
    message: `${code === "unknown_server" ? "Unknown" : "Ambiguous"} LSP server "${serverId}".`,
    suggestions: [
      {
        id: "typescript-language-server",
        score: 80,
        reasons: ["prefix match"],
        aliases: ["typescript"],
        aliasDetails: [{ value: "typescript", kind: "language-id" }],
        languageIds: ["typescript"],
        extensions: [".ts"],
      },
    ],
  });
}

async function createWorkspaceFile() {
  const workspaceRoot = await mkdtemp(resolve(tmpdir(), "lsp-mcp-tools-"));
  const filePath = resolve(workspaceRoot, "app.ts");
  await writeFile(filePath, "const value = 1;\n", "utf8");
  return { workspaceRoot, filePath };
}

async function createWorkspaceAndOutsideFile() {
  const { workspaceRoot } = await createWorkspaceFile();
  const outsideRoot = await mkdtemp(resolve(tmpdir(), "lsp-mcp-tools-outside-"));
  const outsidePath = resolve(outsideRoot, "app.ts");
  await writeFile(outsidePath, "const outside = 1;\n", "utf8");
  return { workspaceRoot, outsidePath };
}

describe("standard tool forwarding", () => {
  it("fails clearly when no LSP sessions match", async () => {
    const { workspaceRoot, filePath } = await createWorkspaceFile();
    const handler = createStandardToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => []),
        getSessionsForWorkspace: vi.fn(async () => []),
      },
      documentStore: new DocumentStore(),
    });

    const result = await handler("hover", { workspaceRoot, filePath, line: 1, character: 1 });

    expect(result).toEqual({
      ok: false,
      results: {},
      error: "No matching LSP servers for hover",
    });
  });

  it("returns structured acquisition failures instead of throwing", async () => {
    const { workspaceRoot, filePath } = await createWorkspaceFile();
    const handler = createStandardToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => {
          throw new LspRequestTimeoutError("initialize", 25);
        }),
        getSessionsForWorkspace: vi.fn(async () => []),
      },
      documentStore: new DocumentStore(),
    });

    const result = await handler("hover", { workspaceRoot, filePath, line: 1, character: 1 });

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

  it("preserves structured server resolution errors", async () => {
    const { workspaceRoot, filePath } = await createWorkspaceFile();
    const handler = createStandardToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => {
          throw serverResolutionError("typescrip");
        }),
        getSessionsForWorkspace: vi.fn(async () => []),
      },
      documentStore: new DocumentStore(),
    });

    const result = await handler("hover", {
      workspaceRoot,
      filePath,
      line: 1,
      character: 1,
      serverId: "typescrip",
    });

    expect(result.results.acquisition).toMatchObject({
      ok: false,
      code: "unknown_server",
      serverId: "typescrip",
      suggestions: [expect.objectContaining({ id: "typescript-language-server" })],
    });
  });

  it("preserves ambiguous server resolution errors", async () => {
    const { workspaceRoot, filePath } = await createWorkspaceFile();
    const handler = createStandardToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => {
          throw serverResolutionError("javascript", "ambiguous_server");
        }),
        getSessionsForWorkspace: vi.fn(async () => []),
      },
      documentStore: new DocumentStore(),
    });

    const result = await handler("hover", {
      workspaceRoot,
      filePath,
      line: 1,
      character: 1,
      serverId: "javascript",
    });

    expect(result.results.acquisition).toMatchObject({
      ok: false,
      code: "ambiguous_server",
      serverId: "javascript",
      suggestions: [expect.objectContaining({ id: "typescript-language-server" })],
    });
  });

  it("returns partial acquisition failures for multi-server tools by default", async () => {
    const { workspaceRoot, filePath } = await createWorkspaceFile();
    const session = createSession(
      { "textDocument/hover": { contents: "ok" } },
      { hoverProvider: true },
    );
    const handler = createStandardToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => {
          throw new Error("strict path should not run");
        }),
        getSessionsForFileSettled: vi.fn(async () => [
          { ok: true as const, value: acquired("typescript", session, workspaceRoot) },
          { ok: false as const, value: { serverId: "go", error: "gopls is not available" } },
        ]),
        getSessionsForWorkspace: vi.fn(async () => []),
        getSessionsForWorkspaceSettled: vi.fn(async () => []),
      },
      documentStore: new DocumentStore(),
    });

    const result = await handler("hover", { workspaceRoot, filePath, line: 1, character: 1 });

    expect(result).toMatchObject({
      ok: true,
      results: {
        typescript: { ok: true, result: { contents: "ok" } },
        go: { ok: false, error: "gopls is not available" },
      },
    });
  });

  it("uses strict acquisition when strict is true", async () => {
    const { workspaceRoot, filePath } = await createWorkspaceFile();
    const handler = createStandardToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => {
          throw new Error("gopls is not available");
        }),
        getSessionsForFileSettled: vi.fn(async () => []),
        getSessionsForWorkspace: vi.fn(async () => []),
        getSessionsForWorkspaceSettled: vi.fn(async () => []),
      },
      documentStore: new DocumentStore(),
    });

    const result = await handler("hover", {
      workspaceRoot,
      filePath,
      line: 1,
      character: 1,
      strict: true,
    });

    expect(result).toMatchObject({
      ok: false,
      results: { acquisition: { ok: false, error: "gopls is not available" } },
    });
  });

  it("uses file matching for workspace symbols when filePath or languageId is provided", async () => {
    const { workspaceRoot, filePath } = await createWorkspaceFile();
    const session = createSession(
      { "workspace/symbol": [{ name: "createMcpServer", kind: 12 }] },
      { workspaceSymbolProvider: true },
    );
    const getSessionsForFileSettled = vi.fn(async () => [
      { ok: true as const, value: acquired("typescript", session, workspaceRoot) },
    ]);
    const getSessionsForWorkspaceSettled = vi.fn(async () => []);
    const handler = createStandardToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => []),
        getSessionsForFileSettled,
        getSessionsForWorkspace: vi.fn(async () => []),
        getSessionsForWorkspaceSettled,
      },
      documentStore: new DocumentStore(),
    });

    const result = await handler("workspace_symbols", {
      workspaceRoot,
      filePath,
      languageId: "typescript",
      query: "createMcpServer",
    });

    expect(result.ok).toBe(true);
    expect(getSessionsForFileSettled).toHaveBeenCalledWith({
      workspaceRoot,
      filePath,
      languageId: "typescript",
      serverId: undefined,
    });
    expect(getSessionsForWorkspaceSettled).not.toHaveBeenCalled();
  });

  it("preserves aggregation key order from acquired sessions", async () => {
    const { workspaceRoot, filePath } = await createWorkspaceFile();
    const slow = createSession(
      { "textDocument/hover": { contents: "slow" } },
      { hoverProvider: true },
    );
    const fast = createSession(
      { "textDocument/hover": { contents: "fast" } },
      { hoverProvider: true },
    );
    const originalSlowRequest = slow.sendRequest.bind(slow);
    slow.sendRequest = async <T = unknown>(method: string, params?: unknown): Promise<T> => {
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 20));
      return originalSlowRequest<T>(method, params);
    };
    const handler = createStandardToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => [
          acquired("slow", slow, workspaceRoot),
          acquired("fast", fast, workspaceRoot),
        ]),
        getSessionsForWorkspace: vi.fn(async () => []),
      },
      documentStore: new DocumentStore(),
    });

    const result = await handler("hover", { workspaceRoot, filePath, line: 1, character: 1 });

    expect(Object.keys(result.results)).toEqual(["slow", "fast"]);
  });

  it("forwards hover requests after opening the document", async () => {
    const { workspaceRoot, filePath } = await createWorkspaceFile();
    const session = createSession(
      {
        "textDocument/hover": {
          contents: { kind: "markdown", value: "value: number" },
          range: { start: { line: 0, character: 6 }, end: { line: 0, character: 11 } },
        },
      },
      { hoverProvider: true },
    );
    const manager = {
      getSessionsForFile: vi.fn(async () => [acquired("ts", session, workspaceRoot)]),
      getSessionsForWorkspace: vi.fn(async () => [acquired("ts", session, workspaceRoot)]),
    };

    const handler = createStandardToolHandler({
      sessionManager: manager,
      documentStore: new DocumentStore(),
    });
    const result = await handler("hover", { workspaceRoot, filePath, line: 1, character: 7 });

    expect(session.notifications[0]).toMatchObject({ method: "textDocument/didOpen" });
    expect(session.requests[0]).toEqual({
      method: "textDocument/hover",
      params: {
        textDocument: { uri: expect.stringMatching(/app\.ts$/) },
        position: { line: 0, character: 6 },
      },
    });
    expect(result).toMatchObject({
      ok: true,
      results: {
        ts: {
          ok: true,
          result: {
            range: {
              start: { line: 1, character: 7 },
              end: { line: 1, character: 12 },
            },
          },
        },
      },
    });
  });

  it("rejects document reads outside the workspace by default", async () => {
    const { workspaceRoot, outsidePath } = await createWorkspaceAndOutsideFile();
    const session = createSession(
      { "textDocument/hover": { contents: "outside" } },
      { hoverProvider: true },
    );
    const manager = {
      getSessionsForFile: vi.fn(async () => [acquired("ts", session, workspaceRoot)]),
      getSessionsForWorkspace: vi.fn(async () => []),
    };
    const handler = createStandardToolHandler({
      sessionManager: manager,
      documentStore: new DocumentStore(),
    });

    const result = await handler("hover", {
      workspaceRoot,
      filePath: outsidePath,
      line: 1,
      character: 1,
    });

    expect(result).toMatchObject({
      ok: false,
      results: {
        validation: {
          ok: false,
          error: expect.stringContaining("outside workspace root"),
        },
      },
    });
    expect(manager.getSessionsForFile).not.toHaveBeenCalled();
    expect(session.notifications).toEqual([]);
  });

  it("allows document reads outside the workspace when configured", async () => {
    const { workspaceRoot, outsidePath } = await createWorkspaceAndOutsideFile();
    const session = createSession(
      { "textDocument/hover": { contents: "outside" } },
      { hoverProvider: true },
    );
    const handler = createStandardToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => [acquired("ts", session, workspaceRoot)]),
        getSessionsForWorkspace: vi.fn(async () => []),
      },
      documentStore: new DocumentStore(),
      security: { allowExternalFiles: true },
    });

    const result = await handler("hover", {
      workspaceRoot,
      filePath: outsidePath,
      line: 1,
      character: 1,
    });

    expect(result.ok).toBe(true);
    expect(session.notifications[0]).toMatchObject({ method: "textDocument/didOpen" });
    expect(session.requests[0]).toMatchObject({ method: "textDocument/hover" });
  });

  it("passes tool cancellation signal to LSP requests", async () => {
    const { workspaceRoot, filePath } = await createWorkspaceFile();
    const signal = new AbortController().signal;
    const session = createSession(
      { "textDocument/hover": { contents: "ok" } },
      { hoverProvider: true },
    );
    const handler = createStandardToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => [acquired("ts", session, workspaceRoot)]),
        getSessionsForWorkspace: vi.fn(async () => []),
      },
      documentStore: new DocumentStore(),
    });

    await handler("hover", { workspaceRoot, filePath, line: 1, character: 1 }, { signal });

    expect(session.requestOptions[0]).toEqual({ signal });
  });

  it("preserves structured timeout errors", async () => {
    const { workspaceRoot, filePath } = await createWorkspaceFile();
    const session = createSession(
      { "textDocument/hover": new LspRequestTimeoutError("textDocument/hover", 25) },
      { hoverProvider: true },
    );
    const handler = createStandardToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => [acquired("ts", session, workspaceRoot)]),
        getSessionsForWorkspace: vi.fn(async () => []),
      },
      documentStore: new DocumentStore(),
    });

    const result = await handler("hover", { workspaceRoot, filePath, line: 1, character: 1 });

    expect(result.results.ts).toMatchObject({
      ok: false,
      error: expect.stringContaining("timed out"),
      code: "LSP_REQUEST_TIMEOUT",
      method: "textDocument/hover",
      timeoutMs: 25,
    });
  });

  it("normalizes definition and references locations", async () => {
    const { workspaceRoot, filePath } = await createWorkspaceFile();
    const uri = `file://${filePath}`;
    const session = createSession(
      {
        "textDocument/definition": {
          uri,
          range: { start: { line: 1, character: 2 }, end: { line: 1, character: 7 } },
        },
        "textDocument/references": [
          { uri, range: { start: { line: 2, character: 0 }, end: { line: 2, character: 5 } } },
        ],
      },
      { definitionProvider: true, referencesProvider: true },
    );
    const handler = createStandardToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => [acquired("ts", session, workspaceRoot)]),
        getSessionsForWorkspace: vi.fn(async () => [acquired("ts", session, workspaceRoot)]),
      },
      documentStore: new DocumentStore(),
    });

    const definition = await handler("definition", {
      workspaceRoot,
      filePath,
      line: 1,
      character: 1,
    });
    const references = await handler("references", {
      workspaceRoot,
      filePath,
      line: 1,
      character: 1,
    });

    expect(definition.results.ts).toMatchObject({ ok: true });
    expect(references.results.ts).toMatchObject({ ok: true });
    if (!definition.results.ts.ok || !references.results.ts.ok) {
      throw new Error("expected successful definition and references results");
    }
    expect(definition.results.ts.result).toMatchObject({
      filePath,
      uri,
      range: { start: { line: 2, character: 3 }, end: { line: 2, character: 8 } },
      outsideWorkspace: false,
    });
    expect((references.results.ts.result as unknown[])[0]).toMatchObject({
      filePath,
      range: { start: { line: 3, character: 1 }, end: { line: 3, character: 6 } },
    });
  });

  it("returns document symbols and preserves successes when another server fails", async () => {
    const { workspaceRoot, filePath } = await createWorkspaceFile();
    const good = createSession(
      {
        "textDocument/documentSymbol": [
          {
            name: "value",
            kind: 13,
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 16 } },
            selectionRange: { start: { line: 0, character: 6 }, end: { line: 0, character: 11 } },
          },
        ],
      },
      { documentSymbolProvider: true },
    );
    const bad = createSession(
      { "textDocument/documentSymbol": new Error("server exploded") },
      { documentSymbolProvider: true },
    );
    const handler = createStandardToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => [
          acquired("good", good, workspaceRoot),
          acquired("bad", bad, workspaceRoot),
        ]),
        getSessionsForWorkspace: vi.fn(async () => [
          acquired("good", good, workspaceRoot),
          acquired("bad", bad, workspaceRoot),
        ]),
      },
      documentStore: new DocumentStore(),
    });

    const result = await handler("document_symbols", { workspaceRoot, filePath });

    expect(result.ok).toBe(true);
    expect(result.results.good).toMatchObject({
      ok: true,
      result: [
        {
          name: "value",
          range: { start: { line: 1, character: 1 }, end: { line: 1, character: 17 } },
          selectionRange: { start: { line: 1, character: 7 }, end: { line: 1, character: 12 } },
        },
      ],
    });
    expect(result.results.bad).toEqual({ ok: false, error: "server exploded" });
  });

  it("builds method-specific params for color, selection range, and inline value requests", async () => {
    const { workspaceRoot, filePath } = await createWorkspaceFile();
    const session = createSession(
      {
        "textDocument/colorPresentation": [],
        "textDocument/selectionRange": [],
        "textDocument/inlineValue": [],
      },
      { colorProvider: true, selectionRangeProvider: true, inlineValueProvider: true },
    );
    const handler = createStandardToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => [acquired("ts", session, workspaceRoot)]),
        getSessionsForWorkspace: vi.fn(async () => [acquired("ts", session, workspaceRoot)]),
      },
      documentStore: new DocumentStore(),
    });

    await handler("color_presentation", {
      workspaceRoot,
      filePath,
      startLine: 1,
      startCharacter: 2,
      endLine: 1,
      endCharacter: 6,
      color: { red: 1, green: 0.5, blue: 0, alpha: 1 },
    });
    await handler("selection_ranges", {
      workspaceRoot,
      filePath,
      positions: [
        { line: 1, character: 1 },
        { line: 1, character: 7 },
      ],
    });
    await handler("inline_values", {
      workspaceRoot,
      filePath,
      startLine: 1,
      startCharacter: 1,
      endLine: 1,
      endCharacter: 10,
      context: {
        frameId: 3,
        stoppedLocation: { startLine: 1, startCharacter: 1, endLine: 1, endCharacter: 6 },
      },
    });

    expect(session.requests).toEqual([
      {
        method: "textDocument/colorPresentation",
        params: {
          textDocument: { uri: expect.stringMatching(/app\.ts$/) },
          color: { red: 1, green: 0.5, blue: 0, alpha: 1 },
          range: { start: { line: 0, character: 1 }, end: { line: 0, character: 5 } },
        },
      },
      {
        method: "textDocument/selectionRange",
        params: {
          textDocument: { uri: expect.stringMatching(/app\.ts$/) },
          positions: [
            { line: 0, character: 0 },
            { line: 0, character: 6 },
          ],
        },
      },
      {
        method: "textDocument/inlineValue",
        params: {
          textDocument: { uri: expect.stringMatching(/app\.ts$/) },
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 9 } },
          context: {
            frameId: 3,
            stoppedLocation: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
          },
        },
      },
    ]);
  });

  it("rejects out-of-range colors and descending ranges", async () => {
    const { workspaceRoot, filePath } = await createWorkspaceFile();
    const session = createSession({}, { colorProvider: true, inlayHintProvider: true });
    const handler = createStandardToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => [acquired("ts", session, workspaceRoot)]),
        getSessionsForWorkspace: vi.fn(async () => []),
      },
      documentStore: new DocumentStore(),
    });

    await expect(
      handler("color_presentation", {
        workspaceRoot,
        filePath,
        startLine: 1,
        startCharacter: 1,
        endLine: 1,
        endCharacter: 2,
        color: { red: 1.1, green: 0, blue: 0, alpha: 1 },
      }),
    ).rejects.toThrow();
    await expect(
      handler("inlay_hints", {
        workspaceRoot,
        filePath,
        startLine: 3,
        startCharacter: 1,
        endLine: 2,
        endCharacter: 1,
      }),
    ).rejects.toThrow("end must not precede start");
    await expect(
      handler("inline_values", {
        workspaceRoot,
        filePath,
        startLine: 1,
        startCharacter: 1,
        endLine: 1,
        endCharacter: 2,
        context: {
          frameId: 1,
          stoppedLocation: {
            startLine: 5,
            startCharacter: 1,
            endLine: 4,
            endCharacter: 1,
          },
        },
      }),
    ).rejects.toThrow("end must not precede start");
  });

  it("converts inline value stoppedLocation from one-based MCP range to zero-based LSP range", async () => {
    const { workspaceRoot, filePath } = await createWorkspaceFile();
    const session = createSession(
      { "textDocument/inlineValue": [] },
      { inlineValueProvider: true },
    );
    const handler = createStandardToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => [acquired("ts", session, workspaceRoot)]),
        getSessionsForWorkspace: vi.fn(async () => [acquired("ts", session, workspaceRoot)]),
      },
      documentStore: new DocumentStore(),
    });

    await handler("inline_values", {
      workspaceRoot,
      filePath,
      startLine: 2,
      startCharacter: 3,
      endLine: 4,
      endCharacter: 5,
      context: {
        frameId: 7,
        stoppedLocation: { startLine: 10, startCharacter: 2, endLine: 10, endCharacter: 9 },
      },
    });

    expect(session.requests[0]).toMatchObject({
      method: "textDocument/inlineValue",
      params: {
        range: { start: { line: 1, character: 2 }, end: { line: 3, character: 4 } },
        context: {
          frameId: 7,
          stoppedLocation: { start: { line: 9, character: 1 }, end: { line: 9, character: 8 } },
        },
      },
    });
  });

  it("aggregates call hierarchy prepare without serverId", async () => {
    const { workspaceRoot, filePath } = await createWorkspaceFile();
    const first = createSession(
      { "textDocument/prepareCallHierarchy": [] },
      { callHierarchyProvider: true },
    );
    const second = createSession(
      { "textDocument/prepareCallHierarchy": [] },
      { callHierarchyProvider: true },
    );
    const handler = createStandardToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => [
          acquired("first", first, workspaceRoot),
          acquired("second", second, workspaceRoot),
        ]),
        getSessionsForWorkspace: vi.fn(async () => []),
      },
      documentStore: new DocumentStore(),
    });

    const result = await handler("call_hierarchy_prepare", {
      workspaceRoot,
      filePath,
      line: 1,
      character: 1,
    });

    expect(result.ok).toBe(true);
    expect(Object.keys(result.results)).toEqual(["first", "second"]);
  });

  it("builds semantic tokens full delta params", async () => {
    const { workspaceRoot, filePath } = await createWorkspaceFile();
    const session = createSession(
      { "textDocument/semanticTokens/full/delta": { edits: [] } },
      { semanticTokensProvider: { full: { delta: true } } },
    );
    const handler = createStandardToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => [acquired("ts", session, workspaceRoot)]),
        getSessionsForWorkspace: vi.fn(async () => []),
      },
      documentStore: new DocumentStore(),
    });

    await handler("semantic_tokens_full_delta", {
      workspaceRoot,
      filePath,
      previousResultId: "abc",
    });

    expect(session.requests[0]).toEqual({
      method: "textDocument/semanticTokens/full/delta",
      params: {
        textDocument: { uri: expect.stringMatching(/app\.ts$/) },
        previousResultId: "abc",
      },
    });
  });

  it("wraps call and type hierarchy item params", async () => {
    const { workspaceRoot } = await createWorkspaceFile();
    const item = { name: "value", uri: `file://${workspaceRoot}/app.ts` };
    const session = createSession(
      {
        "callHierarchy/incomingCalls": [],
        "callHierarchy/outgoingCalls": [],
        "typeHierarchy/supertypes": [],
        "typeHierarchy/subtypes": [],
      },
      { callHierarchyProvider: true, typeHierarchyProvider: true },
    );
    const handler = createStandardToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => [acquired("ts", session, workspaceRoot)]),
        getSessionsForWorkspace: vi.fn(async () => [acquired("ts", session, workspaceRoot)]),
      },
      documentStore: new DocumentStore(),
    });

    await handler("call_hierarchy_incoming", { workspaceRoot, serverId: "ts", item });
    await handler("call_hierarchy_outgoing", { workspaceRoot, serverId: "ts", item });
    await handler("type_hierarchy_supertypes", { workspaceRoot, serverId: "ts", item });
    await handler("type_hierarchy_subtypes", { workspaceRoot, serverId: "ts", item });

    expect(session.requests).toEqual([
      { method: "callHierarchy/incomingCalls", params: { item } },
      { method: "callHierarchy/outgoingCalls", params: { item } },
      { method: "typeHierarchy/supertypes", params: { item } },
      { method: "typeHierarchy/subtypes", params: { item } },
    ]);
  });

  it("normalizes LocationLink target locations", async () => {
    const { workspaceRoot, filePath } = await createWorkspaceFile();
    const uri = `file://${filePath}`;
    const session = createSession(
      {
        "textDocument/definition": [
          {
            targetUri: uri,
            targetRange: { start: { line: 4, character: 0 }, end: { line: 4, character: 8 } },
            targetSelectionRange: {
              start: { line: 4, character: 2 },
              end: { line: 4, character: 7 },
            },
          },
        ],
      },
      { definitionProvider: true },
    );
    const handler = createStandardToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => [acquired("ts", session, workspaceRoot)]),
        getSessionsForWorkspace: vi.fn(async () => [acquired("ts", session, workspaceRoot)]),
      },
      documentStore: new DocumentStore(),
    });

    const result = await handler("definition", { workspaceRoot, filePath, line: 1, character: 1 });

    expect(result.results.ts).toMatchObject({ ok: true });
    if (!result.results.ts.ok) {
      throw new Error("expected definition result");
    }
    expect((result.results.ts.result as unknown[])[0]).toMatchObject({
      targetUri: uri,
      targetFilePath: filePath,
      targetOutsideWorkspace: false,
      targetRange: { start: { line: 5, character: 1 }, end: { line: 5, character: 9 } },
      targetSelectionRange: { start: { line: 5, character: 3 }, end: { line: 5, character: 8 } },
    });
  });

  it("does not mark workspace paths starting with dot-dot characters outside", async () => {
    const workspaceRoot = await mkdtemp(resolve(tmpdir(), "lsp-mcp-tools-"));
    const filePath = resolve(workspaceRoot, "..cache", "file.ts");
    await mkdir(resolve(workspaceRoot, "..cache"));
    await writeFile(filePath, "const cached = true;\n", "utf8");
    const session = createSession(
      {
        "textDocument/definition": {
          uri: `file://${filePath}`,
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 6 } },
        },
      },
      { definitionProvider: true },
    );
    const handler = createStandardToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => [acquired("ts", session, workspaceRoot)]),
        getSessionsForWorkspace: vi.fn(async () => []),
      },
      documentStore: new DocumentStore(),
    });

    const result = await handler("definition", { workspaceRoot, filePath, line: 1, character: 1 });

    expect(result.results.ts).toMatchObject({ ok: true });
    if (!result.results.ts.ok) {
      throw new Error("expected definition result");
    }
    expect(result.results.ts.result).toMatchObject({ filePath, outsideWorkspace: false });
  });

  it("marks parent-directory paths outside the workspace", async () => {
    const workspaceRoot = await mkdtemp(resolve(tmpdir(), "lsp-mcp-tools-"));
    const filePath = resolve(workspaceRoot, "app.ts");
    const outsidePath = resolve(workspaceRoot, "..", "outside.ts");
    await writeFile(filePath, "const value = 1;\n", "utf8");
    const session = createSession(
      {
        "textDocument/definition": {
          uri: `file://${outsidePath}`,
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 6 } },
        },
      },
      { definitionProvider: true },
    );
    const handler = createStandardToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => [acquired("ts", session, workspaceRoot)]),
        getSessionsForWorkspace: vi.fn(async () => []),
      },
      documentStore: new DocumentStore(),
    });

    const result = await handler("definition", { workspaceRoot, filePath, line: 1, character: 1 });

    expect(result.results.ts).toMatchObject({ ok: true });
    if (!result.results.ts.ok) {
      throw new Error("expected definition result");
    }
    expect(result.results.ts.result).toMatchObject({
      filePath: outsidePath,
      outsideWorkspace: true,
    });
  });

  it("limits completion results by default and supports filtering", async () => {
    const { workspaceRoot, filePath } = await createWorkspaceFile();
    const items = Array.from({ length: 120 }, (_, index) => ({
      label: index === 119 ? "goalPlugin" : `global${index}`,
      detail: index === 119 ? "exported plugin" : "global symbol",
    }));
    const session = createSession(
      { "textDocument/completion": { isIncomplete: false, items } },
      { completionProvider: true },
    );
    const handler = createStandardToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => [acquired("ts", session, workspaceRoot)]),
        getSessionsForWorkspace: vi.fn(async () => []),
      },
      documentStore: new DocumentStore(),
    });

    const defaultResult = await handler("completion", {
      workspaceRoot,
      filePath,
      line: 1,
      character: 1,
    });
    const filteredResult = await handler("completion", {
      workspaceRoot,
      filePath,
      line: 1,
      character: 1,
      query: "goal",
    });

    expect(defaultResult.results.ts).toMatchObject({
      ok: true,
      result: {
        isIncomplete: false,
        items: expect.any(Array),
        lspMcpMeta: { totalItems: 120, returnedItems: 100, truncated: true },
      },
    });
    expect(
      (defaultResult.results.ts as { ok: true; result: { items: unknown[] } }).result.items,
    ).toHaveLength(100);
    expect(filteredResult.results.ts).toMatchObject({
      ok: true,
      result: {
        items: [{ label: "goalPlugin", detail: "exported plugin" }],
        lspMcpMeta: { totalItems: 120, matchedItems: 1, returnedItems: 1, truncated: false },
      },
    });
  });

  it("returns serializable completion metadata for completion item arrays", async () => {
    const { workspaceRoot, filePath } = await createWorkspaceFile();
    const items = Array.from({ length: 101 }, (_, index) => ({ label: `global${index}` }));
    const session = createSession(
      { "textDocument/completion": items },
      { completionProvider: true },
    );
    const handler = createStandardToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => [acquired("ts", session, workspaceRoot)]),
        getSessionsForWorkspace: vi.fn(async () => []),
      },
      documentStore: new DocumentStore(),
    });

    const result = await handler("completion", { workspaceRoot, filePath, line: 1, character: 1 });
    const serialized = JSON.parse(JSON.stringify(result)) as typeof result;

    expect(serialized.results.ts).toMatchObject({
      ok: true,
      result: {
        isIncomplete: false,
        items: expect.any(Array),
        lspMcpMeta: { totalItems: 101, returnedItems: 100, truncated: true },
      },
    });
  });

  it("requires serverId for server-specific resolve and hierarchy item methods", async () => {
    const { workspaceRoot } = await createWorkspaceFile();
    const session = createSession({}, { completionProvider: { resolveProvider: true } });
    const handler = createStandardToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => [acquired("ts", session, workspaceRoot)]),
        getSessionsForWorkspace: vi.fn(async () => [acquired("ts", session, workspaceRoot)]),
      },
      documentStore: new DocumentStore(),
    });

    await expect(
      handler("completion_resolve", { workspaceRoot, item: { label: "x" } }),
    ).rejects.toThrow("Tool completion_resolve requires serverId");
  });
});
