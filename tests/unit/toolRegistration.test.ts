import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

import { standardMethodRegistry } from "../../src/lsp/methodRegistry.js";
import type { LspSessionManager } from "../../src/lsp/sessionManager.js";
import { createConfiguredToolRegistry, createToolRegistry } from "../../src/tools/registerTools.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const fixturePath = resolve(__dirname, "../fixtures/fake-lsp-server.ts");

const tempDirs: string[] = [];

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

async function writeText(path: string, value: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, value, "utf8");
}

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("tool registration", () => {
  it("registers control, raw, diagnostics, edit, and standard LSP tools", () => {
    const registry = createToolRegistry({ config: {} });

    const names = registry.tools.map((tool) => tool.name);

    expect(names).toContain("lsp_list_servers");
    expect(names).not.toContain("lsp_servers");
    expect(names).toContain("lsp_server_status");
    expect(names).toContain("lsp_stop_server");
    expect(names).toContain("lsp_stop_workspace");
    expect(names).toContain("lsp_request");
    expect(names).toContain("lsp_notify");
    expect(names).toContain("lsp_execute_command");
    expect(names).toContain("lsp_diagnostics");
    expect(names).toContain("lsp_rename");
    expect(names).toContain("lsp_format_document");
    expect(names).toContain("lsp_format_range");
    expect(names).toContain("lsp_format_on_type");
    expect(names).toContain("lsp_code_actions");
    expect(names).toEqual(
      expect.arrayContaining(standardMethodRegistry.map((entry) => entry.toolName)),
    );
  });

  it("exposes concise descriptions and representative schemas", () => {
    const registry = createToolRegistry({ config: {} });
    const tools = new Map(registry.tools.map((tool) => [tool.name, tool]));

    for (const tool of registry.tools) {
      expect(tool.description).toEqual(expect.any(String));
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.description.length).toBeLessThanOrEqual(120);
      expect(tool.handler).toEqual(expect.any(Function));
    }

    expect(tools.get("lsp_list_servers")!.inputSchema!.safeParse({}).success).toBe(true);
    expect(
      tools.get("lsp_list_servers")!.outputSchema!.safeParse({ ok: true, servers: [] }).success,
    ).toBe(true);
    expect(
      tools.get("hover")!.outputSchema!.safeParse({
        ok: true,
        results: {
          typescript: { ok: true, result: { contents: "hover text" } },
        },
      }).success,
    ).toBe(true);
    expect(
      tools.get("definition")!.outputSchema!.safeParse({
        ok: true,
        results: {
          typescript: {
            ok: true,
            result: [
              {
                uri: "file:///repo/a.ts",
                range: { start: { line: 1, character: 1 }, end: { line: 1, character: 5 } },
                filePath: "/repo/a.ts",
                outsideWorkspace: false,
              },
            ],
          },
        },
      }).success,
    ).toBe(true);
    expect(
      tools.get("lsp_diagnostics")!.outputSchema!.safeParse({
        ok: true,
        results: {
          typescript: {
            ok: true,
            mode: "pull",
            uri: "file:///repo/a.ts",
            filePath: "/repo/a.ts",
            diagnostics: [
              {
                range: { start: { line: 1, character: 1 }, end: { line: 1, character: 5 } },
                message: "Example diagnostic",
                filePath: "/repo/a.ts",
              },
            ],
          },
        },
      }).success,
    ).toBe(true);
    expect(
      tools.get("lsp_rename")!.outputSchema!.safeParse({
        ok: true,
        results: {
          typescript: {
            ok: true,
            applied: false,
            message:
              "Edits were returned but not applied. Re-run with apply: true to modify files.",
            edit: { changes: {} },
          },
        },
      }).success,
    ).toBe(true);
    expect(
      tools.get("hover")!.inputSchema!.safeParse({
        workspaceRoot: "/repo",
        filePath: "/repo/a.ts",
        line: 1,
        character: 1,
      }).success,
    ).toBe(true);
    expect(
      tools.get("hover")!.inputSchema!.safeParse({
        workspaceRoot: "/repo",
        filePath: "/repo/a.ts",
        serverId: "ts",
        line: 1,
        character: 1,
      }).success,
    ).toBe(true);
    expect(
      tools.get("lsp_request")!.inputSchema!.safeParse({
        workspaceRoot: "/repo",
        method: "workspace/symbol",
      }).success,
    ).toBe(true);
    expect(
      tools.get("lsp_rename")!.inputSchema!.parse({
        workspaceRoot: "/repo",
        filePath: "/repo/a.ts",
        line: 1,
        character: 1,
        newName: "nextName",
      }),
    ).toMatchObject({ apply: false });
  });

  it("exposes lifecycle cleanup for its session manager", async () => {
    const shutdownAll = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const sessionManager = {
      shutdownAll,
      getSessionsForFile: vi.fn(),
      getSessionsForWorkspace: vi.fn(),
      getSessionsForFileSettled: vi.fn(),
      getSessionsForWorkspaceSettled: vi.fn(),
    } as unknown as LspSessionManager;
    const registry = createToolRegistry({ config: {}, sessionManager });

    await registry.shutdown();

    expect(shutdownAll).toHaveBeenCalledTimes(1);
  });

  it("uses project config for workspace-scoped tools in the default configured registry", async () => {
    const configHome = await makeTempDir("lsp-mcp-tool-config-home-");
    const workspaceRoot = await makeTempDir("lsp-mcp-tool-workspace-");
    const unrelatedWorkspaceRoot = await makeTempDir("lsp-mcp-tool-other-workspace-");
    vi.stubEnv("XDG_CONFIG_HOME", configHome);
    vi.stubEnv("HOME", "/missing-home");
    await writeText(
      join(workspaceRoot, ".lsp-mcp.jsonc"),
      JSON.stringify({
        lsp: {
          servers: {
            projectCustom: {
              command: process.execPath,
              args: ["--version"],
              languageIds: ["customlang"],
              extensions: [".custom"],
            },
          },
        },
      }),
    );

    const registry = await createConfiguredToolRegistry();
    const statusTool = registry.tools.find((tool) => tool.name === "lsp_server_status")!;

    const result = await statusTool.handler({ workspaceRoot, serverId: "projectCustom" });

    expect(result).toMatchObject({
      ok: true,
      servers: [
        {
          id: "projectCustom",
          kind: "custom",
          command: process.execPath,
          languageIds: ["customlang"],
          extensions: [".custom"],
        },
      ],
    });
    await expect(
      statusTool.handler({ workspaceRoot: unrelatedWorkspaceRoot, serverId: "projectCustom" }),
    ).rejects.toThrow("Unknown LSP server projectCustom");

    await registry.shutdown();
  });

  it("uses cached project config for file-targeted tools until registry shutdown", async () => {
    const configHome = await makeTempDir("lsp-mcp-tool-config-home-");
    const workspaceRoot = await makeTempDir("lsp-mcp-tool-workspace-");
    const eventLogRoot = await makeTempDir("lsp-mcp-tool-events-");
    const filePath = join(workspaceRoot, "app.cached");
    const eventLog = join(eventLogRoot, "server.jsonl");
    vi.stubEnv("XDG_CONFIG_HOME", configHome);
    vi.stubEnv("HOME", "/missing-home");
    await writeText(filePath, "cached content\n");
    await writeText(eventLog, "");
    await writeProjectConfig(workspaceRoot, "cachedServer", ".cached", "cached", eventLog);

    const registry = await createConfiguredToolRegistry();
    const hoverTool = registry.tools.find((tool) => tool.name === "hover")!;

    const firstHover = await hoverTool.handler({ workspaceRoot, filePath, line: 1, character: 1 });

    expect(firstHover).toMatchObject({
      ok: true,
      results: { cachedServer: { ok: true, result: { contents: { value: "cached hover" } } } },
    });

    await writeProjectConfig(workspaceRoot, "changedServer", ".cached", "changed", eventLog);

    const secondHover = await hoverTool.handler({ workspaceRoot, filePath, line: 1, character: 1 });

    expect(secondHover).toMatchObject({
      ok: true,
      results: { cachedServer: { ok: true, result: { contents: { value: "cached hover" } } } },
    });
    expect(Object.keys((secondHover as { results: Record<string, unknown> }).results)).toEqual([
      "cachedServer",
    ]);

    await registry.shutdown();
    await eventually(async () => {
      const methods = await eventMethods(eventLog);
      expect(methods).toContain("shutdown");
      expect(methods).toContain("exit");
    });
  });
});

async function writeProjectConfig(
  workspaceRoot: string,
  serverId: string,
  extension: string,
  label: string,
  eventLog: string,
): Promise<void> {
  await writeText(
    join(workspaceRoot, ".lsp-mcp.jsonc"),
    JSON.stringify({
      sessions: { requestTimeoutMs: 1_000 },
      lsp: {
        servers: {
          [serverId]: {
            command: process.execPath,
            args: ["--import", "tsx", fixturePath],
            cwd: repoRoot,
            languageIds: [label],
            extensions: [extension],
            env: {
              FAKE_LSP_LABEL: label,
              FAKE_LSP_EVENT_LOG: eventLog,
            },
          },
        },
      },
    }),
  );
}

async function eventMethods(eventLog: string): Promise<string[]> {
  const content = await readFile(eventLog, "utf8");
  return content
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { method?: string })
    .map((event) => event.method)
    .filter((method): method is string => typeof method === "string");
}

async function eventually(assertion: () => void | Promise<void>): Promise<void> {
  const deadline = Date.now() + 2_000;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      await assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 20));
    }
  }
  if (lastError) {
    throw lastError;
  }
}
