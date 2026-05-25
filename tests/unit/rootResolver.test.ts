import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { resolveWorkspaceRoot } from "../../src/config/rootResolver.js";

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "lsp-mcp-root-"));
  tempDirs.push(dir);
  return dir;
}

async function writeText(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, "", "utf8");
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("resolveWorkspaceRoot", () => {
  it("uses explicit workspaceRoot when file is inside it", async () => {
    const root = await makeTempDir();
    const filePath = join(root, "src", "index.ts");
    await writeText(filePath);

    const result = await resolveWorkspaceRoot({ filePath, workspaceRoot: root });

    expect(result.workspaceRoot).toBe(root);
    expect(result.source).toBe("explicit");
    expect(result.file.isOutsideWorkspace).toBe(false);
  });

  it("rejects explicit workspaceRoot when file is outside it by default", async () => {
    const root = await makeTempDir();
    const outside = await makeTempDir();
    const filePath = join(outside, "index.ts");
    await writeText(filePath);

    await expect(resolveWorkspaceRoot({ filePath, workspaceRoot: root })).rejects.toThrow(
      "outside workspace root",
    );
  });

  it("uses the nearest configured root marker", async () => {
    const root = await makeTempDir();
    const nested = join(root, "packages", "app");
    const filePath = join(nested, "src", "index.ts");
    await writeText(join(root, "marker"));
    await writeText(join(nested, "marker"));
    await writeText(filePath);

    const result = await resolveWorkspaceRoot({ filePath, rootMarkers: ["marker"] });

    expect(result.workspaceRoot).toBe(nested);
    expect(result.source).toBe("marker");
    expect(result.marker).toBe("marker");
  });

  it("uses .lsp-mcp.json as a built-in root marker", async () => {
    const root = await makeTempDir();
    const filePath = join(root, "src", "index.ts");
    await writeText(join(root, ".lsp-mcp.json"));
    await writeText(filePath);

    const result = await resolveWorkspaceRoot({ filePath });

    expect(result.workspaceRoot).toBe(root);
    expect(result.source).toBe("marker");
    expect(result.marker).toBe(".lsp-mcp.json");
  });

  it("uses .lsp-mcp.jsonc as a built-in root marker", async () => {
    const root = await makeTempDir();
    const filePath = join(root, "src", "index.ts");
    await writeText(join(root, ".lsp-mcp.jsonc"));
    await writeText(filePath);

    const result = await resolveWorkspaceRoot({ filePath });

    expect(result.workspaceRoot).toBe(root);
    expect(result.source).toBe("marker");
    expect(result.marker).toBe(".lsp-mcp.jsonc");
  });

  it("keeps built-in root markers active when custom root markers are configured", async () => {
    const root = await makeTempDir();
    const filePath = join(root, "src", "index.ts");
    await writeText(join(root, ".lsp-mcp.json"));
    await writeText(filePath);

    const result = await resolveWorkspaceRoot({ filePath, rootMarkers: ["custom-root"] });

    expect(result.workspaceRoot).toBe(root);
    expect(result.source).toBe("marker");
    expect(result.marker).toBe(".lsp-mcp.json");
  });

  it("falls back to nearest .git directory", async () => {
    const root = await makeTempDir();
    const filePath = join(root, "src", "index.ts");
    await mkdir(join(root, ".git"));
    await writeText(filePath);

    const result = await resolveWorkspaceRoot({ filePath, rootMarkers: ["missing-marker"] });

    expect(result.workspaceRoot).toBe(root);
    expect(result.source).toBe("vcs");
    expect(result.marker).toBe(".git");
  });

  it("falls back to the file parent directory", async () => {
    const root = await makeTempDir();
    const filePath = join(root, "src", "index.ts");
    await writeText(filePath);

    const result = await resolveWorkspaceRoot({ filePath, rootMarkers: ["missing-marker"] });

    expect(result.workspaceRoot).toBe(join(root, "src"));
    expect(result.source).toBe("parent");
  });
});
