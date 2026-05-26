import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { z } from "zod";

import {
  createToolRegistry,
  type RegisteredTool,
  type ToolRegistry,
} from "../tools/registerTools.js";
export { listLspServers, lspServersSchema, type LspServers } from "../tools/registerTools.js";

export function createMcpServer(
  registry: ToolRegistry = createToolRegistry({ config: {} }),
): McpServer {
  const server = new McpServer({
    name: "lsp-mcp",
    version: "0.1.0",
  });

  for (const tool of registry.tools) {
    registerTool(server, tool);
  }

  const closeServer = server.close.bind(server);
  server.close = async () => {
    try {
      await closeServer();
    } finally {
      await registry.shutdown();
    }
  };

  return server;
}

function registerTool(server: McpServer, tool: RegisteredTool): void {
  const outputSchema = schemaHasObjectRoot(tool.outputSchema) ? tool.outputSchema : undefined;
  server.registerTool(
    tool.name,
    {
      title: tool.title,
      description: tool.description,
      ...(tool.inputSchema ? { inputSchema: tool.inputSchema } : {}),
      ...(outputSchema ? { outputSchema } : {}),
    },
    async (input, extra) => {
      const result = await tool.handler(input, { signal: extra.signal });
      const structuredContent = isRecord(result) ? result : { result };
      return {
        content: [{ type: "text", text: JSON.stringify(structuredContent) }],
        structuredContent,
      };
    },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function schemaHasObjectRoot(schema: z.ZodType | undefined): boolean {
  if (!schema) {
    return false;
  }
  const maybeSchema = schema as z.ZodType & {
    _zod?: { def?: { type?: string; shape?: unknown } };
    _def?: { typeName?: string; type?: string; shape?: unknown };
    shape?: unknown;
  };
  return (
    maybeSchema._zod?.def?.type === "object" ||
    maybeSchema._zod?.def?.shape !== undefined ||
    maybeSchema._def?.typeName === "ZodObject" ||
    maybeSchema._def?.type === "object" ||
    maybeSchema.shape !== undefined
  );
}
