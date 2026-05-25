import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { LspSessionManager } from "../../src/lsp/sessionManager.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(__dirname, "../fixtures/fake-lsp-server.ts");
const repoRoot = resolve(__dirname, "../..");

let managers: LspSessionManager[] = [];

afterEach(async () => {
  await Promise.all(managers.map((manager) => manager.shutdownAll()));
  managers = [];
});

describe("lazy LSP startup", () => {
  it("starts a real LSP session only on first acquisition and reuses it", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "lsp-mcp-lazy-"));
    const manager = new LspSessionManager({
      config: {
        lsp: {
          servers: {
            ts: {
              registry: "typescript",
              command: process.execPath,
              args: ["--import", "tsx", fixturePath],
              cwd: repoRoot,
            },
          },
        },
      },
      commandResolver: async ({ server }) => ({
        status: "ready",
        source: "configured",
        command: server.command ?? process.execPath,
        args: server.args ?? [],
      }),
    });
    managers.push(manager);

    expect(manager.activeSessionCount).toBe(0);

    const first = await manager.getSessionsForFile({
      workspaceRoot,
      filePath: join(workspaceRoot, "src", "app.ts"),
    });
    const second = await manager.getSessionsForFile({
      workspaceRoot,
      filePath: join(workspaceRoot, "src", "other.ts"),
    });

    expect(first).toHaveLength(1);
    expect(second[0]?.session).toBe(first[0]?.session);
    expect(manager.activeSessionCount).toBe(1);
    expect(first[0]?.session.capabilities).toMatchObject({ hoverProvider: true });
  });
});
