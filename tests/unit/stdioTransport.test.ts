import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createSpawnError } from "../../src/utils/errors.js";
import { StdioLspTransport } from "../../src/lsp/stdioTransport.js";

class FakeChildProcess extends EventEmitter {
  readonly stdin = new PassThrough();
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
  readonly pid = 1234;
  exitCode: number | null = null;
  signalCode: NodeJS.Signals | null = null;
  killed = false;
  killCalls: NodeJS.Signals[] = [];

  kill(signal?: NodeJS.Signals | number): boolean {
    const resolvedSignal = typeof signal === "string" ? signal : "SIGTERM";
    this.killCalls.push(resolvedSignal);
    this.killed = true;
    return true;
  }

  finishExit(code: number | null, signal: NodeJS.Signals | null): void {
    this.exitCode = code;
    this.signalCode = signal;
    this.emit("exit", code, signal);
  }
}

afterEach(() => {
  vi.useRealTimers();
});

describe("StdioLspTransport", () => {
  it("reports spawn failures with structured command details", async () => {
    const spawnError = createSpawnError(
      "missing-ls",
      ["--stdio"],
      Object.assign(new Error("spawn ENOENT"), { code: "ENOENT" }),
    );
    const spawn = vi.fn(() => {
      throw spawnError;
    });

    try {
      new StdioLspTransport({ command: "missing-ls", args: ["--stdio"], spawn });
      expect.fail("Expected spawn failure");
    } catch (error) {
      expect(error).toMatchObject({
        code: "LSP_TRANSPORT_SPAWN_FAILED",
        command: "missing-ls",
        args: ["--stdio"],
      });
    }
  });

  it("captures stderr in a bounded ring buffer", () => {
    const child = new FakeChildProcess();
    const transport = new StdioLspTransport({
      command: "fake-ls",
      spawn: () => child,
      stderrBufferSize: 2,
    });

    child.stderr.write("first\n");
    child.stderr.write("second\nthird");

    expect(transport.getStderr()).toEqual(["second", "third"]);
  });

  it("preserves stderr partial lines across chunks", () => {
    const child = new FakeChildProcess();
    const transport = new StdioLspTransport({ command: "fake-ls", spawn: () => child });

    child.stderr.write("warn");
    expect(transport.getStderr()).toEqual(["warn"]);

    child.stderr.write("ing\n");
    expect(transport.getStderr()).toEqual(["warning"]);
  });

  it("tracks exit status", async () => {
    const child = new FakeChildProcess();
    const transport = new StdioLspTransport({ command: "fake-ls", spawn: () => child });

    child.finishExit(7, null);
    await transport.exit;

    expect(transport.status).toEqual({
      state: "exited",
      pid: 1234,
      exitCode: 7,
      signal: null,
    });
  });

  it("records async spawn errors as structured status failures", async () => {
    const child = new FakeChildProcess();
    const transport = new StdioLspTransport({
      command: "missing-ls",
      args: ["--stdio"],
      spawn: () => child,
    });

    child.emit("error", Object.assign(new Error("spawn missing-ls ENOENT"), { code: "ENOENT" }));
    const status = await transport.exit;

    expect(status).toMatchObject({
      state: "exited",
      exitCode: null,
      signal: null,
      error: {
        code: "LSP_TRANSPORT_SPAWN_FAILED",
        command: "missing-ls",
        args: ["--stdio"],
      },
    });
  });

  it("resolves dispose when SIGTERM exits gracefully", async () => {
    vi.useFakeTimers();
    const child = new FakeChildProcess();
    const transport = new StdioLspTransport({
      command: "fake-ls",
      spawn: () => child,
      disposeTimeoutMs: 10,
    });

    try {
      const disposed = transport.dispose();
      child.finishExit(null, "SIGTERM");
      await disposed;

      expect(child.killCalls).toEqual(["SIGTERM"]);
      expect(transport.status).toMatchObject({ state: "exited", signal: "SIGTERM" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("gracefully terminates then force kills on dispose timeout", async () => {
    vi.useFakeTimers();
    const child = new FakeChildProcess();
    const transport = new StdioLspTransport({
      command: "fake-ls",
      spawn: () => child,
      disposeTimeoutMs: 10,
    });

    try {
      const disposed = transport.dispose();
      await vi.advanceTimersByTimeAsync(10);
      child.finishExit(null, "SIGKILL");
      await disposed;

      expect(child.killCalls).toEqual(["SIGTERM", "SIGKILL"]);
      expect(transport.status.state).toBe("exited");
    } finally {
      vi.useRealTimers();
    }
  });

  it("bounds the post-SIGKILL wait when no exit event arrives", async () => {
    vi.useFakeTimers();
    const child = new FakeChildProcess();
    const transport = new StdioLspTransport({
      command: "fake-ls",
      spawn: () => child,
      disposeTimeoutMs: 10,
    });

    try {
      const disposed = transport.dispose();
      await vi.advanceTimersByTimeAsync(20);
      await disposed;

      expect(child.killCalls).toEqual(["SIGTERM", "SIGKILL"]);
      expect(transport.status).toMatchObject({
        state: "exited",
        exitCode: null,
        signal: "SIGKILL",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("shares one dispose operation across concurrent repeated calls", async () => {
    vi.useFakeTimers();
    const child = new FakeChildProcess();
    const transport = new StdioLspTransport({
      command: "fake-ls",
      spawn: () => child,
      disposeTimeoutMs: 10,
    });

    try {
      const first = transport.dispose();
      const second = transport.dispose();
      child.finishExit(null, "SIGTERM");
      await Promise.all([first, second, transport.dispose()]);

      expect(child.killCalls).toEqual(["SIGTERM"]);
      expect(transport.status).toMatchObject({ state: "exited", signal: "SIGTERM" });
    } finally {
      vi.useRealTimers();
    }
  });
});
