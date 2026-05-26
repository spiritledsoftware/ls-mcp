import { chmod, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter } from "node:path";
import { join, resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import type { LspRequestOptions, LspSessionHealth } from "../../src/lsp/session.js";
import { LspSessionManager, type ManagedLspSession } from "../../src/lsp/sessionManager.js";
import type { LspProcessStatus } from "../../src/lsp/transport.js";
import { createToolRegistry } from "../../src/tools/registerTools.js";

class FakeSession implements ManagedLspSession {
  capabilities = { hoverProvider: true, completionProvider: { triggerCharacters: ["."] } };
  health: LspSessionHealth = {
    consecutiveFailures: 0,
    restartCount: 0,
    lastExitCode: null,
    lastExitSignal: null,
    lastStderr: [],
  };
  status: LspProcessStatus = { state: "running", exitCode: null, signal: null };
  startCount = 0;
  shutdownCount = 0;

  async start(): Promise<void> {
    this.startCount += 1;
  }

  async shutdown(): Promise<void> {
    this.shutdownCount += 1;
    this.status = { state: "exited", exitCode: 0, signal: null };
  }

  onNotification(): { dispose(): void } {
    return { dispose() {} };
  }

  async sendNotification(): Promise<void> {}

  async sendRequest<T = unknown>(
    _method: string,
    _params?: unknown,
    _options?: LspRequestOptions,
  ): Promise<T> {
    return null as T;
  }
}

function tool(registry: ReturnType<typeof createToolRegistry>, name: string) {
  const found = registry.tools.find((registered) => registered.name === name);
  if (!found) {
    throw new Error(`Missing tool ${name}`);
  }
  return found;
}

async function callTool(
  registry: ReturnType<typeof createToolRegistry>,
  name: string,
  input: unknown,
) {
  return (await tool(registry, name).handler(input)) as Record<string, any>;
}

async function createWorkspace() {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "lsp-mcp-server-tools-"));
  const filePath = resolve(workspaceRoot, "app.ts");
  await writeFile(filePath, "const value = 1;\n", "utf8");
  return { workspaceRoot, filePath };
}

describe("server lifecycle tools", () => {
  it("lists configured and built-in servers without starting sessions", async () => {
    const factory = vi.fn(() => new FakeSession());
    const registry = createToolRegistry({
      config: {
        lsp: {
          servers: {
            ts: { registry: "typescript", command: "definitely-missing-lsp-test-command" },
            custom: { command: "definitely-missing-custom-lsp", languageIds: ["custom"] },
          },
        },
      },
      sessionManager: new LspSessionManager({
        config: {
          lsp: {
            servers: {
              ts: { registry: "typescript", command: "definitely-missing-lsp-test-command" },
              custom: { command: "definitely-missing-custom-lsp", languageIds: ["custom"] },
            },
          },
        },
        sessionFactory: factory,
      }),
    });

    const result = await callTool(registry, "lsp_list_servers", {});

    expect(factory).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: true });
    expect(result.servers.map((server: { id: string }) => server.id)).toEqual(
      expect.arrayContaining(["ts", "custom", "json", "pyright"]),
    );
    expect(result.servers.find((server: { id: string }) => server.id === "ts")).toMatchObject({
      id: "ts",
      registryId: "typescript",
      kind: "managed",
      install: { status: "error" },
      running: false,
    });
    expect(result.servers.find((server: { id: string }) => server.id === "custom")).toMatchObject({
      kind: "custom",
      running: false,
    });
  });

  it("reports not-started status without starting a matching server", async () => {
    const { workspaceRoot, filePath } = await createWorkspace();
    const factory = vi.fn(() => new FakeSession());
    const registry = createToolRegistry({
      config: { lsp: { servers: { ts: { registry: "typescript", command: process.execPath } } } },
      sessionManager: new LspSessionManager({
        config: { lsp: { servers: { ts: { registry: "typescript", command: process.execPath } } } },
        sessionFactory: factory,
      }),
    });

    const result = await callTool(registry, "lsp_server_status", { workspaceRoot, filePath });

    expect(factory).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: true });
    expect(result.sessions).toEqual([]);
    expect(result.servers).toEqual([
      expect.objectContaining({
        id: "ts",
        running: false,
        install: expect.objectContaining({ status: "ready" }),
      }),
    ]);
  });

  it("reports configured commands available through per-server PATH env", async () => {
    const { workspaceRoot, filePath } = await createWorkspace();
    const binDir = await mkdtemp(join(tmpdir(), "lsp-mcp-server-bin-"));
    const commandPath = join(binDir, "env-only-ls");
    await writeFile(commandPath, "#!/bin/sh\nexit 0\n", "utf8");
    await chmod(commandPath, 0o755);
    const serverEnv = { PATH: `${binDir}${delimiter}${process.env.PATH ?? ""}` };
    const config = {
      lsp: {
        servers: {
          envTs: {
            registry: "typescript",
            command: "env-only-ls",
            env: serverEnv,
          },
        },
      },
    };
    const factory = vi.fn(() => new FakeSession());
    const registry = createToolRegistry({
      config,
      sessionManager: new LspSessionManager({ config, sessionFactory: factory }),
    });

    const result = await callTool(registry, "lsp_server_status", {
      workspaceRoot,
      filePath,
      serverId: "envTs",
    });

    expect(factory).not.toHaveBeenCalled();
    expect(result.servers[0]).toMatchObject({
      id: "envTs",
      install: { status: "ready", command: "env-only-ls" },
    });
  });

  it("reports cached managed npm installs without starting servers or downloading", async () => {
    const originalXdgCacheHome = process.env.XDG_CACHE_HOME;
    const cacheHome = await mkdtemp(join(tmpdir(), "lsp-mcp-cache-home-"));
    process.env.XDG_CACHE_HOME = cacheHome;
    try {
      const cachedCommand = join(
        cacheHome,
        "lsp-mcp",
        "servers",
        "typescript",
        "node_modules",
        ".bin",
        process.platform === "win32"
          ? "typescript-language-server.cmd"
          : "typescript-language-server",
      );
      await mkdir(resolve(cachedCommand, ".."), { recursive: true });
      await writeFile(cachedCommand, "#!/bin/sh\nexit 0\n", "utf8");
      await chmod(cachedCommand, 0o755);
      const { workspaceRoot, filePath } = await createWorkspace();
      const factory = vi.fn(() => new FakeSession());
      const config = { lsp: { servers: { ts: { registry: "typescript" } } } };
      const registry = createToolRegistry({
        config,
        sessionManager: new LspSessionManager({ config, sessionFactory: factory }),
      });

      const result = await callTool(registry, "lsp_server_status", {
        workspaceRoot,
        filePath,
        serverId: "ts",
      });

      expect(factory).not.toHaveBeenCalled();
      expect(result.servers[0]).toMatchObject({
        id: "ts",
        install: { status: "ready", source: "installed", command: cachedCommand },
      });
    } finally {
      if (originalXdgCacheHome === undefined) {
        delete process.env.XDG_CACHE_HOME;
      } else {
        process.env.XDG_CACHE_HOME = originalXdgCacheHome;
      }
    }
  });

  it("reports running sessions, capabilities, health, and idle details after lazy start", async () => {
    const { workspaceRoot, filePath } = await createWorkspace();
    const fake = new FakeSession();
    const manager = new LspSessionManager({
      config: { lsp: { servers: { ts: { registry: "typescript", command: process.execPath } } } },
      idleTimeoutMs: 60_000,
      sessionFactory: () => fake,
    });
    const registry = createToolRegistry({ config: {}, sessionManager: manager });

    await manager.getSessionsForFile({ workspaceRoot, filePath });
    const result = await callTool(registry, "lsp_server_status", {
      workspaceRoot,
      serverId: "ts",
    });

    expect(result).toMatchObject({ ok: true });
    expect(result.sessions).toMatchObject([
      expect.objectContaining({
        serverId: "ts",
        running: true,
        process: { state: "running", exitCode: null, signal: null },
        capabilities: expect.objectContaining({ hover: true, completion: true }),
        health: expect.objectContaining({ consecutiveFailures: 0 }),
        lastAccessedAt: expect.any(String),
        idleDeadlineAt: expect.any(String),
      }),
    ]);
  });

  it("reports only file-matching running sessions when serverId is omitted", async () => {
    const { workspaceRoot, filePath } = await createWorkspace();
    const manager = new LspSessionManager({
      config: {
        lsp: {
          servers: {
            ts: { registry: "typescript", command: process.execPath },
            json: { registry: "json", command: process.execPath },
          },
        },
      },
      sessionFactory: () => new FakeSession(),
    });
    const registry = createToolRegistry({ config: {}, sessionManager: manager });

    await manager.getSessionsForWorkspace({ workspaceRoot, serverId: "ts" });
    await manager.getSessionsForWorkspace({ workspaceRoot, serverId: "json" });
    const result = await callTool(registry, "lsp_server_status", { workspaceRoot, filePath });

    expect(result.servers.map((server: { id: string }) => server.id)).toEqual(["ts"]);
    expect(result.sessions.map((session: { serverId: string }) => session.serverId)).toEqual([
      "ts",
    ]);
  });

  it("stops one running server and reports when it is not running", async () => {
    const { workspaceRoot, filePath } = await createWorkspace();
    const fake = new FakeSession();
    const manager = new LspSessionManager({
      config: {
        lsp: {
          servers: {
            ts: { registry: "typescript", command: process.execPath },
            json: { registry: "json", command: process.execPath },
          },
        },
      },
      sessionFactory: () => fake,
    });
    const registry = createToolRegistry({ config: {}, sessionManager: manager });

    await manager.getSessionsForFile({ workspaceRoot, filePath, serverId: "ts" });
    const stopped = await callTool(registry, "lsp_stop_server", {
      workspaceRoot: join(workspaceRoot, "."),
      serverId: "ts",
    });
    const notRunning = await callTool(registry, "lsp_stop_server", {
      workspaceRoot,
      serverId: "ts",
    });

    expect(stopped).toMatchObject({
      ok: true,
      stopped: true,
      serverId: "ts",
      workspaceRoot,
    });
    expect(notRunning).toMatchObject({ ok: true, stopped: false, reason: "not-running" });
    expect(manager.activeSessionCount).toBe(0);
  });

  it("stops all running sessions for a workspace", async () => {
    const { workspaceRoot } = await createWorkspace();
    const manager = new LspSessionManager({
      config: {
        lsp: {
          servers: {
            ts: { registry: "typescript", command: process.execPath },
            json: { registry: "json", command: process.execPath },
          },
        },
      },
      sessionFactory: () => new FakeSession(),
    });
    const registry = createToolRegistry({ config: {}, sessionManager: manager });

    await manager.getSessionsForWorkspace({ workspaceRoot, serverId: "ts" });
    await manager.getSessionsForWorkspace({ workspaceRoot, serverId: "json" });
    const result = await callTool(registry, "lsp_stop_workspace", {
      workspaceRoot: join(workspaceRoot, "."),
    });

    expect(result).toMatchObject({ ok: true, workspaceRoot, stoppedCount: 2 });
    expect(result.stopped.map((entry: { serverId: string }) => entry.serverId).sort()).toEqual([
      "json",
      "ts",
    ]);
    expect(manager.activeSessionCount).toBe(0);
  });
});
