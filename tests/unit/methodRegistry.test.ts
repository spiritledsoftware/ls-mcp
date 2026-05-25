import { describe, expect, it } from "vitest";

import { getMethodRegistryEntry, standardMethodRegistry } from "../../src/lsp/methodRegistry.js";

describe("standardMethodRegistry", () => {
  it("defines typed read/query tools with capability metadata", () => {
    const hover = getMethodRegistryEntry("hover");
    const definition = getMethodRegistryEntry("definition");
    const workspaceSymbols = getMethodRegistryEntry("workspace_symbols");

    expect(hover).toMatchObject({
      toolName: "hover",
      lspMethod: "textDocument/hover",
      category: "read",
      inputKind: "filePosition",
      needsDocument: true,
      capabilityPath: "hoverProvider",
      supportsMultiServer: true,
    });
    expect(definition).toMatchObject({
      lspMethod: "textDocument/definition",
      inputKind: "filePosition",
      capabilityPath: "definitionProvider",
    });
    expect(workspaceSymbols).toMatchObject({
      lspMethod: "workspace/symbol",
      inputKind: "workspaceSymbol",
      needsDocument: false,
      capabilityPath: "workspaceSymbolProvider",
    });
  });

  it("includes standard LSP 3.17 query methods and excludes editing/control tools", () => {
    const toolNames = standardMethodRegistry.map((entry) => entry.toolName);

    expect(toolNames).toEqual(
      expect.arrayContaining([
        "hover",
        "completion",
        "completion_resolve",
        "signature_help",
        "declaration",
        "definition",
        "type_definition",
        "implementation",
        "references",
        "document_highlight",
        "document_symbols",
        "workspace_symbols",
        "workspace_symbol_resolve",
        "code_lens",
        "code_lens_resolve",
        "document_links",
        "document_link_resolve",
        "document_colors",
        "color_presentation",
        "folding_ranges",
        "selection_ranges",
        "semantic_tokens_full",
        "semantic_tokens_full_delta",
        "semantic_tokens_range",
        "linked_editing_range",
        "monikers",
        "inlay_hints",
        "inlay_hint_resolve",
        "inline_values",
        "call_hierarchy_prepare",
        "call_hierarchy_incoming",
        "call_hierarchy_outgoing",
        "type_hierarchy_prepare",
        "type_hierarchy_supertypes",
        "type_hierarchy_subtypes",
      ]),
    );
    expect(toolNames).not.toEqual(
      expect.arrayContaining(["rename", "formatting", "rangeFormatting", "codeAction"]),
    );
  });

  it("marks resolve and hierarchy item methods as server-specific", () => {
    for (const toolName of [
      "completion_resolve",
      "workspace_symbol_resolve",
      "code_lens_resolve",
      "document_link_resolve",
      "inlay_hint_resolve",
      "call_hierarchy_incoming",
      "call_hierarchy_outgoing",
      "type_hierarchy_supertypes",
      "type_hierarchy_subtypes",
    ]) {
      expect(getMethodRegistryEntry(toolName).supportsMultiServer).toBe(false);
    }
    expect(getMethodRegistryEntry("call_hierarchy_prepare").supportsMultiServer).toBe(true);
  });

  it("defines semantic tokens full delta with previous result ID input", () => {
    expect(getMethodRegistryEntry("semantic_tokens_full_delta")).toMatchObject({
      lspMethod: "textDocument/semanticTokens/full/delta",
      inputKind: "semanticTokensFullDelta",
      needsDocument: true,
      capabilityPath: "semanticTokensProvider.full.delta",
      supportsMultiServer: true,
    });
  });
});
