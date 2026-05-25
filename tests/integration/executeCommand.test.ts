import { describe, expect, it, vi } from "vitest";

import type { AcquiredLspSession, ManagedLspSession } from "../../src/lsp/sessionManager.js";
import { createRawToolHandler } from "../../src/tools/rawTools.js";

interface FakeSession extends ManagedLspSession {
  requests: { method: string; params: unknown }[];
}

function createSession(response: unknown = { applied: true }): FakeSession {
  return {
    capabilities: {},
    requests: [],
    async start() {},
    async shutdown() {},
    onNotification() {
      return { dispose() {} };
    },
    async sendNotification() {},
    async sendRequest<T = unknown>(method: string, params?: unknown): Promise<T> {
      this.requests.push({ method, params });
      return response as T;
    },
  };
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

describe("lsp_execute_command", () => {
  it("calls workspace/executeCommand on a matching fake server", async () => {
    const session = createSession({ ok: true });
    const handler = createRawToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => [acquired("ts", session)]),
        getSessionsForWorkspace: vi.fn(async () => []),
      },
      config: {},
    });

    const result = await handler("lsp_execute_command", {
      workspaceRoot: "/workspace",
      filePath: "/workspace/app.ts",
      command: "source.fixAll.ts",
      arguments: [{ uri: "file:///workspace/app.ts" }],
    });

    expect(session.requests).toEqual([
      {
        method: "workspace/executeCommand",
        params: {
          command: "source.fixAll.ts",
          arguments: [{ uri: "file:///workspace/app.ts" }],
        },
      },
    ]);
    expect(result).toEqual({ ok: true, results: { ts: { ok: true, result: { ok: true } } } });
  });

  it("reports blocked commands clearly", async () => {
    const session = createSession();
    const handler = createRawToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => [acquired("ts", session)]),
        getSessionsForWorkspace: vi.fn(async () => []),
      },
      config: { commands: { allow: { ts: ["source.fixAll.ts"] } } },
    });

    const result = await handler("lsp_execute_command", {
      workspaceRoot: "/workspace",
      filePath: "/workspace/app.ts",
      command: "source.organizeImports.ts",
    });

    expect(session.requests).toEqual([]);
    expect(result.results.ts).toMatchObject({
      ok: false,
      error: 'Command "source.organizeImports.ts" is not allowed for server ts',
    });
  });

  it("executes on all matching file servers when serverId is omitted", async () => {
    const first = createSession({ first: true });
    const second = createSession({ second: true });
    const handler = createRawToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => [
          acquired("first", first),
          acquired("second", second),
        ]),
        getSessionsForWorkspace: vi.fn(async () => []),
      },
      config: {},
    });

    const result = await handler("lsp_execute_command", {
      workspaceRoot: "/workspace",
      filePath: "/workspace/app.ts",
      command: "source.fixAll.ts",
    });

    expect(first.requests).toEqual([
      { method: "workspace/executeCommand", params: { command: "source.fixAll.ts" } },
    ]);
    expect(second.requests).toEqual([
      { method: "workspace/executeCommand", params: { command: "source.fixAll.ts" } },
    ]);
    expect(result).toEqual({
      ok: true,
      results: {
        first: { ok: true, result: { first: true } },
        second: { ok: true, result: { second: true } },
      },
    });
  });

  it("returns partial success when one matching server allows a command and one blocks it", async () => {
    const allowed = createSession({ applied: true });
    const blocked = createSession({ shouldNotRun: true });
    const handler = createRawToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => [
          acquired("allowed", allowed),
          acquired("blocked", blocked),
        ]),
        getSessionsForWorkspace: vi.fn(async () => []),
      },
      config: { commands: { allow: { blocked: ["source.organizeImports.ts"] } } },
    });

    const result = await handler("lsp_execute_command", {
      workspaceRoot: "/workspace",
      filePath: "/workspace/app.ts",
      command: "source.fixAll.ts",
    });

    expect(allowed.requests).toHaveLength(1);
    expect(blocked.requests).toEqual([]);
    expect(result).toEqual({
      ok: false,
      results: {
        allowed: { ok: true, result: { applied: true } },
        blocked: {
          ok: false,
          error: 'Command "source.fixAll.ts" is not allowed for server blocked',
        },
      },
    });
  });

  it("executes workspace-level commands without filePath", async () => {
    const session = createSession({ refreshed: true });
    const getSessionsForWorkspace = vi.fn(async () => [acquired("ts", session)]);
    const handler = createRawToolHandler({
      sessionManager: {
        getSessionsForFile: vi.fn(async () => []),
        getSessionsForWorkspace,
      },
      config: {},
    });

    const result = await handler("lsp_execute_command", {
      workspaceRoot: "/workspace",
      command: "workspace.refresh",
    });

    expect(getSessionsForWorkspace).toHaveBeenCalledWith({
      workspaceRoot: "/workspace",
      serverId: undefined,
    });
    expect(session.requests).toEqual([
      { method: "workspace/executeCommand", params: { command: "workspace.refresh" } },
    ]);
    expect(result.results.ts).toEqual({ ok: true, result: { refreshed: true } });
  });
});
