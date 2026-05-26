import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { LspSessionManager } from "../../src/lsp/sessionManager.js";
import { createToolRegistry, type ToolRegistry } from "../../src/tools/registerTools.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const fixturePath = resolve(__dirname, "../fixtures/fake-lsp-server.ts");

const tempDirs: string[] = [];
const registries: ToolRegistry[] = [];

afterEach(async () => {
  await Promise.all(registries.splice(0).map((registry) => registry.shutdown()));
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("end-to-end smoke tests", () => {
  it("handles lazy startup, aggregation, server targeting, edits, commands, security, and idle shutdown", async () => {
    const { workspaceRoot, filePath, outsidePath, eventLogs } = await createWorkspace();
    const manager = new LspSessionManager({
      config: createConfig(outsidePath, eventLogs, 500),
      commandResolver: async ({ server }) => ({
        status: "ready",
        source: "configured",
        command: server.command ?? process.execPath,
        args: server.args ?? [],
      }),
    });
    const registry = createToolRegistry({
      config: createConfig(outsidePath, eventLogs, 500),
      sessionManager: manager,
    });
    registries.push(registry);

    expect(manager.activeSessionCount).toBe(0);

    const hover = await callTool(registry, "hover", {
      workspaceRoot,
      filePath,
      line: 1,
      character: 7,
    });

    expect(manager.activeSessionCount).toBe(2);
    expect(hover).toMatchObject({
      ok: true,
      results: {
        "typescript-language-server": {
          ok: true,
          result: { contents: { value: "alpha hover" } },
        },
        beta: { ok: true, result: { contents: { value: "beta hover" } } },
      },
    });
    expect(await hoverRequestCount(eventLogs.alpha)).toBe(1);
    expect(await hoverRequestCount(eventLogs.beta)).toBe(1);

    const hoverCountsBeforeTargeting = {
      alpha: await hoverRequestCount(eventLogs.alpha),
      beta: await hoverRequestCount(eventLogs.beta),
    };

    const targetedHover = await callTool(registry, "hover", {
      workspaceRoot,
      filePath,
      line: 1,
      character: 7,
      serverId: "beta",
    });

    expect(targetedHover).toMatchObject({
      ok: true,
      results: {
        beta: { ok: true, result: { contents: { value: "beta hover" } } },
      },
    });
    expect(Object.keys(targetedHover.results)).toEqual(["beta"]);
    expect(await hoverRequestCount(eventLogs.alpha)).toBe(hoverCountsBeforeTargeting.alpha);
    expect(await hoverRequestCount(eventLogs.beta)).toBe(hoverCountsBeforeTargeting.beta + 1);

    const preview = await callTool(registry, "format_document", {
      workspaceRoot,
      filePath,
      serverId: "alpha",
    });

    await expect(readFile(filePath, "utf8")).resolves.toBe("const value = 1;\n");
    expect(preview.results["typescript-language-server"]).toMatchObject({
      ok: true,
      applied: false,
      message: "Edits were returned but not applied. Re-run with apply: true to modify files.",
    });

    const applied = await callTool(registry, "format_document", {
      workspaceRoot,
      filePath,
      serverId: "alpha",
      apply: true,
    });

    await expect(readFile(filePath, "utf8")).resolves.toBe("const alphaFormatted = 1;\n");
    expect(applied.results["typescript-language-server"]).toMatchObject({
      ok: true,
      applied: true,
    });

    const command = await callTool(registry, "execute_command", {
      workspaceRoot,
      filePath,
      serverId: "alpha",
      command: "source.fixAll.fake",
      arguments: [{ filePath }],
    });

    expect(command.results["typescript-language-server"]).toMatchObject({
      ok: true,
      result: {
        executed: { command: "source.fixAll.fake", arguments: [{ filePath }] },
      },
    });

    const outsideEdit = await callTool(registry, "code_actions", {
      workspaceRoot,
      filePath,
      serverId: "alpha",
      startLine: 1,
      startCharacter: 1,
      endLine: 1,
      endCharacter: 6,
      apply: true,
    });

    expect(outsideEdit.results["typescript-language-server"]).toMatchObject({
      ok: false,
      error: expect.stringContaining("outside workspace root"),
    });

    await eventually(() => expect(manager.activeSessionCount).toBe(0));
  }, 30_000);
});

interface EventLogs {
  alpha: string;
  beta: string;
}

function createConfig(outsidePath: string, eventLogs: EventLogs, idleTimeoutMs: number) {
  return {
    downloads: { enabled: false },
    sessions: { idleTimeoutMs, requestTimeoutMs: 1_000 },
    lsp: {
      servers: {
        alpha: {
          registry: "typescript",
          ...fakeServer("alpha", "alphaFormatted", outsidePath, eventLogs.alpha),
        },
        beta: fakeServer("beta", "betaFormatted", outsidePath, eventLogs.beta),
      },
    },
  };
}

function fakeServer(label: string, formatText: string, outsidePath: string, eventLog: string) {
  return {
    command: process.execPath,
    args: ["--import", "tsx", fixturePath],
    cwd: repoRoot,
    languageIds: ["typescript"],
    extensions: [".ts"],
    env: {
      FAKE_LSP_LABEL: label,
      FAKE_LSP_FORMAT_TEXT: formatText,
      FAKE_LSP_OUTSIDE_PATH: outsidePath,
      FAKE_LSP_EVENT_LOG: eventLog,
    },
  };
}

async function createWorkspace() {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "lsp-mcp-e2e-"));
  const outsideRoot = await mkdtemp(join(tmpdir(), "lsp-mcp-e2e-outside-"));
  const eventLogRoot = await mkdtemp(join(tmpdir(), "lsp-mcp-e2e-events-"));
  tempDirs.push(workspaceRoot, outsideRoot, eventLogRoot);
  const filePath = resolve(workspaceRoot, "app.ts");
  const outsidePath = resolve(outsideRoot, "outside.ts");
  const eventLogs = {
    alpha: resolve(eventLogRoot, "alpha.jsonl"),
    beta: resolve(eventLogRoot, "beta.jsonl"),
  };
  await writeFile(filePath, "const value = 1;\n", "utf8");
  await Promise.all(Object.values(eventLogs).map((eventLog) => writeFile(eventLog, "", "utf8")));
  return { workspaceRoot, filePath, outsidePath, eventLogs };
}

async function hoverRequestCount(eventLog: string): Promise<number> {
  const events = await readEventLog(eventLog);
  return events.filter((event) => event.method === "textDocument/hover").length;
}

async function readEventLog(eventLog: string): Promise<Array<{ method?: string }>> {
  const content = await readFile(eventLog, "utf8");
  return content
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { method?: string });
}

async function callTool(registry: ToolRegistry, name: string, input: unknown) {
  const tool = registry.tools.find((registered) => registered.name === name);
  if (!tool) {
    throw new Error(`Missing tool ${name}`);
  }
  return (await tool.handler(input)) as Record<string, any>;
}

async function eventually(assertion: () => void | Promise<void>) {
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
