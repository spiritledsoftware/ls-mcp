import { stat } from "node:fs/promises";
import { dirname, isAbsolute, join, parse, resolve } from "node:path";

import {
  validateWorkspacePath,
  type WorkspacePathResult,
  type WorkspaceSecurityOptions,
} from "../security/workspace.js";

const builtInRootMarkers = [".lsp-mcp.json", ".lsp-mcp.jsonc"];
const vcsMarkers = [".git"];

export type WorkspaceRootSource = "explicit" | "marker" | "vcs" | "parent";

export interface ResolveWorkspaceRootOptions {
  filePath: string;
  workspaceRoot?: string;
  rootMarkers?: string[];
  security?: WorkspaceSecurityOptions;
  stat?: (path: string) => Promise<unknown>;
  realpath?: (path: string) => Promise<string>;
}

export interface ResolveWorkspaceRootResult {
  workspaceRoot: string;
  source: WorkspaceRootSource;
  marker?: string;
  file: WorkspacePathResult;
}

function absolutize(path: string): string {
  return isAbsolute(path) ? path : resolve(path);
}

async function exists(
  path: string,
  statPath: (path: string) => Promise<unknown>,
): Promise<boolean> {
  try {
    await statPath(path);
    return true;
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function findNearestMarker(
  startDir: string,
  markers: string[],
  statPath: (path: string) => Promise<unknown>,
): Promise<{ root: string; marker: string } | undefined> {
  let current = startDir;
  const fsRoot = parse(startDir).root;

  while (true) {
    for (const marker of markers) {
      if (await exists(join(current, marker), statPath)) {
        return { root: current, marker };
      }
    }

    if (current === fsRoot) {
      return undefined;
    }
    current = dirname(current);
  }
}

function getRootMarkers(configuredMarkers: string[] | undefined): string[] {
  return [...new Set([...(configuredMarkers ?? []), ...builtInRootMarkers])];
}

export async function resolveWorkspaceRoot(
  options: ResolveWorkspaceRootOptions,
): Promise<ResolveWorkspaceRootResult> {
  const filePath = absolutize(options.filePath);
  const statPath = options.stat ?? stat;

  if (options.workspaceRoot !== undefined) {
    const workspaceRoot = absolutize(options.workspaceRoot);
    return {
      workspaceRoot,
      source: "explicit",
      file: await validateWorkspacePath({
        filePath,
        workspaceRoot,
        security: options.security,
        realpath: options.realpath,
      }),
    };
  }

  const startDir = dirname(filePath);
  const markerRoot = await findNearestMarker(
    startDir,
    getRootMarkers(options.rootMarkers),
    statPath,
  );
  const vcsRoot = markerRoot ?? (await findNearestMarker(startDir, vcsMarkers, statPath));
  const workspaceRoot = vcsRoot?.root ?? startDir;

  return {
    workspaceRoot,
    source: markerRoot ? "marker" : vcsRoot ? "vcs" : "parent",
    marker: vcsRoot?.marker,
    file: await validateWorkspacePath({
      filePath,
      workspaceRoot,
      security: options.security,
      realpath: options.realpath,
    }),
  };
}

export { builtInRootMarkers };
