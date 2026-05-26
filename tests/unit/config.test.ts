import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it, vi } from "vitest";

import { loadConfig } from "../../src/config/loadConfig.js";
import { resolveConfigPaths } from "../../src/config/paths.js";

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "lsp-mcp-config-"));
  tempDirs.push(dir);
  return dir;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2), "utf8");
}

async function writeText(path: string, value: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, value, "utf8");
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("loadConfig", () => {
  it("loads user config.json when it is the only config file", async () => {
    const configHome = await makeTempDir();
    await writeJson(join(configHome, "lsp-mcp", "config.json"), {
      lsp: {
        servers: {
          ts: { command: "typescript-language-server", args: ["--stdio"] },
        },
      },
    });

    const result = await loadConfig({ env: { XDG_CONFIG_HOME: configHome }, homeDir: "/missing" });

    expect(result.config).toMatchObject({
      lsp: { servers: { ts: { command: "typescript-language-server", args: ["--stdio"] } } },
    });
  });

  it("lets user config.jsonc override user config.json", async () => {
    const configHome = await makeTempDir();
    await writeJson(join(configHome, "lsp-mcp", "config.json"), { logLevel: "info" });
    await writeText(
      join(configHome, "lsp-mcp", "config.jsonc"),
      '{\n  // higher priority\n  "logLevel": "debug",\n}\n',
    );

    const result = await loadConfig({ env: { XDG_CONFIG_HOME: configHome }, homeDir: "/missing" });

    expect(result.config.logLevel).toBe("debug");
  });

  it("lets project .lsp-mcp.json override user config.jsonc", async () => {
    const configHome = await makeTempDir();
    const workspaceRoot = await makeTempDir();
    await writeText(join(configHome, "lsp-mcp", "config.jsonc"), '{ "logLevel": "debug" }');
    await writeJson(join(workspaceRoot, ".lsp-mcp.json"), { logLevel: "warn" });

    const result = await loadConfig({
      env: { XDG_CONFIG_HOME: configHome },
      homeDir: "/missing",
      workspaceRoot,
    });

    expect(result.config.logLevel).toBe("warn");
  });

  it("lets project .lsp-mcp.jsonc override project .lsp-mcp.json", async () => {
    const configHome = await makeTempDir();
    const workspaceRoot = await makeTempDir();
    await writeJson(join(workspaceRoot, ".lsp-mcp.json"), { logLevel: "warn" });
    await writeText(join(workspaceRoot, ".lsp-mcp.jsonc"), '{ "logLevel": "error" }');

    const result = await loadConfig({
      env: { XDG_CONFIG_HOME: configHome },
      homeDir: "/missing",
      workspaceRoot,
    });

    expect(result.config.logLevel).toBe("error");
  });

  it("replaces arrays instead of concatenating them", async () => {
    const configHome = await makeTempDir();
    const workspaceRoot = await makeTempDir();
    await writeJson(join(configHome, "lsp-mcp", "config.json"), {
      lsp: { servers: { ts: { command: "ts-ls", args: ["--stdio", "--old"] } } },
    });
    await writeJson(join(workspaceRoot, ".lsp-mcp.json"), {
      lsp: { servers: { ts: { args: ["--new"] } } },
    });

    const result = await loadConfig({
      env: { XDG_CONFIG_HOME: configHome },
      homeDir: "/missing",
      workspaceRoot,
    });

    expect(result.config).toMatchObject({ lsp: { servers: { ts: { args: ["--new"] } } } });
  });

  it("deep-merges plain objects", async () => {
    const configHome = await makeTempDir();
    const workspaceRoot = await makeTempDir();
    await writeJson(join(configHome, "lsp-mcp", "config.json"), {
      lsp: { servers: { ts: { command: "ts-ls", env: { A: "1", B: "2" } } } },
    });
    await writeJson(join(workspaceRoot, ".lsp-mcp.json"), {
      lsp: { servers: { ts: { env: { B: "project", C: "3" } } } },
    });

    const result = await loadConfig({
      env: { XDG_CONFIG_HOME: configHome },
      homeDir: "/missing",
      workspaceRoot,
    });

    expect(result.config).toMatchObject({
      lsp: { servers: { ts: { env: { A: "1", B: "project", C: "3" } } } },
    });
  });

  it("merges LSP definitions by server ID", async () => {
    const configHome = await makeTempDir();
    const workspaceRoot = await makeTempDir();
    await writeJson(join(configHome, "lsp-mcp", "config.json"), {
      lsp: { servers: { ts: { command: "ts-ls" }, rust: { command: "rust-analyzer" } } },
    });
    await writeJson(join(workspaceRoot, ".lsp-mcp.json"), {
      lsp: { servers: { ts: { args: ["--stdio"] } } },
    });

    const result = await loadConfig({
      env: { XDG_CONFIG_HOME: configHome },
      homeDir: "/missing",
      workspaceRoot,
    });

    expect(result.config).toEqual({
      lsp: {
        servers: {
          ts: { command: "ts-ls", args: ["--stdio"] },
          rust: { command: "rust-analyzer" },
        },
      },
    });
  });

  it("loads security.allowExternalFiles without warning", async () => {
    const configHome = await makeTempDir();
    const warn = vi.fn();
    await writeJson(join(configHome, "lsp-mcp", "config.json"), {
      security: { allowExternalFiles: true },
    });

    const result = await loadConfig({
      env: { XDG_CONFIG_HOME: configHome },
      homeDir: "/missing",
      warn,
    });

    expect(result.config.security?.allowExternalFiles).toBe(true);
    expect(warn).not.toHaveBeenCalled();
  });

  it("loads sessions.maxOpenDocumentsPerSession without warning", async () => {
    const configHome = await makeTempDir();
    const warn = vi.fn();
    await writeJson(join(configHome, "lsp-mcp", "config.json"), {
      sessions: { maxOpenDocumentsPerSession: 128 },
    });

    const result = await loadConfig({
      env: { XDG_CONFIG_HOME: configHome },
      homeDir: "/missing",
      warn,
    });

    expect(result.config.sessions?.maxOpenDocumentsPerSession).toBe(128);
    expect(warn).not.toHaveBeenCalled();
  });

  it("loads configured LSP serverId overrides without warning", async () => {
    const configHome = await makeTempDir();
    const warn = vi.fn();
    await writeJson(join(configHome, "lsp-mcp", "config.json"), {
      lsp: {
        servers: {
          ts: { registry: "typescript", serverId: "workspace-typescript" },
        },
      },
    });

    const result = await loadConfig({
      env: { XDG_CONFIG_HOME: configHome },
      homeDir: "/missing",
      warn,
    });

    expect(result.config.lsp?.servers?.ts?.serverId).toBe("workspace-typescript");
    expect(warn).not.toHaveBeenCalled();
  });

  it("fails with a precise message for invalid known fields", async () => {
    const configHome = await makeTempDir();
    await writeJson(join(configHome, "lsp-mcp", "config.json"), { lsp: { servers: [] } });

    await expect(
      loadConfig({ env: { XDG_CONFIG_HOME: configHome }, homeDir: "/missing" }),
    ).rejects.toThrow("lsp.servers: Invalid input: expected record, received array");
  });

  it("fails with a precise message for unknown nested known-section keys", async () => {
    const configHome = await makeTempDir();
    await writeJson(join(configHome, "lsp-mcp", "config.json"), { lsp: { unknown: true } });

    await expect(
      loadConfig({ env: { XDG_CONFIG_HOME: configHome }, homeDir: "/missing" }),
    ).rejects.toThrow('lsp: Unrecognized key: "unknown"');
  });

  it("reports malformed JSONC with line and column", async () => {
    const configHome = await makeTempDir();
    const configPath = join(configHome, "lsp-mcp", "config.jsonc");
    await writeText(configPath, '{\n  "logLevel": "info",\n  "lsp": \n}\n');

    await expect(
      loadConfig({ env: { XDG_CONFIG_HOME: configHome }, homeDir: "/missing" }),
    ).rejects.toThrow(`${configPath}: ValueExpected at line 4, column 1`);
  });

  it("warns instead of failing for unknown top-level keys", async () => {
    const configHome = await makeTempDir();
    const warn = vi.fn();
    await writeJson(join(configHome, "lsp-mcp", "config.json"), {
      unknown: true,
      logLevel: "info",
    });

    const result = await loadConfig({
      env: { XDG_CONFIG_HOME: configHome },
      homeDir: "/missing",
      warn,
    });

    expect(result.config.logLevel).toBe("info");
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("unknown top-level config key: unknown"),
    );
  });
});

describe("resolveConfigPaths", () => {
  it("falls back to homeDir/.config when XDG_CONFIG_HOME is unset", () => {
    const homeDir = join(tmpdir(), "tester-home");
    const paths = resolveConfigPaths({ env: {}, homeDir });

    expect(paths.userJson).toBe(join(homeDir, ".config", "lsp-mcp", "config.json"));
    expect(paths.userJsonc).toBe(join(homeDir, ".config", "lsp-mcp", "config.jsonc"));
  });

  it("respects absolute XDG_CONFIG_HOME values", () => {
    const configHome = join(tmpdir(), "xdg-home");
    const paths = resolveConfigPaths({
      env: { XDG_CONFIG_HOME: configHome },
      homeDir: join(tmpdir(), "tester-home"),
    });

    expect(paths.userJson).toBe(join(configHome, "lsp-mcp", "config.json"));
  });

  it("ignores relative XDG_CONFIG_HOME values", () => {
    const homeDir = join(tmpdir(), "tester-home");
    const paths = resolveConfigPaths({
      env: { XDG_CONFIG_HOME: "relative-config" },
      homeDir,
    });

    expect(paths.userJson).toBe(join(homeDir, ".config", "lsp-mcp", "config.json"));
  });

  it("ignores relative homeDir and falls back to absolute HOME", () => {
    const homeDir = join(tmpdir(), "home-from-env");
    const paths = resolveConfigPaths({ env: { HOME: homeDir }, homeDir: "relative-home" });

    expect(paths.userJson).toBe(join(homeDir, ".config", "lsp-mcp", "config.json"));
    expect(paths.userJsonc).toBe(join(homeDir, ".config", "lsp-mcp", "config.jsonc"));
  });

  it("ignores relative HOME and uses no user config paths when no absolute fallback exists", () => {
    const paths = resolveConfigPaths({
      env: { HOME: "relative-home" },
      getHomeDir: () => "also-relative",
    });

    expect(paths.userJson).toBeUndefined();
    expect(paths.userJsonc).toBeUndefined();
  });
});
