// Generated from vscode-languageserver-protocol protocol.linkedEditingRange by scripts/generate-lsp-output-schemas.mjs. Do not edit by hand.
import { z } from "zod";

export const linkedEditingRangeClientCapabilitiesSchema = z.looseObject({
  dynamicRegistration: z.boolean().optional(),
});

const textDocumentPositionParamsSchema = z.looseObject({});

const workDoneProgressParamsSchema = z.looseObject({});

const workDoneProgressOptionsSchema = z.looseObject({});

const textDocumentRegistrationOptionsSchema = z.looseObject({});

const staticRegistrationOptionsSchema = z.looseObject({});

const rangeSchema = z.looseObject({});

export const linkedEditingRangeParamsSchema = textDocumentPositionParamsSchema.extend(
  workDoneProgressParamsSchema.shape,
);

export const linkedEditingRangeOptionsSchema = workDoneProgressOptionsSchema;

export const linkedEditingRangeRegistrationOptionsSchema = textDocumentRegistrationOptionsSchema
  .extend(linkedEditingRangeOptionsSchema.shape)
  .extend(staticRegistrationOptionsSchema.shape);

export const linkedEditingRangesSchema = z.looseObject({
  ranges: z.array(rangeSchema),
  wordPattern: z.string().optional(),
});
