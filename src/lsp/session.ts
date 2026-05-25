import process from "node:process";

import {
  CancellationStrategy,
  CancellationTokenSource,
  createMessageConnection,
  RequestType,
} from "vscode-jsonrpc/node.js";
import type { MessageConnection } from "vscode-jsonrpc/node.js";

import { hasCapability as hasServerCapability } from "./capabilities.js";
import type { CapabilityPath, ServerCapabilities } from "./capabilities.js";
import { StdioLspTransport } from "./stdioTransport.js";
import type { LspProcessStatus, LspTransport } from "./transport.js";

export { getCapability, hasCapability } from "./capabilities.js";
export type { CapabilityPath, ServerCapabilities } from "./capabilities.js";

export interface WorkspaceFolder {
  uri: string;
  name: string;
}

export interface LspSessionOptions {
  command?: string;
  args?: readonly string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  rootUri: string;
  workspaceFolders?: readonly WorkspaceFolder[] | null;
  initializationOptions?: unknown;
  shutdownTimeoutMs?: number;
  exitTimeoutMs?: number;
  maxConcurrentRequestsPerServer?: number;
  requestTimeoutMs?: number;
  workspaceRequestTimeoutMs?: number;
  methodTimeoutsMs?: Readonly<Record<string, number>>;
  transport?: LspTransport;
}

export interface LspSessionHealth {
  consecutiveFailures: number;
  restartCount: number;
  lastExitCode: number | null;
  lastExitSignal: NodeJS.Signals | null;
  lastStderr: readonly string[];
  lastError?: string;
}

export interface LspRequestOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

const DEFAULT_SHUTDOWN_TIMEOUT_MS = 1_000;
const DEFAULT_EXIT_TIMEOUT_MS = 1_000;
const DEFAULT_MAX_CONCURRENT_REQUESTS_PER_SERVER = 4;
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_WORKSPACE_REQUEST_TIMEOUT_MS = 90_000;
const WORKSPACE_REQUEST_METHODS = new Set(["workspace/symbol", "workspace/diagnostic"]);

export class LspRequestTimeoutError extends Error {
  readonly code = "LSP_REQUEST_TIMEOUT";
  readonly method: string;
  readonly timeoutMs: number;

  constructor(method: string, timeoutMs: number) {
    super(`LSP request ${method} timed out after ${timeoutMs}ms`);
    this.name = "LspRequestTimeoutError";
    this.method = method;
    this.timeoutMs = timeoutMs;
  }
}

export class LspRequestCancelledError extends Error {
  readonly code = "LSP_REQUEST_CANCELLED";
  readonly method: string;

  constructor(method: string) {
    super(`LSP request ${method} was cancelled`);
    this.name = "LspRequestCancelledError";
    this.method = method;
  }
}

interface QueuedRequest {
  resolve(): void;
  reject(error: unknown): void;
  signal?: AbortSignal;
  abortHandler?: () => void;
}

export class LspSession {
  private readonly options: LspSessionOptions;
  private transport?: LspTransport;
  private connection?: MessageConnection;
  private started = false;
  private stopped = false;
  private starting?: Promise<void>;
  private stopping?: Promise<void>;
  private serverCapabilities?: ServerCapabilities;
  private activeRequests = 0;
  private readonly queuedRequests: QueuedRequest[] = [];
  private readonly healthState: LspSessionHealth = {
    consecutiveFailures: 0,
    restartCount: 0,
    lastExitCode: null,
    lastExitSignal: null,
    lastStderr: [],
  };

  constructor(options: LspSessionOptions) {
    this.options = options;
  }

  get capabilities(): ServerCapabilities | undefined {
    return this.serverCapabilities;
  }

  get status(): LspProcessStatus {
    return this.transport?.status ?? { state: "exited", exitCode: null, signal: null };
  }

  get health(): LspSessionHealth {
    this.refreshHealthFromTransport();
    return { ...this.healthState, lastStderr: [...this.healthState.lastStderr] };
  }

  getStderr(): string[] {
    return this.transport?.getStderr() ?? [];
  }

  hasCapability(path: CapabilityPath): boolean {
    return hasServerCapability(this.serverCapabilities, path);
  }

  async sendNotification(method: string, params?: unknown): Promise<void> {
    await this.start();
    if (!this.connection) {
      throw new Error("LSP session is not connected");
    }
    await this.connection.sendNotification(method, params);
  }

  onNotification(method: string, handler: (params: unknown) => void): { dispose(): void } {
    if (!this.connection) {
      throw new Error("LSP session is not connected");
    }
    return this.connection.onNotification(method, handler);
  }

  async sendRequest<T = unknown>(
    method: string,
    params?: unknown,
    options: LspRequestOptions = {},
  ): Promise<T> {
    await this.start();
    if (!this.connection) {
      throw new Error("LSP session is not connected");
    }
    return this.runQueuedRequest(method, options, () =>
      this.sendRequestNow<T>(method, params, options),
    );
  }

  async start(): Promise<void> {
    if (this.stopped) {
      throw new Error("LSP session cannot be restarted after shutdown");
    }
    if (this.started) {
      return;
    }
    this.starting ??= this.startOnce();
    return this.starting;
  }

  private async startOnce(): Promise<void> {
    if (this.started) {
      return;
    }

    const transport = this.createTransport();
    const connection = createMessageConnection(transport.reader, transport.writer, undefined, {
      cancellationStrategy: CancellationStrategy.Message,
    });
    connection.listen();

    this.transport = transport;
    this.connection = connection;
    void transport.exit.then((status) => {
      this.healthState.lastExitCode = status.exitCode;
      this.healthState.lastExitSignal = status.signal;
      this.refreshHealthFromTransport();
    });

    try {
      const result = await connection.sendRequest("initialize", this.createInitializeParams());
      this.serverCapabilities = extractCapabilities(result);
      await connection.sendNotification("initialized", {});
      this.started = true;
    } catch (error) {
      connection.dispose();
      await transport.dispose();
      this.starting = undefined;
      throw error;
    }
  }

  private async runQueuedRequest<T>(
    method: string,
    options: LspRequestOptions,
    operation: () => Promise<T>,
  ): Promise<T> {
    await this.acquireRequestSlot(method, options.signal);
    try {
      return await operation();
    } finally {
      this.releaseRequestSlot();
    }
  }

  private async acquireRequestSlot(method: string, signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) {
      throw new LspRequestCancelledError(method);
    }
    const maxConcurrent =
      this.options.maxConcurrentRequestsPerServer ?? DEFAULT_MAX_CONCURRENT_REQUESTS_PER_SERVER;
    if (this.activeRequests < maxConcurrent) {
      this.activeRequests += 1;
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const queued: QueuedRequest = {
        resolve,
        reject,
        signal,
      };
      queued.abortHandler = () => {
        this.removeQueuedRequest(queued);
        reject(new LspRequestCancelledError(method));
      };
      signal?.addEventListener("abort", queued.abortHandler, { once: true });
      this.queuedRequests.push(queued);
    });
    this.activeRequests += 1;
  }

  private releaseRequestSlot(): void {
    this.activeRequests -= 1;
    this.resolveNextQueuedRequest();
  }

  private removeQueuedRequest(queued: QueuedRequest): void {
    const index = this.queuedRequests.indexOf(queued);
    if (index !== -1) {
      this.queuedRequests.splice(index, 1);
    }
    if (queued.abortHandler) {
      queued.signal?.removeEventListener("abort", queued.abortHandler);
    }
  }

  private resolveNextQueuedRequest(): void {
    const queued = this.queuedRequests.shift();
    if (!queued) {
      return;
    }
    if (queued.abortHandler) {
      queued.signal?.removeEventListener("abort", queued.abortHandler);
    }
    queued.resolve();
  }

  private async sendRequestNow<T>(
    method: string,
    params: unknown,
    options: LspRequestOptions,
  ): Promise<T> {
    if (!this.connection) {
      throw new Error("LSP session is not connected");
    }
    if (options.signal?.aborted) {
      throw new LspRequestCancelledError(method);
    }

    const timeoutMs = options.timeoutMs ?? this.requestTimeoutFor(method);
    const cancellationSource = new CancellationTokenSource();
    let timeout: NodeJS.Timeout | undefined;
    let abortHandler: (() => void) | undefined;
    let settled = false;
    const request = this.connection
      .sendRequest(new RequestType<unknown, T, unknown>(method), params, cancellationSource.token)
      .then((result) => {
        if (!settled) {
          this.recordSuccess();
        }
        return result;
      })
      .catch((error: unknown) => {
        if (!settled) {
          this.recordFailure(error);
        }
        throw error;
      });

    const timeoutPromise = new Promise<never>((_, reject) => {
      if (timeoutMs <= 0) {
        return;
      }
      timeout = setTimeout(() => {
        settled = true;
        cancellationSource.cancel();
        const error = new LspRequestTimeoutError(method, timeoutMs);
        this.recordFailure(error);
        reject(error);
      }, timeoutMs);
    });
    const abortPromise = new Promise<never>((_, reject) => {
      if (!options.signal) {
        return;
      }
      abortHandler = () => {
        settled = true;
        cancellationSource.cancel();
        const error = new LspRequestCancelledError(method);
        this.recordFailure(error);
        reject(error);
      };
      options.signal.addEventListener("abort", abortHandler, { once: true });
    });

    try {
      return await Promise.race([request, timeoutPromise, abortPromise]);
    } finally {
      settled = true;
      cancellationSource.dispose();
      if (timeout) {
        clearTimeout(timeout);
      }
      if (options.signal && abortHandler) {
        options.signal.removeEventListener("abort", abortHandler);
      }
      request.catch(() => undefined);
    }
  }

  private requestTimeoutFor(method: string): number {
    return (
      this.options.methodTimeoutsMs?.[method] ??
      (WORKSPACE_REQUEST_METHODS.has(method)
        ? (this.options.workspaceRequestTimeoutMs ?? DEFAULT_WORKSPACE_REQUEST_TIMEOUT_MS)
        : (this.options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS))
    );
  }

  private recordSuccess(): void {
    this.healthState.consecutiveFailures = 0;
    this.refreshHealthFromTransport();
  }

  private recordFailure(error: unknown): void {
    if (error instanceof LspRequestCancelledError) {
      this.refreshHealthFromTransport();
      return;
    }
    this.healthState.consecutiveFailures += 1;
    this.healthState.lastError = errorMessage(error);
    this.refreshHealthFromTransport();
  }

  private refreshHealthFromTransport(): void {
    this.healthState.lastStderr = this.transport?.getStderr() ?? [];
    const status = this.transport?.status;
    if (status?.state === "exited") {
      this.healthState.lastExitCode = status.exitCode;
      this.healthState.lastExitSignal = status.signal;
      if (status.error) {
        this.healthState.lastError = errorMessage(status.error);
      }
    }
  }

  async shutdown(): Promise<void> {
    this.stopping ??= this.shutdownOnce();
    return this.stopping;
  }

  private async shutdownOnce(): Promise<void> {
    const connection = this.connection;
    const transport = this.transport;

    if (!connection || !transport) {
      this.stopped = true;
      return;
    }
    this.stopped = true;

    try {
      if (transport.status.state === "running" && this.started) {
        await withTimeout(
          connection.sendRequest("shutdown"),
          this.options.shutdownTimeoutMs ?? DEFAULT_SHUTDOWN_TIMEOUT_MS,
        );
      }
      if (transport.status.state === "running") {
        await withTimeout(
          connection.sendNotification("exit"),
          this.options.exitTimeoutMs ?? DEFAULT_EXIT_TIMEOUT_MS,
        );
        await waitForExitOrTimeout(
          transport,
          this.options.exitTimeoutMs ?? DEFAULT_EXIT_TIMEOUT_MS,
        );
      }
    } finally {
      connection.dispose();
      await transport.dispose();
      this.started = false;
    }
  }

  private createTransport(): LspTransport {
    if (this.options.transport) {
      return this.options.transport;
    }
    if (!this.options.command) {
      throw new Error("LSP session requires a command or transport");
    }
    return new StdioLspTransport({
      command: this.options.command,
      args: this.options.args,
      cwd: this.options.cwd,
      env: this.options.env,
    });
  }

  private createInitializeParams(): Record<string, unknown> {
    const workspaceFolders =
      this.options.workspaceFolders === undefined
        ? [workspaceFolderFromRootUri(this.options.rootUri)]
        : this.options.workspaceFolders;

    return {
      processId: process.pid,
      rootUri: this.options.rootUri,
      workspaceFolders,
      capabilities: createClientCapabilities(),
      initializationOptions: this.options.initializationOptions,
    };
  }
}

async function waitForExitOrTimeout(transport: LspTransport, timeoutMs: number): Promise<void> {
  if (timeoutMs <= 0) {
    return;
  }

  let timeout: NodeJS.Timeout | undefined;
  await Promise.race([
    transport.exit,
    new Promise<void>((resolve) => {
      timeout = setTimeout(resolve, timeoutMs);
    }),
  ]);
  if (timeout) {
    clearTimeout(timeout);
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | undefined> {
  if (timeoutMs <= 0) {
    return undefined;
  }

  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<undefined>((resolve) => {
        timeout = setTimeout(() => resolve(undefined), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function extractCapabilities(result: unknown): ServerCapabilities {
  if (isRecord(result) && isRecord(result.capabilities)) {
    return result.capabilities;
  }
  return {};
}

function workspaceFolderFromRootUri(rootUri: string): WorkspaceFolder {
  const pathname = new URL(rootUri).pathname;
  const name = decodeURIComponent(pathname.split("/").filter(Boolean).at(-1) ?? "workspace");
  return { uri: rootUri, name };
}

function createClientCapabilities(): Record<string, unknown> {
  return {
    workspace: {
      workspaceEdit: { documentChanges: true, resourceOperations: ["create", "rename", "delete"] },
      didChangeWatchedFiles: { relativePatternSupport: true },
      symbol: { symbolKind: { valueSet: range(1, 26) } },
      executeCommand: {},
      workspaceFolders: true,
    },
    textDocument: {
      synchronization: {
        willSave: true,
        willSaveWaitUntil: true,
        didSave: true,
      },
      completion: {
        completionItem: {
          snippetSupport: true,
          commitCharactersSupport: true,
          documentationFormat: ["markdown", "plaintext"],
          deprecatedSupport: true,
          preselectSupport: true,
          insertReplaceSupport: true,
          labelDetailsSupport: true,
        },
        contextSupport: true,
      },
      hover: { contentFormat: ["markdown", "plaintext"] },
      signatureHelp: {
        signatureInformation: {
          documentationFormat: ["markdown", "plaintext"],
          parameterInformation: { labelOffsetSupport: true },
          activeParameterSupport: true,
        },
      },
      declaration: { linkSupport: true },
      definition: { linkSupport: true },
      typeDefinition: { linkSupport: true },
      implementation: { linkSupport: true },
      references: {},
      documentHighlight: {},
      documentSymbol: {
        hierarchicalDocumentSymbolSupport: true,
        symbolKind: { valueSet: range(1, 26) },
      },
      codeAction: {
        isPreferredSupport: true,
        disabledSupport: true,
        dataSupport: true,
        resolveSupport: { properties: ["edit"] },
      },
      codeLens: {},
      formatting: {},
      rangeFormatting: {},
      rename: { prepareSupport: true, honorsChangeAnnotations: true },
      publishDiagnostics: {
        relatedInformation: true,
        versionSupport: true,
        codeDescriptionSupport: true,
        dataSupport: true,
      },
      semanticTokens: {
        requests: { range: true, full: { delta: true } },
        tokenTypes: [],
        tokenModifiers: [],
        formats: ["relative"],
        overlappingTokenSupport: true,
        multilineTokenSupport: true,
      },
      inlayHint: {
        resolveSupport: {
          properties: ["tooltip", "textEdits", "label.tooltip", "label.location", "label.command"],
        },
      },
    },
    window: {},
    general: {
      regularExpressions: { engine: "ECMAScript", version: "ES2023" },
      markdown: { parser: "marked", version: "1.1.0" },
      positionEncodings: ["utf-16"],
    },
  };
}

function range(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
