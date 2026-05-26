import { z } from "zod";
import { extname, resolve } from "node:path";

import { ServerResolutionError } from "../lsp/serverIdentity.js";
import { resolveLspServerCommandStatus } from "../registry/installer.js";
import { serverInfoSchema, serverSuggestionSchema } from "./outputSchemas.js";
import { structuredToolError } from "./toolErrors.js";
import type {
  LspActiveSessionStatus,
  LspServerDefinitionStatus,
  LspSessionManager,
} from "../lsp/sessionManager.js";

export const lspServersInputSchema = z
  .object({
    workspaceRoot: z.string().optional(),
    filePath: z.string().optional(),
    languageId: z.string().optional(),
    serverId: z.string().optional(),
  })
  .strict()
  .optional();

export const lspServerStatusInputSchema = z
  .object({
    workspaceRoot: z.string(),
    filePath: z.string().optional(),
    languageId: z.string().optional(),
    serverId: z.string().optional(),
  })
  .strict();

export const searchServersInputSchema = z
  .object({
    query: z.string(),
    workspaceRoot: z.string().optional(),
    filePath: z.string().optional(),
    languageId: z.string().optional(),
    limit: z.number().int().positive().optional(),
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

export const lspServersSchema = z.union([
  z
    .object({
      ok: z.literal(true),
      servers: z.array(serverInfoSchema).readonly(),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      error: z.string(),
      code: z.string().optional(),
      serverId: z.string().optional(),
      suggestions: z.array(serverSuggestionSchema).readonly().optional(),
    })
    .strict(),
]);

export const searchServersSchema = z.object({
  ok: z.literal(true),
  query: z.string(),
  matches: z.array(serverSuggestionSchema).readonly(),
});

export type LspServers = z.infer<typeof lspServersSchema>;

export interface ServerToolDependencies {
  sessionManager: LspSessionManager;
}

export function createServerToolHandlers(dependencies: ServerToolDependencies) {
  const { sessionManager } = dependencies;

  return {
    async listServers(input: unknown): Promise<LspServers> {
      const parsed = lspServersInputSchema.parse(input);
      try {
        const statuses = listServerStatuses(sessionManager, parsed);
        const servers = await Promise.all(statuses.map(toServerInfo));
        return { ok: true, servers };
      } catch (error) {
        if (error instanceof ServerResolutionError) {
          return {
            ok: false,
            error: error.message,
            code: error.code,
            serverId: error.serverId,
            suggestions: error.suggestions.map((suggestion) => ({ ...suggestion })),
          };
        }
        throw error;
      }
    },

    async serverStatus(input: unknown): Promise<unknown> {
      const parsed = lspServerStatusInputSchema.parse(input);
      let servers: Awaited<ReturnType<typeof toServerInfo>>[];
      try {
        servers = await Promise.all(sessionManager.listServerStatuses(parsed).map(toServerInfo));
      } catch (error) {
        if (error instanceof ServerResolutionError) {
          return { ok: false, ...structuredToolError(error) };
        }
        throw error;
      }
      const matchedServerIds = new Set(servers.map((server) => server.id));
      const matchedConfiguredIds = new Set(
        servers.map((server) => server.configuredId).filter((id): id is string => Boolean(id)),
      );
      const sessions = sessionManager
        .listActiveSessions({ workspaceRoot: parsed.workspaceRoot })
        .filter(
          (session) =>
            matchedServerIds.has(session.serverId) &&
            (matchedConfiguredIds.size === 0 ||
              (session.configuredId !== undefined &&
                matchedConfiguredIds.has(session.configuredId))),
        )
        .map(toSessionInfo);
      return { ok: true, servers, sessions };
    },

    searchServers(input: unknown): unknown {
      const parsed = searchServersInputSchema.parse(input);
      return {
        ok: true,
        query: parsed.query,
        matches: sessionManager.searchServers(parsed).map((match) => ({ ...match })),
      };
    },

    async stopServer(input: unknown): Promise<unknown> {
      const parsed = lspStopServerInputSchema.parse(input);
      let stopped: boolean;
      try {
        stopped = await sessionManager.stopServer(parsed);
      } catch (error) {
        if (error instanceof ServerResolutionError) {
          return { ok: false, ...structuredToolError(error) };
        }
        throw error;
      }
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

function listServerStatuses(
  sessionManager: LspSessionManager,
  options: z.infer<typeof lspServersInputSchema>,
): LspServerDefinitionStatus[] {
  if (!options) {
    return sessionManager.listServers();
  }

  if (options.workspaceRoot) {
    try {
      return sessionManager.listServerStatuses({
        workspaceRoot: options.workspaceRoot,
        filePath: options.filePath,
        languageId: options.languageId,
        serverId: options.serverId,
      });
    } catch (error) {
      if (error instanceof Error && / does not match /.test(error.message)) {
        return [];
      }
      throw error;
    }
  }

  const resolvedServerId = options.serverId
    ? sessionManager.resolveServerId(options.serverId)
    : undefined;
  return sessionManager
    .listServers()
    .filter((server) => !resolvedServerId || server.id === resolvedServerId)
    .filter((server) => matchesListTarget(server, options.filePath, options.languageId));
}

function matchesListTarget(
  server: LspServerDefinitionStatus,
  filePath?: string,
  languageId?: string,
): boolean {
  if (!filePath && !languageId) {
    return true;
  }
  const fileExtension = filePath ? extname(filePath).toLowerCase() : "";
  return (
    (languageId !== undefined && server.languageIds.includes(languageId)) ||
    (fileExtension !== "" && server.extensions.includes(fileExtension))
  );
}

async function toServerInfo(server: LspServerDefinitionStatus) {
  const { downloads, server: _serverConfig, ...publicServer } = server;
  void downloads;
  return {
    ...publicServer,
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
    configuredId: session.configuredId,
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
