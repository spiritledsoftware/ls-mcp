import type { ServerSuggestion } from "../lsp/serverIdentity.js";

export interface StructuredToolError {
  error: string;
  code?: string | number;
  method?: string;
  timeoutMs?: number;
  serverId?: string;
  suggestions?: readonly ServerSuggestion[];
}

export function structuredToolError(error: unknown): StructuredToolError {
  const result: StructuredToolError = {
    error: error instanceof Error ? error.message : String(error),
  };
  if (isRecord(error)) {
    if (typeof error.code === "string" || typeof error.code === "number") {
      result.code = error.code;
    }
    if (typeof error.method === "string") {
      result.method = error.method;
    }
    if (typeof error.timeoutMs === "number") {
      result.timeoutMs = error.timeoutMs;
    }
    if (typeof error.serverId === "string") {
      result.serverId = error.serverId;
    }
    if (Array.isArray(error.suggestions)) {
      result.suggestions = error.suggestions as ServerSuggestion[];
    }
  }
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
