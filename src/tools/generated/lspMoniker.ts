// Generated from vscode-languageserver-protocol protocol.moniker by scripts/generate-lsp-output-schemas.mjs. Do not edit by hand.
import { z } from "zod";

export const uniquenessLevelSchema = z.union([
  z.literal("document"),
  z.literal("project"),
  z.literal("group"),
  z.literal("scheme"),
  z.literal("global"),
]);

export const monikerKindSchema = z.union([
  z.literal("import"),
  z.literal("export"),
  z.literal("local"),
]);

export const monikerSchema = z.looseObject({
  scheme: z.string(),
  identifier: z.string(),
  unique: uniquenessLevelSchema,
  kind: monikerKindSchema.optional(),
});

export const monikerClientCapabilitiesSchema = z.looseObject({
  dynamicRegistration: z.boolean().optional(),
});

export const monikerServerCapabilitiesSchema = z.looseObject({});

const workDoneProgressOptionsSchema = z.looseObject({});

const textDocumentRegistrationOptionsSchema = z.looseObject({});

const textDocumentPositionParamsSchema = z.looseObject({});

const workDoneProgressParamsSchema = z.looseObject({});

const partialResultParamsSchema = z.looseObject({});

export const monikerOptionsSchema = workDoneProgressOptionsSchema;

export const monikerRegistrationOptionsSchema = textDocumentRegistrationOptionsSchema.extend(
  monikerOptionsSchema.shape,
);

export const monikerParamsSchema = textDocumentPositionParamsSchema
  .extend(workDoneProgressParamsSchema.shape)
  .extend(partialResultParamsSchema.shape);
