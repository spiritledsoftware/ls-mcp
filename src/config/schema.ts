import { z } from "zod";

export const logLevelSchema = z.enum(["debug", "info", "warn", "error"]);

export const lspServerSchema = z
  .object({
    registry: z.string().optional(),
    serverId: z.string().optional(),
    profile: z.enum(["managed", "system"]).optional(),
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    env: z.record(z.string(), z.string()).optional(),
    cwd: z.string().optional(),
    languageIds: z.array(z.string()).optional(),
    extensions: z.array(z.string()).optional(),
    initializationOptions: z.unknown().optional(),
  })
  .strict();

export const configSchema = z
  .object({
    logLevel: logLevelSchema.optional(),
    lsp: z
      .object({
        servers: z.record(z.string(), lspServerSchema).optional(),
      })
      .strict()
      .optional(),
    sessions: z
      .object({
        maxActiveServers: z.number().int().positive().optional(),
        maxOpenDocumentsPerSession: z.number().int().positive().optional(),
        maxConcurrentRequestsPerServer: z.number().int().positive().optional(),
        idleTimeoutMs: z.number().int().nonnegative().optional(),
        requestTimeoutMs: z.number().int().nonnegative().optional(),
        workspaceRequestTimeoutMs: z.number().int().nonnegative().optional(),
        methodTimeoutsMs: z.record(z.string(), z.number().int().nonnegative()).optional(),
        diagnosticsWaitMs: z.number().int().nonnegative().optional(),
      })
      .strict()
      .optional(),
    security: z
      .object({
        allowExternalFiles: z.boolean().optional(),
      })
      .strict()
      .optional(),
    downloads: z
      .object({
        enabled: z.boolean().optional(),
      })
      .strict()
      .optional(),
    commands: z
      .object({
        enabled: z.boolean().optional(),
        allow: z.record(z.string(), z.array(z.string())).optional(),
      })
      .strict()
      .optional(),
  })
  .passthrough();

export type LspMcpConfig = z.infer<typeof configSchema>;

export const knownTopLevelConfigKeys = new Set(Object.keys(configSchema.shape));

export function formatConfigError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");
}
