import { access } from "node:fs/promises";
import { delimiter, isAbsolute, join } from "node:path";
import { homedir } from "node:os";

import type { LspMcpConfig } from "../config/schema.js";
import { getBuiltInServer, type BuiltInServerMetadata } from "./builtins.js";
import { InstallLocks } from "./locks.js";
import { installNpmServer } from "./npmInstaller.js";

export interface InstalledCommand {
  command: string;
  args: string[];
}

export type ResolvedServerCommand =
  | (InstalledCommand & { status: "ready"; source: "configured" | "system" | "installed" })
  | (InstalledCommand & { status: "not-installed" | "error"; reason: string });

export type CommandExists = (command: string) => Promise<boolean>;
export interface CommandLookupOptions {
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
}

export interface InstallerContext {
  installDir: string;
  lockRoot: string;
}

export type Installer = (
  metadata: BuiltInServerMetadata,
  context: InstallerContext,
) => Promise<InstalledCommand>;

export interface ResolveLspServerCommandOptions {
  serverId: string;
  server: NonNullable<NonNullable<LspMcpConfig["lsp"]>["servers"]>[string];
  downloads?: LspMcpConfig["downloads"];
  commandExists?: CommandExists;
  installers?: Partial<Record<"npm" | "github", Installer>>;
  locks?: InstallLocks;
  installDir?: string;
  env?: NodeJS.ProcessEnv;
}

interface ResolveLspServerCommandInternalOptions extends ResolveLspServerCommandOptions {
  install: boolean;
}

const defaultInstallLocksByRoot = new Map<string, InstallLocks>();

function resolveCacheRoot(env: NodeJS.ProcessEnv = process.env): string {
  if (env.XDG_CACHE_HOME && isAbsolute(env.XDG_CACHE_HOME)) {
    return join(env.XDG_CACHE_HOME, "lsp-mcp");
  }
  const home = env.HOME && isAbsolute(env.HOME) ? env.HOME : homedir();
  return join(home, ".cache", "lsp-mcp");
}

function getDefaultInstallLocks(lockRoot: string): InstallLocks {
  let locks = defaultInstallLocksByRoot.get(lockRoot);
  if (!locks) {
    locks = new InstallLocks({ lockRoot });
    defaultInstallLocksByRoot.set(lockRoot, locks);
  }
  return locks;
}

function resolveCommandEnv(options: ResolveLspServerCommandOptions): NodeJS.ProcessEnv | undefined {
  if (!options.env && !options.server.env) {
    return undefined;
  }
  return { ...(options.env ?? process.env), ...options.server.env };
}

function resolveInstallContext(
  metadata: BuiltInServerMetadata,
  options: ResolveLspServerCommandOptions,
): InstallerContext {
  const cacheRoot = resolveCacheRoot(options.env);
  return {
    installDir: options.installDir ?? join(cacheRoot, "servers", metadata.id),
    lockRoot: join(cacheRoot, "install-locks"),
  };
}

function resolveCachedCommand(
  metadata: BuiltInServerMetadata,
  installDir: string,
): InstalledCommand | undefined {
  if (metadata.installStrategy.type === "github") {
    return undefined;
  }
  if (metadata.installStrategy.type !== "npm") {
    return undefined;
  }
  const binName = process.platform === "win32" ? `${metadata.command}.cmd` : metadata.command;
  return { command: join(installDir, "node_modules", ".bin", binName), args: metadata.args };
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function getPathEntries(env: NodeJS.ProcessEnv): string[] {
  return (env.PATH ?? env.Path ?? env.path ?? "").split(delimiter).filter(Boolean);
}

function getWindowsCandidates(command: string, env: NodeJS.ProcessEnv): string[] {
  if (/\.[^\\/.]+$/.test(command)) {
    return [command];
  }
  const extensions = (env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD")
    .split(";")
    .filter(Boolean)
    .flatMap((extension) => [extension.toLowerCase(), extension.toUpperCase()]);
  return [command, ...extensions.map((extension) => `${command}${extension}`)];
}

export async function defaultCommandExists(
  command: string,
  options: CommandLookupOptions = {},
): Promise<boolean> {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  if (isAbsolute(command)) {
    return fileExists(command);
  }

  const candidates = platform === "win32" ? getWindowsCandidates(command, env) : [command];
  for (const pathDir of getPathEntries(env)) {
    for (const candidate of candidates) {
      if (await fileExists(join(pathDir, candidate))) {
        return true;
      }
    }
  }
  return false;
}

async function installServer(
  metadata: BuiltInServerMetadata,
  options: ResolveLspServerCommandOptions,
): Promise<InstalledCommand> {
  const context = resolveInstallContext(metadata, options);
  const strategy = metadata.installStrategy;

  if (strategy.type === "npm") {
    return (options.installers?.npm ?? ((server) => installNpmServer(server, context)))(
      metadata,
      context,
    );
  }
  if (strategy.type === "github") {
    throw new Error(`${metadata.id} uses GitHub archive installation, which is not supported yet`);
  }
  throw new Error(`${metadata.id} does not support automatic installation`);
}

export async function resolveLspServerCommandStatus(
  options: ResolveLspServerCommandOptions,
): Promise<ResolvedServerCommand> {
  return resolveLspServerCommandInternal({ ...options, install: false });
}

export async function resolveLspServerCommand(
  options: ResolveLspServerCommandOptions,
): Promise<ResolvedServerCommand> {
  return resolveLspServerCommandInternal({ ...options, install: true });
}

async function resolveLspServerCommandInternal(
  options: ResolveLspServerCommandInternalOptions,
): Promise<ResolvedServerCommand> {
  const commandExists =
    options.commandExists ??
    ((command) => defaultCommandExists(command, { env: resolveCommandEnv(options) }));
  const registryId = options.server.registry ?? options.serverId;
  const metadata = getBuiltInServer(registryId);
  const configuredCommand = options.server.command;
  const configuredArgs = options.server.args ?? [];

  if (configuredCommand) {
    if (await commandExists(configuredCommand)) {
      return {
        status: "ready",
        command: configuredCommand,
        args: configuredArgs,
        source: "configured",
      };
    }

    return {
      status: "error",
      reason: `Configured command ${configuredCommand} for ${options.serverId} was not found on PATH.`,
      command: configuredCommand,
      args: configuredArgs,
    };
  }

  if (!metadata) {
    return {
      status: "error",
      reason: `No built-in registry entry or available command found for ${options.serverId}.`,
      command: configuredCommand ?? options.serverId,
      args: configuredArgs,
    };
  }

  if (await commandExists(metadata.command)) {
    return { status: "ready", command: metadata.command, args: metadata.args, source: "system" };
  }

  if (options.server.profile === "system") {
    return {
      status: "not-installed",
      reason: `${metadata.command} is not available for system profile. Install it manually or switch to managed profile.`,
      command: metadata.command,
      args: metadata.args,
    };
  }

  if (metadata.installStrategy.type === "system") {
    return {
      status: "not-installed",
      reason: `${metadata.command} is not available and automatic installation is not supported for ${metadata.id}. Install it manually.`,
      command: metadata.command,
      args: metadata.args,
    };
  }

  if (options.downloads?.enabled === false) {
    return {
      status: "not-installed",
      reason: `${metadata.command} is not available and downloads are disabled. Install it manually or enable downloads.`,
      command: metadata.command,
      args: metadata.args,
    };
  }

  const context = resolveInstallContext(metadata, options);
  const cached = resolveCachedCommand(metadata, context.installDir);
  if (cached && (await fileExists(cached.command))) {
    return { status: "ready", ...cached, source: "installed" };
  }

  if (!options.install) {
    return {
      status: "not-installed",
      reason: `${metadata.command} is not available and no cached install was found. It may be installed on first use if downloads are enabled.`,
      command: metadata.command,
      args: metadata.args,
    };
  }

  const lockRoot = context.lockRoot;
  const locks = options.locks ?? getDefaultInstallLocks(lockRoot);
  const installed = await locks.withLock(metadata.id, metadata.version, async () => {
    const cached = resolveCachedCommand(metadata, context.installDir);
    if (cached && (await fileExists(cached.command))) {
      return cached;
    }
    return installServer(metadata, options);
  });
  return { status: "ready", ...installed, source: "installed" };
}
