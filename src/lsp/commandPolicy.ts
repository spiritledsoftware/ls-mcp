import type { LspMcpConfig } from "../config/schema.js";

export interface CommandPolicyOptions {
  resolveServerId?: (serverId: string) => string;
  requireResolvedAllowlist?: boolean;
}

export function isCommandAllowed(
  config: Pick<LspMcpConfig, "commands">,
  serverId: string,
  command: string,
  options: CommandPolicyOptions = {},
): boolean {
  if (config.commands?.enabled === false) {
    return false;
  }
  const serverAllowlist = normalizeCommandAllow(config, options)?.[serverId];
  return serverAllowlist === undefined || serverAllowlist.includes(command);
}

export function assertCommandAllowed(
  config: Pick<LspMcpConfig, "commands">,
  serverId: string,
  command: string,
  options: CommandPolicyOptions = {},
): void {
  if (config.commands?.enabled === false) {
    throw new Error("Command execution is disabled");
  }
  if (!isCommandAllowed(config, serverId, command, options)) {
    throw new Error(`Command "${command}" is not allowed for server ${serverId}`);
  }
}

function normalizeCommandAllow(
  config: Pick<LspMcpConfig, "commands">,
  options: CommandPolicyOptions,
): Record<string, string[]> | undefined {
  const allow = config.commands?.allow;
  if (!allow) {
    return undefined;
  }
  if (!options.resolveServerId) {
    if (options.requireResolvedAllowlist) {
      throw new Error("Command allowlist requires server ID resolution");
    }
    return allow;
  }

  const normalized: Record<string, string[]> = {};
  for (const [configuredServerId, commands] of Object.entries(allow)) {
    let canonicalServerId: string;
    try {
      canonicalServerId = options.resolveServerId(configuredServerId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid commands.allow key "${configuredServerId}": ${message}`);
    }
    normalized[canonicalServerId] = [...(normalized[canonicalServerId] ?? []), ...commands];
  }

  return normalized;
}
