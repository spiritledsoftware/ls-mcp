import { z } from "zod";

import { serverAliasKinds } from "../lsp/serverIdentity.js";
import { linkedEditingRangesSchema } from "./generated/lspLinkedEditingRange.js";
import { monikerSchema } from "./generated/lspMoniker.js";
import {
  callHierarchyIncomingCallSchema,
  callHierarchyItemSchema,
  callHierarchyOutgoingCallSchema,
  codeActionSchema,
  codeLensSchema,
  colorInformationSchema,
  colorPresentationSchema,
  commandSchema,
  completionItemSchema,
  completionListSchema,
  declarationLinkSchema,
  declarationSchema,
  definitionLinkSchema,
  definitionSchema,
  diagnosticSchema,
  documentHighlightSchema,
  documentLinkSchema,
  documentSymbolSchema,
  foldingRangeSchema,
  hoverSchema,
  inlayHintSchema,
  inlineValueSchema,
  locationSchema,
  rangeSchema as lspRangeSchema,
  selectionRangeSchema,
  semanticTokensDeltaSchema,
  semanticTokensSchema,
  signatureHelpSchema,
  symbolInformationSchema,
  textEditSchema,
  typeHierarchyItemSchema,
  workspaceEditSchema,
  workspaceSymbolSchema,
} from "./generated/lspTypes.js";

export const aliasDetailSchema = z
  .object({
    value: z.string(),
    kind: z.enum(serverAliasKinds),
  })
  .strict();

export const serverSuggestionSchema = z
  .object({
    id: z.string(),
    score: z.number(),
    reasons: z.array(z.string()).readonly(),
    aliases: z.array(z.string()).readonly(),
    aliasDetails: z.array(aliasDetailSchema).readonly(),
    registryId: z.string().optional(),
    configuredId: z.string().optional(),
    languageIds: z.array(z.string()).readonly(),
    extensions: z.array(z.string()).readonly(),
  })
  .strict();

const installStatusSchema = z
  .object({
    status: z.union([z.literal("ready"), z.literal("not-installed"), z.literal("error")]),
    command: z.string(),
    args: z.array(z.string()).readonly(),
    source: z
      .union([z.literal("configured"), z.literal("system"), z.literal("installed")])
      .optional(),
    reason: z.string().optional(),
  })
  .strict();

const installStrategySchema = z.union([z.literal("system"), z.literal("npm"), z.literal("github")]);

const masonPackageMetadataSchema = z
  .object({
    package: z.string(),
    version: z.string(),
    source: z.string(),
    lspconfig: z.string().optional(),
  })
  .strict();

const upstreamSchema = z
  .object({
    mason: masonPackageMetadataSchema.optional(),
  })
  .strict();

export const serverInfoSchema = z
  .object({
    id: z.string(),
    registryId: z.string().optional(),
    configuredId: z.string().optional(),
    kind: z.union([z.literal("managed"), z.literal("system"), z.literal("custom")]),
    profile: z.union([z.literal("managed"), z.literal("system")]).optional(),
    command: z.string().optional(),
    configuredCommand: z.boolean(),
    args: z.array(z.string()).readonly(),
    languageIds: z.array(z.string()).readonly(),
    extensions: z.array(z.string()).readonly(),
    installStrategy: installStrategySchema.optional(),
    version: z.string().optional(),
    aliases: z.array(z.string()).readonly(),
    aliasDetails: z.array(aliasDetailSchema).readonly(),
    upstream: upstreamSchema.optional(),
    install: installStatusSchema,
    running: z.boolean(),
  })
  .strict();

const structuredErrorSchema = z.object({
  ok: z.literal(false),
  error: z.string(),
  code: z.union([z.string(), z.number()]).optional(),
  method: z.string().optional(),
  timeoutMs: z.number().optional(),
  serverId: z.string().optional(),
  suggestions: z.array(serverSuggestionSchema).readonly().optional(),
});

const changedFileSchema = z.object({
  filePath: z.string(),
  changeType: z.union([
    z.literal("modified"),
    z.literal("created"),
    z.literal("renamed"),
    z.literal("deleted"),
  ]),
});

function perServerOutputSchema(resultSchema: z.ZodType): z.ZodType {
  return z.object({
    ok: z.boolean(),
    results: z.record(
      z.string(),
      z.union([z.object({ ok: z.literal(true), result: resultSchema }), structuredErrorSchema]),
    ),
    error: z.string().optional(),
  });
}

const nullable = (schema: z.ZodType) => z.union([schema, z.null()]);
const arrayOf = (schema: z.ZodType) => z.array(schema);

const linkedEditingRangesOutputSchema = linkedEditingRangesSchema.extend({
  ranges: z.array(lspRangeSchema),
});

export const standardOutputSchemas = {
  hover: perServerOutputSchema(nullable(hoverSchema)),
  completion: perServerOutputSchema(
    z.union([completionListSchema, arrayOf(completionItemSchema), z.null()]),
  ),
  completion_resolve: perServerOutputSchema(completionItemSchema),
  signature_help: perServerOutputSchema(nullable(signatureHelpSchema)),
  declaration: perServerOutputSchema(
    z.union([declarationSchema, arrayOf(declarationLinkSchema), z.null()]),
  ),
  definition: perServerOutputSchema(
    z.union([definitionSchema, arrayOf(definitionLinkSchema), z.null()]),
  ),
  type_definition: perServerOutputSchema(
    z.union([definitionSchema, arrayOf(definitionLinkSchema), z.null()]),
  ),
  implementation: perServerOutputSchema(
    z.union([definitionSchema, arrayOf(definitionLinkSchema), z.null()]),
  ),
  references: perServerOutputSchema(z.union([arrayOf(locationSchema), z.null()])),
  document_highlight: perServerOutputSchema(z.union([arrayOf(documentHighlightSchema), z.null()])),
  document_symbols: perServerOutputSchema(
    z.union([arrayOf(documentSymbolSchema), arrayOf(symbolInformationSchema), z.null()]),
  ),
  workspace_symbols: perServerOutputSchema(
    z.union([arrayOf(symbolInformationSchema), arrayOf(workspaceSymbolSchema), z.null()]),
  ),
  workspace_symbol_resolve: perServerOutputSchema(workspaceSymbolSchema),
  code_lens: perServerOutputSchema(z.union([arrayOf(codeLensSchema), z.null()])),
  code_lens_resolve: perServerOutputSchema(codeLensSchema),
  document_links: perServerOutputSchema(z.union([arrayOf(documentLinkSchema), z.null()])),
  document_link_resolve: perServerOutputSchema(documentLinkSchema),
  document_colors: perServerOutputSchema(arrayOf(colorInformationSchema)),
  color_presentation: perServerOutputSchema(arrayOf(colorPresentationSchema)),
  folding_ranges: perServerOutputSchema(z.union([arrayOf(foldingRangeSchema), z.null()])),
  selection_ranges: perServerOutputSchema(z.union([arrayOf(selectionRangeSchema), z.null()])),
  semantic_tokens_full: perServerOutputSchema(nullable(semanticTokensSchema)),
  semantic_tokens_full_delta: perServerOutputSchema(
    z.union([semanticTokensSchema, semanticTokensDeltaSchema, z.null()]),
  ),
  semantic_tokens_range: perServerOutputSchema(nullable(semanticTokensSchema)),
  linked_editing_range: perServerOutputSchema(nullable(linkedEditingRangesOutputSchema)),
  monikers: perServerOutputSchema(z.union([arrayOf(monikerSchema), z.null()])),
  inlay_hints: perServerOutputSchema(z.union([arrayOf(inlayHintSchema), z.null()])),
  inlay_hint_resolve: perServerOutputSchema(inlayHintSchema),
  inline_values: perServerOutputSchema(z.union([arrayOf(inlineValueSchema), z.null()])),
  call_hierarchy_prepare: perServerOutputSchema(
    z.union([arrayOf(callHierarchyItemSchema), z.null()]),
  ),
  call_hierarchy_incoming: perServerOutputSchema(
    z.union([arrayOf(callHierarchyIncomingCallSchema), z.null()]),
  ),
  call_hierarchy_outgoing: perServerOutputSchema(
    z.union([arrayOf(callHierarchyOutgoingCallSchema), z.null()]),
  ),
  type_hierarchy_prepare: perServerOutputSchema(
    z.union([arrayOf(typeHierarchyItemSchema), z.null()]),
  ),
  type_hierarchy_supertypes: perServerOutputSchema(
    z.union([arrayOf(typeHierarchyItemSchema), z.null()]),
  ),
  type_hierarchy_subtypes: perServerOutputSchema(
    z.union([arrayOf(typeHierarchyItemSchema), z.null()]),
  ),
} as const;

export const rawToolOutputSchema = perServerOutputSchema(z.unknown());

export const diagnosticsOutputSchema = z.object({
  ok: z.boolean(),
  results: z.record(
    z.string(),
    z.union([
      z.object({
        ok: z.literal(true),
        mode: z.union([z.literal("pull"), z.literal("push-cache"), z.literal("push-wait")]),
        uri: z.string().optional(),
        filePath: z.string().optional(),
        diagnostics: z.array(diagnosticSchema),
      }),
      structuredErrorSchema,
    ]),
  ),
  error: z.string().optional(),
});

const editSuccessBaseSchema = z.object({
  ok: z.literal(true),
  applied: z.boolean(),
  message: z.string().optional(),
  changedFiles: z.array(changedFileSchema).optional(),
});

export const editToolOutputSchemas = {
  lsp_rename: editOutputSchema(z.object({ edit: workspaceEditSchema.optional() })),
  lsp_format_document: editOutputSchema(z.object({ edits: z.array(textEditSchema).optional() })),
  lsp_format_range: editOutputSchema(z.object({ edits: z.array(textEditSchema).optional() })),
  lsp_format_on_type: editOutputSchema(z.object({ edits: z.array(textEditSchema).optional() })),
  lsp_code_actions: editOutputSchema(
    z.object({
      actions: z.array(z.union([commandSchema, codeActionSchema])).optional(),
      action: z.union([commandSchema, codeActionSchema]).optional(),
      command: z.object({ ok: z.literal(true), result: z.unknown() }).optional(),
    }),
  ),
} as const;

const processStatusSchema = z
  .object({
    state: z.union([z.literal("running"), z.literal("exited")]),
    pid: z.number().optional(),
    exitCode: z.number().nullable(),
    signal: z.string().nullable(),
    error: z.unknown().optional(),
  })
  .strict();

const capabilitiesSummarySchema = z
  .object({
    hover: z.boolean(),
    completion: z.boolean(),
    definition: z.boolean(),
    references: z.boolean(),
    documentSymbol: z.boolean(),
    workspaceSymbol: z.boolean(),
    codeAction: z.boolean(),
    rename: z.boolean(),
    formatting: z.boolean(),
  })
  .strict();

const sessionHealthSchema = z
  .object({
    consecutiveFailures: z.number(),
    restartCount: z.number(),
    lastExitCode: z.number().nullable(),
    lastExitSignal: z.string().nullable(),
    lastStderr: z.array(z.string()).readonly(),
    lastError: z.string().optional(),
  })
  .strict();

const activeSessionStatusSchema = z
  .object({
    serverId: z.string(),
    configuredId: z.string().optional(),
    workspaceRoot: z.string(),
    running: z.boolean(),
    process: processStatusSchema.optional(),
    capabilities: capabilitiesSummarySchema,
    health: sessionHealthSchema.optional(),
    lastAccessedAt: z.string().optional(),
    idleDeadlineAt: z.string().optional(),
  })
  .strict();

export const serverStatusOutputSchema = z.union([
  z
    .object({
      ok: z.literal(true),
      servers: z.array(serverInfoSchema),
      sessions: z.array(activeSessionStatusSchema),
    })
    .strict(),
  structuredErrorSchema.strict(),
]);

export const stopServerOutputSchema = z.union([
  z
    .object({
      ok: z.literal(true),
      stopped: z.boolean(),
      reason: z.string().optional(),
      serverId: z.string(),
      workspaceRoot: z.string(),
    })
    .strict(),
  structuredErrorSchema.strict(),
]);

export const stopWorkspaceOutputSchema = z.object({
  ok: z.literal(true),
  workspaceRoot: z.string(),
  stoppedCount: z.number().int().nonnegative(),
  stopped: z.array(
    z.object({
      serverId: z.string(),
      workspaceRoot: z.string(),
    }),
  ),
});

function editOutputSchema(extraSuccessFields: z.ZodObject): z.ZodType {
  return z.object({
    ok: z.boolean(),
    results: z.record(
      z.string(),
      z.union([
        editSuccessBaseSchema.extend(extraSuccessFields.shape),
        structuredErrorSchema.extend({
          applied: z.boolean().optional(),
          changedFiles: z.array(changedFileSchema).optional(),
        }),
      ]),
    ),
    error: z.string().optional(),
  });
}
