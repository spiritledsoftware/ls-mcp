import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { applyTextEdits, applyWorkspaceEdit } from "../../src/lsp/editApplier.js";
import { filePathToUri } from "../../src/lsp/documentStore.js";

const tempDirs: string[] = [];

async function makeWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "lsp-mcp-edit-applier-"));
  tempDirs.push(dir);
  return dir;
}

async function writeText(path: string, text: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text, "utf8");
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("applyTextEdits", () => {
  it("applies edits in reverse range order", async () => {
    const workspaceRoot = await makeWorkspace();
    const filePath = join(workspaceRoot, "app.ts");
    await writeText(filePath, "abcdef\n");

    const result = await applyTextEdits({
      workspaceRoot,
      filePath,
      edits: [
        {
          range: { start: { line: 0, character: 1 }, end: { line: 0, character: 3 } },
          newText: "BC",
        },
        {
          range: { start: { line: 0, character: 4 }, end: { line: 0, character: 6 } },
          newText: "EF",
        },
      ],
    });

    await expect(readFile(filePath, "utf8")).resolves.toBe("aBCdEF\n");
    expect(result.changedFiles).toEqual([{ filePath, changeType: "modified" }]);
  });

  it("rejects outside-workspace text edits by default", async () => {
    const workspaceRoot = await makeWorkspace();
    const outsideRoot = await makeWorkspace();
    const filePath = join(outsideRoot, "secret.ts");
    await writeText(filePath, "secret\n");

    await expect(
      applyTextEdits({
        workspaceRoot,
        filePath,
        edits: [
          {
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 6 } },
            newText: "public",
          },
        ],
      }),
    ).rejects.toThrow("outside workspace root");
    await expect(readFile(filePath, "utf8")).resolves.toBe("secret\n");
  });

  it("allows outside-workspace text edits when allowExternalFiles is true", async () => {
    const workspaceRoot = await makeWorkspace();
    const outsideRoot = await makeWorkspace();
    const filePath = join(outsideRoot, "external.ts");
    await writeText(filePath, "external\n");

    const result = await applyTextEdits({
      workspaceRoot,
      filePath,
      security: { allowExternalFiles: true },
      edits: [
        {
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 8 } },
          newText: "updated",
        },
      ],
    });

    await expect(readFile(filePath, "utf8")).resolves.toBe("updated\n");
    expect(result.changedFiles).toEqual([{ filePath, changeType: "modified" }]);
  });

  it("rejects overlapping text edits", async () => {
    const workspaceRoot = await makeWorkspace();
    const filePath = join(workspaceRoot, "app.ts");
    await writeText(filePath, "abcdef\n");

    await expect(
      applyTextEdits({
        workspaceRoot,
        filePath,
        edits: [
          {
            range: { start: { line: 0, character: 1 }, end: { line: 0, character: 4 } },
            newText: "x",
          },
          {
            range: { start: { line: 0, character: 3 }, end: { line: 0, character: 5 } },
            newText: "y",
          },
        ],
      }),
    ).rejects.toThrow("overlap");
    await expect(readFile(filePath, "utf8")).resolves.toBe("abcdef\n");
  });

  it("rejects text edits with duplicate starts", async () => {
    const workspaceRoot = await makeWorkspace();
    const filePath = join(workspaceRoot, "app.ts");
    await writeText(filePath, "abcdef\n");

    await expect(
      applyTextEdits({
        workspaceRoot,
        filePath,
        edits: [
          {
            range: { start: { line: 0, character: 1 }, end: { line: 0, character: 2 } },
            newText: "x",
          },
          {
            range: { start: { line: 0, character: 1 }, end: { line: 0, character: 3 } },
            newText: "y",
          },
        ],
      }),
    ).rejects.toThrow("overlap");
    await expect(readFile(filePath, "utf8")).resolves.toBe("abcdef\n");
  });

  it("allows adjacent non-overlapping text edits", async () => {
    const workspaceRoot = await makeWorkspace();
    const filePath = join(workspaceRoot, "app.ts");
    await writeText(filePath, "abcdef\n");

    await applyTextEdits({
      workspaceRoot,
      filePath,
      edits: [
        {
          range: { start: { line: 0, character: 1 }, end: { line: 0, character: 3 } },
          newText: "BC",
        },
        {
          range: { start: { line: 0, character: 3 }, end: { line: 0, character: 5 } },
          newText: "DE",
        },
      ],
    });

    await expect(readFile(filePath, "utf8")).resolves.toBe("aBCDEf\n");
  });

  it("treats empty text edits as a no-op", async () => {
    const workspaceRoot = await makeWorkspace();
    const filePath = join(workspaceRoot, "app.ts");
    await writeText(filePath, "abcdef\n");

    const result = await applyTextEdits({ workspaceRoot, filePath, edits: [] });

    await expect(readFile(filePath, "utf8")).resolves.toBe("abcdef\n");
    expect(result.changedFiles).toEqual([]);
  });
});

describe("applyWorkspaceEdit", () => {
  it("applies changes maps and documentChanges text document edits", async () => {
    const workspaceRoot = await makeWorkspace();
    const first = join(workspaceRoot, "first.ts");
    const second = join(workspaceRoot, "second.ts");
    await writeText(first, "const one = 1;\n");
    await writeText(second, "const two = 2;\n");

    const result = await applyWorkspaceEdit({
      workspaceRoot,
      edit: {
        changes: {
          [filePathToUri(first)]: [
            {
              range: { start: { line: 0, character: 6 }, end: { line: 0, character: 9 } },
              newText: "uno",
            },
          ],
        },
        documentChanges: [
          {
            textDocument: { uri: filePathToUri(second), version: null },
            edits: [
              {
                range: { start: { line: 0, character: 6 }, end: { line: 0, character: 9 } },
                newText: "dos",
              },
            ],
          },
        ],
      },
    });

    await expect(readFile(first, "utf8")).resolves.toBe("const uno = 1;\n");
    await expect(readFile(second, "utf8")).resolves.toBe("const dos = 2;\n");
    expect(result.changedFiles).toEqual([
      { filePath: first, changeType: "modified" },
      { filePath: second, changeType: "modified" },
    ]);
  });

  it("applies create, rename, and delete operations inside the workspace", async () => {
    const workspaceRoot = await makeWorkspace();
    const created = join(workspaceRoot, "created.ts");
    const source = join(workspaceRoot, "source.ts");
    const renamed = join(workspaceRoot, "renamed.ts");
    const deleted = join(workspaceRoot, "deleted.ts");
    await writeText(source, "source\n");
    await writeText(deleted, "deleted\n");

    const result = await applyWorkspaceEdit({
      workspaceRoot,
      edit: {
        documentChanges: [
          { kind: "create", uri: filePathToUri(created) },
          { kind: "rename", oldUri: filePathToUri(source), newUri: filePathToUri(renamed) },
          { kind: "delete", uri: filePathToUri(deleted) },
        ],
      },
    });

    await expect(readFile(created, "utf8")).resolves.toBe("");
    await expect(readFile(renamed, "utf8")).resolves.toBe("source\n");
    await expect(readFile(deleted, "utf8")).rejects.toThrow();
    expect(result.changedFiles).toEqual([
      { filePath: created, changeType: "created" },
      { filePath: renamed, changeType: "renamed" },
      { filePath: deleted, changeType: "deleted" },
    ]);
  });

  it("applies a text document edit after creating the target file", async () => {
    const workspaceRoot = await makeWorkspace();
    const created = join(workspaceRoot, "created.ts");

    const result = await applyWorkspaceEdit({
      workspaceRoot,
      edit: {
        documentChanges: [
          { kind: "create", uri: filePathToUri(created) },
          {
            textDocument: { uri: filePathToUri(created), version: null },
            edits: [
              {
                range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
                newText: "created content\n",
              },
            ],
          },
        ],
      },
    });

    await expect(readFile(created, "utf8")).resolves.toBe("created content\n");
    expect(result.changedFiles).toEqual([{ filePath: created, changeType: "created" }]);
  });

  it("applies a text document edit after renaming to the target file", async () => {
    const workspaceRoot = await makeWorkspace();
    const source = join(workspaceRoot, "source.ts");
    const renamed = join(workspaceRoot, "renamed.ts");
    await writeText(source, "const value = 1;\n");

    const result = await applyWorkspaceEdit({
      workspaceRoot,
      edit: {
        documentChanges: [
          { kind: "rename", oldUri: filePathToUri(source), newUri: filePathToUri(renamed) },
          {
            textDocument: { uri: filePathToUri(renamed), version: null },
            edits: [
              {
                range: { start: { line: 0, character: 6 }, end: { line: 0, character: 11 } },
                newText: "renamed",
              },
            ],
          },
        ],
      },
    });

    await expect(readFile(source, "utf8")).rejects.toThrow();
    await expect(readFile(renamed, "utf8")).resolves.toBe("const renamed = 1;\n");
    expect(result.changedFiles).toEqual([{ filePath: renamed, changeType: "renamed" }]);
  });

  it("rejects an invalid text document edit after create without creating the file", async () => {
    const workspaceRoot = await makeWorkspace();
    const created = join(workspaceRoot, "created.ts");

    await expect(
      applyWorkspaceEdit({
        workspaceRoot,
        edit: {
          documentChanges: [
            { kind: "create", uri: filePathToUri(created) },
            {
              textDocument: { uri: filePathToUri(created), version: null },
              edits: [
                {
                  range: { start: { line: 1, character: 0 }, end: { line: 1, character: 0 } },
                  newText: "invalid\n",
                },
              ],
            },
          ],
        },
      }),
    ).rejects.toThrow("outside document");
    await expect(readFile(created, "utf8")).rejects.toThrow();
  });

  it("applies create followed by rename", async () => {
    const workspaceRoot = await makeWorkspace();
    const created = join(workspaceRoot, "created.ts");
    const renamed = join(workspaceRoot, "renamed.ts");

    const result = await applyWorkspaceEdit({
      workspaceRoot,
      edit: {
        documentChanges: [
          { kind: "create", uri: filePathToUri(created) },
          { kind: "rename", oldUri: filePathToUri(created), newUri: filePathToUri(renamed) },
        ],
      },
    });

    await expect(readFile(created, "utf8")).rejects.toThrow();
    await expect(readFile(renamed, "utf8")).resolves.toBe("");
    expect(result.changedFiles).toEqual([{ filePath: renamed, changeType: "created" }]);
  });

  it("preserves created summary for create followed by rename and edit", async () => {
    const workspaceRoot = await makeWorkspace();
    const created = join(workspaceRoot, "created.ts");
    const renamed = join(workspaceRoot, "renamed.ts");

    const result = await applyWorkspaceEdit({
      workspaceRoot,
      edit: {
        documentChanges: [
          { kind: "create", uri: filePathToUri(created) },
          { kind: "rename", oldUri: filePathToUri(created), newUri: filePathToUri(renamed) },
          {
            textDocument: { uri: filePathToUri(renamed), version: null },
            edits: [
              {
                range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
                newText: "content\n",
              },
            ],
          },
        ],
      },
    });

    await expect(readFile(created, "utf8")).rejects.toThrow();
    await expect(readFile(renamed, "utf8")).resolves.toBe("content\n");
    expect(result.changedFiles).toEqual([{ filePath: renamed, changeType: "created" }]);
  });

  it("preserves created summary for create followed by edit and rename", async () => {
    const workspaceRoot = await makeWorkspace();
    const created = join(workspaceRoot, "created.ts");
    const renamed = join(workspaceRoot, "renamed.ts");

    const result = await applyWorkspaceEdit({
      workspaceRoot,
      edit: {
        documentChanges: [
          { kind: "create", uri: filePathToUri(created) },
          {
            textDocument: { uri: filePathToUri(created), version: null },
            edits: [
              {
                range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
                newText: "content\n",
              },
            ],
          },
          { kind: "rename", oldUri: filePathToUri(created), newUri: filePathToUri(renamed) },
        ],
      },
    });

    await expect(readFile(created, "utf8")).rejects.toThrow();
    await expect(readFile(renamed, "utf8")).resolves.toBe("content\n");
    expect(result.changedFiles).toEqual([{ filePath: renamed, changeType: "created" }]);
  });

  it("preserves renamed summary for rename followed by edit and rename", async () => {
    const workspaceRoot = await makeWorkspace();
    const source = join(workspaceRoot, "source.ts");
    const first = join(workspaceRoot, "first.ts");
    const second = join(workspaceRoot, "second.ts");
    await writeText(source, "const value = 1;\n");

    const result = await applyWorkspaceEdit({
      workspaceRoot,
      edit: {
        documentChanges: [
          { kind: "rename", oldUri: filePathToUri(source), newUri: filePathToUri(first) },
          {
            textDocument: { uri: filePathToUri(first), version: null },
            edits: [
              {
                range: { start: { line: 0, character: 6 }, end: { line: 0, character: 11 } },
                newText: "renamed",
              },
            ],
          },
          { kind: "rename", oldUri: filePathToUri(first), newUri: filePathToUri(second) },
        ],
      },
    });

    await expect(readFile(source, "utf8")).rejects.toThrow();
    await expect(readFile(first, "utf8")).rejects.toThrow();
    await expect(readFile(second, "utf8")).resolves.toBe("const renamed = 1;\n");
    expect(result.changedFiles).toEqual([{ filePath: second, changeType: "renamed" }]);
  });

  it("applies create followed by delete and leaves no file", async () => {
    const workspaceRoot = await makeWorkspace();
    const created = join(workspaceRoot, "created.ts");

    const result = await applyWorkspaceEdit({
      workspaceRoot,
      edit: {
        documentChanges: [
          { kind: "create", uri: filePathToUri(created) },
          { kind: "delete", uri: filePathToUri(created) },
        ],
      },
    });

    await expect(readFile(created, "utf8")).rejects.toThrow();
    expect(result.changedFiles).toEqual([{ filePath: created, changeType: "deleted" }]);
  });

  it("applies rename followed by delete of the renamed path", async () => {
    const workspaceRoot = await makeWorkspace();
    const source = join(workspaceRoot, "source.ts");
    const renamed = join(workspaceRoot, "renamed.ts");
    await writeText(source, "source\n");

    await applyWorkspaceEdit({
      workspaceRoot,
      edit: {
        documentChanges: [
          { kind: "rename", oldUri: filePathToUri(source), newUri: filePathToUri(renamed) },
          { kind: "delete", uri: filePathToUri(renamed) },
        ],
      },
    });

    await expect(readFile(source, "utf8")).rejects.toThrow();
    await expect(readFile(renamed, "utf8")).rejects.toThrow();
  });

  it("applies chained renames through virtual paths", async () => {
    const workspaceRoot = await makeWorkspace();
    const source = join(workspaceRoot, "source.ts");
    const first = join(workspaceRoot, "first.ts");
    const second = join(workspaceRoot, "second.ts");
    await writeText(source, "source\n");

    const result = await applyWorkspaceEdit({
      workspaceRoot,
      edit: {
        documentChanges: [
          { kind: "rename", oldUri: filePathToUri(source), newUri: filePathToUri(first) },
          { kind: "rename", oldUri: filePathToUri(first), newUri: filePathToUri(second) },
        ],
      },
    });

    await expect(readFile(source, "utf8")).rejects.toThrow();
    await expect(readFile(first, "utf8")).rejects.toThrow();
    await expect(readFile(second, "utf8")).resolves.toBe("source\n");
    expect(result.changedFiles).toEqual([{ filePath: second, changeType: "renamed" }]);
  });

  it("rejects invalid virtual sequence without partial mutation", async () => {
    const workspaceRoot = await makeWorkspace();
    const source = join(workspaceRoot, "source.ts");
    const renamed = join(workspaceRoot, "renamed.ts");
    await writeText(source, "source\n");

    await expect(
      applyWorkspaceEdit({
        workspaceRoot,
        edit: {
          documentChanges: [
            { kind: "rename", oldUri: filePathToUri(source), newUri: filePathToUri(renamed) },
            { kind: "delete", uri: filePathToUri(source) },
          ],
        },
      }),
    ).rejects.toThrow("does not exist");
    await expect(readFile(source, "utf8")).resolves.toBe("source\n");
    await expect(readFile(renamed, "utf8")).rejects.toThrow();
  });

  it("rejects a later outside-workspace edit without mutating an earlier in-workspace edit", async () => {
    const workspaceRoot = await makeWorkspace();
    const outsideRoot = await makeWorkspace();
    const inside = join(workspaceRoot, "inside.ts");
    const outside = join(outsideRoot, "outside.ts");
    await writeText(inside, "inside\n");
    await writeText(outside, "outside\n");

    await expect(
      applyWorkspaceEdit({
        workspaceRoot,
        edit: {
          changes: {
            [filePathToUri(inside)]: [
              {
                range: { start: { line: 0, character: 0 }, end: { line: 0, character: 6 } },
                newText: "mutated",
              },
            ],
            [filePathToUri(outside)]: [
              {
                range: { start: { line: 0, character: 0 }, end: { line: 0, character: 7 } },
                newText: "blocked",
              },
            ],
          },
        },
      }),
    ).rejects.toThrow("outside workspace root");
    await expect(readFile(inside, "utf8")).resolves.toBe("inside\n");
    await expect(readFile(outside, "utf8")).resolves.toBe("outside\n");
  });

  it("rejects a later invalid text range without mutating an earlier valid edit", async () => {
    const workspaceRoot = await makeWorkspace();
    const first = join(workspaceRoot, "first.ts");
    const second = join(workspaceRoot, "second.ts");
    await writeText(first, "first\n");
    await writeText(second, "second\n");

    await expect(
      applyWorkspaceEdit({
        workspaceRoot,
        edit: {
          changes: {
            [filePathToUri(first)]: [
              {
                range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
                newText: "mutated",
              },
            ],
            [filePathToUri(second)]: [
              {
                range: { start: { line: 5, character: 0 }, end: { line: 5, character: 1 } },
                newText: "invalid",
              },
            ],
          },
        },
      }),
    ).rejects.toThrow("outside document");
    await expect(readFile(first, "utf8")).resolves.toBe("first\n");
    await expect(readFile(second, "utf8")).resolves.toBe("second\n");
  });

  it("rejects positions past non-final line text length", async () => {
    const workspaceRoot = await makeWorkspace();
    const filePath = join(workspaceRoot, "app.ts");
    await writeText(filePath, "abc\ndef\n");

    await expect(
      applyTextEdits({
        workspaceRoot,
        filePath,
        edits: [
          {
            range: { start: { line: 0, character: 4 }, end: { line: 0, character: 4 } },
            newText: "x",
          },
        ],
      }),
    ).rejects.toThrow("outside line 0");
    await expect(readFile(filePath, "utf8")).resolves.toBe("abc\ndef\n");
  });

  it("rejects positions past final line text length", async () => {
    const workspaceRoot = await makeWorkspace();
    const filePath = join(workspaceRoot, "app.ts");
    await writeText(filePath, "abc\ndef");

    await expect(
      applyTextEdits({
        workspaceRoot,
        filePath,
        edits: [
          {
            range: { start: { line: 1, character: 4 }, end: { line: 1, character: 4 } },
            newText: "x",
          },
        ],
      }),
    ).rejects.toThrow("outside line 1");
    await expect(readFile(filePath, "utf8")).resolves.toBe("abc\ndef");
  });

  it("rejects a later create conflict without mutating an earlier edit or create", async () => {
    const workspaceRoot = await makeWorkspace();
    const edited = join(workspaceRoot, "edited.ts");
    const created = join(workspaceRoot, "created.ts");
    const conflict = join(workspaceRoot, "conflict.ts");
    await writeText(edited, "edited\n");
    await writeText(conflict, "exists\n");

    await expect(
      applyWorkspaceEdit({
        workspaceRoot,
        edit: {
          changes: {
            [filePathToUri(edited)]: [
              {
                range: { start: { line: 0, character: 0 }, end: { line: 0, character: 6 } },
                newText: "mutated",
              },
            ],
          },
          documentChanges: [
            { kind: "create", uri: filePathToUri(created) },
            { kind: "create", uri: filePathToUri(conflict) },
          ],
        },
      }),
    ).rejects.toThrow("already exists");
    await expect(readFile(edited, "utf8")).resolves.toBe("edited\n");
    await expect(readFile(created, "utf8")).rejects.toThrow();
    await expect(readFile(conflict, "utf8")).resolves.toBe("exists\n");
  });

  it("rejects a later missing rename source without mutating an earlier edit or create", async () => {
    const workspaceRoot = await makeWorkspace();
    const edited = join(workspaceRoot, "edited.ts");
    const created = join(workspaceRoot, "created.ts");
    const missing = join(workspaceRoot, "missing.ts");
    const renamed = join(workspaceRoot, "renamed.ts");
    await writeText(edited, "edited\n");

    await expect(
      applyWorkspaceEdit({
        workspaceRoot,
        edit: {
          changes: {
            [filePathToUri(edited)]: [
              {
                range: { start: { line: 0, character: 0 }, end: { line: 0, character: 6 } },
                newText: "mutated",
              },
            ],
          },
          documentChanges: [
            { kind: "create", uri: filePathToUri(created) },
            { kind: "rename", oldUri: filePathToUri(missing), newUri: filePathToUri(renamed) },
          ],
        },
      }),
    ).rejects.toThrow();
    await expect(readFile(edited, "utf8")).resolves.toBe("edited\n");
    await expect(readFile(created, "utf8")).rejects.toThrow();
    await expect(readFile(renamed, "utf8")).rejects.toThrow();
  });

  it("rejects a later missing delete target without mutating an earlier edit or create", async () => {
    const workspaceRoot = await makeWorkspace();
    const edited = join(workspaceRoot, "edited.ts");
    const created = join(workspaceRoot, "created.ts");
    const missing = join(workspaceRoot, "missing.ts");
    await writeText(edited, "edited\n");

    await expect(
      applyWorkspaceEdit({
        workspaceRoot,
        edit: {
          changes: {
            [filePathToUri(edited)]: [
              {
                range: { start: { line: 0, character: 0 }, end: { line: 0, character: 6 } },
                newText: "mutated",
              },
            ],
          },
          documentChanges: [
            { kind: "create", uri: filePathToUri(created) },
            { kind: "delete", uri: filePathToUri(missing) },
          ],
        },
      }),
    ).rejects.toThrow();
    await expect(readFile(edited, "utf8")).resolves.toBe("edited\n");
    await expect(readFile(created, "utf8")).rejects.toThrow();
  });

  it("rejects rename followed by delete of the original source without applying the rename", async () => {
    const workspaceRoot = await makeWorkspace();
    const source = join(workspaceRoot, "source.ts");
    const renamed = join(workspaceRoot, "renamed.ts");
    await writeText(source, "source\n");

    await expect(
      applyWorkspaceEdit({
        workspaceRoot,
        edit: {
          documentChanges: [
            { kind: "rename", oldUri: filePathToUri(source), newUri: filePathToUri(renamed) },
            { kind: "delete", uri: filePathToUri(source) },
          ],
        },
      }),
    ).rejects.toThrow();
    await expect(readFile(source, "utf8")).resolves.toBe("source\n");
    await expect(readFile(renamed, "utf8")).rejects.toThrow();
  });

  it("rejects create followed by rename to the same target without mutating", async () => {
    const workspaceRoot = await makeWorkspace();
    const source = join(workspaceRoot, "source.ts");
    const target = join(workspaceRoot, "target.ts");
    await writeText(source, "source\n");

    await expect(
      applyWorkspaceEdit({
        workspaceRoot,
        edit: {
          documentChanges: [
            { kind: "create", uri: filePathToUri(target) },
            { kind: "rename", oldUri: filePathToUri(source), newUri: filePathToUri(target) },
          ],
        },
      }),
    ).rejects.toThrow("already exists");
    await expect(readFile(source, "utf8")).resolves.toBe("source\n");
    await expect(readFile(target, "utf8")).rejects.toThrow();
  });

  it("rejects two renames to the same missing destination without mutating", async () => {
    const workspaceRoot = await makeWorkspace();
    const first = join(workspaceRoot, "first.ts");
    const second = join(workspaceRoot, "second.ts");
    const target = join(workspaceRoot, "target.ts");
    await writeText(first, "first\n");
    await writeText(second, "second\n");

    await expect(
      applyWorkspaceEdit({
        workspaceRoot,
        edit: {
          documentChanges: [
            { kind: "rename", oldUri: filePathToUri(first), newUri: filePathToUri(target) },
            { kind: "rename", oldUri: filePathToUri(second), newUri: filePathToUri(target) },
          ],
        },
      }),
    ).rejects.toThrow("already exists");
    await expect(readFile(first, "utf8")).resolves.toBe("first\n");
    await expect(readFile(second, "utf8")).resolves.toBe("second\n");
    await expect(readFile(target, "utf8")).rejects.toThrow();
  });

  it("rejects create into symlinked workspace subdirectory pointing outside by default", async () => {
    const workspaceRoot = await makeWorkspace();
    const outsideRoot = await makeWorkspace();
    const linkedDir = join(workspaceRoot, "linked");
    const target = join(linkedDir, "created.ts");
    await symlink(outsideRoot, linkedDir);

    await expect(
      applyWorkspaceEdit({
        workspaceRoot,
        edit: { documentChanges: [{ kind: "create", uri: filePathToUri(target) }] },
      }),
    ).rejects.toThrow("outside workspace root");
    await expect(readFile(target, "utf8")).rejects.toThrow();
  });

  it("honors create ignoreIfExists and overwrite options", async () => {
    const workspaceRoot = await makeWorkspace();
    const ignored = join(workspaceRoot, "ignored.ts");
    const overwritten = join(workspaceRoot, "overwritten.ts");
    await writeText(ignored, "keep\n");
    await writeText(overwritten, "replace\n");

    await applyWorkspaceEdit({
      workspaceRoot,
      edit: {
        documentChanges: [
          { kind: "create", uri: filePathToUri(ignored), options: { ignoreIfExists: true } },
          { kind: "create", uri: filePathToUri(overwritten), options: { overwrite: true } },
        ],
      },
    });

    await expect(readFile(ignored, "utf8")).resolves.toBe("keep\n");
    await expect(readFile(overwritten, "utf8")).resolves.toBe("");
  });

  it("rejects create overwrite of an existing symlink to outside by default", async () => {
    const workspaceRoot = await makeWorkspace();
    const outsideRoot = await makeWorkspace();
    const outsideFile = join(outsideRoot, "outside.ts");
    const linkedFile = join(workspaceRoot, "linked.ts");
    await writeText(outsideFile, "outside\n");
    await symlink(outsideFile, linkedFile);

    await expect(
      applyWorkspaceEdit({
        workspaceRoot,
        edit: {
          documentChanges: [
            { kind: "create", uri: filePathToUri(linkedFile), options: { overwrite: true } },
          ],
        },
      }),
    ).rejects.toThrow("outside workspace root");
    await expect(readFile(outsideFile, "utf8")).resolves.toBe("outside\n");
  });

  it("honors rename ignoreIfExists and overwrite options", async () => {
    const workspaceRoot = await makeWorkspace();
    const ignoredSource = join(workspaceRoot, "ignored-source.ts");
    const ignoredTarget = join(workspaceRoot, "ignored-target.ts");
    const overwriteSource = join(workspaceRoot, "overwrite-source.ts");
    const overwriteTarget = join(workspaceRoot, "overwrite-target.ts");
    await writeText(ignoredSource, "ignored source\n");
    await writeText(ignoredTarget, "ignored target\n");
    await writeText(overwriteSource, "overwrite source\n");
    await writeText(overwriteTarget, "overwrite target\n");

    await applyWorkspaceEdit({
      workspaceRoot,
      edit: {
        documentChanges: [
          {
            kind: "rename",
            oldUri: filePathToUri(ignoredSource),
            newUri: filePathToUri(ignoredTarget),
            options: { ignoreIfExists: true },
          },
          {
            kind: "rename",
            oldUri: filePathToUri(overwriteSource),
            newUri: filePathToUri(overwriteTarget),
            options: { overwrite: true },
          },
        ],
      },
    });

    await expect(readFile(ignoredSource, "utf8")).resolves.toBe("ignored source\n");
    await expect(readFile(ignoredTarget, "utf8")).resolves.toBe("ignored target\n");
    await expect(readFile(overwriteSource, "utf8")).rejects.toThrow();
    await expect(readFile(overwriteTarget, "utf8")).resolves.toBe("overwrite source\n");
  });

  it("rejects rename when destination appears after preflight and overwrite is false", async () => {
    const workspaceRoot = await makeWorkspace();
    const source = join(workspaceRoot, "source.ts");
    const target = join(workspaceRoot, "target.ts");
    await writeText(source, "source\n");

    await expect(
      applyWorkspaceEdit({
        workspaceRoot,
        edit: {
          documentChanges: [
            { kind: "rename", oldUri: filePathToUri(source), newUri: filePathToUri(target) },
          ],
        },
        beforeMutation: async (operation) => {
          if (operation.type === "rename") {
            await writeText(target, "raced\n");
          }
        },
      }),
    ).rejects.toThrow("already exists");
    await expect(readFile(source, "utf8")).resolves.toBe("source\n");
    await expect(readFile(target, "utf8")).resolves.toBe("raced\n");
  });

  it("honors delete ignoreIfNotExists and recursive options", async () => {
    const workspaceRoot = await makeWorkspace();
    const missing = join(workspaceRoot, "missing.ts");
    const directory = join(workspaceRoot, "dir");
    await writeText(join(directory, "nested.ts"), "nested\n");

    await applyWorkspaceEdit({
      workspaceRoot,
      edit: {
        documentChanges: [
          { kind: "delete", uri: filePathToUri(missing), options: { ignoreIfNotExists: true } },
          { kind: "delete", uri: filePathToUri(directory), options: { recursive: true } },
        ],
      },
    });

    await expect(readFile(join(directory, "nested.ts"), "utf8")).rejects.toThrow();
  });
});
