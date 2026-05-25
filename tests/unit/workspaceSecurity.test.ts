import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { validateWorkspacePath } from "../../src/security/workspace.js";

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "lsp-mcp-security-"));
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

describe("validateWorkspacePath", () => {
  it("denies outside-workspace paths by default", async () => {
    const root = await makeTempDir();
    const outside = await makeTempDir();
    const filePath = join(outside, "index.ts");
    await writeText(filePath);

    await expect(validateWorkspacePath({ filePath, workspaceRoot: root })).rejects.toThrow(
      "outside workspace root",
    );
  });

  it("allows outside-workspace paths when allowExternalFiles is true and marks them outside", async () => {
    const root = await makeTempDir();
    const outside = await makeTempDir();
    const filePath = join(outside, "index.ts");
    await writeText(filePath);

    const result = await validateWorkspacePath({
      filePath,
      workspaceRoot: root,
      security: { allowExternalFiles: true },
    });

    expect(result.isOutsideWorkspace).toBe(true);
    expect(result.path).toBe(filePath);
  });

  it("does not allow a symlink escape to bypass default deny", async () => {
    const root = await makeTempDir();
    const outside = await makeTempDir();
    const outsideFile = join(outside, "secret.ts");
    const linkedFile = join(root, "linked-secret.ts");
    await writeText(outsideFile);
    await symlink(outsideFile, linkedFile);

    await expect(
      validateWorkspacePath({ filePath: linkedFile, workspaceRoot: root }),
    ).rejects.toThrow("outside workspace root");
  });
});
