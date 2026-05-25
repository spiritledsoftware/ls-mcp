export const LSP_TRANSPORT_SPAWN_FAILED = "LSP_TRANSPORT_SPAWN_FAILED" as const;

export class LspTransportSpawnError extends Error {
  readonly code = LSP_TRANSPORT_SPAWN_FAILED;
  readonly command: string;
  readonly args: string[];
  readonly cause: unknown;

  constructor(command: string, args: string[], cause: unknown) {
    super(`Failed to spawn LSP server command: ${[command, ...args].join(" ")}`);
    this.name = "LspTransportSpawnError";
    this.command = command;
    this.args = args;
    this.cause = cause;
  }
}

export function createSpawnError(
  command: string,
  args: string[] = [],
  cause: unknown,
): LspTransportSpawnError {
  return new LspTransportSpawnError(command, args, cause);
}
