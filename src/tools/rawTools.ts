import { z } from "zod";

import type { LspMcpConfig } from "../config/schema.js";
import { assertCommandAllowed } from "../lsp/commandPolicy.js";
import type {
  AcquiredLspSession,
  LspSessionManager,
  SettledLspSessionAcquisition,
} from "../lsp/sessionManager.js";
import type { ToolHandlerContext } from "./registerTools.js";
import { structuredToolError, type StructuredToolError } from "./toolErrors.js";

type RawSessionManager = Pick<LspSessionManager, "getSessionsForFile" | "getSessionsForWorkspace"> &
  Partial<Pick<LspSessionManager, "getSessionsForFileSettled" | "getSessionsForWorkspaceSettled">>;

export interface RawToolHandlerOptions {
  sessionManager: RawSessionManager;
  config?: Pick<LspMcpConfig, "commands">;
}

export interface RawToolResult {
  ok: boolean;
  results: Record<string, RawToolServerResult>;
  error?: string;
}

export type RawToolServerResult =
  | { ok: true; result: unknown }
  | ({ ok: false } & StructuredToolError);

const rawLspSchema = z.object({
  workspaceRoot: z.string(),
  filePath: z.string().optional(),
  languageId: z.string().optional(),
  serverId: z.string().optional(),
  method: z.string(),
  params: z.unknown().optional(),
});

export const rawToolInputSchemas = {
  lsp_execute_command: z.object({
    workspaceRoot: z.string(),
    filePath: z.string().optional(),
    languageId: z.string().optional(),
    serverId: z.string().optional(),
    command: z.string(),
    arguments: z.array(z.unknown()).optional(),
  }),
  lsp_request: rawLspSchema,
  lsp_notify: rawLspSchema,
} as const;

type RawToolName = keyof typeof rawToolInputSchemas;

export const rawToolDescriptors = {
  lsp_execute_command: {
    title: "Execute LSP command",
    description:
      "Runs workspace/executeCommand on matching LSP servers with command allow-list enforcement.",
    inputSchema: rawToolInputSchemas.lsp_execute_command,
  },
  lsp_request: {
    title: "Send raw LSP request",
    description: "Sends a native LSP request to resolved workspace or file-matching servers.",
    inputSchema: rawToolInputSchemas.lsp_request,
  },
  lsp_notify: {
    title: "Send raw LSP notification",
    description: "Sends a native LSP notification to resolved workspace or file-matching servers.",
    inputSchema: rawToolInputSchemas.lsp_notify,
  },
} as const;

export function createRawToolHandler(options: RawToolHandlerOptions) {
  return async (
    toolName: RawToolName,
    input: unknown,
    context?: ToolHandlerContext,
  ): Promise<RawToolResult> => {
    const parsed = rawToolInputSchemas[toolName].parse(input);
    const acquisition = await acquireRawToolSessions(options.sessionManager, toolName, parsed);
    if (acquisition.sessions.length === 0 && Object.keys(acquisition.results).length === 0) {
      return { ok: false, results: {}, error: `No matching LSP servers for ${toolName}` };
    }

    const perServer = await Promise.all(
      acquisition.sessions.map(async (acquired) => {
        try {
          const result = await runRawTool(options, toolName, parsed, acquired, context);
          return { serverId: acquired.serverId, result: { ok: true, result } } as const;
        } catch (error) {
          return {
            serverId: acquired.serverId,
            result: { ok: false, ...structuredToolError(error) },
          } as const;
        }
      }),
    );
    const results: RawToolResult["results"] = { ...acquisition.results };
    for (const item of perServer) {
      results[item.serverId] = item.result;
    }
    return { ok: Object.values(results).every((result) => result.ok), results };
  };
}

interface RawToolAcquisition {
  sessions: AcquiredLspSession[];
  results: RawToolResult["results"];
}

async function acquireRawToolSessions(
  sessionManager: RawToolHandlerOptions["sessionManager"],
  toolName: RawToolName,
  input: z.infer<(typeof rawToolInputSchemas)[RawToolName]>,
): Promise<RawToolAcquisition> {
  if (toolName === "lsp_execute_command") {
    try {
      return { sessions: await acquireSessions(sessionManager, input), results: {} };
    } catch (error) {
      return {
        sessions: [],
        results: { acquisition: { ok: false, ...structuredToolError(error) } },
      };
    }
  }

  const settled = await acquireSettledSessions(sessionManager, input);
  const sessions: AcquiredLspSession[] = [];
  const results: RawToolResult["results"] = {};
  for (const acquisition of settled) {
    if (acquisition.ok) {
      sessions.push(acquisition.value);
    } else {
      results[acquisition.value.serverId] = { ok: false, error: acquisition.value.error };
    }
  }
  return { sessions, results };
}

async function runRawTool(
  options: RawToolHandlerOptions,
  toolName: RawToolName,
  input: z.infer<(typeof rawToolInputSchemas)[RawToolName]>,
  acquired: AcquiredLspSession,
  context?: ToolHandlerContext,
): Promise<unknown> {
  switch (toolName) {
    case "lsp_execute_command": {
      const commandInput = input as z.infer<(typeof rawToolInputSchemas)["lsp_execute_command"]>;
      assertCommandAllowed(options.config ?? {}, acquired.serverId, commandInput.command);
      return acquired.session.sendRequest(
        "workspace/executeCommand",
        {
          command: commandInput.command,
          ...(commandInput.arguments ? { arguments: commandInput.arguments } : {}),
        },
        { signal: context?.signal },
      );
    }
    case "lsp_request": {
      const requestInput = input as z.infer<typeof rawLspSchema>;
      return acquired.session.sendRequest(requestInput.method, requestInput.params, {
        signal: context?.signal,
      });
    }
    case "lsp_notify": {
      const notifyInput = input as z.infer<typeof rawLspSchema>;
      await acquired.session.sendNotification(notifyInput.method, notifyInput.params);
      return null;
    }
  }
}

async function acquireSessions(
  sessionManager: Pick<LspSessionManager, "getSessionsForFile" | "getSessionsForWorkspace">,
  input: z.infer<(typeof rawToolInputSchemas)[RawToolName]>,
): Promise<AcquiredLspSession[]> {
  if (input.filePath) {
    return sessionManager.getSessionsForFile({
      workspaceRoot: input.workspaceRoot,
      filePath: input.filePath,
      languageId: input.languageId,
      serverId: input.serverId,
    });
  }
  return sessionManager.getSessionsForWorkspace({
    workspaceRoot: input.workspaceRoot,
    serverId: input.serverId,
  });
}

async function acquireSettledSessions(
  sessionManager: RawToolHandlerOptions["sessionManager"],
  input: z.infer<(typeof rawToolInputSchemas)[RawToolName]>,
): Promise<SettledLspSessionAcquisition[]> {
  if (input.filePath) {
    return requiredSettledMethod(sessionManager.getSessionsForFileSettled).call(sessionManager, {
      workspaceRoot: input.workspaceRoot,
      filePath: input.filePath,
      languageId: input.languageId,
      serverId: input.serverId,
    });
  }
  return requiredSettledMethod(sessionManager.getSessionsForWorkspaceSettled).call(sessionManager, {
    workspaceRoot: input.workspaceRoot,
    serverId: input.serverId,
  });
}

function requiredSettledMethod<T extends (...args: never[]) => unknown>(method: T | undefined): T {
  if (!method) {
    throw new Error("Raw LSP request and notify tools require settled session acquisition");
  }
  return method;
}
