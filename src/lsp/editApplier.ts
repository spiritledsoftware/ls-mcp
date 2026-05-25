import { createHash } from "node:crypto";
import { access, mkdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";

import { uriToFilePath } from "./documentStore.js";
import { validateWorkspacePath, type WorkspaceSecurityOptions } from "../security/workspace.js";

export interface LspPosition {
  line: number;
  character: number;
}

export interface LspRange {
  start: LspPosition;
  end: LspPosition;
}

export interface TextEdit {
  range: LspRange;
  newText: string;
}

export interface WorkspaceEdit {
  changes?: Record<string, TextEdit[]>;
  documentChanges?: Array<
    TextDocumentEdit | CreateFileOperation | RenameFileOperation | DeleteFileOperation
  >;
}

export interface TextDocumentEdit {
  textDocument: { uri: string; version?: number | null };
  edits: TextEdit[];
}

export interface CreateFileOperation {
  kind: "create";
  uri: string;
  options?: { overwrite?: boolean; ignoreIfExists?: boolean };
}

export interface RenameFileOperation {
  kind: "rename";
  oldUri: string;
  newUri: string;
  options?: { overwrite?: boolean; ignoreIfExists?: boolean };
}

export interface DeleteFileOperation {
  kind: "delete";
  uri: string;
  options?: { recursive?: boolean; ignoreIfNotExists?: boolean };
}

export interface ChangedFileSummary {
  filePath: string;
  changeType: ChangeType;
}

type ChangeType = "modified" | "created" | "renamed" | "deleted";

export interface ApplyEditResult {
  applied: true;
  changedFiles: ChangedFileSummary[];
}

export interface ApplyTextEditsOptions {
  workspaceRoot: string;
  filePath: string;
  edits: TextEdit[];
  security?: WorkspaceSecurityOptions;
  expectedContentHash?: string;
}

export interface ApplyWorkspaceEditOptions {
  workspaceRoot: string;
  edit: WorkspaceEdit;
  security?: WorkspaceSecurityOptions;
  expectedContentHashes?: Record<string, string>;
  beforeMutation?: (operation: WorkspaceMutationOperation) => Promise<void> | void;
}

export type WorkspaceMutationOperation =
  | { type: "edit"; filePath: string }
  | { type: "create"; filePath: string; overwrite: boolean }
  | { type: "rename"; oldPath: string; newPath: string; overwrite: boolean }
  | { type: "delete"; filePath: string; recursive: boolean };

export async function applyTextEdits(options: ApplyTextEditsOptions): Promise<ApplyEditResult> {
  if (options.edits.length === 0) {
    return { applied: true, changedFiles: [] };
  }
  const filePath = await validateEditTarget(
    options.workspaceRoot,
    options.filePath,
    options.security,
  );
  await applyEditsToFile(filePath, options.edits, options.expectedContentHash);
  return { applied: true, changedFiles: [{ filePath, changeType: "modified" }] };
}

export async function applyWorkspaceEdit(
  options: ApplyWorkspaceEditOptions,
): Promise<ApplyEditResult> {
  const operations = await preflightWorkspaceEditOperations(options);
  const changedFiles: ChangedFileSummary[] = [];

  for (const operation of operations) {
    if (operation.type === "edit") {
      await options.beforeMutation?.({ type: "edit", filePath: operation.filePath });
      const current = await readFile(operation.filePath, "utf8");
      if (hashContent(current) !== operation.originalHash) {
        throw new Error(`${operation.filePath} changed while edits were being applied`);
      }
      await writeFile(operation.filePath, operation.updatedContent, "utf8");
      addChangedFile(changedFiles, {
        filePath: operation.filePath,
        changeType: operation.changeType,
      });
      continue;
    }
    if (operation.type === "create") {
      const filePath = operation.filePath;
      await options.beforeMutation?.({ type: "create", filePath, overwrite: operation.overwrite });
      if (operation.overwrite) {
        await validateExistingOverwriteTarget(options.workspaceRoot, filePath, options.security);
      }
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, "", { encoding: "utf8", flag: operation.overwrite ? "w" : "wx" });
      addChangedFile(changedFiles, { filePath, changeType: "created" });
      continue;
    }
    if (operation.type === "rename") {
      const { oldPath, newPath } = operation;
      await options.beforeMutation?.({
        type: "rename",
        oldPath,
        newPath,
        overwrite: operation.overwrite,
      });
      if (operation.overwrite) {
        await validateExistingOverwriteTarget(options.workspaceRoot, newPath, options.security);
      } else if (await pathExists(newPath)) {
        throw new Error(`${newPath} already exists`);
      }
      await mkdir(dirname(newPath), { recursive: true });
      if (operation.overwrite) {
        await rm(newPath, { recursive: true, force: true });
      }
      await rename(oldPath, newPath);
      const previousChange = takeChangedFile(changedFiles, oldPath);
      addChangedFile(changedFiles, {
        filePath: newPath,
        changeType: previousChange?.changeType ?? "renamed",
      });
      continue;
    }
    if (operation.type === "delete") {
      const filePath = operation.filePath;
      await options.beforeMutation?.({ type: "delete", filePath, recursive: operation.recursive });
      await rm(filePath, { force: false, recursive: operation.recursive });
      addChangedFile(changedFiles, { filePath, changeType: "deleted" });
    }
  }

  return { applied: true, changedFiles };
}

type WorkspaceEditOperation =
  | {
      type: "edit";
      filePath: string;
      updatedContent: string;
      originalHash: string;
      changeType: ChangeType;
    }
  | { type: "create"; filePath: string; overwrite: boolean }
  | { type: "rename"; oldPath: string; newPath: string; overwrite: boolean }
  | { type: "delete"; filePath: string; recursive: boolean };

async function preflightWorkspaceEditOperations(
  options: ApplyWorkspaceEditOptions,
): Promise<WorkspaceEditOperation[]> {
  const collected = await collectWorkspaceEditOperations(options);
  return prepareWorkspaceEditOperations(collected);
}

type CollectedWorkspaceEditOperation =
  | { type: "edit"; filePath: string; edits: TextEdit[]; expectedContentHash?: string }
  | { type: "create"; filePath: string; overwrite: boolean; ignoreIfExists: boolean }
  | {
      type: "rename";
      oldPath: string;
      newPath: string;
      overwrite: boolean;
      ignoreIfExists: boolean;
    }
  | { type: "delete"; filePath: string; recursive: boolean; ignoreIfNotExists: boolean };

async function collectWorkspaceEditOperations(
  options: ApplyWorkspaceEditOptions,
): Promise<CollectedWorkspaceEditOperation[]> {
  const operations: CollectedWorkspaceEditOperation[] = [];

  for (const [uri, edits] of Object.entries(options.edit.changes ?? {})) {
    const filePath = await validateEditTarget(
      options.workspaceRoot,
      uriToFilePath(uri),
      options.security,
    );
    operations.push({
      type: "edit",
      filePath,
      edits,
      expectedContentHash: options.expectedContentHashes?.[filePath],
    });
  }

  for (const change of options.edit.documentChanges ?? []) {
    if (isTextDocumentEdit(change)) {
      await validateMaybeMissingTextTarget(
        options.workspaceRoot,
        uriToFilePath(change.textDocument.uri),
        options.security,
      );
      const filePath = await validateEditTarget(
        options.workspaceRoot,
        uriToFilePath(change.textDocument.uri),
        options.security,
        true,
      );
      operations.push({
        type: "edit",
        filePath,
        edits: change.edits,
        expectedContentHash: options.expectedContentHashes?.[filePath],
      });
      continue;
    }
    if (change.kind === "create") {
      await validateMaybeExistingWriteTarget(
        options.workspaceRoot,
        uriToFilePath(change.uri),
        options.security,
      );
      operations.push({
        type: "create",
        overwrite: change.options?.overwrite === true,
        ignoreIfExists: change.options?.ignoreIfExists === true,
        filePath: await validateEditTarget(
          options.workspaceRoot,
          uriToFilePath(change.uri),
          options.security,
          true,
        ),
      });
      continue;
    }
    if (change.kind === "rename") {
      await validateMaybeMissingTextTarget(
        options.workspaceRoot,
        uriToFilePath(change.oldUri),
        options.security,
      );
      await validateMaybeExistingWriteTarget(
        options.workspaceRoot,
        uriToFilePath(change.newUri),
        options.security,
      );
      operations.push({
        type: "rename",
        overwrite: change.options?.overwrite === true,
        ignoreIfExists: change.options?.ignoreIfExists === true,
        oldPath: await validateEditTarget(
          options.workspaceRoot,
          uriToFilePath(change.oldUri),
          options.security,
          true,
        ),
        newPath: await validateEditTarget(
          options.workspaceRoot,
          uriToFilePath(change.newUri),
          options.security,
          true,
        ),
      });
      continue;
    }
    if (change.kind === "delete") {
      await validateMaybeMissingTextTarget(
        options.workspaceRoot,
        uriToFilePath(change.uri),
        options.security,
      );
      operations.push({
        type: "delete",
        recursive: change.options?.recursive === true,
        ignoreIfNotExists: change.options?.ignoreIfNotExists === true,
        filePath: await validateEditTarget(
          options.workspaceRoot,
          uriToFilePath(change.uri),
          options.security,
          true,
        ),
      });
    }
  }

  return operations;
}

async function prepareWorkspaceEditOperations(
  operations: CollectedWorkspaceEditOperation[],
): Promise<WorkspaceEditOperation[]> {
  const prepared: WorkspaceEditOperation[] = [];
  const existing = new Set<string>();
  const missing = new Set<string>();
  const virtualContent = new Map<string, string>();
  const summaryTypes = new Map<string, ChangeType>();

  for (const operation of operations) {
    if (operation.type === "edit") {
      if (operation.edits.length === 0) {
        continue;
      }
      const original = await getVirtualContent(
        operation.filePath,
        existing,
        missing,
        virtualContent,
      );
      validateExpectedHash(operation.filePath, original, operation.expectedContentHash);
      const originalHash = hashContent(original);
      virtualContent.set(operation.filePath, applyEditsToContent(original, operation.edits));
      upsertPreparedEdit(
        prepared,
        operation.filePath,
        virtualContent.get(operation.filePath) ?? "",
        originalHash,
        summaryTypes.get(operation.filePath) ?? "modified",
      );
      if (!summaryTypes.has(operation.filePath)) {
        summaryTypes.set(operation.filePath, "modified");
      }
      continue;
    }
    if (operation.type === "create") {
      if (await stateExists(operation.filePath, existing, missing)) {
        if (operation.ignoreIfExists) {
          continue;
        }
        if (!operation.overwrite) {
          throw new Error(`${operation.filePath} already exists`);
        }
      }
      existing.add(operation.filePath);
      missing.delete(operation.filePath);
      virtualContent.set(operation.filePath, "");
      summaryTypes.set(operation.filePath, "created");
      prepared.push({
        type: "create",
        filePath: operation.filePath,
        overwrite: operation.overwrite,
      });
      continue;
    }
    if (operation.type === "rename") {
      const content = await getVirtualContent(operation.oldPath, existing, missing, virtualContent);
      if (await stateExists(operation.newPath, existing, missing)) {
        if (operation.ignoreIfExists) {
          continue;
        }
        if (!operation.overwrite) {
          throw new Error(`${operation.newPath} already exists`);
        }
      }
      missing.add(operation.oldPath);
      existing.delete(operation.oldPath);
      existing.add(operation.newPath);
      missing.delete(operation.newPath);
      virtualContent.delete(operation.oldPath);
      virtualContent.set(operation.newPath, content);
      const previousSummaryType = summaryTypes.get(operation.oldPath);
      summaryTypes.delete(operation.oldPath);
      summaryTypes.set(operation.newPath, previousSummaryType ?? "renamed");
      transferPreparedEditSummary(prepared, operation.oldPath, previousSummaryType);
      prepared.push({
        type: "rename",
        oldPath: operation.oldPath,
        newPath: operation.newPath,
        overwrite: operation.overwrite,
      });
      continue;
    }
    if (operation.type === "delete") {
      if (!(await stateExists(operation.filePath, existing, missing))) {
        if (operation.ignoreIfNotExists) {
          continue;
        }
        throw new Error(`${operation.filePath} does not exist`);
      }
      missing.add(operation.filePath);
      existing.delete(operation.filePath);
      virtualContent.delete(operation.filePath);
      summaryTypes.set(operation.filePath, "deleted");
      prepared.push({
        type: "delete",
        filePath: operation.filePath,
        recursive: operation.recursive,
      });
    }
  }

  return prepared;
}

async function getVirtualContent(
  filePath: string,
  existing: Set<string>,
  missing: Set<string>,
  virtualContent: Map<string, string>,
): Promise<string> {
  if (virtualContent.has(filePath)) {
    return virtualContent.get(filePath) ?? "";
  }
  await ensureStateExists(filePath, existing, missing);
  const content = await readFile(filePath, "utf8");
  virtualContent.set(filePath, content);
  return content;
}

function validateExpectedHash(
  filePath: string,
  content: string,
  expectedContentHash?: string,
): void {
  if (expectedContentHash && hashContent(content) !== expectedContentHash) {
    throw new Error(`${filePath} changed since the LSP request was made`);
  }
}

function upsertPreparedEdit(
  operations: WorkspaceEditOperation[],
  filePath: string,
  updatedContent: string,
  originalHash: string,
  changeType: ChangeType,
): void {
  const existing = operations.find(
    (operation): operation is Extract<WorkspaceEditOperation, { type: "edit" }> =>
      operation.type === "edit" && operation.filePath === filePath,
  );
  if (existing) {
    existing.updatedContent = updatedContent;
    existing.changeType = changeType;
    return;
  }
  operations.push({
    type: "edit",
    filePath,
    updatedContent,
    originalHash,
    changeType,
  });
}

function transferPreparedEditSummary(
  operations: WorkspaceEditOperation[],
  oldPath: string,
  changeType?: ChangeType,
): void {
  for (const operation of operations) {
    if (operation.type === "edit" && operation.filePath === oldPath) {
      operation.changeType = changeType ?? operation.changeType;
    }
  }
}

async function validateEditTarget(
  workspaceRoot: string,
  filePath: string,
  security?: WorkspaceSecurityOptions,
  allowMissing = false,
): Promise<string> {
  const resolved = resolve(filePath);
  if (!allowMissing) {
    return (await validateWorkspacePath({ workspaceRoot, filePath: resolved, security })).path;
  }
  const realpath = async (path: string) => (path === resolved ? resolved : resolve(path));
  return (await validateWorkspacePath({ workspaceRoot, filePath: resolved, security, realpath }))
    .path;
}

async function applyEditsToFile(
  filePath: string,
  edits: TextEdit[],
  expectedContentHash?: string,
): Promise<void> {
  const original = await readFile(filePath, "utf8");
  const originalHash = hashContent(original);
  if (expectedContentHash && originalHash !== expectedContentHash) {
    throw new Error(`${filePath} changed since the LSP request was made`);
  }
  const updated = applyEditsToContent(original, edits);
  const current = await readFile(filePath, "utf8");
  if (hashContent(current) !== originalHash) {
    throw new Error(`${filePath} changed while edits were being applied`);
  }
  await writeFile(filePath, updated, "utf8");
}

export function applyEditsToContent(content: string, edits: readonly TextEdit[]): string {
  const lineOffsets = getLineOffsets(content);
  const ranges = edits
    .map((edit) => ({
      start: offsetAt(content, lineOffsets, edit.range.start),
      end: offsetAt(content, lineOffsets, edit.range.end),
    }))
    .sort((left, right) => left.start - right.start || left.end - right.end);
  let previous: { start: number; end: number } | undefined;
  for (const range of ranges) {
    if (range.end < range.start) {
      throw new Error("Text edit range end precedes start");
    }
    if (previous && (range.start < previous.end || range.start === previous.start)) {
      throw new Error("Text edits must not overlap");
    }
    previous = range;
  }
  let result = content;
  for (const edit of [...edits].sort(compareEditsDescending)) {
    const start = offsetAt(content, lineOffsets, edit.range.start);
    const end = offsetAt(content, lineOffsets, edit.range.end);
    if (end < start) {
      throw new Error("Text edit range end precedes start");
    }
    result = `${result.slice(0, start)}${edit.newText}${result.slice(end)}`;
  }
  return result;
}

function compareEditsDescending(left: TextEdit, right: TextEdit): number {
  return positionOffset(right.range.start) - positionOffset(left.range.start);
}

function positionOffset(position: LspPosition): number {
  return position.line * 1_000_000 + position.character;
}

function getLineOffsets(content: string): number[] {
  const offsets = [0];
  for (let index = 0; index < content.length; index += 1) {
    if (content.charCodeAt(index) === 10) {
      offsets.push(index + 1);
    }
  }
  return offsets;
}

function offsetAt(content: string, lineOffsets: readonly number[], position: LspPosition): number {
  const lineOffset = lineOffsets[position.line];
  if (lineOffset === undefined) {
    throw new Error(`Line ${position.line} is outside document`);
  }
  const nextLineOffset = lineOffsets[position.line + 1] ?? content.length;
  const lineEndOffset =
    content.charCodeAt(nextLineOffset - 1) === 10 ? nextLineOffset - 1 : nextLineOffset;
  const offset = lineOffset + position.character;
  if (offset > lineEndOffset) {
    throw new Error(`Character ${position.character} is outside line ${position.line}`);
  }
  return offset;
}

function addChangedFile(changedFiles: ChangedFileSummary[], changedFile: ChangedFileSummary): void {
  const existing = changedFiles.find((file) => file.filePath === changedFile.filePath);
  if (existing) {
    existing.changeType = changedFile.changeType;
    return;
  }
  changedFiles.push(changedFile);
}

function takeChangedFile(
  changedFiles: ChangedFileSummary[],
  filePath: string,
): ChangedFileSummary | undefined {
  const index = changedFiles.findIndex((file) => file.filePath === filePath);
  if (index === -1) {
    return undefined;
  }
  const [changedFile] = changedFiles.splice(index, 1);
  return changedFile;
}

function isTextDocumentEdit(change: unknown): change is TextDocumentEdit {
  return (
    typeof change === "object" && change !== null && "textDocument" in change && "edits" in change
  );
}

async function ensureStateExists(
  filePath: string,
  existing: Set<string>,
  missing: Set<string>,
): Promise<void> {
  if (missing.has(filePath)) {
    throw new Error(`${filePath} does not exist`);
  }
  if (existing.has(filePath)) {
    return;
  }
  await access(filePath);
  existing.add(filePath);
}

async function stateExists(
  filePath: string,
  existing: Set<string>,
  missing: Set<string>,
): Promise<boolean> {
  if (existing.has(filePath)) {
    return true;
  }
  if (missing.has(filePath)) {
    return false;
  }
  try {
    await access(filePath);
    existing.add(filePath);
    return true;
  } catch {
    missing.add(filePath);
    return false;
  }
}

async function validateMissingTargetParent(
  workspaceRoot: string,
  filePath: string,
  security?: WorkspaceSecurityOptions,
): Promise<void> {
  if (security?.allowExternalFiles === true) {
    return;
  }
  const parent = await nearestExistingParent(resolve(filePath));
  const [parentRealPath, workspaceRootRealPath] = await Promise.all([
    realpath(parent),
    realpath(resolve(workspaceRoot)),
  ]);
  if (!isInsideOrSame(parentRealPath, workspaceRootRealPath)) {
    throw new Error(`${filePath} is outside workspace root ${resolve(workspaceRoot)}`);
  }
}

async function validateMaybeMissingTextTarget(
  workspaceRoot: string,
  filePath: string,
  security?: WorkspaceSecurityOptions,
): Promise<void> {
  try {
    await validateEditTarget(workspaceRoot, filePath, security);
  } catch (error) {
    if (!isMissingPathError(error)) {
      throw error;
    }
    await validateMissingTargetParent(workspaceRoot, filePath, security);
  }
}

async function validateMaybeExistingWriteTarget(
  workspaceRoot: string,
  filePath: string,
  security?: WorkspaceSecurityOptions,
): Promise<void> {
  try {
    await validateEditTarget(workspaceRoot, filePath, security);
  } catch (error) {
    if (!isMissingPathError(error)) {
      throw error;
    }
    await validateMissingTargetParent(workspaceRoot, filePath, security);
  }
}

async function validateExistingOverwriteTarget(
  workspaceRoot: string,
  filePath: string,
  security?: WorkspaceSecurityOptions,
): Promise<void> {
  try {
    await validateEditTarget(workspaceRoot, filePath, security);
  } catch (error) {
    if (!isMissingPathError(error)) {
      throw error;
    }
  }
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isMissingPathError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

async function nearestExistingParent(filePath: string): Promise<string> {
  let current = dirname(filePath);
  while (true) {
    try {
      await access(current);
      return current;
    } catch {
      const parent = dirname(current);
      if (parent === current) {
        throw new Error(`No existing parent directory for ${filePath}`);
      }
      current = parent;
    }
  }
}

function isInsideOrSame(child: string, parent: string): boolean {
  const pathToChild = relative(parent, child);
  return pathToChild === "" || (!pathToChild.startsWith("..") && !isAbsolute(pathToChild));
}

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}
