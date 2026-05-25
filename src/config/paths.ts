import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";

export interface ConfigPathOptions {
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  homeDir?: string;
  workspaceRoot?: string;
  getHomeDir?: () => string;
}

export interface ConfigPaths {
  userJson?: string;
  userJsonc?: string;
  projectJson?: string;
  projectJsonc?: string;
}

function firstAbsolutePath(paths: Array<string | undefined>): string | undefined {
  return paths.find((path) => path !== undefined && path !== "" && isAbsolute(path));
}

export function resolveConfigPaths(options: ConfigPathOptions = {}): ConfigPaths {
  const env = options.env ?? process.env;
  const homeDir = firstAbsolutePath([options.homeDir, env.HOME, (options.getHomeDir ?? homedir)()]);
  const configHome =
    env.XDG_CONFIG_HOME && isAbsolute(env.XDG_CONFIG_HOME)
      ? env.XDG_CONFIG_HOME
      : homeDir
        ? join(homeDir, ".config")
        : undefined;
  const userDir = configHome ? join(configHome, "lsp-mcp") : undefined;

  return {
    userJson: userDir ? join(userDir, "config.json") : undefined,
    userJsonc: userDir ? join(userDir, "config.jsonc") : undefined,
    projectJson: options.workspaceRoot ? join(options.workspaceRoot, ".lsp-mcp.json") : undefined,
    projectJsonc: options.workspaceRoot ? join(options.workspaceRoot, ".lsp-mcp.jsonc") : undefined,
  };
}

export function getConfigLoadOrder(options: ConfigPathOptions = {}): string[] {
  const paths = resolveConfigPaths(options);
  return [paths.userJson, paths.userJsonc, paths.projectJson, paths.projectJsonc].filter(
    (path): path is string => Boolean(path),
  );
}
