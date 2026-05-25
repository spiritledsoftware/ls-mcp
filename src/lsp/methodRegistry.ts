import type { CapabilityPath } from "./capabilities.js";

export type MethodCategory = "read" | "query" | "resolve";
export type MethodInputKind =
  | "file"
  | "filePosition"
  | "fileRange"
  | "colorPresentation"
  | "selectionRange"
  | "inlineValue"
  | "semanticTokensFullDelta"
  | "workspaceSymbol"
  | "item";

export interface MethodRegistryEntry {
  toolName: string;
  lspMethod: string;
  category: MethodCategory;
  description: string;
  inputKind: MethodInputKind;
  needsDocument: boolean;
  capabilityPath?: CapabilityPath;
  supportsMultiServer: boolean;
}

export const standardMethodRegistry = [
  entry(
    "hover",
    "textDocument/hover",
    "read",
    "Returns hover information at a document position.",
    "filePosition",
    true,
    "hoverProvider",
  ),
  entry(
    "completion",
    "textDocument/completion",
    "query",
    "Returns completion items at a document position.",
    "filePosition",
    true,
    "completionProvider",
  ),
  entry(
    "completion_resolve",
    "completionItem/resolve",
    "resolve",
    "Resolves a completion item.",
    "item",
    false,
    ["completionProvider", "resolveProvider"],
    false,
  ),
  entry(
    "signature_help",
    "textDocument/signatureHelp",
    "read",
    "Returns signature help at a document position.",
    "filePosition",
    true,
    "signatureHelpProvider",
  ),
  entry(
    "declaration",
    "textDocument/declaration",
    "read",
    "Returns declaration locations.",
    "filePosition",
    true,
    "declarationProvider",
  ),
  entry(
    "definition",
    "textDocument/definition",
    "read",
    "Returns definition locations.",
    "filePosition",
    true,
    "definitionProvider",
  ),
  entry(
    "type_definition",
    "textDocument/typeDefinition",
    "read",
    "Returns type definition locations.",
    "filePosition",
    true,
    "typeDefinitionProvider",
  ),
  entry(
    "implementation",
    "textDocument/implementation",
    "read",
    "Returns implementation locations.",
    "filePosition",
    true,
    "implementationProvider",
  ),
  entry(
    "references",
    "textDocument/references",
    "read",
    "Returns reference locations.",
    "filePosition",
    true,
    "referencesProvider",
  ),
  entry(
    "document_highlight",
    "textDocument/documentHighlight",
    "read",
    "Returns document highlights.",
    "filePosition",
    true,
    "documentHighlightProvider",
  ),
  entry(
    "document_symbols",
    "textDocument/documentSymbol",
    "query",
    "Returns symbols in a document.",
    "file",
    true,
    "documentSymbolProvider",
  ),
  entry(
    "workspace_symbols",
    "workspace/symbol",
    "query",
    "Returns workspace symbols matching a query.",
    "workspaceSymbol",
    false,
    "workspaceSymbolProvider",
  ),
  entry(
    "workspace_symbol_resolve",
    "workspaceSymbol/resolve",
    "resolve",
    "Resolves a workspace symbol.",
    "item",
    false,
    ["workspaceSymbolProvider", "resolveProvider"],
    false,
  ),
  entry(
    "code_lens",
    "textDocument/codeLens",
    "query",
    "Returns code lenses for a document.",
    "file",
    true,
    "codeLensProvider",
  ),
  entry(
    "code_lens_resolve",
    "codeLens/resolve",
    "resolve",
    "Resolves a code lens.",
    "item",
    false,
    ["codeLensProvider", "resolveProvider"],
    false,
  ),
  entry(
    "document_links",
    "textDocument/documentLink",
    "query",
    "Returns document links.",
    "file",
    true,
    "documentLinkProvider",
  ),
  entry(
    "document_link_resolve",
    "documentLink/resolve",
    "resolve",
    "Resolves a document link.",
    "item",
    false,
    ["documentLinkProvider", "resolveProvider"],
    false,
  ),
  entry(
    "document_colors",
    "textDocument/documentColor",
    "query",
    "Returns document colors.",
    "file",
    true,
    "colorProvider",
  ),
  entry(
    "color_presentation",
    "textDocument/colorPresentation",
    "query",
    "Returns color presentations for a range.",
    "colorPresentation",
    true,
    "colorProvider",
  ),
  entry(
    "folding_ranges",
    "textDocument/foldingRange",
    "query",
    "Returns folding ranges.",
    "file",
    true,
    "foldingRangeProvider",
  ),
  entry(
    "selection_ranges",
    "textDocument/selectionRange",
    "query",
    "Returns selection ranges.",
    "selectionRange",
    true,
    "selectionRangeProvider",
  ),
  entry(
    "semantic_tokens_full",
    "textDocument/semanticTokens/full",
    "query",
    "Returns full semantic tokens.",
    "file",
    true,
    "semanticTokensProvider.full",
  ),
  entry(
    "semantic_tokens_full_delta",
    "textDocument/semanticTokens/full/delta",
    "query",
    "Returns semantic token edits since a previous full result.",
    "semanticTokensFullDelta",
    true,
    "semanticTokensProvider.full.delta",
  ),
  entry(
    "semantic_tokens_range",
    "textDocument/semanticTokens/range",
    "query",
    "Returns range semantic tokens.",
    "fileRange",
    true,
    "semanticTokensProvider.range",
  ),
  entry(
    "linked_editing_range",
    "textDocument/linkedEditingRange",
    "query",
    "Returns linked editing ranges.",
    "filePosition",
    true,
    "linkedEditingRangeProvider",
  ),
  entry(
    "monikers",
    "textDocument/moniker",
    "query",
    "Returns monikers at a position.",
    "filePosition",
    true,
    "monikerProvider",
  ),
  entry(
    "inlay_hints",
    "textDocument/inlayHint",
    "query",
    "Returns inlay hints for a range.",
    "fileRange",
    true,
    "inlayHintProvider",
  ),
  entry(
    "inlay_hint_resolve",
    "inlayHint/resolve",
    "resolve",
    "Resolves an inlay hint.",
    "item",
    false,
    ["inlayHintProvider", "resolveProvider"],
    false,
  ),
  entry(
    "inline_values",
    "textDocument/inlineValue",
    "query",
    "Returns inline values for a range.",
    "inlineValue",
    true,
    "inlineValueProvider",
  ),
  entry(
    "call_hierarchy_prepare",
    "textDocument/prepareCallHierarchy",
    "query",
    "Prepares call hierarchy items.",
    "filePosition",
    true,
    "callHierarchyProvider",
  ),
  entry(
    "call_hierarchy_incoming",
    "callHierarchy/incomingCalls",
    "query",
    "Returns incoming call hierarchy calls.",
    "item",
    false,
    "callHierarchyProvider",
    false,
  ),
  entry(
    "call_hierarchy_outgoing",
    "callHierarchy/outgoingCalls",
    "query",
    "Returns outgoing call hierarchy calls.",
    "item",
    false,
    "callHierarchyProvider",
    false,
  ),
  entry(
    "type_hierarchy_prepare",
    "textDocument/prepareTypeHierarchy",
    "query",
    "Prepares type hierarchy items.",
    "filePosition",
    true,
    "typeHierarchyProvider",
  ),
  entry(
    "type_hierarchy_supertypes",
    "typeHierarchy/supertypes",
    "query",
    "Returns type hierarchy supertypes.",
    "item",
    false,
    "typeHierarchyProvider",
    false,
  ),
  entry(
    "type_hierarchy_subtypes",
    "typeHierarchy/subtypes",
    "query",
    "Returns type hierarchy subtypes.",
    "item",
    false,
    "typeHierarchyProvider",
    false,
  ),
] satisfies MethodRegistryEntry[];

const entriesByToolName = new Map(standardMethodRegistry.map((entry) => [entry.toolName, entry]));

export function getMethodRegistryEntry(toolName: string): MethodRegistryEntry {
  const found = entriesByToolName.get(toolName);
  if (!found) {
    throw new Error(`Unknown standard LSP tool ${toolName}`);
  }
  return found;
}

function entry(
  toolName: string,
  lspMethod: string,
  category: MethodCategory,
  description: string,
  inputKind: MethodInputKind,
  needsDocument: boolean,
  capabilityPath?: CapabilityPath,
  supportsMultiServer = true,
): MethodRegistryEntry {
  return {
    toolName,
    lspMethod,
    category,
    description,
    inputKind,
    needsDocument,
    capabilityPath,
    supportsMultiServer,
  };
}
