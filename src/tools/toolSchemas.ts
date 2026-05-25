import { z } from "zod";

export const positionInputSchema = z.object({
  workspaceRoot: z.string(),
  filePath: z.string(),
  languageId: z.string().optional(),
  serverId: z.string().optional(),
  strict: z.boolean().optional(),
  line: z.number().int().positive(),
  character: z.number().int().positive(),
});

export const fileInputSchema = z.object({
  workspaceRoot: z.string(),
  filePath: z.string(),
  languageId: z.string().optional(),
  serverId: z.string().optional(),
  strict: z.boolean().optional(),
});

export const mcpRangeSchema = z
  .object({
    startLine: z.number().int().positive(),
    startCharacter: z.number().int().positive(),
    endLine: z.number().int().positive(),
    endCharacter: z.number().int().positive(),
  })
  .refine(
    (input) =>
      input.endLine > input.startLine ||
      (input.endLine === input.startLine && input.endCharacter >= input.startCharacter),
    { message: "end must not precede start", path: ["endLine"] },
  );

export const rangeInputSchema = fileInputSchema
  .extend(mcpRangeSchema.shape)
  .refine(
    (input) =>
      input.endLine > input.startLine ||
      (input.endLine === input.startLine && input.endCharacter >= input.startCharacter),
    { message: "end must not precede start", path: ["endLine"] },
  );

const colorComponentSchema = z.number().min(0).max(1);

export const colorPresentationInputSchema = rangeInputSchema.extend({
  color: z.object({
    red: colorComponentSchema,
    green: colorComponentSchema,
    blue: colorComponentSchema,
    alpha: colorComponentSchema,
  }),
});

export const selectionRangeInputSchema = fileInputSchema.extend({
  positions: z.array(
    z.object({
      line: z.number().int().positive(),
      character: z.number().int().positive(),
    }),
  ),
});

export const inlineValueInputSchema = rangeInputSchema.extend({
  context: z.object({
    frameId: z.number().int(),
    stoppedLocation: mcpRangeSchema,
  }),
});

export const semanticTokensFullDeltaInputSchema = fileInputSchema.extend({
  previousResultId: z.string(),
});

export const workspaceSymbolInputSchema = z.object({
  workspaceRoot: z.string(),
  filePath: z.string().optional(),
  languageId: z.string().optional(),
  serverId: z.string().optional(),
  strict: z.boolean().optional(),
  query: z.string(),
});

export const itemInputSchema = z.object({
  workspaceRoot: z.string(),
  filePath: z.string().optional(),
  languageId: z.string().optional(),
  serverId: z.string().optional(),
  strict: z.boolean().optional(),
  item: z.unknown(),
});

export const callHierarchyItemInputSchema = itemInputSchema;
export const typeHierarchyItemInputSchema = itemInputSchema;

export type StandardToolInput =
  | z.infer<typeof positionInputSchema>
  | z.infer<typeof fileInputSchema>;

export const inputSchemas = {
  file: fileInputSchema,
  filePosition: positionInputSchema,
  fileRange: rangeInputSchema,
  colorPresentation: colorPresentationInputSchema,
  selectionRange: selectionRangeInputSchema,
  inlineValue: inlineValueInputSchema,
  semanticTokensFullDelta: semanticTokensFullDeltaInputSchema,
  workspaceSymbol: workspaceSymbolInputSchema,
  item: itemInputSchema,
} as const;
