export type CapabilityPath = string | readonly string[];
export type ServerCapabilities = Record<string, unknown>;

export function getCapability(
  capabilities: ServerCapabilities | undefined,
  path: CapabilityPath,
): unknown {
  const parts = typeof path === "string" ? path.split(".").filter(Boolean) : path;
  let current: unknown = capabilities;

  for (const part of parts) {
    if (!isRecord(current) || !(part in current)) {
      return undefined;
    }
    current = current[part];
  }

  return current;
}

export function hasCapability(
  capabilities: ServerCapabilities | undefined,
  path: CapabilityPath,
): boolean {
  const value = getCapability(capabilities, path);
  if (value === undefined || value === null || value === false) {
    return false;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
