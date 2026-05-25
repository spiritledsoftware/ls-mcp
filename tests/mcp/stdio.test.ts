import { describe, expect, it, vi } from "vitest";

import { runStdioServer, type StdioRuntimeProcess } from "../../src/mcp/stdio.js";

describe("runStdioServer shutdown", () => {
  it("cleans up once when the transport closes", async () => {
    const { server, transport, processLike } = testRuntime();

    await runStdioServer({
      createServer: async () => server,
      createTransport: () => transport,
      process: processLike,
    });
    transport.onclose?.();
    await flushAsyncShutdown();

    expect(server.close).toHaveBeenCalledTimes(1);
  });

  it("does not recurse when signal close synchronously fires transport onclose", async () => {
    const { server, transport, processLike } = testRuntime();
    server.close.mockImplementation(async () => {
      transport.onclose?.();
    });

    await runStdioServer({
      createServer: async () => server,
      createTransport: () => transport,
      process: processLike,
    });
    processLike.emit("SIGINT");
    await flushAsyncShutdown();

    expect(server.close).toHaveBeenCalledTimes(1);
    expect(processLike.exit).toHaveBeenCalledWith(130);
  });

  it("handles transport onclose cleanup rejection", async () => {
    const { server, transport, processLike } = testRuntime();
    const onShutdownError = vi.fn();
    server.close.mockRejectedValue(new Error("cleanup failed"));

    await runStdioServer({
      createServer: async () => server,
      createTransport: () => transport,
      process: processLike,
      onShutdownError,
    });
    transport.onclose?.();
    await flushAsyncShutdown();

    expect(onShutdownError).toHaveBeenCalledWith(new Error("cleanup failed"));
  });

  it("handles signal cleanup rejection and still exits", async () => {
    const { server, transport, processLike } = testRuntime();
    const onShutdownError = vi.fn();
    server.close.mockRejectedValue(new Error("cleanup failed"));

    await runStdioServer({
      createServer: async () => server,
      createTransport: () => transport,
      process: processLike,
      onShutdownError,
    });
    processLike.emit("SIGTERM");
    await flushAsyncShutdown();

    expect(onShutdownError).toHaveBeenCalledWith(new Error("cleanup failed"));
    expect(processLike.exit).toHaveBeenCalledWith(143);
  });
});

function testRuntime() {
  const listeners = new Map<NodeJS.Signals, () => void>();
  const transport: { onclose?: () => void } = {};
  const server = {
    connect: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    close: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  };
  const processLike: StdioRuntimeProcess & { emit(signal: NodeJS.Signals): void } = {
    once: vi.fn((signal: NodeJS.Signals, handler: () => void): typeof processLike => {
      listeners.set(signal, handler);
      return processLike;
    }),
    exit: vi.fn(),
    emit: (signal: NodeJS.Signals) => listeners.get(signal)?.(),
  };

  return { server, transport, processLike };
}

async function flushAsyncShutdown(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}
