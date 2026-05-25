import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export interface InstallLocksOptions {
  lockRoot?: string;
  acquireTimeoutMs?: number;
  retryDelayMs?: number;
  staleTimeoutMs?: number;
  now?: () => number;
}

interface LockMetadata {
  createdAt: number;
  pid: number;
  key: string;
  token: string;
}

const defaultAcquireTimeoutMs = 2 * 60 * 1000;
const defaultRetryDelayMs = 100;
const defaultStaleTimeoutMs = 30 * 60 * 1000;

function safeLockPart(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, "_");
}

function isAlreadyExistsError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "EEXIST";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class InstallLocks {
  private readonly locks = new Map<string, Promise<unknown>>();

  constructor(private readonly options: InstallLocksOptions = {}) {}

  getLockPath(serverId: string, version: string): string {
    const lockRoot = this.options.lockRoot;
    if (!lockRoot) {
      throw new Error("Install lock root is required for filesystem lock paths.");
    }
    return join(lockRoot, `${safeLockPart(serverId)}@${safeLockPart(version)}.lock`);
  }

  async withLock<T>(serverId: string, version: string, install: () => Promise<T>): Promise<T> {
    const key = `${serverId}@${version}`;
    const existing = this.locks.get(key) as Promise<T> | undefined;
    if (existing) {
      return existing;
    }

    const promise = this.withFilesystemLock(key, serverId, version, install).finally(() =>
      this.locks.delete(key),
    );
    this.locks.set(key, promise);
    return promise;
  }

  private async withFilesystemLock<T>(
    key: string,
    serverId: string,
    version: string,
    install: () => Promise<T>,
  ): Promise<T> {
    if (!this.options.lockRoot) {
      return install();
    }

    const lockPath = this.getLockPath(serverId, version);
    const token = await this.acquireFilesystemLock(key, lockPath);
    try {
      return await install();
    } finally {
      await this.releaseFilesystemLock(lockPath, token);
    }
  }

  private async acquireFilesystemLock(key: string, lockPath: string): Promise<string> {
    const startedAt = this.now();
    await mkdir(this.options.lockRoot!, { recursive: true });

    while (true) {
      try {
        await mkdir(lockPath, { recursive: false });
        const token = randomUUID();
        await writeFile(
          join(lockPath, "metadata.json"),
          JSON.stringify({
            createdAt: this.now(),
            pid: process.pid,
            key,
            token,
          } satisfies LockMetadata),
          "utf8",
        );
        return token;
      } catch (error: unknown) {
        if (!isAlreadyExistsError(error)) {
          throw error;
        }

        if (await this.removeIfStale(lockPath)) {
          continue;
        }

        if (this.now() - startedAt >= (this.options.acquireTimeoutMs ?? defaultAcquireTimeoutMs)) {
          throw new Error(`Timed out waiting for install lock ${lockPath}`);
        }

        await sleep(this.options.retryDelayMs ?? defaultRetryDelayMs);
      }
    }
  }

  private async removeIfStale(lockPath: string): Promise<boolean> {
    let metadata: LockMetadata | undefined;
    try {
      metadata = JSON.parse(
        await readFile(join(lockPath, "metadata.json"), "utf8"),
      ) as LockMetadata;
    } catch {
      let directoryMtime: number;
      try {
        directoryMtime = (await stat(lockPath)).mtimeMs;
      } catch {
        return true;
      }
      if (this.now() - directoryMtime < (this.options.staleTimeoutMs ?? defaultStaleTimeoutMs)) {
        return false;
      }
      await rm(lockPath, { recursive: true, force: true });
      return true;
    }

    if (this.now() - metadata.createdAt < (this.options.staleTimeoutMs ?? defaultStaleTimeoutMs)) {
      return false;
    }

    await rm(lockPath, { recursive: true, force: true });
    return true;
  }

  private async releaseFilesystemLock(lockPath: string, token: string): Promise<void> {
    let metadata: LockMetadata;
    try {
      metadata = JSON.parse(
        await readFile(join(lockPath, "metadata.json"), "utf8"),
      ) as LockMetadata;
    } catch {
      return;
    }

    if (metadata.token === token) {
      await rm(lockPath, { recursive: true, force: true });
    }
  }

  private now(): number {
    return (this.options.now ?? Date.now)();
  }
}
