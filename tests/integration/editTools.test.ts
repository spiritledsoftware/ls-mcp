import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { DocumentStore, filePathToUri } from "../../src/lsp/documentStore.js";
import { LspRequestTimeoutError, type LspRequestOptions } from "../../src/lsp/session.js";
import type { AcquiredLspSession, ManagedLspSession } from "../../src/lsp/sessionManager.js";
import { createEditToolHandler, EDITS_NOT_APPLIED_MESSAGE } from "../../src/tools/editTools.js";

const tempDirs: string[] = [];

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
  workspaceRoot: string,
): AcquiredLspSession {
  return {
    serverId,
    workspaceRoot,
    session,
    languageIds: ["typescript"],
    extensions: [".ts"],
  };
}

async function createWorkspaceFile(content = "const value = 1;\n") {
  const workspaceRoot = await mkdtemp(resolve(tmpdir(), "lsp-mcp-edit-tools-"));
  tempDirs.push(workspaceRoot);
  const filePath = resolve(workspaceRoot, "app.ts");
  await writeFile(filePath, content, "utf8");
  return { workspaceRoot, filePath };
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("edit-producing tools", () => {
  it("previews edits without mutating files and includes a clear not-applied message", async () => {
    const { workspaceRoot, filePath } = await createWorkspaceFile();
    const session = createSession(
      {
        "textDocument/formatting": [
          {
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 16 } },
            newText: "const formatted = 1;",
          },
        ],
      },
      { documentFormattingProvider: true },
    );
    const handler = createEditToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => [acquired("ts", session, workspaceRoot)]),
      },
      documentStore: new DocumentStore(),
    });

    const result = await handler("lsp_format_document", { workspaceRoot, filePath });

    await expect(readFile(filePath, "utf8")).resolves.toBe("const value = 1;\n");
    expect(result.results.ts).toMatchObject({
      ok: true,
      applied: false,
      message: EDITS_NOT_APPLIED_MESSAGE,
    });
    expect(session.notifications[0]).toMatchObject({ method: "textDocument/didOpen" });
  });

  it("passes tool cancellation signal to edit-producing requests", async () => {
    const { workspaceRoot, filePath } = await createWorkspaceFile();
    const signal = new AbortController().signal;
    const session = createSession(
      { "textDocument/formatting": [] },
      { documentFormattingProvider: true },
    );
    const handler = createEditToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => [acquired("ts", session, workspaceRoot)]),
      },
      documentStore: new DocumentStore(),
    });

    await handler("lsp_format_document", { workspaceRoot, filePath }, { signal });

    expect(session.requestOptions[0]).toEqual({ signal });
  });

  it("preserves structured timeout errors", async () => {
    const { workspaceRoot, filePath } = await createWorkspaceFile();
    const session = createSession(
      { "textDocument/formatting": new LspRequestTimeoutError("textDocument/formatting", 40) },
      { documentFormattingProvider: true },
    );
    const handler = createEditToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => [acquired("ts", session, workspaceRoot)]),
      },
      documentStore: new DocumentStore(),
    });

    const result = await handler("lsp_format_document", { workspaceRoot, filePath });

    expect(result.results.ts).toMatchObject({
      ok: false,
      error: expect.stringContaining("timed out"),
      code: "LSP_REQUEST_TIMEOUT",
      method: "textDocument/formatting",
      timeoutMs: 40,
    });
  });

  it("returns structured acquisition failures instead of throwing", async () => {
    const { workspaceRoot, filePath } = await createWorkspaceFile();
    const handler = createEditToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => {
          throw new LspRequestTimeoutError("initialize", 25);
        }),
      },
      documentStore: new DocumentStore(),
    });

    const result = await handler("lsp_format_document", { workspaceRoot, filePath });

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

  it("applies formatting edits when apply is true", async () => {
    const { workspaceRoot, filePath } = await createWorkspaceFile();
    const session = createSession(
      {
        "textDocument/formatting": [
          {
            range: { start: { line: 0, character: 6 }, end: { line: 0, character: 11 } },
            newText: "formatted",
          },
        ],
      },
      { documentFormattingProvider: true },
    );
    const handler = createEditToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => [acquired("ts", session, workspaceRoot)]),
      },
      documentStore: new DocumentStore(),
    });

    const result = await handler("lsp_format_document", { workspaceRoot, filePath, apply: true });

    await expect(readFile(filePath, "utf8")).resolves.toBe("const formatted = 1;\n");
    expect(result.results.ts).toMatchObject({ ok: true, applied: true });
  });

  it("rejects apply when the file changes after document sync and before applying edits", async () => {
    const { workspaceRoot, filePath } = await createWorkspaceFile();
    const session = createSession(
      {
        "textDocument/formatting": [
          {
            range: { start: { line: 0, character: 6 }, end: { line: 0, character: 11 } },
            newText: "formatted",
          },
        ],
      },
      { documentFormattingProvider: true },
    );
    const originalSendRequest = session.sendRequest.bind(session);
    session.sendRequest = async <T = unknown>(method: string, params?: unknown): Promise<T> => {
      const result = await originalSendRequest<T>(method, params);
      await writeFile(filePath, "const changed = 2;\n", "utf8");
      return result;
    };
    const handler = createEditToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => [acquired("ts", session, workspaceRoot)]),
      },
      documentStore: new DocumentStore(),
    });

    const result = await handler("lsp_format_document", { workspaceRoot, filePath, apply: true });

    expect(result.results.ts).toMatchObject({
      ok: false,
      error: expect.stringContaining("changed since the LSP request was made"),
    });
    await expect(readFile(filePath, "utf8")).resolves.toBe("const changed = 2;\n");
  });

  it("applies rename workspace edits when apply is true", async () => {
    const { workspaceRoot, filePath } = await createWorkspaceFile("const value = value;\n");
    const session = createSession(
      {
        "textDocument/rename": {
          changes: {
            [filePathToUri(filePath)]: [
              {
                range: { start: { line: 0, character: 6 }, end: { line: 0, character: 11 } },
                newText: "renamed",
              },
              {
                range: { start: { line: 0, character: 14 }, end: { line: 0, character: 19 } },
                newText: "renamed",
              },
            ],
          },
        },
      },
      { renameProvider: true },
    );
    const handler = createEditToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => [acquired("ts", session, workspaceRoot)]),
      },
      documentStore: new DocumentStore(),
    });

    await handler("lsp_rename", {
      workspaceRoot,
      filePath,
      line: 1,
      character: 7,
      newName: "renamed",
      apply: true,
    });

    await expect(readFile(filePath, "utf8")).resolves.toBe("const renamed = renamed;\n");
  });

  it("fails apply without serverId when multiple servers match", async () => {
    const { workspaceRoot, filePath } = await createWorkspaceFile();
    const first = createSession(
      { "textDocument/formatting": [] },
      { documentFormattingProvider: true },
    );
    const second = createSession(
      { "textDocument/formatting": [] },
      { documentFormattingProvider: true },
    );
    const handler = createEditToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => [
          acquired("first", first, workspaceRoot),
          acquired("second", second, workspaceRoot),
        ]),
      },
      documentStore: new DocumentStore(),
    });

    await expect(
      handler("lsp_format_document", { workspaceRoot, filePath, apply: true }),
    ).rejects.toThrow("apply: true requires serverId when multiple LSP servers match");
  });

  it("returns code actions for preview and applies the selected edit and command", async () => {
    const { workspaceRoot, filePath } = await createWorkspaceFile("const value = 1;\n");
    const actions = [
      {
        title: "No edit",
        kind: "quickfix",
        command: { command: "do.not.run", title: "Do not run" },
      },
      {
        title: "Replace value",
        kind: "quickfix",
        edit: {
          changes: {
            [filePathToUri(filePath)]: [
              {
                range: { start: { line: 0, character: 6 }, end: { line: 0, character: 11 } },
                newText: "answer",
              },
            ],
          },
        },
        command: { command: "do.not.run", title: "Do not run" },
      },
    ];
    const session = createSession(
      { "textDocument/codeAction": actions, "workspace/executeCommand": { ran: true } },
      { codeActionProvider: true },
    );
    const handler = createEditToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => [acquired("ts", session, workspaceRoot)]),
      },
      documentStore: new DocumentStore(),
    });

    const preview = await handler("lsp_code_actions", {
      workspaceRoot,
      filePath,
      startLine: 1,
      startCharacter: 1,
      endLine: 1,
      endCharacter: 6,
    });
    const applied = await handler("lsp_code_actions", {
      workspaceRoot,
      filePath,
      startLine: 1,
      startCharacter: 1,
      endLine: 1,
      endCharacter: 6,
      actionIndex: 1,
      apply: true,
    });

    expect(preview.results.ts).toMatchObject({ ok: true, applied: false, actions });
    expect(applied.results.ts).toMatchObject({
      ok: true,
      applied: true,
      command: { ok: true, result: { ran: true } },
    });
    expect(session.requests.at(-1)).toEqual({
      method: "workspace/executeCommand",
      params: { command: "do.not.run" },
    });
    await expect(readFile(filePath, "utf8")).resolves.toBe("const answer = 1;\n");
  });

  it("requires actionIndex when multiple actionable code-action results exist", async () => {
    const { workspaceRoot, filePath } = await createWorkspaceFile("const value = 1;\n");
    const actions = [
      {
        title: "Replace value",
        kind: "quickfix",
        edit: {
          changes: {
            [filePathToUri(filePath)]: [
              {
                range: { start: { line: 0, character: 6 }, end: { line: 0, character: 11 } },
                newText: "answer",
              },
            ],
          },
        },
      },
      {
        title: "Organize imports",
        kind: "source.organizeImports",
        command: { command: "source.organizeImports.ts", title: "Organize imports" },
      },
    ];
    const session = createSession(
      { "textDocument/codeAction": actions, "workspace/executeCommand": { organized: true } },
      { codeActionProvider: true },
    );
    const handler = createEditToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => [acquired("ts", session, workspaceRoot)]),
      },
      documentStore: new DocumentStore(),
    });

    const applied = await handler("lsp_code_actions", {
      workspaceRoot,
      filePath,
      startLine: 1,
      startCharacter: 1,
      endLine: 1,
      endCharacter: 6,
      apply: true,
    });

    expect(applied.results.ts).toMatchObject({
      ok: false,
      error: "Multiple actionable code actions are available; provide actionIndex for apply: true",
    });
    await expect(readFile(filePath, "utf8")).resolves.toBe("const value = 1;\n");
    expect(session.requests).toHaveLength(1);
  });

  it("executes selected code action commands by default when apply is true", async () => {
    const { workspaceRoot, filePath } = await createWorkspaceFile("const value = 1;\n");
    const actions = [
      {
        title: "Fix all",
        kind: "quickfix",
        edit: {
          changes: {
            [filePathToUri(filePath)]: [
              {
                range: { start: { line: 0, character: 6 }, end: { line: 0, character: 11 } },
                newText: "answer",
              },
            ],
          },
        },
        command: { command: "source.fixAll.ts", title: "Fix all", arguments: [filePath] },
      },
    ];
    const session = createSession(
      { "textDocument/codeAction": actions, "workspace/executeCommand": { fixed: true } },
      { codeActionProvider: true },
    );
    const handler = createEditToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => [acquired("ts", session, workspaceRoot)]),
      },
      documentStore: new DocumentStore(),
    });

    const applied = await handler("lsp_code_actions", {
      workspaceRoot,
      filePath,
      startLine: 1,
      startCharacter: 1,
      endLine: 1,
      endCharacter: 6,
      apply: true,
    });

    expect(applied.results.ts).toMatchObject({
      ok: true,
      applied: true,
      command: { ok: true, result: { fixed: true } },
    });
    expect(session.requests.at(-1)).toEqual({
      method: "workspace/executeCommand",
      params: { command: "source.fixAll.ts", arguments: [filePath] },
    });
  });

  it("reports blocked code action commands clearly after applying edit portion", async () => {
    const { workspaceRoot, filePath } = await createWorkspaceFile("const value = 1;\n");
    const actions = [
      {
        title: "Fix all",
        kind: "quickfix",
        edit: {
          changes: {
            [filePathToUri(filePath)]: [
              {
                range: { start: { line: 0, character: 6 }, end: { line: 0, character: 11 } },
                newText: "answer",
              },
            ],
          },
        },
        command: { command: "source.fixAll.ts", title: "Fix all" },
      },
    ];
    const session = createSession(
      { "textDocument/codeAction": actions },
      { codeActionProvider: true },
    );
    const handler = createEditToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => [acquired("ts", session, workspaceRoot)]),
      },
      documentStore: new DocumentStore(),
      config: { commands: { allow: { ts: ["source.organizeImports.ts"] } } },
    });

    const applied = await handler("lsp_code_actions", {
      workspaceRoot,
      filePath,
      startLine: 1,
      startCharacter: 1,
      endLine: 1,
      endCharacter: 6,
      apply: true,
    });

    await expect(readFile(filePath, "utf8")).resolves.toBe("const answer = 1;\n");
    expect(applied.results.ts).toMatchObject({
      ok: false,
      error: 'Command "source.fixAll.ts" is not allowed for server ts',
      applied: true,
    });
  });

  it("executes a single command-only code action by default when apply is true", async () => {
    const { workspaceRoot, filePath } = await createWorkspaceFile("const value = 1;\n");
    const actions = [
      {
        title: "Organize imports",
        kind: "source.organizeImports",
        command: { command: "source.organizeImports.ts", title: "Organize imports" },
      },
    ];
    const session = createSession(
      { "textDocument/codeAction": actions, "workspace/executeCommand": { organized: true } },
      { codeActionProvider: true },
    );
    const handler = createEditToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => [acquired("ts", session, workspaceRoot)]),
      },
      documentStore: new DocumentStore(),
    });

    const applied = await handler("lsp_code_actions", {
      workspaceRoot,
      filePath,
      startLine: 1,
      startCharacter: 1,
      endLine: 1,
      endCharacter: 6,
      apply: true,
    });

    expect(applied.results.ts).toMatchObject({
      ok: true,
      applied: false,
      command: { ok: true, result: { organized: true } },
    });
    expect(session.requests.at(-1)).toEqual({
      method: "workspace/executeCommand",
      params: { command: "source.organizeImports.ts" },
    });
  });

  it("executes a direct LSP command result when apply is true", async () => {
    const { workspaceRoot, filePath } = await createWorkspaceFile("const value = 1;\n");
    const command = {
      title: "Fix all",
      command: "source.fixAll.ts",
      arguments: [{ uri: filePathToUri(filePath) }],
    };
    const session = createSession(
      { "textDocument/codeAction": [command], "workspace/executeCommand": { fixed: true } },
      { codeActionProvider: true },
    );
    const handler = createEditToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => [acquired("ts", session, workspaceRoot)]),
      },
      documentStore: new DocumentStore(),
    });

    const applied = await handler("lsp_code_actions", {
      workspaceRoot,
      filePath,
      startLine: 1,
      startCharacter: 1,
      endLine: 1,
      endCharacter: 6,
      apply: true,
    });

    expect(applied.results.ts).toMatchObject({
      ok: true,
      applied: false,
      command: { ok: true, result: { fixed: true } },
    });
    expect(session.requests.at(-1)).toEqual({
      method: "workspace/executeCommand",
      params: { command: "source.fixAll.ts", arguments: [{ uri: filePathToUri(filePath) }] },
    });
  });

  it("reports blocked direct LSP commands clearly", async () => {
    const { workspaceRoot, filePath } = await createWorkspaceFile("const value = 1;\n");
    const command = { title: "Fix all", command: "source.fixAll.ts" };
    const session = createSession(
      { "textDocument/codeAction": [command] },
      { codeActionProvider: true },
    );
    const handler = createEditToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => [acquired("ts", session, workspaceRoot)]),
      },
      documentStore: new DocumentStore(),
      config: { commands: { allow: { ts: ["source.organizeImports.ts"] } } },
    });

    const applied = await handler("lsp_code_actions", {
      workspaceRoot,
      filePath,
      startLine: 1,
      startCharacter: 1,
      endLine: 1,
      endCharacter: 6,
      apply: true,
    });

    expect(session.requests).toHaveLength(1);
    expect(applied.results.ts).toMatchObject({
      ok: false,
      applied: false,
      error: 'Command "source.fixAll.ts" is not allowed for server ts',
    });
  });
});
