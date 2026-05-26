import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { LspSessionManager, type ManagedLspSession } from "../../src/lsp/sessionManager.js";

interface StartedSession extends ManagedLspSession {
  readonly id: number;
  readonly command: string;
  readonly args: readonly string[];
  starts: number;
  shutdowns: number;
}

function createManager(options: ConstructorParameters<typeof LspSessionManager>[0] = {}) {
  const sessions: StartedSession[] = [];
  const { config: optionConfig, ...managerOptions } = options;
  const configuredServers = optionConfig?.lsp?.servers ?? {
    ts: { registry: "typescript", command: "ts-ls", args: ["--stdio"] },
    json: { registry: "json", command: "json-ls" },
  };
  const manager = new LspSessionManager({
    config: {
      ...optionConfig,
      lsp: {
        ...optionConfig?.lsp,
        servers: configuredServers,
      },
    },
    commandResolver:
      options.commandResolver ??
      (async ({ serverId, server }) => ({
        status: "ready" as const,
        source: "configured" as const,
        command: server.command ?? `${serverId}-ls`,
        args: server.args ?? [],
      })),
    sessionFactory:
      options.sessionFactory ??
      ((sessionOptions) => {
        const session: StartedSession = {
          id: sessions.length + 1,
          command: sessionOptions.command ?? "",
          args: sessionOptions.args ?? [],
          starts: 0,
          shutdowns: 0,
          async start() {
            this.starts += 1;
          },
          async shutdown() {
            this.shutdowns += 1;
          },
          onNotification() {
            return { dispose() {} };
          },
          async sendNotification() {},
          async sendRequest<T>() {
            return undefined as T;
          },
        };
        sessions.push(session);
        return session;
      }),
    ...managerOptions,
  });
  return { manager, sessions };
}

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("LspSessionManager", () => {
  it("does not resolve commands or create sessions before first acquisition", () => {
    const commandResolver = vi.fn();
    const sessionFactory = vi.fn();

    new LspSessionManager({ commandResolver, sessionFactory });

    expect(commandResolver).not.toHaveBeenCalled();
    expect(sessionFactory).not.toHaveBeenCalled();
  });

  it("starts all extension-matching deduped servers when serverId is omitted", async () => {
    const { manager, sessions } = createManager({
      config: {
        lsp: {
          servers: {
            ts: { registry: "typescript", command: "configured-ts-ls" },
            tsDuplicate: { registry: "typescript", command: "duplicate-ts-ls" },
          },
        },
      },
    });

    const result = await manager.getSessionsForFile({
      workspaceRoot: "/workspace",
      filePath: "/workspace/src/app.ts",
    });

    expect(result.map((session) => session.serverId)).toEqual(["ts"]);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.command).toBe("configured-ts-ls");
    expect(sessions[0]?.starts).toBe(1);
  });

  it("starts all matching deduped distinct server IDs when serverId is omitted", async () => {
    const { manager, sessions } = createManager({
      config: {
        lsp: {
          servers: {
            ts: { registry: "typescript", command: "ts-ls" },
            customTs: { command: "custom-ts-ls", extensions: [".ts"] },
            customTsDuplicate: { command: "duplicate-ts-ls", extensions: [".ts"] },
          },
        },
      },
    });

    const result = await manager.getSessionsForFile({
      workspaceRoot: "/workspace",
      filePath: "/workspace/src/app.ts",
    });

    expect(result.map((session) => session.serverId)).toEqual([
      "ts",
      "customTs",
      "customTsDuplicate",
    ]);
    expect(sessions.map((session) => session.command)).toEqual([
      "ts-ls",
      "custom-ts-ls",
      "duplicate-ts-ls",
    ]);
  });

  it("starts only the provided matching serverId", async () => {
    const { manager } = createManager();

    const result = await manager.getSessionsForFile({
      workspaceRoot: "/workspace",
      filePath: "/workspace/package.json",
      serverId: "json",
    });

    expect(result.map((session) => session.serverId)).toEqual(["json"]);
  });

  it("resolves explicit compatibility alias serverId for file sessions", async () => {
    const { manager } = createManager({ config: { lsp: { servers: {} } } });

    const result = await manager.getSessionsForFile({
      workspaceRoot: "/workspace",
      filePath: "/workspace/main.py",
      serverId: "python",
    });

    expect(result.map((session) => session.serverId)).toEqual(["pyright"]);
  });

  it("resolves explicit compatibility alias serverId for workspace sessions", async () => {
    const { manager } = createManager({ config: { lsp: { servers: {} } } });

    const result = await manager.getSessionsForWorkspace({
      workspaceRoot: "/workspace",
      serverId: "yaml",
    });

    expect(result.map((session) => session.serverId)).toEqual(["yaml-ls"]);
  });

  it("resolves explicit Mason alias serverId to configured canonical equivalent", async () => {
    const { manager } = createManager();

    const result = await manager.getSessionsForFile({
      workspaceRoot: "/workspace",
      filePath: "/workspace/src/app.ts",
      serverId: "ts_ls",
    });

    expect(result.map((session) => session.serverId)).toEqual(["ts"]);
  });

  it("resolves explicit alias serverId for status listing", () => {
    const { manager } = createManager({ config: { lsp: { servers: {} } } });

    expect(
      manager
        .listServerStatuses({ workspaceRoot: "/workspace", serverId: "python" })
        .map((server) => server.id),
    ).toEqual(["pyright"]);
  });

  it("stops canonical active sessions by alias serverId", async () => {
    const { manager, sessions } = createManager({ config: { lsp: { servers: {} } } });
    await manager.getSessionsForFile({
      workspaceRoot: "/workspace",
      filePath: "/workspace/main.py",
      serverId: "pyright",
    });

    await expect(
      manager.stopServer({ workspaceRoot: "/workspace", serverId: "python" }),
    ).resolves.toBe(true);

    expect(sessions[0]?.shutdowns).toBe(1);
    expect(manager.listActiveSessions({ workspaceRoot: "/workspace" })).toEqual([]);
  });

  it("dedupes configured registry aliases with canonical built-ins in status and listing", () => {
    const { manager } = createManager({
      config: {
        lsp: {
          servers: {
            yamlAlias: { registry: "yamlls", command: "yaml-ls" },
          },
        },
      },
    });

    expect(manager.listServers().filter((server) => server.registryId === "yaml-ls")).toEqual([
      expect.objectContaining({ id: "yamlAlias", registryId: "yaml-ls" }),
    ]);
    expect(
      manager
        .listServerStatuses({ workspaceRoot: "/workspace", filePath: "/workspace/config.yaml" })
        .map((server) => server.id),
    ).toEqual(["yamlAlias"]);
  });

  it("filters Deno activation for TypeScript files unless a Deno marker exists", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "lsp-mcp-deno-"));
    try {
      const { manager } = createManager({ config: { lsp: { servers: {} } } });
      const filePath = join(workspaceRoot, "mod.ts");
      await writeFile(filePath, "export const value = 1;\n");

      expect(
        manager
          .listServerStatuses({ workspaceRoot, filePath })
          .map((server) => server.registryId ?? server.id),
      ).toContain("typescript");
      expect(
        manager
          .listServerStatuses({ workspaceRoot, filePath })
          .map((server) => server.registryId ?? server.id),
      ).not.toContain("deno");

      await writeFile(join(workspaceRoot, "deno.json"), "{}\n");

      expect(
        manager
          .listServerStatuses({ workspaceRoot, filePath })
          .map((server) => server.registryId ?? server.id),
      ).toContain("deno");
      expect(
        manager
          .listServerStatuses({ workspaceRoot, filePath })
          .map((server) => server.registryId ?? server.id),
      ).not.toContain("typescript");
    } finally {
      await rm(workspaceRoot, { force: true, recursive: true });
    }
  });

  it("allows explicit TypeScript targeting inside Deno workspaces", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "lsp-mcp-deno-"));
    try {
      const { manager } = createManager({ config: { lsp: { servers: {} } } });
      const filePath = join(workspaceRoot, "mod.ts");
      await writeFile(filePath, "export const value = 1;\n");
      await writeFile(join(workspaceRoot, "deno.json"), "{}\n");

      const result = await manager.getSessionsForFile({
        workspaceRoot,
        filePath,
        serverId: "typescript",
      });

      expect(result.map((session) => session.serverId)).toEqual(["typescript"]);
    } finally {
      await rm(workspaceRoot, { force: true, recursive: true });
    }
  });

  it("exposes aliases and upstream metadata in server statuses", () => {
    const { manager } = createManager({ config: { lsp: { servers: {} } } });

    expect(
      manager.listServerStatuses({ workspaceRoot: "/workspace", serverId: "ts_ls" })[0],
    ).toMatchObject({
      id: "typescript",
      aliases: expect.arrayContaining(["ts_ls"]),
      upstream: expect.objectContaining({ mason: expect.any(Object) }),
    });
  });

  it("starts only the provided serverId when multiple servers match", async () => {
    const { manager, sessions } = createManager({
      config: {
        lsp: {
          servers: {
            ts: { registry: "typescript", command: "ts-ls" },
            customTs: { command: "custom-ts-ls", extensions: [".ts"] },
          },
        },
      },
    });

    const result = await manager.getSessionsForFile({
      workspaceRoot: "/workspace",
      filePath: "/workspace/src/app.ts",
      serverId: "customTs",
    });

    expect(result.map((session) => session.serverId)).toEqual(["customTs"]);
    expect(sessions.map((session) => session.command)).toEqual(["custom-ts-ls"]);
  });

  it("allows explicit targeting for custom servers without match criteria", async () => {
    const { manager, sessions } = createManager({
      config: {
        lsp: {
          servers: {
            custom: { command: "custom-ls" },
          },
        },
      },
    });

    const result = await manager.getSessionsForFile({
      workspaceRoot: "/workspace",
      filePath: "/workspace/src/app.ts",
      serverId: "custom",
    });

    expect(result.map((session) => session.serverId)).toEqual(["custom"]);
    expect(sessions.map((session) => session.command)).toEqual(["custom-ls"]);
  });

  it("rejects a provided serverId that does not match the file or language", async () => {
    const { manager } = createManager();

    await expect(
      manager.getSessionsForFile({
        workspaceRoot: "/workspace",
        filePath: "/workspace/main.py",
        languageId: "python",
        serverId: "json",
      }),
    ).rejects.toThrow("Server json does not match /workspace/main.py or language python");
  });

  it("reuses an existing live session for the same workspace root and server ID", async () => {
    const { manager, sessions } = createManager();

    const first = await manager.getSessionsForFile({
      workspaceRoot: "/workspace",
      filePath: "/workspace/src/app.ts",
    });
    const second = await manager.getSessionsForFile({
      workspaceRoot: "/workspace",
      filePath: "/workspace/src/other.ts",
    });

    expect(second[0]?.session).toBe(first[0]?.session);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.starts).toBe(1);
  });

  it("notifies when a session shuts down", async () => {
    const onSessionShutdown = vi.fn();
    const { manager, sessions } = createManager({ onSessionShutdown });

    await manager.getSessionsForFile({
      workspaceRoot: "/workspace",
      filePath: "/workspace/src/app.ts",
    });
    await manager.stopServer({ workspaceRoot: "/workspace", serverId: "ts" });

    expect(onSessionShutdown).toHaveBeenCalledOnce();
    expect(onSessionShutdown).toHaveBeenCalledWith(sessions[0]);
  });

  it("shares one start operation across concurrent acquisitions for the same workspace and server", async () => {
    const startGate = deferred();
    const sessionFactory = vi.fn((sessionOptions) => {
      const session: StartedSession = {
        id: 1,
        command: sessionOptions.command ?? "",
        args: sessionOptions.args ?? [],
        starts: 0,
        shutdowns: 0,
        async start() {
          this.starts += 1;
          await startGate.promise;
        },
        async shutdown() {
          this.shutdowns += 1;
        },
        onNotification() {
          return { dispose() {} };
        },
        async sendNotification() {},
        async sendRequest<T>() {
          return undefined as T;
        },
      };
      return session;
    });
    const { manager } = createManager({ sessionFactory });

    const first = manager.getSessionsForFile({
      workspaceRoot: "/workspace",
      filePath: "/workspace/src/app.ts",
    });
    const second = manager.getSessionsForFile({
      workspaceRoot: "/workspace",
      filePath: "/workspace/src/other.ts",
    });
    startGate.resolve();
    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(sessionFactory).toHaveBeenCalledOnce();
    expect(firstResult[0]?.session).toBe(secondResult[0]?.session);
    expect((firstResult[0]?.session as StartedSession | undefined)?.starts).toBe(1);
  });

  it("stops a server startup in progress and leaves no running session", async () => {
    const startGate = deferred();
    const { manager, sessions } = createManager({
      sessionFactory: (sessionOptions) => {
        const session: StartedSession = {
          id: sessions.length + 1,
          command: sessionOptions.command ?? "",
          args: sessionOptions.args ?? [],
          starts: 0,
          shutdowns: 0,
          async start() {
            this.starts += 1;
            await startGate.promise;
          },
          async shutdown() {
            this.shutdowns += 1;
          },
          onNotification() {
            return { dispose() {} };
          },
          async sendNotification() {},
          async sendRequest<T>() {
            return undefined as T;
          },
        };
        sessions.push(session);
        return session;
      },
    });

    const startup = manager.getSessionsForFile({
      workspaceRoot: "/workspace",
      filePath: "/workspace/src/app.ts",
      serverId: "ts",
    });
    await vi.waitFor(() => expect(sessions).toHaveLength(1));
    const stopped = manager.stopServer({ workspaceRoot: "/workspace", serverId: "ts" });
    startGate.resolve();

    await expect(startup).resolves.toHaveLength(1);
    await expect(stopped).resolves.toBe(true);
    expect(sessions[0]?.shutdowns).toBe(1);
    expect(manager.activeSessionCount).toBe(0);
  });

  it("stops workspace startups in progress and leaves no running sessions", async () => {
    const startGate = deferred();
    const { manager, sessions } = createManager({
      sessionFactory: (sessionOptions) => {
        const session: StartedSession = {
          id: sessions.length + 1,
          command: sessionOptions.command ?? "",
          args: sessionOptions.args ?? [],
          starts: 0,
          shutdowns: 0,
          async start() {
            this.starts += 1;
            await startGate.promise;
          },
          async shutdown() {
            this.shutdowns += 1;
          },
          onNotification() {
            return { dispose() {} };
          },
          async sendNotification() {},
          async sendRequest<T>() {
            return undefined as T;
          },
        };
        sessions.push(session);
        return session;
      },
    });

    const tsStartup = manager.getSessionsForWorkspace({
      workspaceRoot: "/workspace",
      serverId: "ts",
    });
    const jsonStartup = manager.getSessionsForWorkspace({
      workspaceRoot: "/workspace",
      serverId: "json",
    });
    await vi.waitFor(() => expect(sessions).toHaveLength(2));
    const stopped = manager.stopWorkspace("/workspace");
    startGate.resolve();

    await expect(Promise.all([tsStartup, jsonStartup])).resolves.toHaveLength(2);
    await expect(stopped).resolves.toHaveLength(2);
    expect(sessions.map((session) => session.shutdowns)).toEqual([1, 1]);
    expect(manager.activeSessionCount).toBe(0);
  });

  it("shuts down idle sessions and removes them from reuse", async () => {
    vi.useFakeTimers();
    const { manager, sessions } = createManager({ config: { sessions: { idleTimeoutMs: 50 } } });

    await manager.getSessionsForFile({
      workspaceRoot: "/workspace",
      filePath: "/workspace/src/app.ts",
    });
    await vi.advanceTimersByTimeAsync(49);
    expect(sessions[0]?.shutdowns).toBe(0);

    await vi.advanceTimersByTimeAsync(1);
    expect(sessions[0]?.shutdowns).toBe(1);

    await manager.getSessionsForFile({
      workspaceRoot: "/workspace",
      filePath: "/workspace/src/app.ts",
    });
    expect(sessions).toHaveLength(2);
  });

  it("keeps idle sessions reserved until shutdown completes", async () => {
    vi.useFakeTimers();
    const shutdownGate = deferred();
    const { manager, sessions } = createManager({
      config: { sessions: { idleTimeoutMs: 50, maxActiveServers: 1 } },
      sessionFactory: (sessionOptions) => {
        const session: StartedSession = {
          id: sessions.length + 1,
          command: sessionOptions.command ?? "",
          args: sessionOptions.args ?? [],
          starts: 0,
          shutdowns: 0,
          async start() {
            this.starts += 1;
          },
          async shutdown() {
            this.shutdowns += 1;
            await shutdownGate.promise;
          },
          onNotification() {
            return { dispose() {} };
          },
          async sendNotification() {},
          async sendRequest<T>() {
            return undefined as T;
          },
        };
        sessions.push(session);
        return session;
      },
    });

    await manager.getSessionsForFile({
      workspaceRoot: "/workspace",
      filePath: "/workspace/src/app.ts",
    });
    await vi.advanceTimersByTimeAsync(50);

    await expect(
      manager.getSessionsForFile({
        workspaceRoot: "/workspace",
        filePath: "/workspace/package.json",
      }),
    ).rejects.toThrow("Max active LSP servers reached (1)");
    const sameKey = manager.getSessionsForFile({
      workspaceRoot: "/workspace",
      filePath: "/workspace/src/app.ts",
    });
    expect(sessions).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(sessions).toHaveLength(1);

    shutdownGate.resolve();
    const sameKeyResult = await sameKey;

    expect(sessions).toHaveLength(2);
    expect(sameKeyResult[0]?.session).toBe(sessions[1]);
    expect(sameKeyResult[0]?.session).not.toBe(sessions[0]);
    expect(sessions[1]?.starts).toBe(1);
  });

  it("starts a fresh same-key session after a failed shutdown completes", async () => {
    vi.useFakeTimers();
    const shutdownGate = deferred();
    const { manager, sessions } = createManager({
      config: { sessions: { idleTimeoutMs: 50, maxActiveServers: 1 } },
      sessionFactory: (sessionOptions) => {
        const session: StartedSession = {
          id: sessions.length + 1,
          command: sessionOptions.command ?? "",
          args: sessionOptions.args ?? [],
          starts: 0,
          shutdowns: 0,
          async start() {
            this.starts += 1;
          },
          async shutdown() {
            this.shutdowns += 1;
            if (this.id === 1) {
              await shutdownGate.promise;
              throw new Error("shutdown failed");
            }
          },
          onNotification() {
            return { dispose() {} };
          },
          async sendNotification() {},
          async sendRequest<T>() {
            return undefined as T;
          },
        };
        sessions.push(session);
        return session;
      },
    });

    await manager.getSessionsForFile({
      workspaceRoot: "/workspace",
      filePath: "/workspace/src/app.ts",
    });
    await vi.advanceTimersByTimeAsync(50);

    const sameKey = manager.getSessionsForFile({
      workspaceRoot: "/workspace",
      filePath: "/workspace/src/app.ts",
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(sessions).toHaveLength(1);

    shutdownGate.resolve();
    const sameKeyResult = await sameKey;

    expect(sessions).toHaveLength(2);
    expect(sameKeyResult[0]?.session).toBe(sessions[1]);
    expect(sessions[1]?.starts).toBe(1);
  });

  it("touches the idle deadline on reuse", async () => {
    vi.useFakeTimers();
    const { manager, sessions } = createManager({ config: { sessions: { idleTimeoutMs: 50 } } });

    await manager.getSessionsForFile({
      workspaceRoot: "/workspace",
      filePath: "/workspace/src/app.ts",
    });
    await vi.advanceTimersByTimeAsync(40);
    await manager.getSessionsForFile({
      workspaceRoot: "/workspace",
      filePath: "/workspace/src/other.ts",
    });
    await vi.advanceTimersByTimeAsync(40);
    expect(sessions[0]?.shutdowns).toBe(0);

    await vi.advanceTimersByTimeAsync(10);
    expect(sessions[0]?.shutdowns).toBe(1);
  });

  it("enforces maxActiveServers with a clear error", async () => {
    const { manager } = createManager({ config: { sessions: { maxActiveServers: 1 } } });

    await manager.getSessionsForFile({
      workspaceRoot: "/workspace",
      filePath: "/workspace/src/app.ts",
    });

    await expect(
      manager.getSessionsForFile({
        workspaceRoot: "/workspace",
        filePath: "/workspace/package.json",
      }),
    ).rejects.toThrow("Max active LSP servers reached (1)");
  });

  it("uses the resolver result before constructing the session", async () => {
    const commandResolver = vi.fn(async () => ({
      status: "ready" as const,
      source: "installed" as const,
      command: "/cache/ts-ls",
      args: ["--stdio"],
    }));
    const { manager, sessions } = createManager({ commandResolver });

    await manager.getSessionsForFile({
      workspaceRoot: "/workspace",
      filePath: "/workspace/src/app.ts",
    });

    expect(commandResolver).toHaveBeenCalledWith(
      expect.objectContaining({
        serverId: "ts",
        server: expect.objectContaining({ registry: "typescript" }),
      }),
    );
    expect(sessions[0]).toMatchObject({ command: "/cache/ts-ls", args: ["--stdio"] });
  });

  it("passes request concurrency and timeout session config to new sessions", async () => {
    const sessionFactory = vi.fn((sessionOptions) => {
      const session: StartedSession = {
        id: 1,
        command: sessionOptions.command ?? "",
        args: sessionOptions.args ?? [],
        starts: 0,
        shutdowns: 0,
        async start() {
          this.starts += 1;
        },
        async shutdown() {
          this.shutdowns += 1;
        },
        onNotification() {
          return { dispose() {} };
        },
        async sendNotification() {},
        async sendRequest<T>() {
          return undefined as T;
        },
      };
      return session;
    });
    const { manager } = createManager({
      config: {
        sessions: {
          maxConcurrentRequestsPerServer: 3,
          requestTimeoutMs: 11,
          workspaceRequestTimeoutMs: 22,
          methodTimeoutsMs: { "textDocument/hover": 7 },
        },
      },
      sessionFactory,
    });

    await manager.getSessionsForFile({
      workspaceRoot: "/workspace",
      filePath: "/workspace/src/app.ts",
    });

    expect(sessionFactory).toHaveBeenCalledWith(
      expect.objectContaining({
        maxConcurrentRequestsPerServer: 3,
        requestTimeoutMs: 11,
        workspaceRequestTimeoutMs: 22,
        methodTimeoutsMs: { "textDocument/hover": 7 },
      }),
    );
  });

  it("matches language ID when extension is unavailable", async () => {
    const { manager } = createManager();

    const result = await manager.getSessionsForFile({
      workspaceRoot: "/workspace",
      filePath: `/workspace/${basename("Makefile")}`,
      languageId: "typescript",
    });

    expect(result.map((session) => session.serverId)).toEqual(["ts"]);
  });
});
