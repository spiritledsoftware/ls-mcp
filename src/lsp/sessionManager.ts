import { existsSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { LspMcpConfig } from "../config/schema.js";
import {
  builtInServers,
  getBuiltInServer,
  type BuiltInServerMetadata,
} from "../registry/builtins.js";
import {
  resolveLspServerCommand,
  type ResolveLspServerCommandOptions,
  type ResolvedServerCommand,
} from "../registry/installer.js";
import {
  LspSession,
  type LspSessionHealth,
  type LspRequestOptions,
  type LspSessionOptions,
  type ServerCapabilities,
} from "./session.js";
import type { LspProcessStatus } from "./transport.js";

type ConfiguredServer = NonNullable<NonNullable<LspMcpConfig["lsp"]>["servers"]>[string];
type DownloadsConfig = LspMcpConfig["downloads"];

export interface ManagedLspSession {
  readonly capabilities?: ServerCapabilities;
  readonly health?: LspSessionHealth;
  readonly status?: LspProcessStatus;
  start(): Promise<void>;
  shutdown(): Promise<void>;
  onNotification(method: string, handler: (params: unknown) => void): { dispose(): void };
  sendNotification(method: string, params?: unknown): Promise<void>;
  sendRequest<T = unknown>(
    method: string,
    params?: unknown,
    options?: LspRequestOptions,
  ): Promise<T>;
}

export interface SessionCommandResolverOptions {
  serverId: string;
  server: ConfiguredServer;
  downloads?: LspMcpConfig["downloads"];
}

export type SessionCommandResolver = (
  options: SessionCommandResolverOptions,
) => Promise<ResolvedServerCommand>;

export type LspSessionFactory = (options: LspSessionOptions) => ManagedLspSession;

export interface LspSessionManagerOptions {
  config?: LspMcpConfig;
  maxActiveServers?: number;
  idleTimeoutMs?: number;
  commandResolver?: SessionCommandResolver;
  sessionFactory?: LspSessionFactory;
  onSessionShutdown?: (session: ManagedLspSession) => void;
}

export interface GetSessionsForFileOptions {
  workspaceRoot: string;
  filePath: string;
  languageId?: string;
  serverId?: string;
}

export interface GetSessionsForWorkspaceOptions {
  workspaceRoot: string;
  serverId?: string;
}

export interface AcquiredLspSession {
  serverId: string;
  workspaceRoot: string;
  session: ManagedLspSession;
  languageIds: readonly string[];
  extensions: readonly string[];
}

export interface FailedLspSessionAcquisition {
  serverId: string;
  error: string;
}

export type SettledLspSessionAcquisition =
  | { ok: true; value: AcquiredLspSession }
  | { ok: false; value: FailedLspSessionAcquisition };

interface ServerDefinition {
  id: string;
  server: ConfiguredServer;
  metadata?: BuiltInServerMetadata;
  languageIds: readonly string[];
  extensions: readonly string[];
  dedupeId: string;
}

export interface LspServerDefinitionStatus {
  id: string;
  registryId?: string;
  kind: "managed" | "system" | "custom";
  profile?: "managed" | "system";
  command?: string;
  configuredCommand: boolean;
  args: readonly string[];
  languageIds: readonly string[];
  extensions: readonly string[];
  installStrategy?: string;
  version?: string;
  aliases: readonly string[];
  upstream?: BuiltInServerMetadata["upstream"];
  running: boolean;
  server: ConfiguredServer;
  downloads?: DownloadsConfig;
}

export interface LspActiveSessionStatus {
  serverId: string;
  workspaceRoot: string;
  running: boolean;
  process?: LspProcessStatus;
  capabilities?: ServerCapabilities;
  health?: LspSessionHealth;
  lastAccessedAt?: Date;
  idleDeadlineAt?: Date;
}

interface ActiveSession {
  key: string;
  serverId: string;
  workspaceRoot: string;
  session: ManagedLspSession;
  idleTimer?: NodeJS.Timeout;
  shutdownPromise?: Promise<void>;
  lastAccessedAt?: Date;
  idleDeadlineAt?: Date;
}

const DEFAULT_MAX_ACTIVE_SERVERS = Number.POSITIVE_INFINITY;
const DEFAULT_IDLE_TIMEOUT_MS = 5 * 60 * 1_000;

export class LspSessionManager {
  private readonly config: LspMcpConfig;
  private readonly maxActiveServers: number;
  private readonly idleTimeoutMs: number;
  private readonly commandResolver: SessionCommandResolver;
  private readonly sessionFactory: LspSessionFactory;
  private readonly onSessionShutdown?: (session: ManagedLspSession) => void;
  private readonly sessions = new Map<string, ActiveSession>();
  private readonly starting = new Map<string, Promise<ActiveSession>>();

  constructor(options: LspSessionManagerOptions = {}) {
    this.config = options.config ?? {};
    this.maxActiveServers =
      options.maxActiveServers ??
      this.config.sessions?.maxActiveServers ??
      DEFAULT_MAX_ACTIVE_SERVERS;
    this.idleTimeoutMs =
      options.idleTimeoutMs ?? this.config.sessions?.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
    this.commandResolver =
      options.commandResolver ??
      ((resolverOptions) =>
        resolveLspServerCommand({
          serverId: resolverOptions.serverId,
          server: resolverOptions.server,
          downloads: resolverOptions.downloads,
        } satisfies ResolveLspServerCommandOptions));
    this.sessionFactory =
      options.sessionFactory ??
      ((sessionOptions) => {
        requireCommand(sessionOptions.command);
        return new LspSession(sessionOptions);
      });
    this.onSessionShutdown = options.onSessionShutdown;
  }

  get activeSessionCount(): number {
    return this.sessions.size;
  }

  async getSessionsForFile(options: GetSessionsForFileOptions): Promise<AcquiredLspSession[]> {
    const definitions = this.resolveMatchingServers(options);
    const acquired: AcquiredLspSession[] = [];

    for (const definition of definitions) {
      const active = await this.acquireSession(options.workspaceRoot, definition);
      acquired.push({
        serverId: definition.id,
        workspaceRoot: active.workspaceRoot,
        session: active.session,
        languageIds: definition.languageIds,
        extensions: definition.extensions,
      });
    }

    return acquired;
  }

  async getSessionsForFileSettled(
    options: GetSessionsForFileOptions,
  ): Promise<SettledLspSessionAcquisition[]> {
    return this.acquireDefinitionsSettled(
      options.workspaceRoot,
      this.resolveMatchingServers(options),
    );
  }

  async getSessionsForWorkspace(
    options: GetSessionsForWorkspaceOptions,
  ): Promise<AcquiredLspSession[]> {
    const definitions = this.resolveWorkspaceServers(options.serverId);
    const acquired: AcquiredLspSession[] = [];

    for (const definition of definitions) {
      const active = await this.acquireSession(options.workspaceRoot, definition);
      acquired.push({
        serverId: definition.id,
        workspaceRoot: active.workspaceRoot,
        session: active.session,
        languageIds: definition.languageIds,
        extensions: definition.extensions,
      });
    }

    return acquired;
  }

  async getSessionsForWorkspaceSettled(
    options: GetSessionsForWorkspaceOptions,
  ): Promise<SettledLspSessionAcquisition[]> {
    return this.acquireDefinitionsSettled(
      options.workspaceRoot,
      this.resolveWorkspaceServers(options.serverId),
    );
  }

  async shutdownAll(): Promise<void> {
    await Promise.all([...this.sessions.values()].map((session) => this.shutdownSession(session)));
    await Promise.allSettled(this.starting.values());
    await Promise.all([...this.sessions.values()].map((session) => this.shutdownSession(session)));
  }

  listServers(): LspServerDefinitionStatus[] {
    return this.resolveWorkspaceServers().map((definition) => ({
      id: definition.id,
      registryId: definition.metadata?.id ?? definition.server.registry,
      kind: getServerKind(definition),
      profile: definition.server.profile,
      command: definition.server.command ?? definition.metadata?.command,
      configuredCommand: Boolean(definition.server.command),
      args: definition.server.args ?? definition.metadata?.args ?? [],
      languageIds: definition.languageIds,
      extensions: definition.extensions,
      installStrategy: definition.metadata?.installStrategy.type,
      version: definition.metadata?.version,
      aliases: definition.metadata?.aliases ?? [],
      upstream: definition.metadata?.upstream,
      running: this.hasRunningSession(definition.id),
      server: definition.server,
      downloads: this.config.downloads,
    }));
  }

  listServerStatuses(options: {
    workspaceRoot: string;
    filePath?: string;
    languageId?: string;
    serverId?: string;
  }): LspServerDefinitionStatus[] {
    const definitions = options.filePath
      ? this.resolveMatchingServers({
          workspaceRoot: options.workspaceRoot,
          filePath: options.filePath,
          languageId: options.languageId,
          serverId: options.serverId,
        })
      : this.resolveWorkspaceServers(options.serverId);
    const normalizedRoot = resolve(options.workspaceRoot);
    return definitions.map((definition) => ({
      id: definition.id,
      registryId: definition.metadata?.id ?? definition.server.registry,
      kind: getServerKind(definition),
      profile: definition.server.profile,
      command: definition.server.command ?? definition.metadata?.command,
      configuredCommand: Boolean(definition.server.command),
      args: definition.server.args ?? definition.metadata?.args ?? [],
      languageIds: definition.languageIds,
      extensions: definition.extensions,
      installStrategy: definition.metadata?.installStrategy.type,
      version: definition.metadata?.version,
      aliases: definition.metadata?.aliases ?? [],
      upstream: definition.metadata?.upstream,
      running: this.sessions.has(sessionKey(normalizedRoot, definition.id)),
      server: definition.server,
      downloads: this.config.downloads,
    }));
  }

  listActiveSessions(
    options: { workspaceRoot?: string; serverId?: string } = {},
  ): LspActiveSessionStatus[] {
    const workspaceRoot = options.workspaceRoot ? resolve(options.workspaceRoot) : undefined;
    const serverId = options.serverId ? this.resolveServerId(options.serverId) : undefined;
    return [...this.sessions.values()]
      .filter((active) => !workspaceRoot || active.workspaceRoot === workspaceRoot)
      .filter((active) => !serverId || active.serverId === serverId)
      .map((active) => ({
        serverId: active.serverId,
        workspaceRoot: active.workspaceRoot,
        running: true,
        process: active.session.status,
        capabilities: active.session.capabilities,
        health: active.session.health,
        lastAccessedAt: active.lastAccessedAt,
        idleDeadlineAt: active.idleDeadlineAt,
      }));
  }

  async stopServer(options: { workspaceRoot: string; serverId: string }): Promise<boolean> {
    const key = sessionKey(resolve(options.workspaceRoot), this.resolveServerId(options.serverId));
    const starting = this.starting.get(key);
    if (starting) {
      const active = await starting.catch(() => undefined);
      if (active) {
        await this.shutdownSession(active);
        return true;
      }
    }

    const active = this.sessions.get(key);
    if (!active) {
      return false;
    }
    await this.shutdownSession(active);
    return true;
  }

  async stopWorkspace(workspaceRoot: string): Promise<LspActiveSessionStatus[]> {
    const normalizedRoot = resolve(workspaceRoot);
    const startedDuringStop = await Promise.all(
      [...this.starting.entries()]
        .filter(([key]) => key.startsWith(`${normalizedRoot}\0`))
        .map(([, starting]) => starting.catch(() => undefined)),
    );
    const active = [...this.sessions.values(), ...startedDuringStop.filter(isActiveSession)].filter(
      (session) => session.workspaceRoot === normalizedRoot,
    );
    const uniqueActive = [...new Map(active.map((session) => [session.key, session])).values()];
    await Promise.all(uniqueActive.map((session) => this.shutdownSession(session)));
    return uniqueActive.map((session) => ({
      serverId: session.serverId,
      workspaceRoot: session.workspaceRoot,
      running: false,
      process: session.session.status,
      capabilities: session.session.capabilities,
      health: session.session.health,
      lastAccessedAt: session.lastAccessedAt,
      idleDeadlineAt: session.idleDeadlineAt,
    }));
  }

  private resolveMatchingServers(options: GetSessionsForFileOptions): ServerDefinition[] {
    const definitions = this.getServerDefinitions();
    if (options.serverId) {
      const definition = this.resolveServerDefinition(definitions, options.serverId);
      if (!definition) {
        throw new Error(`Unknown LSP server ${options.serverId}`);
      }
      if (
        hasMatchCriteria(definition) &&
        !matchesTarget(definition, options.filePath, options.languageId)
      ) {
        const language = options.languageId ? ` or language ${options.languageId}` : "";
        throw new Error(`Server ${options.serverId} does not match ${options.filePath}${language}`);
      }
      return [definition];
    }

    const seen = new Set<string>();
    const matched: ServerDefinition[] = [];
    for (const definition of definitions) {
      if (
        !matchesTarget(definition, options.filePath, options.languageId) ||
        !activationApplies(definition, options.workspaceRoot) ||
        seen.has(definition.dedupeId)
      ) {
        continue;
      }
      seen.add(definition.dedupeId);
      matched.push(definition);
    }
    return matched;
  }

  private resolveWorkspaceServers(serverId?: string): ServerDefinition[] {
    const definitions = this.getServerDefinitions();
    if (serverId) {
      const definition = this.resolveServerDefinition(definitions, serverId);
      if (!definition) {
        throw new Error(`Unknown LSP server ${serverId}`);
      }
      return [definition];
    }

    const seen = new Set<string>();
    const matched: ServerDefinition[] = [];
    for (const definition of definitions) {
      if (seen.has(definition.dedupeId)) {
        continue;
      }
      seen.add(definition.dedupeId);
      matched.push(definition);
    }
    return matched;
  }

  private getServerDefinitions(): ServerDefinition[] {
    const definitions: ServerDefinition[] = [];
    const configured = this.config.lsp?.servers ?? {};
    const configuredRegistryIds = new Set<string>();

    for (const [id, server] of Object.entries(configured)) {
      const metadata = getBuiltInServer(server.registry ?? id);
      if (metadata) {
        configuredRegistryIds.add(metadata.id);
      }
      definitions.push(toServerDefinition(id, server, metadata));
    }

    for (const metadata of Object.values(builtInServers)) {
      if (configured[metadata.id] || configuredRegistryIds.has(metadata.id)) {
        continue;
      }
      definitions.push(toServerDefinition(metadata.id, { registry: metadata.id }, metadata));
    }

    return definitions;
  }

  private resolveServerId(serverId: string): string {
    return this.resolveServerDefinition(this.getServerDefinitions(), serverId)?.id ?? serverId;
  }

  private resolveServerDefinition(
    definitions: readonly ServerDefinition[],
    serverId: string,
  ): ServerDefinition | undefined {
    const canonicalId = getBuiltInServer(serverId)?.id ?? serverId;
    return definitions.find(
      (definition) => definition.id === serverId || definition.metadata?.id === canonicalId,
    );
  }

  private async acquireSession(
    workspaceRoot: string,
    definition: ServerDefinition,
  ): Promise<ActiveSession> {
    const normalizedRoot = resolve(workspaceRoot);
    const key = sessionKey(normalizedRoot, definition.id);
    const existing = this.sessions.get(key);
    if (existing) {
      if (existing.shutdownPromise) {
        await existing.shutdownPromise.catch(() => undefined);
        return this.acquireSession(normalizedRoot, definition);
      }
      this.touch(existing);
      return existing;
    }

    const starting = this.starting.get(key);
    if (starting) {
      const active = await starting;
      this.touch(active);
      return active;
    }

    if (this.sessions.size + this.starting.size >= this.maxActiveServers) {
      throw new Error(`Max active LSP servers reached (${this.maxActiveServers})`);
    }

    const startup = this.startSession(key, normalizedRoot, definition);
    this.starting.set(key, startup);
    try {
      return await startup;
    } finally {
      this.starting.delete(key);
    }
  }

  private async acquireDefinitionsSettled(
    workspaceRoot: string,
    definitions: ServerDefinition[],
  ): Promise<SettledLspSessionAcquisition[]> {
    const settled: SettledLspSessionAcquisition[] = [];
    for (const definition of definitions) {
      try {
        const active = await this.acquireSession(workspaceRoot, definition);
        settled.push({
          ok: true,
          value: {
            serverId: definition.id,
            workspaceRoot: active.workspaceRoot,
            session: active.session,
            languageIds: definition.languageIds,
            extensions: definition.extensions,
          },
        });
      } catch (error) {
        settled.push({ ok: false, value: { serverId: definition.id, error: errorMessage(error) } });
      }
    }
    return settled;
  }

  private async startSession(
    key: string,
    workspaceRoot: string,
    definition: ServerDefinition,
  ): Promise<ActiveSession> {
    const resolvedCommand = await this.commandResolver({
      serverId: definition.id,
      server: definition.server,
      downloads: this.config.downloads,
    });
    if (resolvedCommand.status !== "ready") {
      throw new Error(`LSP server ${definition.id} is not ready: ${resolvedCommand.reason}`);
    }

    const session = this.sessionFactory({
      command: resolvedCommand.command,
      args: resolvedCommand.args,
      cwd: definition.server.cwd ?? workspaceRoot,
      env: definition.server.env ? { ...process.env, ...definition.server.env } : undefined,
      rootUri: pathToFileURL(workspaceRoot).toString(),
      initializationOptions: definition.server.initializationOptions,
      maxConcurrentRequestsPerServer: this.config.sessions?.maxConcurrentRequestsPerServer,
      requestTimeoutMs: this.config.sessions?.requestTimeoutMs,
      workspaceRequestTimeoutMs: this.config.sessions?.workspaceRequestTimeoutMs,
      methodTimeoutsMs: this.config.sessions?.methodTimeoutsMs,
    });
    const active: ActiveSession = { key, serverId: definition.id, workspaceRoot, session };

    try {
      await session.start();
    } catch (error) {
      await session.shutdown().catch(() => undefined);
      throw error;
    }

    this.sessions.set(key, active);
    this.touch(active);
    return active;
  }

  private touch(session: ActiveSession): void {
    session.lastAccessedAt = new Date();
    session.idleDeadlineAt = undefined;
    if (session.idleTimer) {
      clearTimeout(session.idleTimer);
    }
    if (this.idleTimeoutMs === 0) {
      void this.shutdownSession(session).catch(() => undefined);
      return;
    }
    if (!Number.isFinite(this.idleTimeoutMs)) {
      return;
    }
    session.idleDeadlineAt = new Date(Date.now() + this.idleTimeoutMs);
    session.idleTimer = setTimeout(() => {
      void this.shutdownSession(session).catch(() => undefined);
    }, this.idleTimeoutMs);
    session.idleTimer.unref?.();
  }

  private async shutdownSession(session: ActiveSession): Promise<void> {
    session.shutdownPromise ??= (async () => {
      if (session.idleTimer) {
        clearTimeout(session.idleTimer);
      }
      try {
        await session.session.shutdown();
      } finally {
        this.onSessionShutdown?.(session.session);
        this.sessions.delete(session.key);
      }
    })();
    return session.shutdownPromise;
  }

  private hasRunningSession(serverId: string): boolean {
    return [...this.sessions.values()].some((session) => session.serverId === serverId);
  }
}

function toServerDefinition(
  id: string,
  server: ConfiguredServer,
  metadata?: BuiltInServerMetadata,
): ServerDefinition {
  const languageIds = server.languageIds ?? metadata?.languageIds ?? [];
  const extensions = normalizeExtensions(server.extensions ?? metadata?.extensions ?? []);
  return {
    id,
    server,
    metadata,
    languageIds,
    extensions,
    dedupeId: metadata?.id ?? id,
  };
}

function normalizeExtensions(extensions: readonly string[]): string[] {
  return extensions.map((extension) =>
    extension.startsWith(".") ? extension.toLowerCase() : `.${extension.toLowerCase()}`,
  );
}

function matchesTarget(
  definition: ServerDefinition,
  filePath: string,
  languageId?: string,
): boolean {
  const fileExtension = extname(filePath).toLowerCase();
  const matchesExtension = fileExtension !== "" && definition.extensions.includes(fileExtension);
  const matchesLanguage = languageId ? definition.languageIds.includes(languageId) : false;
  return matchesExtension || matchesLanguage;
}

function hasMatchCriteria(definition: ServerDefinition): boolean {
  return definition.extensions.length > 0 || definition.languageIds.length > 0;
}

function activationApplies(definition: ServerDefinition, workspaceRoot: string): boolean {
  const requiredRootMarkers = definition.metadata?.activation?.requiredRootMarkers;
  return (
    (!requiredRootMarkers?.length ||
      requiredRootMarkers.some((marker) => existsSync(join(workspaceRoot, marker)))) &&
    !hasAnyRootMarker(definition.metadata?.activation?.excludedRootMarkers, workspaceRoot)
  );
}

function hasAnyRootMarker(markers: readonly string[] | undefined, workspaceRoot: string): boolean {
  return Boolean(markers?.some((marker) => existsSync(join(workspaceRoot, marker))));
}

function sessionKey(workspaceRoot: string, serverId: string): string {
  return `${workspaceRoot}\0${serverId}`;
}

function requireCommand(command: string | undefined): string {
  if (!command) {
    throw new Error("LSP session manager requires a resolved command");
  }
  return command;
}

function getServerKind(definition: ServerDefinition): "managed" | "system" | "custom" {
  if (!definition.metadata) {
    return "custom";
  }
  if (
    definition.server.profile === "system" ||
    definition.metadata.installStrategy.type === "system"
  ) {
    return "system";
  }
  return "managed";
}

function isActiveSession(session: ActiveSession | undefined): session is ActiveSession {
  return Boolean(session);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
