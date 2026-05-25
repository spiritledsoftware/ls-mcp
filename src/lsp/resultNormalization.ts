import { isAbsolute, relative, resolve, sep } from "node:path";

import { uriToFilePath } from "./documentStore.js";

interface NormalizationContext {
  workspaceRoot: string;
}

export function normalizeLspResult<T>(result: T, context: NormalizationContext): T {
  return normalizeValue(result, resolve(context.workspaceRoot)) as T;
}

function normalizeValue(value: unknown, workspaceRoot: string): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item, workspaceRoot));
  }
  if (!isRecord(value)) {
    return value;
  }

  const normalized: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    normalized[key] = isRange(child) ? normalizeRange(child) : normalizeValue(child, workspaceRoot);
  }

  if (typeof value.uri === "string" && isRange(value.range)) {
    const filePath = safeUriToFilePath(value.uri);
    if (filePath) {
      normalized.filePath = filePath;
      normalized.outsideWorkspace = isOutsideWorkspace(filePath, workspaceRoot);
    }
  }

  if (typeof value.targetUri === "string" && isRange(value.targetRange)) {
    const filePath = safeUriToFilePath(value.targetUri);
    if (filePath) {
      normalized.targetFilePath = filePath;
      normalized.targetOutsideWorkspace = isOutsideWorkspace(filePath, workspaceRoot);
    }
  }

  return normalized;
}

function normalizeRange(range: LspRange) {
  return {
    start: normalizePosition(range.start),
    end: normalizePosition(range.end),
  };
}

function normalizePosition(position: LspPosition) {
  return {
    line: position.line + 1,
    character: position.character + 1,
  };
}

function safeUriToFilePath(uri: string): string | undefined {
  try {
    return uriToFilePath(uri);
  } catch {
    return undefined;
  }
}

function isOutsideWorkspace(filePath: string, workspaceRoot: string): boolean {
  const relativePath = relative(workspaceRoot, filePath);
  return relativePath === ".." || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath);
}

interface LspPosition {
  line: number;
  character: number;
}

interface LspRange {
  start: LspPosition;
  end: LspPosition;
}

function isRange(value: unknown): value is LspRange {
  return isRecord(value) && isPosition(value.start) && isPosition(value.end);
}

function isPosition(value: unknown): value is LspPosition {
  return isRecord(value) && typeof value.line === "number" && typeof value.character === "number";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
