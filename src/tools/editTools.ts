import { z } from "zod";

import type { LspMcpConfig } from "../config/schema.js";
import { hasCapability } from "../lsp/capabilities.js";
import { assertCommandAllowed } from "../lsp/commandPolicy.js";
import {
  filePathToUri,
  mcpPositionToLspPosition,
  uriToFilePath,
  type DocumentStore,
  type OpenedDocumentState,
} from "../lsp/documentStore.js";
import { applyTextEdits, applyWorkspaceEdit, type WorkspaceEdit } from "../lsp/editApplier.js";
import type { AcquiredLspSession, LspSessionManager } from "../lsp/sessionManager.js";
import { validateWorkspacePath, type WorkspaceSecurityOptions } from "../security/workspace.js";
import type { ToolHandlerContext } from "./registerTools.js";
import { structuredToolError, type StructuredToolError } from "./toolErrors.js";

export const EDITS_NOT_APPLIED_MESSAGE =
  "Edits were returned but not applied. Re-run with apply: true to modify files.";

export interface EditToolHandlerOptions {
  sessionManager: Pick<LspSessionManager, "getSessionsForFile"> &
    Partial<Pick<LspSessionManager, "resolveServerId">>;
  documentStore: DocumentStore;
  security?: WorkspaceSecurityOptions;
  config?: Pick<LspMcpConfig, "commands">;
}

export interface EditToolResult {
  ok: boolean;
  results: Record<string, EditToolServerResult>;
  error?: string;
}

export type EditToolServerResult =
  | ({ ok: true; applied: false; message: string } & Record<string, unknown>)
  | ({ ok: true; applied: false; changedFiles: unknown[] } & Record<string, unknown>)
  | ({ ok: true; applied: true; changedFiles: unknown[] } & Record<string, unknown>)
  | ({ ok: false } & StructuredToolError & Record<string, unknown>);

const baseFileSchema = z.object({
  workspaceRoot: z.string(),
  filePath: z.string(),
  languageId: z.string().optional(),
  serverId: z.string().optional(),
  apply: z.boolean().optional().default(false),
});

const positionSchema = baseFileSchema.extend({
  line: z.number().int().positive(),
  character: z.number().int().positive(),
});

const rangeSchema = baseFileSchema.extend({
  startLine: z.number().int().positive(),
  startCharacter: z.number().int().positive(),
  endLine: z.number().int().positive(),
  endCharacter: z.number().int().positive(),
});

export const editToolInputSchemas = {
  lsp_rename: positionSchema.extend({ newName: z.string() }),
  lsp_format_document: baseFileSchema,
  lsp_format_range: rangeSchema,
  lsp_format_on_type: positionSchema.extend({ ch: z.string().min(1) }),
  lsp_code_actions: rangeSchema.extend({ actionIndex: z.number().int().nonnegative().optional() }),
} as const;

type EditToolName = keyof typeof editToolInputSchemas;

const editPublicToolNames = {
  lsp_rename: "rename",
  lsp_format_document: "format_document",
  lsp_format_range: "format_range",
  lsp_format_on_type: "format_on_type",
  lsp_code_actions: "code_actions",
} as const satisfies Record<EditToolName, string>;

export const editToolDescriptors = {
  lsp_rename: {
    title: "Rename symbol",
    description: "Returns or applies a symbol rename workspace edit.",
    inputSchema: editToolInputSchemas.lsp_rename,
  },
  lsp_format_document: {
    title: "Format document",
    description: "Returns or applies document formatting edits.",
    inputSchema: editToolInputSchemas.lsp_format_document,
  },
  lsp_format_range: {
    title: "Format range",
    description: "Returns or applies formatting edits for a range.",
    inputSchema: editToolInputSchemas.lsp_format_range,
  },
  lsp_format_on_type: {
    title: "Format on type",
    description: "Returns or applies on-type formatting edits.",
    inputSchema: editToolInputSchemas.lsp_format_on_type,
  },
  lsp_code_actions: {
    title: "Code actions",
    description: "Returns or applies code actions for a range.",
    inputSchema: editToolInputSchemas.lsp_code_actions,
  },
} as const;

const toolDefinitions = {
  lsp_rename: { method: "textDocument/rename", capability: "renameProvider" },
  lsp_format_document: {
    method: "textDocument/formatting",
    capability: "documentFormattingProvider",
  },
  lsp_format_range: {
    method: "textDocument/rangeFormatting",
    capability: "documentRangeFormattingProvider",
  },
  lsp_format_on_type: {
    method: "textDocument/onTypeFormatting",
    capability: "documentOnTypeFormattingProvider",
  },
  lsp_code_actions: { method: "textDocument/codeAction", capability: "codeActionProvider" },
} as const;

export function createEditToolHandler(options: EditToolHandlerOptions) {
  return async (
    toolName: EditToolName,
    input: unknown,
    context?: ToolHandlerContext,
  ): Promise<EditToolResult> => {
    const parsed = editToolInputSchemas[toolName].parse(input) as Record<string, unknown> & {
      workspaceRoot: string;
      filePath: string;
      languageId?: string;
      serverId?: string;
      apply: boolean;
    };
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
    let sessions: AcquiredLspSession[];
    try {
      sessions = await options.sessionManager.getSessionsForFile({
        workspaceRoot: parsed.workspaceRoot,
        filePath: parsed.filePath,
        languageId: parsed.languageId,
        serverId: parsed.serverId,
      });
    } catch (error) {
      return {
        ok: false,
        results: { acquisition: { ok: false, ...structuredToolError(error) } },
      };
    }
    if (sessions.length === 0) {
      return {
        ok: false,
        results: {},
        error: `No matching LSP servers for ${editPublicToolNames[toolName]}`,
      };
    }
    if (parsed.apply && sessions.length > 1 && !parsed.serverId) {
      throw new Error("apply: true requires serverId when multiple LSP servers match");
    }

    const perServer = await Promise.all(
      sessions.map(
        async (acquired) =>
          [
            acquired.serverId,
            await runToolForServer(toolName, parsed, acquired, options, context),
          ] as const,
      ),
    );
    const results: EditToolResult["results"] = {};
    for (const [serverId, result] of perServer) {
      results[serverId] = result;
    }
    return { ok: Object.values(results).every((result) => result.ok), results };
  };
}

async function runToolForServer(
  toolName: EditToolName,
  input: Record<string, unknown> & { workspaceRoot: string; filePath: string; apply: boolean },
  acquired: AcquiredLspSession,
  options: EditToolHandlerOptions,
  context?: ToolHandlerContext,
): Promise<EditToolServerResult> {
  try {
    const definition = toolDefinitions[toolName];
    if (!hasCapability(acquired.session.capabilities, definition.capability)) {
      throw new Error(`Server ${acquired.serverId} does not support ${definition.method}`);
    }
    const documentState = await options.documentStore.ensureDocumentOpen({
      session: acquired.session,
      filePath: input.filePath,
      languageId: typeof input.languageId === "string" ? input.languageId : undefined,
      serverLanguageIds: acquired.languageIds,
      serverExtensions: acquired.extensions,
    });

    const rawResult = await acquired.session.sendRequest(
      definition.method,
      buildParams(toolName, input),
      { signal: context?.signal },
    );
    if (toolName === "lsp_code_actions") {
      return await handleCodeActions(input, rawResult, acquired, options, documentState, context);
    }
    if (isWorkspaceEdit(rawResult)) {
      if (!input.apply) {
        return { ok: true, applied: false, message: EDITS_NOT_APPLIED_MESSAGE, edit: rawResult };
      }
      const applied = await applyWorkspaceEdit({
        workspaceRoot: input.workspaceRoot,
        edit: rawResult,
        security: options.security,
        expectedContentHashes: expectedHashesForWorkspaceEdit(rawResult, documentState),
      });
      return { ok: true, ...applied };
    }
    const edits = Array.isArray(rawResult) ? rawResult : [];
    if (!input.apply) {
      return { ok: true, applied: false, message: EDITS_NOT_APPLIED_MESSAGE, edits };
    }
    const applied = await applyTextEdits({
      workspaceRoot: input.workspaceRoot,
      filePath: input.filePath,
      edits,
      security: options.security,
      expectedContentHash: documentState.contentHash,
    });
    return { ok: true, ...applied };
  } catch (error) {
    return { ok: false, ...structuredToolError(error) };
  }
}

async function handleCodeActions(
  input: Record<string, unknown> & { workspaceRoot: string; apply: boolean },
  rawResult: unknown,
  acquired: AcquiredLspSession,
  options: EditToolHandlerOptions,
  documentState?: OpenedDocumentState,
  context?: ToolHandlerContext,
): Promise<EditToolServerResult> {
  const actions = Array.isArray(rawResult) ? rawResult : [];
  if (!input.apply) {
    return { ok: true, applied: false, message: EDITS_NOT_APPLIED_MESSAGE, actions };
  }

  const actionIndex = typeof input.actionIndex === "number" ? input.actionIndex : undefined;
  const selected = actionIndex === undefined ? safeDefaultAction(actions) : actions[actionIndex];
  if (!selected) {
    if (actionIndex === undefined && actionableActions(actions).length > 1) {
      return {
        ok: false,
        error:
          "Multiple actionable code actions are available; provide actionIndex for apply: true",
      };
    }
    throw new Error("No code action selected for apply: true");
  }
  if (!isRecord(selected)) {
    throw new Error("Selected code action is not an object");
  }
  const command = commandFromCodeActionResult(selected);
  if (!isWorkspaceEdit(selected.edit) && !command) {
    throw new Error("Selected code action does not include an edit or command to apply");
  }

  const applied:
    | { applied: true; changedFiles: unknown[] }
    | { applied: false; changedFiles: unknown[] } = isWorkspaceEdit(selected.edit)
    ? await applyWorkspaceEdit({
        workspaceRoot: input.workspaceRoot,
        edit: selected.edit,
        security: options.security,
        expectedContentHashes: documentState
          ? expectedHashesForWorkspaceEdit(selected.edit, documentState)
          : undefined,
      })
    : { applied: false, changedFiles: [] };

  if (!command) {
    return { ok: true, ...applied, action: selected };
  }

  try {
    assertCommandAllowed(options.config ?? {}, acquired.serverId, command.command, {
      resolveServerId: options.sessionManager.resolveServerId?.bind(options.sessionManager),
      requireResolvedAllowlist: true,
    });
    const commandResult = await acquired.session.sendRequest(
      "workspace/executeCommand",
      {
        command: command.command,
        ...(Array.isArray(command.arguments) ? { arguments: command.arguments } : {}),
      },
      { signal: context?.signal },
    );
    return { ok: true, ...applied, action: selected, command: { ok: true, result: commandResult } };
  } catch (error) {
    return { ok: false, ...applied, action: selected, ...structuredToolError(error) };
  }
}

function isCommand(value: unknown): value is { command: string; arguments?: unknown[] } {
  return isRecord(value) && typeof value.command === "string";
}

function commandFromCodeActionResult(
  value: Record<string, unknown>,
): { command: string; arguments?: unknown[] } | undefined {
  if (isCommand(value.command)) {
    return value.command;
  }
  if (isCommand(value)) {
    return value;
  }
  return undefined;
}

function expectedHashesForWorkspaceEdit(
  edit: WorkspaceEdit,
  documentState: OpenedDocumentState,
): Record<string, string> {
  const hashes: Record<string, string> = {};
  for (const uri of Object.keys(edit.changes ?? {})) {
    if (uri === documentState.uri) {
      hashes[documentState.filePath] = documentState.contentHash;
    }
  }
  for (const change of edit.documentChanges ?? []) {
    if (
      isRecord(change) &&
      isRecord(change.textDocument) &&
      change.textDocument.uri === documentState.uri
    ) {
      hashes[uriToFilePath(change.textDocument.uri)] = documentState.contentHash;
    }
  }
  return hashes;
}

function safeDefaultAction(actions: unknown[]): unknown | undefined {
  const actionable = actionableActions(actions);
  return actionable.length === 1 ? actionable[0] : undefined;
}

function actionableActions(actions: unknown[]): unknown[] {
  return actions.filter(
    (action) =>
      isRecord(action) &&
      (isWorkspaceEdit(action.edit) || Boolean(commandFromCodeActionResult(action))),
  );
}

function buildParams(toolName: EditToolName, input: Record<string, unknown>) {
  const textDocument = { uri: filePathToUri(String(input.filePath)) };
  switch (toolName) {
    case "lsp_rename":
      return {
        textDocument,
        position: position(input.line, input.character),
        newName: String(input.newName),
      };
    case "lsp_format_document":
      return { textDocument, options: formattingOptions(input) };
    case "lsp_format_range":
      return { textDocument, range: range(input), options: formattingOptions(input) };
    case "lsp_format_on_type":
      return {
        textDocument,
        position: position(input.line, input.character),
        ch: String(input.ch),
        options: formattingOptions(input),
      };
    case "lsp_code_actions":
      return { textDocument, range: range(input), context: { diagnostics: [] } };
  }
}

function formattingOptions(input: Record<string, unknown>) {
  return {
    tabSize: typeof input.tabSize === "number" ? input.tabSize : 2,
    insertSpaces: typeof input.insertSpaces === "boolean" ? input.insertSpaces : true,
  };
}

function range(input: Record<string, unknown>) {
  return {
    start: position(input.startLine, input.startCharacter),
    end: position(input.endLine, input.endCharacter),
  };
}

function position(line: unknown, character: unknown) {
  return mcpPositionToLspPosition({ line: Number(line), character: Number(character) });
}

function isWorkspaceEdit(value: unknown): value is WorkspaceEdit {
  return isRecord(value) && (isRecord(value.changes) || Array.isArray(value.documentChanges));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
