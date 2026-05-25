import type { LspMcpConfig } from "../config/schema.js";

export function isCommandAllowed(
  config: Pick<LspMcpConfig, "commands">,
  serverId: string,
  command: string,
): boolean {
  if (config.commands?.enabled === false) {
    return false;
  }
  const serverAllowlist = config.commands?.allow?.[serverId];
  return serverAllowlist === undefined || serverAllowlist.includes(command);
}

export function assertCommandAllowed(
  config: Pick<LspMcpConfig, "commands">,
  serverId: string,
  command: string,
): void {
  if (config.commands?.enabled === false) {
    throw new Error("Command execution is disabled");
  }
  if (!isCommandAllowed(config, serverId, command)) {
    throw new Error(`Command "${command}" is not allowed for server ${serverId}`);
  }
}
