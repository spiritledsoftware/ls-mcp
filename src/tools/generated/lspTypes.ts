// Generated from vscode-languageserver-types by scripts/generate-lsp-output-schemas.mjs. Do not edit by hand.
import { z } from "zod";

export const documentUriSchema = z.string();

export const uriSchema = z.string();

export const integerSchema = z.number();

export const uintegerSchema = z.number();

export const decimalSchema = z.number();

export const lspAnySchema = z.any();

export const lspObjectSchema = z.record(z.string(), z.any());

export const lspArraySchema = z.array(z.any());

export const positionSchema = z.looseObject({
  line: uintegerSchema,
  character: uintegerSchema,
});

export const rangeSchema = z.looseObject({
  start: positionSchema,
  end: positionSchema,
});

export const locationSchema = z.looseObject({
  uri: documentUriSchema,
  range: rangeSchema,
});

export const locationLinkSchema = z.looseObject({
  originSelectionRange: rangeSchema.optional(),
  targetUri: documentUriSchema,
  targetRange: rangeSchema,
  targetSelectionRange: rangeSchema,
});

export const colorSchema = z.looseObject({
  red: decimalSchema,
  green: decimalSchema,
  blue: decimalSchema,
  alpha: decimalSchema,
});

export const colorInformationSchema = z.looseObject({
  range: rangeSchema,
  color: colorSchema,
});

export const textEditSchema = z.looseObject({
  range: rangeSchema,
  newText: z.string(),
});

export const foldingRangeKindSchema = z.string();

export const foldingRangeSchema = z.looseObject({
  startLine: uintegerSchema,
  startCharacter: uintegerSchema.optional(),
  endLine: uintegerSchema,
  endCharacter: uintegerSchema.optional(),
  kind: foldingRangeKindSchema.optional(),
  collapsedText: z.string().optional(),
});

export const diagnosticRelatedInformationSchema = z.looseObject({
  location: locationSchema,
  message: z.string(),
});

export const diagnosticSeveritySchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
]);

export const diagnosticTagSchema = z.union([z.literal(1), z.literal(2)]);

export const codeDescriptionSchema = z.looseObject({
  href: uriSchema,
});

export const diagnosticSchema = z.looseObject({
  range: rangeSchema,
  severity: diagnosticSeveritySchema.optional(),
  code: z.union([integerSchema, z.string()]).optional(),
  codeDescription: codeDescriptionSchema.optional(),
  source: z.string().optional(),
  message: z.string(),
  tags: z.array(diagnosticTagSchema).optional(),
  relatedInformation: z.array(diagnosticRelatedInformationSchema).optional(),
  data: lspAnySchema.optional(),
});

export const commandSchema = z.looseObject({
  title: z.string(),
  command: z.string(),
  arguments: z.array(lspAnySchema).optional(),
});

export const changeAnnotationSchema = z.looseObject({
  label: z.string(),
  needsConfirmation: z.boolean().optional(),
  description: z.string().optional(),
});

export const changeAnnotationIdentifierSchema = z.string();

export const annotatedTextEditSchema = textEditSchema.extend({
  annotationId: changeAnnotationIdentifierSchema,
});

const resourceOperationSchema = z.looseObject({
  kind: z.string(),
  annotationId: changeAnnotationIdentifierSchema.optional(),
});

export const createFileOptionsSchema = z.looseObject({
  overwrite: z.boolean().optional(),
  ignoreIfExists: z.boolean().optional(),
});

export const createFileSchema = resourceOperationSchema.extend({
  kind: z.literal("create"),
  uri: documentUriSchema,
  options: createFileOptionsSchema.optional(),
});

export const renameFileOptionsSchema = z.looseObject({
  overwrite: z.boolean().optional(),
  ignoreIfExists: z.boolean().optional(),
});

export const renameFileSchema = resourceOperationSchema.extend({
  kind: z.literal("rename"),
  oldUri: documentUriSchema,
  newUri: documentUriSchema,
  options: renameFileOptionsSchema.optional(),
});

export const deleteFileOptionsSchema = z.looseObject({
  recursive: z.boolean().optional(),
  ignoreIfNotExists: z.boolean().optional(),
});

export const deleteFileSchema = resourceOperationSchema.extend({
  kind: z.literal("delete"),
  uri: documentUriSchema,
  options: deleteFileOptionsSchema.optional(),
});

export const textEditChangeSchema = z.looseObject({});

export const textDocumentIdentifierSchema = z.looseObject({
  uri: documentUriSchema,
});

export const versionedTextDocumentIdentifierSchema = textDocumentIdentifierSchema.extend({
  version: integerSchema,
});

export const optionalVersionedTextDocumentIdentifierSchema = textDocumentIdentifierSchema.extend({
  version: integerSchema.nullable(),
});

export const textDocumentItemSchema = z.looseObject({
  uri: documentUriSchema,
  languageId: z.string(),
  version: integerSchema,
  text: z.string(),
});

export const markupKindSchema = z.union([z.literal("plaintext"), z.literal("markdown")]);

export const markupContentSchema = z.looseObject({
  kind: markupKindSchema,
  value: z.string(),
});

export const completionItemKindSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
  z.literal(7),
  z.literal(8),
  z.literal(9),
  z.literal(10),
  z.literal(11),
  z.literal(12),
  z.literal(13),
  z.literal(14),
  z.literal(15),
  z.literal(16),
  z.literal(17),
  z.literal(18),
  z.literal(19),
  z.literal(20),
  z.literal(21),
  z.literal(22),
  z.literal(23),
  z.literal(24),
  z.literal(25),
]);

export const insertTextFormatSchema = z.union([z.literal(1), z.literal(2)]);

export const completionItemTagSchema = z.literal(1);

export const insertReplaceEditSchema = z.looseObject({
  newText: z.string(),
  insert: rangeSchema,
  replace: rangeSchema,
});

export const insertTextModeSchema = z.union([z.literal(1), z.literal(2)]);

export const completionItemLabelDetailsSchema = z.looseObject({
  detail: z.string().optional(),
  description: z.string().optional(),
});

export const completionItemSchema = z.looseObject({
  label: z.string(),
  labelDetails: completionItemLabelDetailsSchema.optional(),
  kind: completionItemKindSchema.optional(),
  tags: z.array(completionItemTagSchema).optional(),
  detail: z.string().optional(),
  documentation: z.union([z.string(), markupContentSchema]).optional(),
  deprecated: z.boolean().optional(),
  preselect: z.boolean().optional(),
  sortText: z.string().optional(),
  filterText: z.string().optional(),
  insertText: z.string().optional(),
  insertTextFormat: insertTextFormatSchema.optional(),
  insertTextMode: insertTextModeSchema.optional(),
  textEdit: z.union([textEditSchema, insertReplaceEditSchema]).optional(),
  textEditText: z.string().optional(),
  additionalTextEdits: z.array(textEditSchema).optional(),
  commitCharacters: z.array(z.string()).optional(),
  command: commandSchema.optional(),
  data: lspAnySchema.optional(),
});

export const completionListSchema = z.looseObject({
  isIncomplete: z.boolean(),
  itemDefaults: z
    .looseObject({
      commitCharacters: z.array(z.string()).optional(),
      editRange: z
        .union([
          rangeSchema,
          z.looseObject({
            insert: rangeSchema,
            replace: rangeSchema,
          }),
        ])
        .optional(),
      insertTextFormat: insertTextFormatSchema.optional(),
      insertTextMode: insertTextModeSchema.optional(),
      data: lspAnySchema.optional(),
    })
    .optional(),
  items: z.array(completionItemSchema),
});

export const markedStringSchema = z.union([
  z.string(),
  z.looseObject({
    language: z.string(),
    value: z.string(),
  }),
]);

export const hoverSchema = z.looseObject({
  contents: z.union([markupContentSchema, markedStringSchema, z.array(markedStringSchema)]),
  range: rangeSchema.optional(),
});

export const parameterInformationSchema = z.looseObject({
  label: z.union([z.string(), z.tuple([uintegerSchema, uintegerSchema])]),
  documentation: z.union([z.string(), markupContentSchema]).optional(),
});

export const signatureInformationSchema = z.looseObject({
  label: z.string(),
  documentation: z.union([z.string(), markupContentSchema]).optional(),
  parameters: z.array(parameterInformationSchema).optional(),
  activeParameter: uintegerSchema.optional(),
});

export const signatureHelpSchema = z.looseObject({
  signatures: z.array(signatureInformationSchema),
  activeSignature: uintegerSchema.optional(),
  activeParameter: uintegerSchema.optional(),
});

export const definitionSchema = z.union([locationSchema, z.array(locationSchema)]);

export const definitionLinkSchema = locationLinkSchema;

export const declarationSchema = z.union([locationSchema, z.array(locationSchema)]);

export const declarationLinkSchema = locationLinkSchema;

export const referenceContextSchema = z.looseObject({
  includeDeclaration: z.boolean(),
});

export const documentHighlightKindSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

export const documentHighlightSchema = z.looseObject({
  range: rangeSchema,
  kind: documentHighlightKindSchema.optional(),
});

export const symbolKindSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
  z.literal(7),
  z.literal(8),
  z.literal(9),
  z.literal(10),
  z.literal(11),
  z.literal(12),
  z.literal(13),
  z.literal(14),
  z.literal(15),
  z.literal(16),
  z.literal(17),
  z.literal(18),
  z.literal(19),
  z.literal(20),
  z.literal(21),
  z.literal(22),
  z.literal(23),
  z.literal(24),
  z.literal(25),
  z.literal(26),
]);

export const symbolTagSchema = z.literal(1);

export const baseSymbolInformationSchema = z.looseObject({
  name: z.string(),
  kind: symbolKindSchema,
  tags: z.array(symbolTagSchema).optional(),
  containerName: z.string().optional(),
});

export const symbolInformationSchema = baseSymbolInformationSchema.extend({
  deprecated: z.boolean().optional(),
  location: locationSchema,
});

export const workspaceSymbolSchema = baseSymbolInformationSchema.extend({
  location: z.union([
    locationSchema,
    z.looseObject({
      uri: documentUriSchema,
    }),
  ]),
  data: lspAnySchema.optional(),
});

export const documentSymbolSchema: z.ZodType = z.lazy(() =>
  z.looseObject({
    name: z.string(),
    detail: z.string().optional(),
    kind: symbolKindSchema,
    tags: z.array(symbolTagSchema).optional(),
    deprecated: z.boolean().optional(),
    range: rangeSchema,
    selectionRange: rangeSchema,
    children: z.array(documentSymbolSchema).optional(),
  }),
);

export const codeActionKindSchema = z.string();

export const codeActionTriggerKindSchema = z.union([z.literal(1), z.literal(2)]);

export const codeActionContextSchema = z.looseObject({
  diagnostics: z.array(diagnosticSchema),
  only: z.array(codeActionKindSchema).optional(),
  triggerKind: codeActionTriggerKindSchema.optional(),
});

export const codeLensSchema = z.looseObject({
  range: rangeSchema,
  command: commandSchema.optional(),
  data: lspAnySchema.optional(),
});

export const formattingOptionsSchema = z
  .record(z.string(), z.union([z.boolean(), integerSchema, z.string(), z.undefined()]))
  .and(
    z.looseObject({
      tabSize: uintegerSchema,
      insertSpaces: z.boolean(),
      trimTrailingWhitespace: z.boolean().optional(),
      insertFinalNewline: z.boolean().optional(),
      trimFinalNewlines: z.boolean().optional(),
    }),
  );

export const documentLinkSchema = z.looseObject({
  range: rangeSchema,
  target: uriSchema.optional(),
  tooltip: z.string().optional(),
  data: lspAnySchema.optional(),
});

export const selectionRangeSchema: z.ZodType = z.lazy(() =>
  z.looseObject({
    range: rangeSchema,
    parent: selectionRangeSchema.optional(),
  }),
);

export const callHierarchyItemSchema = z.looseObject({
  name: z.string(),
  kind: symbolKindSchema,
  tags: z.array(symbolTagSchema).optional(),
  detail: z.string().optional(),
  uri: documentUriSchema,
  range: rangeSchema,
  selectionRange: rangeSchema,
  data: lspAnySchema.optional(),
});

export const callHierarchyIncomingCallSchema = z.looseObject({
  from: callHierarchyItemSchema,
  fromRanges: z.array(rangeSchema),
});

export const callHierarchyOutgoingCallSchema = z.looseObject({
  to: callHierarchyItemSchema,
  fromRanges: z.array(rangeSchema),
});

export const semanticTokenTypesSchema = z.string();

export const semanticTokenModifiersSchema = z.string();

export const semanticTokensLegendSchema = z.looseObject({
  tokenTypes: z.array(z.string()),
  tokenModifiers: z.array(z.string()),
});

export const semanticTokensSchema = z.looseObject({
  resultId: z.string().optional(),
  data: z.array(uintegerSchema),
});

export const semanticTokensEditSchema = z.looseObject({
  start: uintegerSchema,
  deleteCount: uintegerSchema,
  data: z.array(uintegerSchema).optional(),
});

export const semanticTokensDeltaSchema = z.looseObject({
  resultId: z.string().optional(),
  edits: z.array(semanticTokensEditSchema),
});

export const typeHierarchyItemSchema = z.looseObject({
  name: z.string(),
  kind: symbolKindSchema,
  tags: z.array(symbolTagSchema).optional(),
  detail: z.string().optional(),
  uri: documentUriSchema,
  range: rangeSchema,
  selectionRange: rangeSchema,
  data: lspAnySchema.optional(),
});

export const inlineValueTextSchema = z.looseObject({
  range: rangeSchema,
  text: z.string(),
});

export const inlineValueVariableLookupSchema = z.looseObject({
  range: rangeSchema,
  variableName: z.string().optional(),
  caseSensitiveLookup: z.boolean(),
});

export const inlineValueEvaluatableExpressionSchema = z.looseObject({
  range: rangeSchema,
  expression: z.string().optional(),
});

export const inlineValueSchema = z.union([
  inlineValueTextSchema,
  inlineValueVariableLookupSchema,
  inlineValueEvaluatableExpressionSchema,
]);

export const inlineValueContextSchema = z.looseObject({
  frameId: integerSchema,
  stoppedLocation: rangeSchema,
});

export const inlayHintKindSchema = z.union([z.literal(1), z.literal(2)]);

export const inlayHintLabelPartSchema = z.looseObject({
  value: z.string(),
  tooltip: z.union([z.string(), markupContentSchema]).optional(),
  location: locationSchema.optional(),
  command: commandSchema.optional(),
});

export const inlayHintSchema = z.looseObject({
  position: positionSchema,
  label: z.union([z.string(), z.array(inlayHintLabelPartSchema)]),
  kind: inlayHintKindSchema.optional(),
  textEdits: z.array(textEditSchema).optional(),
  tooltip: z.union([z.string(), markupContentSchema]).optional(),
  paddingLeft: z.boolean().optional(),
  paddingRight: z.boolean().optional(),
  data: lspAnySchema.optional(),
});

export const stringValueSchema = z.looseObject({
  kind: z.literal("snippet"),
  value: z.string(),
});

export const inlineCompletionItemSchema = z.looseObject({
  insertText: z.union([z.string(), stringValueSchema]),
  filterText: z.string().optional(),
  range: rangeSchema.optional(),
  command: commandSchema.optional(),
});

export const inlineCompletionListSchema = z.looseObject({
  items: z.array(inlineCompletionItemSchema),
});

export const inlineCompletionTriggerKindSchema = z.union([z.literal(0), z.literal(1)]);

export const selectedCompletionInfoSchema = z.looseObject({
  range: rangeSchema,
  text: z.string(),
});

export const inlineCompletionContextSchema = z.looseObject({
  triggerKind: inlineCompletionTriggerKindSchema,
  selectedCompletionInfo: selectedCompletionInfoSchema.optional(),
});

export const workspaceFolderSchema = z.looseObject({
  uri: uriSchema,
  name: z.string(),
});

export const textDocumentSchema = z.looseObject({
  uri: documentUriSchema,
  languageId: z.string(),
  version: integerSchema,
  lineCount: uintegerSchema,
});

export const colorPresentationSchema = z.looseObject({
  label: z.string(),
  textEdit: textEditSchema.optional(),
  additionalTextEdits: z.array(textEditSchema).optional(),
});

export const textDocumentEditSchema = z.looseObject({
  textDocument: optionalVersionedTextDocumentIdentifierSchema,
  edits: z.array(z.union([textEditSchema, annotatedTextEditSchema])),
});

export const workspaceEditSchema = z.looseObject({
  changes: z.record(documentUriSchema, z.array(textEditSchema)).optional(),
  documentChanges: z
    .array(z.union([textDocumentEditSchema, createFileSchema, renameFileSchema, deleteFileSchema]))
    .optional(),
  changeAnnotations: z.record(changeAnnotationIdentifierSchema, changeAnnotationSchema).optional(),
});

export const codeActionSchema = z.looseObject({
  title: z.string(),
  kind: codeActionKindSchema.optional(),
  diagnostics: z.array(diagnosticSchema).optional(),
  isPreferred: z.boolean().optional(),
  disabled: z
    .looseObject({
      reason: z.string(),
    })
    .optional(),
  edit: workspaceEditSchema.optional(),
  command: commandSchema.optional(),
  data: lspAnySchema.optional(),
});
