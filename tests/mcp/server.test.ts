import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { z } from "zod";
import { describe, expect, it, vi } from "vitest";

import { createMcpServer, listLspServers } from "../../src/mcp/server.js";
import type { ToolHandlerContext, ToolRegistry } from "../../src/tools/registerTools.js";

describe("lsp_list_servers", () => {
  it("lists known LSP servers", async () => {
    await expect(listLspServers()).resolves.toMatchObject({
      ok: true,
      servers: expect.arrayContaining([expect.objectContaining({ id: "typescript" })]),
    });
  });
});

describe("createMcpServer", () => {
  it("registers provided tools through the MCP SDK path", async () => {
    const handle = createMcpServer(
      testRegistry([
        {
          name: "example",
          outputSchema: z.object({ ok: z.boolean() }),
          handler: () => ({ ok: true }),
        },
      ]),
    );
    const client = await connectClient(handle);

    const result = await client.listTools();

    const exampleTool = result.tools.find((tool) => tool.name === "example");
    expect(exampleTool).toBeDefined();
    expect(exampleTool?.outputSchema).toMatchObject({
      type: "object",
      properties: { ok: { type: "boolean" } },
    });
    await client.close();
    await handle.close();
  });

  it("wraps object handler results as structured content and JSON text content", async () => {
    const payload = { ok: true, value: 42 };
    const handle = createMcpServer(
      testRegistry([{ name: "object_result", handler: () => payload }]),
    );
    const client = await connectClient(handle);

    const result = await client.callTool({ name: "object_result", arguments: {} });

    expect(result.structuredContent).toEqual(payload);
    expect(result.content).toEqual([{ type: "text", text: JSON.stringify(payload) }]);
    await client.close();
    await handle.close();
  });

  it("wraps primitive handler results under result", async () => {
    const handle = createMcpServer(
      testRegistry([{ name: "primitive_result", handler: () => "done" }]),
    );
    const client = await connectClient(handle);

    const result = await client.callTool({ name: "primitive_result", arguments: {} });

    expect(result.structuredContent).toEqual({ result: "done" });
    expect(result.content).toEqual([{ type: "text", text: JSON.stringify({ result: "done" }) }]);
    await client.close();
    await handle.close();
  });

  it("passes MCP request context signal to registered tool handlers", async () => {
    const handler = vi.fn((_: unknown, context?: ToolHandlerContext) => ({
      hasSignal: context?.signal instanceof AbortSignal,
    }));
    const handle = createMcpServer(testRegistry([{ name: "signal", handler }]));
    const client = await connectClient(handle);

    const result = await client.callTool({ name: "signal", arguments: {} });

    expect(handler).toHaveBeenCalledWith({}, { signal: expect.any(AbortSignal) });
    expect(result.structuredContent).toEqual({ hasSignal: true });
    await client.close();
    await handle.close();
  });

  it("returns MCP error content when handlers throw", async () => {
    const handle = createMcpServer(
      testRegistry([
        {
          name: "throws",
          handler: () => {
            throw new Error("boom");
          },
        },
      ]),
    );
    const client = await connectClient(handle);

    const result = await client.callTool({ name: "throws", arguments: {} });

    expect(result).toMatchObject({
      content: [{ type: "text", text: "boom" }],
      isError: true,
    });
    await client.close();
    await handle.close();
  });

  it("calls registry shutdown during server close", async () => {
    const shutdown = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const handle = createMcpServer(testRegistry([], shutdown));

    await handle.close();

    expect(shutdown).toHaveBeenCalledTimes(1);
  });
});

interface TestTool {
  name: string;
  outputSchema?: z.ZodType;
  handler(input: unknown, context?: ToolHandlerContext): unknown;
}

function testRegistry(
  tools: TestTool[],
  shutdown: () => Promise<void> = async () => undefined,
): ToolRegistry {
  return {
    shutdown,
    tools: tools.map((tool) => ({
      name: tool.name,
      title: tool.name,
      description: `Test tool ${tool.name}`,
      inputSchema: z.object({}),
      ...(tool.outputSchema ? { outputSchema: tool.outputSchema } : {}),
      handler: tool.handler,
    })),
  };
}

async function connectClient(handle: ReturnType<typeof createMcpServer>): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([handle.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}
