import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createMcpServer } from "./server.js";
import { createConfiguredToolRegistry } from "../tools/registerTools.js";

export interface StdioRuntimeProcess {
  once(signal: NodeJS.Signals, handler: () => void): unknown;
  exit(code?: number): never | void;
}

interface StdioServerHandle {
  connect(transport: StdioTransportHandle): Promise<void>;
  close(): Promise<void>;
}

interface StdioTransportHandle {
  onclose?: () => void;
}

interface RunStdioServerOptions {
  createServer?: () => Promise<StdioServerHandle>;
  createTransport?: () => StdioTransportHandle;
  process?: StdioRuntimeProcess;
  onShutdownError?: (error: unknown) => void;
}

export async function runStdioServer(options: RunStdioServerOptions = {}): Promise<void> {
  const server = await (options.createServer?.() ??
    Promise.resolve(createMcpServer(await createConfiguredToolRegistry())));
  const transport = options.createTransport?.() ?? new StdioServerTransport();
  const runtimeProcess = options.process ?? process;
  const onShutdownError = options.onShutdownError ?? defaultShutdownErrorHandler;
  let closing: Promise<void> | undefined;
  const close = () => {
    if (!closing) {
      closing = Promise.resolve().then(() => server.close());
    }
    return closing;
  };

  transport.onclose = () => {
    void close().catch(onShutdownError);
  };
  runtimeProcess.once("SIGINT", () => {
    void closeForSignal(130, close, runtimeProcess, onShutdownError);
  });
  runtimeProcess.once("SIGTERM", () => {
    void closeForSignal(143, close, runtimeProcess, onShutdownError);
  });

  await server.connect(transport);
}

async function closeForSignal(
  exitCode: number,
  close: () => Promise<void>,
  runtimeProcess: StdioRuntimeProcess,
  onShutdownError: (error: unknown) => void,
): Promise<void> {
  try {
    await close();
  } catch (error) {
    onShutdownError(error);
  } finally {
    runtimeProcess.exit(exitCode);
  }
}

function defaultShutdownErrorHandler(error: unknown): void {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  process.stderr.write(`${message}\n`);
}
