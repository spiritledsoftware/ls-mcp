export interface StructuredToolError {
  error: string;
  code?: string | number;
  method?: string;
  timeoutMs?: number;
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
  }
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
