import { z } from "zod";
import { resolve } from "node:path";

import { resolveLspServerCommandStatus } from "../registry/installer.js";
import type {
  LspActiveSessionStatus,
  LspServerDefinitionStatus,
  LspSessionManager,
} from "../lsp/sessionManager.js";

export const lspServersInputSchema = z.object({}).strict().optional();

export const lspServerStatusInputSchema = z
  .object({
    workspaceRoot: z.string(),
    filePath: z.string().optional(),
    languageId: z.string().optional(),
    serverId: z.string().optional(),
  })
  .strict();

export const lspStopServerInputSchema = z
  .object({
    workspaceRoot: z.string(),
    serverId: z.string(),
  })
  .strict();

export const lspStopWorkspaceInputSchema = z
  .object({
    workspaceRoot: z.string(),
  })
  .strict();

export const lspServersSchema = z.object({
  ok: z.boolean(),
  servers: z.array(z.record(z.string(), z.unknown())),
});

export type LspServers = z.infer<typeof lspServersSchema>;

export interface ServerToolDependencies {
  sessionManager: LspSessionManager;
}

export function createServerToolHandlers(dependencies: ServerToolDependencies) {
  const { sessionManager } = dependencies;

  return {
    async listServers(): Promise<LspServers> {
      const servers = await Promise.all(sessionManager.listServers().map(toServerInfo));
      return { ok: true, servers };
    },

    async serverStatus(input: unknown): Promise<unknown> {
      const parsed = lspServerStatusInputSchema.parse(input);
      const servers = await Promise.all(
        sessionManager.listServerStatuses(parsed).map(toServerInfo),
      );
      const matchedServerIds = new Set(servers.map((server) => server.id));
      const sessions = sessionManager
        .listActiveSessions({ workspaceRoot: parsed.workspaceRoot, serverId: parsed.serverId })
        .filter((session) => matchedServerIds.has(session.serverId))
        .map(toSessionInfo);
      return { ok: true, servers, sessions };
    },

    async stopServer(input: unknown): Promise<unknown> {
      const parsed = lspStopServerInputSchema.parse(input);
      const stopped = await sessionManager.stopServer(parsed);
      const workspaceRoot = resolve(parsed.workspaceRoot);
      return stopped
        ? {
            ok: true,
            stopped: true,
            serverId: parsed.serverId,
            workspaceRoot,
          }
        : {
            ok: true,
            stopped: false,
            reason: "not-running",
            serverId: parsed.serverId,
            workspaceRoot,
          };
    },

    async stopWorkspace(input: unknown): Promise<unknown> {
      const parsed = lspStopWorkspaceInputSchema.parse(input);
      const stopped = await sessionManager.stopWorkspace(parsed.workspaceRoot);
      const workspaceRoot = resolve(parsed.workspaceRoot);
      return {
        ok: true,
        workspaceRoot,
        stoppedCount: stopped.length,
        stopped: stopped.map((session) => ({
          serverId: session.serverId,
          workspaceRoot: session.workspaceRoot,
        })),
      };
    },
  };
}

async function toServerInfo(server: LspServerDefinitionStatus) {
  return {
    ...server,
    install: await getInstallStatus(server),
  };
}

async function getInstallStatus(server: LspServerDefinitionStatus) {
  return resolveLspServerCommandStatus({
    serverId: server.id,
    server: server.server,
    downloads: server.downloads,
  });
}

function toSessionInfo(session: LspActiveSessionStatus) {
  return {
    serverId: session.serverId,
    workspaceRoot: session.workspaceRoot,
    running: session.running,
    process: session.process,
    capabilities: summarizeCapabilities(session.capabilities),
    health: session.health,
    lastAccessedAt: session.lastAccessedAt?.toISOString(),
    idleDeadlineAt: session.idleDeadlineAt?.toISOString(),
  };
}

function summarizeCapabilities(capabilities: unknown) {
  if (!capabilities || typeof capabilities !== "object") {
    return {};
  }
  const record = capabilities as Record<string, unknown>;
  return {
    hover: Boolean(record.hoverProvider),
    completion: Boolean(record.completionProvider),
    definition: Boolean(record.definitionProvider),
    references: Boolean(record.referencesProvider),
    documentSymbol: Boolean(record.documentSymbolProvider),
    workspaceSymbol: Boolean(record.workspaceSymbolProvider),
    codeAction: Boolean(record.codeActionProvider),
    rename: Boolean(record.renameProvider),
    formatting: Boolean(record.documentFormattingProvider),
  };
}
