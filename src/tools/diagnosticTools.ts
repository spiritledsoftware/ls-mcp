import { isAbsolute, resolve } from "node:path";

import { z } from "zod";

import type { LspMcpConfig } from "../config/schema.js";
import { DiagnosticStore, diagnosticFilePath } from "../lsp/diagnosticStore.js";
import { filePathToUri } from "../lsp/documentStore.js";
import type { DocumentStore } from "../lsp/documentStore.js";
import type {
  AcquiredLspSession,
  LspSessionManager,
  SettledLspSessionAcquisition,
} from "../lsp/sessionManager.js";
import { validateWorkspacePath, type WorkspaceSecurityOptions } from "../security/workspace.js";
import type { ToolHandlerContext } from "./registerTools.js";
import { structuredToolError, type StructuredToolError } from "./toolErrors.js";

export type DiagnosticSourceMode = "pull" | "push-cache" | "push-wait";

export interface DiagnosticsToolServerSuccess {
  ok: true;
  mode: DiagnosticSourceMode;
  uri?: string;
  filePath?: string;
  diagnostics: unknown[];
}

export interface DiagnosticsToolServerFailure extends StructuredToolError {
  ok: false;
}

export interface DiagnosticsToolResult {
  ok: boolean;
  results: Record<string, DiagnosticsToolServerSuccess | DiagnosticsToolServerFailure>;
  error?: string;
}

export interface DiagnosticsToolHandlerOptions {
  sessionManager: Pick<LspSessionManager, "getSessionsForFile" | "getSessionsForWorkspace">;
  documentStore: DocumentStore;
  diagnosticStore: DiagnosticStore;
  diagnosticsWaitMs?: number;
  config?: LspMcpConfig;
  security?: WorkspaceSecurityOptions;
}

export const lspDiagnosticsInputSchema = z
  .object({
    workspaceRoot: z.string(),
    filePath: z.string().optional(),
    serverId: z.string().optional(),
    languageId: z.string().optional(),
  })
  .strict();

const DEFAULT_DIAGNOSTICS_WAIT_MS = 750;

export const lspDiagnosticsTool = {
  name: "lsp_diagnostics",
  inputSchema: lspDiagnosticsInputSchema,
} as const;

export function createDiagnosticsToolHandler(options: DiagnosticsToolHandlerOptions) {
  return async (input: unknown, context?: ToolHandlerContext): Promise<DiagnosticsToolResult> => {
    const parsed = lspDiagnosticsInputSchema.parse(input);
    if (parsed.filePath) {
      try {
        const validated = await validateWorkspacePath({
          workspaceRoot: parsed.workspaceRoot,
          filePath: parsed.filePath,
          security: options.security,
        });
        parsed.filePath = validated.path;
      } catch (error) {
        return {
          ok: false,
          results: { validation: { ok: false, ...structuredToolError(error) } },
        };
      }
    }
    const sessions = await acquireSessionsSettled(options.sessionManager, parsed);
    if (sessions.length === 0) {
      return { ok: false, results: {}, error: "No matching LSP servers for lsp_diagnostics" };
    }

    const perServer = await Promise.all(
      sessions.map((acquired) => {
        if (!acquired.ok) {
          return {
            serverId: acquired.value.serverId,
            result: {
              ok: false,
              error: acquired.value.error,
            } satisfies DiagnosticsToolServerFailure,
          };
        }
        return collectDiagnostics(options, acquired.value, parsed, context);
      }),
    );
    const results: DiagnosticsToolResult["results"] = {};
    for (const result of perServer) {
      results[result.serverId] = result.result;
    }
    return { ok: Object.values(results).every((result) => result.ok), results };
  };
}

async function acquireSessionsSettled(
  sessionManager: DiagnosticsToolHandlerOptions["sessionManager"],
  input: z.infer<typeof lspDiagnosticsInputSchema>,
): Promise<SettledLspSessionAcquisition[]> {
  if (input.filePath) {
    if (hasSettledFileAcquisition(sessionManager)) {
      return sessionManager.getSessionsForFileSettled({
        workspaceRoot: input.workspaceRoot,
        filePath: input.filePath,
        languageId: input.languageId,
        serverId: input.serverId,
      });
    }
    return (
      await sessionManager.getSessionsForFile({
        workspaceRoot: input.workspaceRoot,
        filePath: input.filePath,
        languageId: input.languageId,
        serverId: input.serverId,
      })
    ).map((value) => ({ ok: true, value }) as const);
  }
  if (hasSettledWorkspaceAcquisition(sessionManager)) {
    return sessionManager.getSessionsForWorkspaceSettled({
      workspaceRoot: input.workspaceRoot,
      serverId: input.serverId,
    });
  }
  return (
    await sessionManager.getSessionsForWorkspace({
      workspaceRoot: input.workspaceRoot,
      serverId: input.serverId,
    })
  ).map((value) => ({ ok: true, value }) as const);
}

async function collectDiagnostics(
  options: DiagnosticsToolHandlerOptions,
  acquired: AcquiredLspSession,
  input: z.infer<typeof lspDiagnosticsInputSchema>,
  context?: ToolHandlerContext,
): Promise<{
  serverId: string;
  result: DiagnosticsToolServerSuccess | DiagnosticsToolServerFailure;
}> {
  try {
    options.diagnosticStore.watchSession(acquired.serverId, acquired.session);
    if (input.filePath) {
      return {
        serverId: acquired.serverId,
        result: await collectFileDiagnostics(options, acquired, input, context),
      };
    }
    return {
      serverId: acquired.serverId,
      result: await collectWorkspaceDiagnostics(acquired, context),
    };
  } catch (error) {
    return { serverId: acquired.serverId, result: { ok: false, ...structuredToolError(error) } };
  }
}

async function collectFileDiagnostics(
  options: DiagnosticsToolHandlerOptions,
  acquired: AcquiredLspSession,
  input: z.infer<typeof lspDiagnosticsInputSchema>,
  context?: ToolHandlerContext,
): Promise<DiagnosticsToolServerSuccess> {
  const filePath = resolveDiagnosticFilePath(input.workspaceRoot, input.filePath);
  const uri = filePathToUri(filePath);
  await options.documentStore.ensureDocumentOpen({
    session: acquired.session,
    filePath,
    languageId: input.languageId,
    serverLanguageIds: acquired.languageIds,
    serverExtensions: acquired.extensions,
  });
  if (acquired.session.capabilities?.diagnosticProvider) {
    const response = await acquired.session.sendRequest(
      "textDocument/diagnostic",
      {
        textDocument: { uri },
      },
      { signal: context?.signal },
    );
    return {
      ok: true,
      mode: "pull",
      uri,
      filePath,
      diagnostics: normalizeDiagnostics(extractPullDiagnostics(response), uri),
    };
  }

  const cached = options.diagnosticStore.get(acquired.serverId, uri);
  if (cached) {
    return pushResult("push-cache", cached.uri, cached.diagnostics);
  }

  const waited = await options.diagnosticStore.waitFor(
    acquired.serverId,
    uri,
    options.diagnosticsWaitMs ??
      options.config?.sessions?.diagnosticsWaitMs ??
      DEFAULT_DIAGNOSTICS_WAIT_MS,
  );
  return pushResult("push-wait", uri, waited?.diagnostics ?? []);
}

async function collectWorkspaceDiagnostics(
  acquired: AcquiredLspSession,
  context?: ToolHandlerContext,
): Promise<DiagnosticsToolServerSuccess | DiagnosticsToolServerFailure> {
  const provider = acquired.session.capabilities?.diagnosticProvider;
  if (isRecord(provider) && provider.workspaceDiagnostics) {
    const response = await acquired.session.sendRequest(
      "workspace/diagnostic",
      {},
      {
        signal: context?.signal,
      },
    );
    return { ok: true, mode: "pull", diagnostics: normalizeWorkspaceDiagnostics(response) };
  }
  return {
    ok: false,
    error: "Workspace diagnostics require filePath unless the server supports workspace/diagnostic",
  };
}

function pushResult(
  mode: "push-cache" | "push-wait",
  uri: string,
  diagnostics: unknown[],
): DiagnosticsToolServerSuccess {
  return {
    ok: true,
    mode,
    uri,
    filePath: diagnosticFilePath(uri),
    diagnostics: normalizeDiagnostics(diagnostics, uri),
  };
}

function extractPullDiagnostics(response: unknown): unknown[] {
  if (isRecord(response) && Array.isArray(response.items)) {
    return response.items;
  }
  return [];
}

function normalizeWorkspaceDiagnostics(response: unknown): unknown[] {
  if (!isRecord(response) || !Array.isArray(response.items)) {
    return [];
  }
  return response.items.flatMap((item) => {
    if (!isRecord(item) || typeof item.uri !== "string" || !Array.isArray(item.items)) {
      return [];
    }
    return normalizeDiagnostics(item.items, item.uri);
  });
}

function normalizeDiagnostics(diagnostics: unknown[], uri: string): unknown[] {
  return diagnostics.map((diagnostic) => normalizeDiagnosticValue(diagnostic, uri));
}

function normalizeDiagnosticValue(value: unknown, fallbackUri?: string): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeDiagnosticValue(item, fallbackUri));
  }
  if (!isRecord(value)) {
    return value;
  }

  const uri = typeof value.uri === "string" ? value.uri : fallbackUri;
  const normalized: Record<string, unknown> = { ...value };
  if (isRange(value.range)) {
    normalized.range = normalizeRange(value.range);
  }
  if (typeof value.uri === "string") {
    normalized.filePath = diagnosticFilePath(value.uri);
  }
  for (const [key, child] of Object.entries(value)) {
    if (key === "range" && isRange(child)) {
      continue;
    }
    normalized[key] = normalizeDiagnosticValue(child, uri);
  }
  if (fallbackUri && !normalized.uri) {
    normalized.uri = fallbackUri;
    normalized.filePath = diagnosticFilePath(fallbackUri);
  }
  return normalized;
}

function normalizeRange(range: unknown): unknown {
  if (!isRecord(range)) {
    return range;
  }
  return {
    start: normalizePosition(range.start),
    end: normalizePosition(range.end),
  };
}

function normalizePosition(position: unknown): unknown {
  if (!isRecord(position)) {
    return position;
  }
  return {
    line: typeof position.line === "number" ? position.line + 1 : position.line,
    character: typeof position.character === "number" ? position.character + 1 : position.character,
  };
}

function resolveDiagnosticFilePath(workspaceRoot: string, filePath?: string): string {
  const target = filePath ?? workspaceRoot;
  return isAbsolute(target) ? resolve(target) : resolve(workspaceRoot, target);
}

function isRange(value: unknown): value is { start: unknown; end: unknown } {
  return isRecord(value) && "start" in value && "end" in value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasSettledFileAcquisition(
  sessionManager: DiagnosticsToolHandlerOptions["sessionManager"],
): sessionManager is DiagnosticsToolHandlerOptions["sessionManager"] & {
  getSessionsForFileSettled(input: {
    workspaceRoot: string;
    filePath: string;
    languageId?: string;
    serverId?: string;
  }): Promise<SettledLspSessionAcquisition[]>;
} {
  return "getSessionsForFileSettled" in sessionManager;
}

function hasSettledWorkspaceAcquisition(
  sessionManager: DiagnosticsToolHandlerOptions["sessionManager"],
): sessionManager is DiagnosticsToolHandlerOptions["sessionManager"] & {
  getSessionsForWorkspaceSettled(input: {
    workspaceRoot: string;
    serverId?: string;
  }): Promise<SettledLspSessionAcquisition[]>;
} {
  return "getSessionsForWorkspaceSettled" in sessionManager;
}
