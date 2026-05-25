import { realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

export interface WorkspaceSecurityOptions {
  allowExternalFiles?: boolean;
}

export interface ValidateWorkspacePathOptions {
  filePath: string;
  workspaceRoot: string;
  security?: WorkspaceSecurityOptions;
  realpath?: (path: string) => Promise<string>;
}

export interface WorkspacePathResult {
  path: string;
  realPath: string;
  workspaceRoot: string;
  workspaceRootRealPath: string;
  isOutsideWorkspace: boolean;
}

function absolutize(path: string): string {
  return isAbsolute(path) ? path : resolve(path);
}

function absolutizeFilePath(filePath: string, workspaceRoot: string): string {
  return isAbsolute(filePath) ? resolve(filePath) : resolve(workspaceRoot, filePath);
}

function isInsideOrSame(child: string, parent: string): boolean {
  const pathToChild = relative(parent, child);
  return (
    pathToChild === "" ||
    (pathToChild !== ".." && !pathToChild.startsWith(`..${sep}`) && !isAbsolute(pathToChild))
  );
}

export async function validateWorkspacePath(
  options: ValidateWorkspacePathOptions,
): Promise<WorkspacePathResult> {
  const resolveRealpath = options.realpath ?? realpath;
  const workspaceRoot = absolutize(options.workspaceRoot);
  const filePath = absolutizeFilePath(options.filePath, workspaceRoot);
  const [fileRealPath, workspaceRootRealPath] = await Promise.all([
    resolveRealpath(filePath),
    resolveRealpath(workspaceRoot),
  ]);
  const isOutsideWorkspace = !isInsideOrSame(fileRealPath, workspaceRootRealPath);

  if (isOutsideWorkspace && options.security?.allowExternalFiles !== true) {
    throw new Error(`${filePath} is outside workspace root ${workspaceRoot}`);
  }

  return {
    path: filePath,
    realPath: fileRealPath,
    workspaceRoot,
    workspaceRootRealPath,
    isOutsideWorkspace,
  };
}

export { isInsideOrSame };
