import { filePathToUri, mcpPositionToLspPosition, type McpPosition } from "../lsp/documentStore.js";
import { hasCapability } from "../lsp/capabilities.js";
import { getMethodRegistryEntry } from "../lsp/methodRegistry.js";
import type { MethodRegistryEntry } from "../lsp/methodRegistry.js";
import { normalizeLspResult } from "../lsp/resultNormalization.js";
import type { DocumentStore } from "../lsp/documentStore.js";
import type {
  AcquiredLspSession,
  LspSessionManager,
  SettledLspSessionAcquisition,
} from "../lsp/sessionManager.js";
import { validateWorkspacePath, type WorkspaceSecurityOptions } from "../security/workspace.js";
import type { ToolHandlerContext } from "./registerTools.js";
import { inputSchemas } from "./toolSchemas.js";
import { structuredToolError, type StructuredToolError } from "./toolErrors.js";

export interface StandardToolHandlerOptions {
  sessionManager: Pick<LspSessionManager, "getSessionsForFile" | "getSessionsForWorkspace"> &
    Partial<
      Pick<LspSessionManager, "getSessionsForFileSettled" | "getSessionsForWorkspaceSettled">
    >;
  documentStore: DocumentStore;
  security?: WorkspaceSecurityOptions;
}

export interface StandardToolServerSuccess {
  ok: true;
  result: unknown;
}

export interface StandardToolServerFailure extends StructuredToolError {
  ok: false;
}

export interface StandardToolResult {
  ok: boolean;
  results: Record<string, StandardToolServerSuccess | StandardToolServerFailure>;
  error?: string;
}

export function createStandardToolHandler(options: StandardToolHandlerOptions) {
  return async (
    toolName: string,
    input: unknown,
    context?: ToolHandlerContext,
  ): Promise<StandardToolResult> => {
    const entry = getMethodRegistryEntry(toolName);
    const parsed = inputSchemas[entry.inputKind].parse(input) as Record<string, unknown>;
    if (entry.needsDocument) {
      try {
        const validated = await validateWorkspacePath({
          workspaceRoot: String(parsed.workspaceRoot),
          filePath: String(parsed.filePath),
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
    if (!entry.supportsMultiServer && !optionalString(parsed.serverId)) {
      throw new Error(`Tool ${entry.toolName} requires serverId`);
    }
    let acquisition: SessionAcquisitionResult;
    try {
      acquisition = await acquireSessions(options.sessionManager, entry, parsed);
    } catch (error) {
      return {
        ok: false,
        results: { acquisition: { ok: false, ...structuredToolError(error) } },
      };
    }
    if (acquisition.sessions.length === 0 && acquisition.failures.length === 0) {
      return { ok: false, results: {}, error: `No matching LSP servers for ${entry.toolName}` };
    }

    const perServerResults = await Promise.all(
      acquisition.sessions.map(async (acquired) => {
        try {
          if (
            entry.capabilityPath &&
            !hasCapability(acquired.session.capabilities, entry.capabilityPath)
          ) {
            throw new Error(
              `Server ${acquired.serverId} does not support ${String(entry.capabilityPath)}`,
            );
          }
          if (entry.needsDocument) {
            await options.documentStore.ensureDocumentOpen({
              session: acquired.session,
              filePath: String(parsed.filePath),
              languageId: optionalString(parsed.languageId),
              serverLanguageIds: acquired.languageIds,
              serverExtensions: acquired.extensions,
            });
          }
          const requestParams = buildRequestParams(entry, parsed);
          const rawResult = await acquired.session.sendRequest(entry.lspMethod, requestParams, {
            signal: context?.signal,
          });
          const normalizedResult = normalizeLspResult(rawResult, {
            workspaceRoot: acquired.workspaceRoot,
          });
          return {
            serverId: acquired.serverId,
            result: {
              ok: true,
              result: postProcessResult(entry, parsed, normalizedResult),
            },
          } satisfies PerServerResult;
        } catch (error) {
          return {
            serverId: acquired.serverId,
            result: { ok: false, ...structuredToolError(error) },
          } satisfies PerServerResult;
        }
      }),
    );
    const results: StandardToolResult["results"] = {};
    for (const failure of acquisition.failures) {
      results[failure.serverId] = { ok: false, error: failure.error };
    }
    for (const perServerResult of perServerResults) {
      results[perServerResult.serverId] = perServerResult.result;
    }

    const values = Object.values(results);
    return {
      ok: values.some((result) => result.ok),
      results,
    };
  };
}

interface PerServerResult {
  serverId: string;
  result: StandardToolServerSuccess | StandardToolServerFailure;
}

interface SessionAcquisitionResult {
  sessions: AcquiredLspSession[];
  failures: Array<{ serverId: string; error: string }>;
}

async function acquireSessions(
  sessionManager: StandardToolHandlerOptions["sessionManager"],
  entry: MethodRegistryEntry,
  input: Record<string, unknown>,
): Promise<SessionAcquisitionResult> {
  const workspaceRoot = String(input.workspaceRoot);
  const filePath = optionalString(input.filePath);
  const languageId = optionalString(input.languageId);
  const serverId = optionalString(input.serverId);
  const strict = input.strict === true || !entry.supportsMultiServer || Boolean(serverId);
  if (!filePath && !entry.needsDocument) {
    if (languageId) {
      return acquireForFile(sessionManager, entry, input, workspaceRoot, workspaceRoot, strict);
    }
    if (strict) {
      return {
        sessions: await sessionManager.getSessionsForWorkspace({ workspaceRoot, serverId }),
        failures: [],
      };
    }
    if (sessionManager.getSessionsForWorkspaceSettled) {
      return settledResult(
        await sessionManager.getSessionsForWorkspaceSettled({ workspaceRoot, serverId }),
      );
    }
    return {
      sessions: await sessionManager.getSessionsForWorkspace({ workspaceRoot, serverId }),
      failures: [],
    };
  }
  return acquireForFile(
    sessionManager,
    entry,
    input,
    workspaceRoot,
    filePath ?? workspaceRoot,
    strict,
  );
}

async function acquireForFile(
  sessionManager: StandardToolHandlerOptions["sessionManager"],
  _entry: MethodRegistryEntry,
  input: Record<string, unknown>,
  workspaceRoot: string,
  filePath: string,
  strict: boolean,
): Promise<SessionAcquisitionResult> {
  const options = {
    workspaceRoot,
    filePath,
    languageId: optionalString(input.languageId),
    serverId: optionalString(input.serverId),
  };
  if (strict) {
    return { sessions: await sessionManager.getSessionsForFile(options), failures: [] };
  }
  if (sessionManager.getSessionsForFileSettled) {
    return settledResult(await sessionManager.getSessionsForFileSettled(options));
  }
  return { sessions: await sessionManager.getSessionsForFile(options), failures: [] };
}

function settledResult(settled: SettledLspSessionAcquisition[]): SessionAcquisitionResult {
  return {
    sessions: settled.filter((result) => result.ok).map((result) => result.value),
    failures: settled.filter((result) => !result.ok).map((result) => result.value),
  };
}

function buildRequestParams(entry: MethodRegistryEntry, input: Record<string, unknown>): unknown {
  switch (entry.inputKind) {
    case "filePosition":
      return {
        textDocument: { uri: filePathToUri(String(input.filePath)) },
        position: mcpPositionToLspPosition({
          line: Number(input.line),
          character: Number(input.character),
        }),
        ...(entry.toolName === "references" ? { context: { includeDeclaration: true } } : {}),
      };
    case "file":
      return { textDocument: { uri: filePathToUri(String(input.filePath)) } };
    case "fileRange":
      return {
        textDocument: { uri: filePathToUri(String(input.filePath)) },
        range: range(input),
      };
    case "colorPresentation":
      return {
        textDocument: { uri: filePathToUri(String(input.filePath)) },
        color: input.color,
        range: range(input),
      };
    case "selectionRange":
      return {
        textDocument: { uri: filePathToUri(String(input.filePath)) },
        positions: (input.positions as McpPosition[]).map(mcpPositionToLspPosition),
      };
    case "inlineValue":
      return {
        textDocument: { uri: filePathToUri(String(input.filePath)) },
        range: range(input),
        context: inlineValueContext(input.context),
      };
    case "semanticTokensFullDelta":
      return {
        textDocument: { uri: filePathToUri(String(input.filePath)) },
        previousResultId: String(input.previousResultId),
      };
    case "workspaceSymbol":
      return { query: String(input.query) };
    case "item":
      if (isWrappedItemMethod(entry.toolName)) {
        return { item: input.item };
      }
      return input.item;
  }
}

function postProcessResult(
  entry: MethodRegistryEntry,
  input: Record<string, unknown>,
  result: unknown,
): unknown {
  if (entry.toolName !== "completion" || input.includeAll === true) {
    return result;
  }
  return limitCompletionResult(result, optionalString(input.query), completionLimit(input.limit));
}

function completionLimit(value: unknown): number {
  return typeof value === "number" ? value : 100;
}

function limitCompletionResult(result: unknown, query: string | undefined, limit: number): unknown {
  if (Array.isArray(result)) {
    const filteredItems = filterCompletionItems(result, query);
    return {
      isIncomplete: false,
      items: filteredItems.slice(0, limit),
      lspMcpMeta: completionMeta(result.length, filteredItems.length, limit),
    };
  }
  if (!isRecord(result) || !Array.isArray(result.items)) {
    return result;
  }
  const filteredItems = filterCompletionItems(result.items, query);
  return {
    ...result,
    items: filteredItems.slice(0, limit),
    lspMcpMeta: completionMeta(result.items.length, filteredItems.length, limit),
  };
}

function completionMeta(totalItems: number, matchedItems: number, limit: number) {
  return {
    totalItems,
    matchedItems,
    returnedItems: Math.min(matchedItems, limit),
    truncated: matchedItems > limit,
  };
}

function filterCompletionItems(items: unknown[], query: string | undefined): unknown[] {
  if (!query) {
    return items;
  }
  const normalizedQuery = query.toLowerCase();
  return items.filter((item) => completionSearchText(item).includes(normalizedQuery));
}

function completionSearchText(item: unknown): string {
  if (!isRecord(item)) {
    return "";
  }
  return [item.label, item.detail, item.documentation, labelDetailsText(item.labelDetails)]
    .filter((value): value is string => typeof value === "string")
    .join("\n")
    .toLowerCase();
}

function labelDetailsText(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  return [value.detail, value.description]
    .filter((item): item is string => typeof item === "string")
    .join(" ");
}

function range(input: Record<string, unknown>) {
  return {
    start: mcpPositionToLspPosition(position(input.startLine, input.startCharacter)),
    end: mcpPositionToLspPosition(position(input.endLine, input.endCharacter)),
  };
}

function inlineValueContext(value: unknown) {
  const context = value as {
    frameId: number;
    stoppedLocation: {
      startLine: number;
      startCharacter: number;
      endLine: number;
      endCharacter: number;
    };
  };
  return {
    frameId: context.frameId,
    stoppedLocation: {
      start: mcpPositionToLspPosition(
        position(context.stoppedLocation.startLine, context.stoppedLocation.startCharacter),
      ),
      end: mcpPositionToLspPosition(
        position(context.stoppedLocation.endLine, context.stoppedLocation.endCharacter),
      ),
    },
  };
}

function isWrappedItemMethod(toolName: string): boolean {
  return toolName.startsWith("call_hierarchy") || toolName.startsWith("type_hierarchy");
}

function position(line: unknown, character: unknown): McpPosition {
  return { line: Number(line), character: Number(character) };
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
