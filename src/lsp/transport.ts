import type { MessageReader, MessageWriter } from "vscode-jsonrpc";

export type LspTransportState = "running" | "exited";

export interface LspProcessStatus {
  state: LspTransportState;
  pid?: number;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  error?: unknown;
}

export interface LspTransport {
  readonly reader: MessageReader;
  readonly writer: MessageWriter;
  readonly command: string;
  readonly args: readonly string[];
  readonly status: LspProcessStatus;
  readonly exit: Promise<LspProcessStatus>;
  getStderr(): string[];
  dispose(): Promise<void>;
}
