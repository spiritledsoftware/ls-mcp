import { spawn as nodeSpawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams, SpawnOptionsWithoutStdio } from "node:child_process";
import type { Readable, Writable } from "node:stream";

import { StreamMessageReader, StreamMessageWriter } from "vscode-jsonrpc/node.js";

import { createSpawnError } from "../utils/errors.js";
import type { LspProcessStatus, LspTransport } from "./transport.js";

interface StdioChildProcess {
  readonly stdin: Writable;
  readonly stdout: Readable;
  readonly stderr: Readable;
  readonly pid?: number;
  readonly exitCode: number | null;
  readonly signalCode: NodeJS.Signals | null;
  kill(signal?: NodeJS.Signals | number): boolean;
  once(event: "exit", listener: (code: number | null, signal: NodeJS.Signals | null) => void): this;
  once(event: "error", listener: (error: Error) => void): this;
  on(event: "exit", listener: (code: number | null, signal: NodeJS.Signals | null) => void): this;
  on(event: "error", listener: (error: Error) => void): this;
}

export type LspProcessSpawner = (
  command: string,
  args: readonly string[],
  options: SpawnOptionsWithoutStdio,
) => StdioChildProcess;

export interface StdioLspTransportOptions {
  command: string;
  args?: readonly string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  stderrBufferSize?: number;
  disposeTimeoutMs?: number;
  spawn?: LspProcessSpawner;
}

const DEFAULT_STDERR_BUFFER_SIZE = 100;
const DEFAULT_DISPOSE_TIMEOUT_MS = 1_000;

export class StdioLspTransport implements LspTransport {
  readonly reader: StreamMessageReader;
  readonly writer: StreamMessageWriter;
  readonly command: string;
  readonly args: readonly string[];
  readonly exit: Promise<LspProcessStatus>;

  private readonly child: StdioChildProcess;
  private readonly stderrBufferSize: number;
  private readonly disposeTimeoutMs: number;
  private readonly stderrLines: string[] = [];
  private stderrRemainder = "";
  private currentStatus: LspProcessStatus;
  private disposePromise?: Promise<void>;
  private resolveExit!: (status: LspProcessStatus) => void;

  constructor(options: StdioLspTransportOptions) {
    this.command = options.command;
    this.args = options.args ?? [];
    this.stderrBufferSize = Math.max(1, options.stderrBufferSize ?? DEFAULT_STDERR_BUFFER_SIZE);
    this.disposeTimeoutMs = Math.max(0, options.disposeTimeoutMs ?? DEFAULT_DISPOSE_TIMEOUT_MS);

    const spawn = options.spawn ?? defaultSpawner;
    try {
      this.child = spawn(this.command, this.args, {
        cwd: options.cwd,
        env: options.env,
        windowsHide: true,
      });
    } catch (error) {
      throw createSpawnError(this.command, [...this.args], error);
    }

    this.currentStatus = {
      state: "running",
      pid: this.child.pid,
      exitCode: null,
      signal: null,
    };
    this.exit = new Promise((resolve) => {
      this.resolveExit = resolve;
    });

    this.reader = new StreamMessageReader(this.child.stdout);
    this.writer = new StreamMessageWriter(this.child.stdin);

    this.child.stderr.on("data", (chunk: Buffer | string) => this.captureStderr(chunk));
    this.child.stderr.once("end", () => this.flushStderrRemainder());
    this.child.once("exit", (code, signal) => this.markExited(code, signal));
    this.child.once("error", (error) =>
      this.markExited(null, null, createSpawnError(this.command, [...this.args], error)),
    );
  }

  get status(): LspProcessStatus {
    return { ...this.currentStatus };
  }

  getStderr(): string[] {
    const lines = [...this.stderrLines];
    if (this.stderrRemainder) {
      lines.push(this.stderrRemainder);
    }
    return lines.slice(-this.stderrBufferSize);
  }

  async dispose(): Promise<void> {
    this.disposePromise ??= this.disposeOnce();
    return this.disposePromise;
  }

  private async disposeOnce(): Promise<void> {
    this.reader.dispose();
    this.writer.dispose();
    if (this.currentStatus.state === "exited") {
      return;
    }

    this.child.kill("SIGTERM");
    const timedOut = await this.waitForExitOrTimeout(this.disposeTimeoutMs);
    if (timedOut && this.currentStatus.state === "running") {
      this.child.kill("SIGKILL");
      const forceTimedOut = await this.waitForExitOrTimeout(this.disposeTimeoutMs);
      if (forceTimedOut && this.currentStatus.state === "running") {
        this.markExited(null, "SIGKILL");
      }
    }
  }

  private waitForExitOrTimeout(timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(true), timeoutMs);
      this.exit.then(() => {
        clearTimeout(timeout);
        resolve(false);
      });
    });
  }

  private captureStderr(chunk: Buffer | string): void {
    const text = this.stderrRemainder + chunk.toString();
    const lines = text.split(/\r?\n/);
    this.stderrRemainder = lines.pop() ?? "";
    for (const line of lines) {
      this.pushStderrLine(line);
    }
  }

  private flushStderrRemainder(): void {
    if (!this.stderrRemainder) {
      return;
    }
    this.pushStderrLine(this.stderrRemainder);
    this.stderrRemainder = "";
  }

  private pushStderrLine(line: string): void {
    this.stderrLines.push(line);
    while (this.stderrLines.length > this.stderrBufferSize) {
      this.stderrLines.shift();
    }
  }

  private markExited(code: number | null, signal: NodeJS.Signals | null, error?: unknown): void {
    if (this.currentStatus.state === "exited") {
      return;
    }
    if (error instanceof Error) {
      this.pushStderrLine(error.message);
    }
    this.currentStatus = {
      state: "exited",
      pid: this.child.pid,
      exitCode: code,
      signal,
      error,
    };
    this.resolveExit(this.status);
  }
}

function defaultSpawner(
  command: string,
  args: readonly string[],
  options: SpawnOptionsWithoutStdio,
): ChildProcessWithoutNullStreams {
  return nodeSpawn(command, [...args], options);
}
