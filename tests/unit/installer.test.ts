import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { access, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it, vi } from "vitest";

import { builtInServers } from "../../src/registry/builtins.js";
import { defaultCommandExists, resolveLspServerCommand } from "../../src/registry/installer.js";
import { InstallLocks } from "../../src/registry/locks.js";
import { installNpmServer } from "../../src/registry/npmInstaller.js";

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "lsp-mcp-installer-"));
  tempDirs.push(dir);
  return dir;
}

async function makeCacheEnv(): Promise<NodeJS.ProcessEnv> {
  return { XDG_CACHE_HOME: await makeTempDir(), HOME: "/missing" };
}

async function waitForPath(path: string): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      await access(path);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
  }
  throw new Error(`Timed out waiting for ${path}`);
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("resolveLspServerCommand", () => {
  it("prefers an available configured command over registry install", async () => {
    const install = vi.fn();
    const result = await resolveLspServerCommand({
      serverId: "typescript",
      server: { registry: "typescript", command: "custom-ts-ls", args: ["--stdio"] },
      downloads: { enabled: true },
      commandExists: async (command) => command === "custom-ts-ls",
      installers: { npm: install },
    });

    expect(result).toEqual({
      status: "ready",
      command: "custom-ts-ls",
      args: ["--stdio"],
      source: "configured",
    });
    expect(install).not.toHaveBeenCalled();
  });

  it("uses system registry command when it is on PATH", async () => {
    const install = vi.fn();
    const result = await resolveLspServerCommand({
      serverId: "typescript",
      server: { registry: "typescript", profile: "managed" },
      downloads: { enabled: true },
      commandExists: async (command) => command === "typescript-language-server",
      installers: { npm: install },
    });

    expect(result).toMatchObject({
      status: "ready",
      command: "typescript-language-server",
      args: ["--stdio"],
      source: "system",
    });
    expect(install).not.toHaveBeenCalled();
  });

  it("installs managed registry server on first use when downloads are enabled", async () => {
    const install = vi.fn(async () => ({
      command: "/cache/typescript-language-server",
      args: ["--stdio"],
    }));

    const result = await resolveLspServerCommand({
      serverId: "typescript",
      server: { registry: "typescript", profile: "managed" },
      downloads: { enabled: true },
      commandExists: async () => false,
      installers: { npm: install },
      env: await makeCacheEnv(),
    });

    expect(result).toEqual({
      status: "ready",
      command: "/cache/typescript-language-server",
      args: ["--stdio"],
      source: "installed",
    });
    expect(install).toHaveBeenCalledOnce();
  });

  it("installs managed registry server when profile is omitted", async () => {
    const install = vi.fn(async () => ({
      command: "/cache/typescript-language-server",
      args: ["--stdio"],
    }));

    const result = await resolveLspServerCommand({
      serverId: "typescript",
      server: { registry: "typescript" },
      downloads: { enabled: true },
      commandExists: async () => false,
      installers: { npm: install },
      env: await makeCacheEnv(),
    });

    expect(result).toEqual({
      status: "ready",
      command: "/cache/typescript-language-server",
      args: ["--stdio"],
      source: "installed",
    });
    expect(install).toHaveBeenCalledOnce();
  });

  it("does not install registry server when profile is system", async () => {
    const install = vi.fn();

    const result = await resolveLspServerCommand({
      serverId: "typescript",
      server: { registry: "typescript", profile: "system" },
      downloads: { enabled: true },
      commandExists: async () => false,
      installers: { npm: install },
    });

    expect(result).toEqual({
      status: "not-installed",
      reason:
        "typescript-language-server is not available for system profile. Install it manually or switch to managed profile.",
      command: "typescript-language-server",
      args: ["--stdio"],
    });
    expect(install).not.toHaveBeenCalled();
  });

  it("does not fall back to registry install when configured command is missing", async () => {
    const install = vi.fn();

    const result = await resolveLspServerCommand({
      serverId: "typescript",
      server: { registry: "typescript", command: "custom-ts-ls", args: ["--stdio"] },
      downloads: { enabled: true },
      commandExists: async () => false,
      installers: { npm: install },
    });

    expect(result).toEqual({
      status: "error",
      reason: "Configured command custom-ts-ls for typescript was not found on PATH.",
      command: "custom-ts-ls",
      args: ["--stdio"],
    });
    expect(install).not.toHaveBeenCalled();
  });

  it("uses server env PATH when resolving configured command", async () => {
    const topLevelBin = await makeTempDir();
    const serverBin = await makeTempDir();
    await writeFile(join(serverBin, "custom-ls"), "", "utf8");

    const result = await resolveLspServerCommand({
      serverId: "custom",
      server: { command: "custom-ls", args: ["--stdio"], env: { PATH: serverBin } },
      env: { PATH: topLevelBin },
    });

    expect(result).toEqual({
      status: "ready",
      command: "custom-ls",
      args: ["--stdio"],
      source: "configured",
    });
  });

  it("does not install when downloads are disabled", async () => {
    const install = vi.fn();

    const result = await resolveLspServerCommand({
      serverId: "typescript",
      server: { registry: "typescript", profile: "managed" },
      downloads: { enabled: false },
      commandExists: async () => false,
      installers: { npm: install },
    });

    expect(result).toEqual({
      status: "not-installed",
      reason:
        "typescript-language-server is not available and downloads are disabled. Install it manually or enable downloads.",
      command: "typescript-language-server",
      args: ["--stdio"],
    });
    expect(install).not.toHaveBeenCalled();
  });

  it("reports system-only registry servers separately from disabled downloads", async () => {
    const install = vi.fn();

    const result = await resolveLspServerCommand({
      serverId: "rust",
      server: { registry: "rust" },
      downloads: { enabled: true },
      commandExists: async () => false,
      installers: { npm: install },
    });

    expect(result).toEqual({
      status: "not-installed",
      reason:
        "rust-analyzer is not available and automatic installation is not supported for rust. Install it manually.",
      command: "rust-analyzer",
      args: [],
    });
    expect(install).not.toHaveBeenCalled();
  });

  it("does not invent installs for missing user-defined commands", async () => {
    const install = vi.fn();

    const result = await resolveLspServerCommand({
      serverId: "custom",
      server: { command: "custom-ls", args: ["--stdio"] },
      downloads: { enabled: true },
      commandExists: async () => false,
      installers: { npm: install },
    });

    expect(result).toEqual({
      status: "error",
      reason: "Configured command custom-ls for custom was not found on PATH.",
      command: "custom-ls",
      args: ["--stdio"],
    });
    expect(install).not.toHaveBeenCalled();
  });

  it("recognizes existing absolute configured commands", async () => {
    const dir = await makeTempDir();
    const command = join(dir, "language-server");
    await writeFile(command, "", "utf8");

    const result = await resolveLspServerCommand({
      serverId: "custom",
      server: { command, args: ["--stdio"] },
    });

    expect(result).toEqual({ status: "ready", command, args: ["--stdio"], source: "configured" });
  });

  it("reuses managed cached binary without reinstalling", async () => {
    const installDir = await makeTempDir();
    const cachedCommand = join(installDir, "node_modules", ".bin", "typescript-language-server");
    await mkdir(join(installDir, "node_modules", ".bin"), { recursive: true });
    await writeFile(cachedCommand, "", "utf8");
    const install = vi.fn(async () => ({ command: "/should/not/run", args: ["--stdio"] }));

    const first = await resolveLspServerCommand({
      serverId: "typescript",
      server: { registry: "typescript" },
      downloads: { enabled: true },
      commandExists: async () => false,
      installers: { npm: install },
      installDir,
    });
    const second = await resolveLspServerCommand({
      serverId: "typescript",
      server: { registry: "typescript" },
      downloads: { enabled: true },
      commandExists: async () => false,
      installers: { npm: install },
      installDir,
    });

    expect(first).toEqual({
      status: "ready",
      command: cachedCommand,
      args: ["--stdio"],
      source: "installed",
    });
    expect(second).toEqual(first);
    expect(install).not.toHaveBeenCalled();
  });

  it("default command lookup uses injected PATH", async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, "custom-ls"), "", "utf8");

    await expect(defaultCommandExists("custom-ls", { env: { PATH: dir } })).resolves.toBe(true);
  });

  it("default command lookup uses PATHEXT on Windows", async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, "custom-ls.CMD"), "", "utf8");

    await expect(
      defaultCommandExists("custom-ls", {
        env: { PATH: dir, PATHEXT: ".COM;.EXE;.BAT;.CMD" },
        platform: "win32",
      }),
    ).resolves.toBe(true);
  });
});

describe("installNpmServer", () => {
  it("installs the exact pinned package version with lifecycle scripts disabled", async () => {
    const installDir = await makeTempDir();
    const runCommand = vi.fn(() => {
      const child = new EventEmitter();
      queueMicrotask(() => child.emit("exit", 0));
      return child as ReturnType<typeof spawn>;
    }) as unknown as typeof spawn;

    const result = await installNpmServer(builtInServers.typescript, { installDir, runCommand });

    expect(runCommand).toHaveBeenCalledWith(
      "npm",
      ["install", "--ignore-scripts", "--prefix", installDir, "typescript-language-server@5.3.0"],
      { stdio: "ignore" },
    );
    expect(result.command).toContain("typescript-language-server");
    expect(builtInServers.typescript.version).toBe("5.3.0");
    expect(builtInServers.json.version).toBe("4.10.0");
    expect(builtInServers.yaml.version).toBe("1.23.0");
    expect(builtInServers.python.version).toBe("1.1.409");
  });
});

describe("InstallLocks", () => {
  it("deduplicates concurrent installs for the same server and version", async () => {
    const locks = new InstallLocks();
    const install = vi.fn(async () => "installed");

    const [first, second] = await Promise.all([
      locks.withLock("typescript", "5.3.0", install),
      locks.withLock("typescript", "5.3.0", install),
    ]);

    expect(first).toBe("installed");
    expect(second).toBe("installed");
    expect(install).toHaveBeenCalledOnce();
  });

  it("default resolver lock deduplicates concurrent installs", async () => {
    const install = vi.fn(async () => ({
      command: "/cache/typescript-language-server",
      args: ["--stdio"],
    }));
    const env = await makeCacheEnv();

    const [first, second] = await Promise.all([
      resolveLspServerCommand({
        serverId: "typescript",
        server: { registry: "typescript" },
        downloads: { enabled: true },
        commandExists: async () => false,
        installers: { npm: install },
        env,
      }),
      resolveLspServerCommand({
        serverId: "typescript",
        server: { registry: "typescript" },
        downloads: { enabled: true },
        commandExists: async () => false,
        installers: { npm: install },
        env,
      }),
    ]);

    expect(first).toEqual(second);
    expect(install).toHaveBeenCalledOnce();
  });

  it("uses safe filesystem lock directory names", async () => {
    const dir = await makeTempDir();
    const locks = new InstallLocks({ lockRoot: dir });

    await locks.withLock("../type/script", "5.3.0/beta", async () => "installed");

    expect(locks.getLockPath("../type/script", "5.3.0/beta")).toBe(
      join(dir, ".._type_script@5.3.0_beta.lock"),
    );
  });

  it("times out clearly when another instance holds the filesystem lock", async () => {
    const dir = await makeTempDir();
    const first = new InstallLocks({ lockRoot: dir });
    const second = new InstallLocks({ lockRoot: dir, acquireTimeoutMs: 10, retryDelayMs: 1 });
    let releaseFirst!: () => void;

    const firstInstall = first.withLock(
      "typescript",
      "5.3.0",
      () => new Promise<string>((resolve) => (releaseFirst = () => resolve("first"))),
    );

    await waitForPath(join(dir, "typescript@5.3.0.lock", "metadata.json"));

    await expect(second.withLock("typescript", "5.3.0", async () => "second")).rejects.toThrow(
      `Timed out waiting for install lock ${join(dir, "typescript@5.3.0.lock")}`,
    );

    releaseFirst();
    await expect(firstInstall).resolves.toBe("first");
  });

  it("removes stale filesystem locks and continues", async () => {
    const dir = await makeTempDir();
    const lockPath = join(dir, "typescript@5.3.0.lock");
    await mkdir(lockPath, { recursive: true });
    await writeFile(join(lockPath, "metadata.json"), JSON.stringify({ createdAt: 1 }), "utf8");

    const locks = new InstallLocks({ lockRoot: dir, staleTimeoutMs: 1_000, now: () => 10_000 });
    const result = await locks.withLock("typescript", "5.3.0", async () => "installed");

    expect(result).toBe("installed");
  });

  it("does not remove another owner's active lock during cleanup", async () => {
    const dir = await makeTempDir();
    const first = new InstallLocks({ lockRoot: dir });
    let releaseFirst!: () => void;

    const firstInstall = first.withLock(
      "typescript",
      "5.3.0",
      () => new Promise<string>((resolve) => (releaseFirst = () => resolve("first"))),
    );
    await waitForPath(join(dir, "typescript@5.3.0.lock", "metadata.json"));
    await writeFile(
      join(dir, "typescript@5.3.0.lock", "metadata.json"),
      JSON.stringify({
        createdAt: Date.now(),
        pid: 999_999,
        key: "typescript@5.3.0",
        token: "other",
      }),
      "utf8",
    );

    releaseFirst();
    await expect(firstInstall).resolves.toBe("first");

    const metadata = JSON.parse(
      await readFile(join(dir, "typescript@5.3.0.lock", "metadata.json"), "utf8"),
    ) as { token: string };
    expect(metadata.token).toBe("other");
  });

  it("treats metadata-less orphan locks as stale by directory mtime", async () => {
    const dir = await makeTempDir();
    const lockPath = join(dir, "typescript@5.3.0.lock");
    await mkdir(lockPath, { recursive: true });
    const createdAt = (await stat(lockPath)).mtimeMs;

    const locks = new InstallLocks({
      lockRoot: dir,
      staleTimeoutMs: 1_000,
      now: () => createdAt + 10_000,
    });
    const result = await locks.withLock("typescript", "5.3.0", async () => "installed");

    expect(result).toBe("installed");
  });

  it("default resolver uses XDG cache lock root", async () => {
    const cacheHome = await makeTempDir();
    const install = vi.fn(async () => ({
      command: "/cache/typescript-language-server",
      args: ["--stdio"],
    }));

    await resolveLspServerCommand({
      serverId: "typescript",
      server: { registry: "typescript" },
      downloads: { enabled: true },
      commandExists: async () => false,
      installers: { npm: install },
      env: { XDG_CACHE_HOME: cacheHome, HOME: "/missing" },
    });

    expect(install).toHaveBeenCalledOnce();
    const calls = install.mock.calls as unknown as [unknown, { lockRoot: string }][];
    expect(calls[0]?.[1]).toEqual(
      expect.objectContaining({
        lockRoot: join(cacheHome, "lsp-mcp", "install-locks"),
      }),
    );
  });
});
