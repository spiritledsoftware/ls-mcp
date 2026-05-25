import { uriToFilePath } from "./documentStore.js";
import type { ManagedLspSession } from "./sessionManager.js";

export interface StoredDiagnostics {
  serverId: string;
  uri: string;
  diagnostics: unknown[];
  receivedAt: number;
}

export class DiagnosticStore {
  private readonly diagnostics = new Map<string, StoredDiagnostics>();
  private readonly watchedSessions = new WeakSet<ManagedLspSession>();
  private readonly waiters = new Map<string, Set<(diagnostics: StoredDiagnostics) => void>>();

  watchSession(serverId: string, session: ManagedLspSession): void {
    if (this.watchedSessions.has(session)) {
      return;
    }
    this.watchedSessions.add(session);
    session.onNotification("textDocument/publishDiagnostics", (params) => {
      const payload = params as { uri?: unknown; diagnostics?: unknown };
      if (typeof payload.uri !== "string" || !Array.isArray(payload.diagnostics)) {
        return;
      }
      this.set(serverId, payload.uri, payload.diagnostics);
    });
  }

  get(serverId: string, uri: string): StoredDiagnostics | undefined {
    return this.diagnostics.get(key(serverId, uri));
  }

  waitFor(
    serverId: string,
    uri: string,
    timeoutMs: number,
  ): Promise<StoredDiagnostics | undefined> {
    const cached = this.get(serverId, uri);
    if (cached) {
      return Promise.resolve(cached);
    }
    if (timeoutMs <= 0) {
      return Promise.resolve(undefined);
    }

    return new Promise((resolve) => {
      const waiterKey = key(serverId, uri);
      let timeout: NodeJS.Timeout | undefined;
      const resolveOnce = (value: StoredDiagnostics | undefined) => {
        const waiters = this.waiters.get(waiterKey);
        waiters?.delete(onDiagnostics);
        if (waiters?.size === 0) {
          this.waiters.delete(waiterKey);
        }
        if (timeout) {
          clearTimeout(timeout);
        }
        resolve(value);
      };
      const onDiagnostics = (diagnostics: StoredDiagnostics) => resolveOnce(diagnostics);
      let waiters = this.waiters.get(waiterKey);
      if (!waiters) {
        waiters = new Set();
        this.waiters.set(waiterKey, waiters);
      }
      waiters.add(onDiagnostics);
      timeout = setTimeout(() => resolveOnce(undefined), timeoutMs);
    });
  }

  private set(serverId: string, uri: string, diagnostics: unknown[]): void {
    const stored = {
      serverId,
      uri,
      diagnostics,
      receivedAt: Date.now(),
    } satisfies StoredDiagnostics;
    this.diagnostics.set(key(serverId, uri), stored);
    const waiters = this.waiters.get(key(serverId, uri));
    if (!waiters) {
      return;
    }
    for (const waiter of waiters) {
      waiter(stored);
    }
  }
}

export function diagnosticFilePath(uri: string): string | undefined {
  try {
    return uriToFilePath(uri);
  } catch {
    return undefined;
  }
}

function key(serverId: string, uri: string): string {
  return `${serverId}\0${uri}`;
}
