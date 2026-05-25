import { filePathToUri, mcpPositionToLspPosition, type McpPosition } from "../lsp/documentStore.js";
import { hasCapability } from "../lsp/capabilities.js";
import { getMethodRegistryEntry } from "../lsp/methodRegistry.js";
import type { MethodRegistryEntry } from "../lsp/methodRegistry.js";
import { normalizeLspResult } from "../lsp/resultNormalization.js";
import type { DocumentStore } from "../lsp/documentStore.js";
import type { AcquiredLspSession, LspSessionManager } from "../lsp/sessionManager.js";
import { validateWorkspacePath, type WorkspaceSecurityOptions } from "../security/workspace.js";
import type { ToolHandlerContext } from "./registerTools.js";
import { inputSchemas } from "./toolSchemas.js";
import { structuredToolError, type StructuredToolError } from "./toolErrors.js";

export interface StandardToolHandlerOptions {
  sessionManager: Pick<LspSessionManager, "getSessionsForFile" | "getSessionsForWorkspace">;
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
    let sessions: AcquiredLspSession[];
    try {
      sessions = await acquireSessions(options.sessionManager, entry, parsed);
    } catch (error) {
      return {
        ok: false,
        results: { acquisition: { ok: false, ...structuredToolError(error) } },
      };
    }
    if (sessions.length === 0) {
      return { ok: false, results: {}, error: `No matching LSP servers for ${entry.toolName}` };
    }

    const perServerResults = await Promise.all(
      sessions.map(async (acquired) => {
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
          return {
            serverId: acquired.serverId,
            result: {
              ok: true,
              result: normalizeLspResult(rawResult, { workspaceRoot: acquired.workspaceRoot }),
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
    for (const perServerResult of perServerResults) {
      results[perServerResult.serverId] = perServerResult.result;
    }

    return {
      ok: Object.values(results).every((result) => result.ok),
      results,
    };
  };
}

interface PerServerResult {
  serverId: string;
  result: StandardToolServerSuccess | StandardToolServerFailure;
}

async function acquireSessions(
  sessionManager: Pick<LspSessionManager, "getSessionsForFile" | "getSessionsForWorkspace">,
  entry: MethodRegistryEntry,
  input: Record<string, unknown>,
): Promise<AcquiredLspSession[]> {
  const workspaceRoot = String(input.workspaceRoot);
  const filePath = optionalString(input.filePath);
  if (!filePath && !entry.needsDocument) {
    return sessionManager.getSessionsForWorkspace({
      workspaceRoot,
      serverId: optionalString(input.serverId),
    });
  }
  return sessionManager.getSessionsForFile({
    workspaceRoot,
    filePath: filePath ?? workspaceRoot,
    languageId: optionalString(input.languageId),
    serverId: optionalString(input.serverId),
  });
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
  return toolName.startsWith("callHierarchy") || toolName.startsWith("typeHierarchy");
}

function position(line: unknown, character: unknown): McpPosition {
  return { line: Number(line), character: Number(character) };
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
