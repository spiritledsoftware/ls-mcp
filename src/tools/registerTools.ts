import { resolve } from "node:path";

import { z } from "zod";

import type { LspMcpConfig } from "../config/schema.js";
import { loadConfig } from "../config/loadConfig.js";
import { DiagnosticStore } from "../lsp/diagnosticStore.js";
import { DocumentStore } from "../lsp/documentStore.js";
import { standardMethodRegistry } from "../lsp/methodRegistry.js";
import { LspSessionManager } from "../lsp/sessionManager.js";
import { createDiagnosticsToolHandler, lspDiagnosticsInputSchema } from "./diagnosticTools.js";
import { createEditToolHandler, editToolDescriptors } from "./editTools.js";
import { createRawToolHandler, rawToolDescriptors } from "./rawTools.js";
import {
  createServerToolHandlers,
  lspServerStatusInputSchema,
  lspServersInputSchema,
  lspServersSchema,
  lspStopServerInputSchema,
  lspStopWorkspaceInputSchema,
  type LspServers,
} from "./serverTools.js";
import { createStandardToolHandler } from "./standardTools.js";
import { inputSchemas } from "./toolSchemas.js";

export { lspServersSchema, type LspServers } from "./serverTools.js";

export async function listLspServers(): Promise<LspServers> {
  const registry = createToolRegistry();
  return (await registry.tools
    .find((tool) => tool.name === "lsp_servers")!
    .handler({})) as LspServers;
}

export interface RegisteredTool {
  name: string;
  title: string;
  description: string;
  inputSchema?: z.ZodType;
  outputSchema?: z.ZodType;
  handler(input: unknown, context?: ToolHandlerContext): Promise<unknown> | unknown;
}

export interface ToolHandlerContext {
  signal?: AbortSignal;
}

export interface ToolRegistry {
  tools: RegisteredTool[];
  shutdown(): Promise<void>;
}

export interface ToolRegistryOptions {
  config?: LspMcpConfig;
  sessionManager?: LspSessionManager;
  documentStore?: DocumentStore;
  diagnosticStore?: DiagnosticStore;
}

export async function createConfiguredToolRegistry(): Promise<ToolRegistry> {
  const { config } = await loadConfig();
  const baseRegistry = createToolRegistry({ config });
  const workspaceRegistries = new Map<string, Promise<ToolRegistry>>();

  async function registryForWorkspace(workspaceRoot: string): Promise<ToolRegistry> {
    const normalizedRoot = resolve(workspaceRoot);
    let registry = workspaceRegistries.get(normalizedRoot);
    if (!registry) {
      registry = loadConfig({ workspaceRoot: normalizedRoot }).then(({ config: workspaceConfig }) =>
        createToolRegistry({ config: workspaceConfig }),
      );
      registry.catch(() => workspaceRegistries.delete(normalizedRoot));
      workspaceRegistries.set(normalizedRoot, registry);
    }
    return registry;
  }

  return {
    async shutdown() {
      const registries = await Promise.allSettled(workspaceRegistries.values());
      await Promise.all([
        baseRegistry.shutdown(),
        ...registries
          .filter(
            (result): result is PromiseFulfilledResult<ToolRegistry> =>
              result.status === "fulfilled",
          )
          .map((result) => result.value.shutdown()),
      ]);
    },
    tools: baseRegistry.tools.map((baseTool) => ({
      ...baseTool,
      async handler(input: unknown, context?: ToolHandlerContext): Promise<unknown> {
        const workspaceRoot = workspaceRootFromInput(input);
        if (!workspaceRoot) {
          return baseTool.handler(input, context);
        }
        const registry = await registryForWorkspace(workspaceRoot);
        const workspaceTool = registry.tools.find((tool) => tool.name === baseTool.name);
        if (!workspaceTool) {
          throw new Error(`Workspace registry is missing tool ${baseTool.name}`);
        }
        return workspaceTool.handler(input, context);
      },
    })),
  };
}

function workspaceRootFromInput(input: unknown): string | undefined {
  if (typeof input !== "object" || input === null || !("workspaceRoot" in input)) {
    return undefined;
  }
  const workspaceRoot = input.workspaceRoot;
  return typeof workspaceRoot === "string" ? workspaceRoot : undefined;
}

export function createToolRegistry(options: ToolRegistryOptions = {}): ToolRegistry {
  const config = options.config ?? {};
  const documentStore =
    options.documentStore ??
    new DocumentStore({
      maxOpenDocumentsPerSession: config.sessions?.maxOpenDocumentsPerSession,
    });
  const sessionManager =
    options.sessionManager ??
    new LspSessionManager({
      config,
      onSessionShutdown: (session) => documentStore.clearSession(session),
    });
  const diagnosticStore = options.diagnosticStore ?? new DiagnosticStore();
  const standardHandler = createStandardToolHandler({
    sessionManager,
    documentStore,
    security: config.security,
  });
  const rawHandler = createRawToolHandler({ sessionManager, config });
  const diagnosticsHandler = createDiagnosticsToolHandler({
    sessionManager,
    documentStore,
    diagnosticStore,
    config,
    security: config.security,
  });
  const editHandler = createEditToolHandler({
    sessionManager,
    documentStore,
    security: config.security,
    config,
  });
  const serverHandlers = createServerToolHandlers({ sessionManager });

  return {
    shutdown: () => sessionManager.shutdownAll(),
    tools: [
      {
        name: "lsp_servers",
        title: "List LSP servers",
        description: "Lists configured and built-in LSP servers without starting them.",
        inputSchema: lspServersInputSchema,
        outputSchema: lspServersSchema,
        handler: serverHandlers.listServers,
      },
      {
        name: "lsp_server_status",
        title: "Get LSP server status",
        description: "Reports install, runtime, health, capability, and idle status.",
        inputSchema: lspServerStatusInputSchema,
        handler: serverHandlers.serverStatus,
      },
      {
        name: "lsp_stop_server",
        title: "Stop an LSP server",
        description: "Stops one running LSP session for a workspace and server ID.",
        inputSchema: lspStopServerInputSchema,
        handler: serverHandlers.stopServer,
      },
      {
        name: "lsp_stop_workspace",
        title: "Stop workspace LSP servers",
        description: "Stops all running LSP sessions for a workspace.",
        inputSchema: lspStopWorkspaceInputSchema,
        handler: serverHandlers.stopWorkspace,
      },
      ...Object.entries(rawToolDescriptors).map(([name, descriptor]) => ({
        name,
        title: descriptor.title,
        description: descriptor.description,
        inputSchema: descriptor.inputSchema,
        handler: (input: unknown, context?: ToolHandlerContext) =>
          rawHandler(name as keyof typeof rawToolDescriptors, input, context),
      })),
      {
        name: "lsp_diagnostics",
        title: "Get diagnostics",
        description: "Returns diagnostics from matching LSP servers.",
        inputSchema: lspDiagnosticsInputSchema,
        handler: diagnosticsHandler,
      },
      ...Object.entries(editToolDescriptors).map(([name, descriptor]) => ({
        name,
        title: descriptor.title,
        description: descriptor.description,
        inputSchema: descriptor.inputSchema,
        handler: (input: unknown, context?: ToolHandlerContext) =>
          editHandler(name as keyof typeof editToolDescriptors, input, context),
      })),
      ...standardMethodRegistry.map((entry) => ({
        name: entry.toolName,
        title: entry.toolName,
        description: entry.description,
        inputSchema: inputSchemas[entry.inputKind],
        handler: (input: unknown, context?: ToolHandlerContext) =>
          standardHandler(entry.toolName, input, context),
      })),
    ],
  };
}
