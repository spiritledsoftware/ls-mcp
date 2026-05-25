import { readFile } from "node:fs/promises";

import { getConfigLoadOrder, type ConfigPathOptions } from "./paths.js";
import {
  configSchema,
  formatConfigError,
  knownTopLevelConfigKeys,
  type LspMcpConfig,
} from "./schema.js";
import { parseJsonc } from "../utils/json.js";

type ReadFile = (path: string) => Promise<string>;
type Warn = (message: string) => void;

export interface LoadConfigOptions extends ConfigPathOptions {
  readFile?: ReadFile;
  warn?: Warn;
}

export interface LoadConfigResult {
  config: LspMcpConfig;
  loadedFiles: string[];
  warnings: string[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function mergeConfig(base: unknown, override: unknown): unknown {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return override;
  }

  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    merged[key] = key in merged ? mergeConfig(merged[key], value) : value;
  }
  return merged;
}

function warnUnknownTopLevelKeys(
  value: unknown,
  filePath: string,
  warn: Warn,
  warnings: string[],
): void {
  if (!isPlainObject(value)) {
    return;
  }

  for (const key of Object.keys(value)) {
    if (!knownTopLevelConfigKeys.has(key)) {
      const message = `${filePath}: unknown top-level config key: ${key}`;
      warnings.push(message);
      warn(message);
    }
  }
}

async function defaultReadFile(path: string): Promise<string> {
  return readFile(path, "utf8");
}

export async function loadConfig(options: LoadConfigOptions = {}): Promise<LoadConfigResult> {
  const read = options.readFile ?? defaultReadFile;
  const warn = options.warn ?? (() => undefined);
  const warnings: string[] = [];
  const loadedFiles: string[] = [];
  let merged: unknown = {};

  for (const filePath of getConfigLoadOrder(options)) {
    let source: string;
    try {
      source = await read(filePath);
    } catch (error: unknown) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        continue;
      }
      throw error;
    }

    const parsed = parseJsonc(source, filePath);
    warnUnknownTopLevelKeys(parsed, filePath, warn, warnings);
    merged = mergeConfig(merged, parsed);
    loadedFiles.push(filePath);
  }

  const result = configSchema.safeParse(merged);
  if (!result.success) {
    throw new Error(formatConfigError(result.error));
  }

  return { config: result.data, loadedFiles, warnings };
}

export { mergeConfig };
