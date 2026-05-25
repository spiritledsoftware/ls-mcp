import { describe, expect, it } from "vitest";

import { getMethodRegistryEntry, standardMethodRegistry } from "../../src/lsp/methodRegistry.js";

describe("standardMethodRegistry", () => {
  it("defines typed read/query tools with capability metadata", () => {
    const hover = getMethodRegistryEntry("hover");
    const definition = getMethodRegistryEntry("definition");
    const workspaceSymbols = getMethodRegistryEntry("workspaceSymbols");

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
        "completionResolve",
        "signatureHelp",
        "declaration",
        "definition",
        "typeDefinition",
        "implementation",
        "references",
        "documentHighlight",
        "documentSymbols",
        "workspaceSymbols",
        "workspaceSymbolResolve",
        "codeLens",
        "codeLensResolve",
        "documentLinks",
        "documentLinkResolve",
        "documentColors",
        "colorPresentation",
        "foldingRanges",
        "selectionRanges",
        "semanticTokensFull",
        "semanticTokensFullDelta",
        "semanticTokensRange",
        "linkedEditingRange",
        "monikers",
        "inlayHints",
        "inlayHintResolve",
        "inlineValues",
        "callHierarchyPrepare",
        "callHierarchyIncoming",
        "callHierarchyOutgoing",
        "typeHierarchyPrepare",
        "typeHierarchySupertypes",
        "typeHierarchySubtypes",
      ]),
    );
    expect(toolNames).not.toEqual(
      expect.arrayContaining(["rename", "formatting", "rangeFormatting", "codeAction"]),
    );
  });

  it("marks resolve and hierarchy item methods as server-specific", () => {
    for (const toolName of [
      "completionResolve",
      "workspaceSymbolResolve",
      "codeLensResolve",
      "documentLinkResolve",
      "inlayHintResolve",
      "callHierarchyIncoming",
      "callHierarchyOutgoing",
      "typeHierarchySupertypes",
      "typeHierarchySubtypes",
    ]) {
      expect(getMethodRegistryEntry(toolName).supportsMultiServer).toBe(false);
    }
    expect(getMethodRegistryEntry("callHierarchyPrepare").supportsMultiServer).toBe(true);
  });

  it("defines semantic tokens full delta with previous result ID input", () => {
    expect(getMethodRegistryEntry("semanticTokensFullDelta")).toMatchObject({
      lspMethod: "textDocument/semanticTokens/full/delta",
      inputKind: "semanticTokensFullDelta",
      needsDocument: true,
      capabilityPath: "semanticTokensProvider.full.delta",
      supportsMultiServer: true,
    });
  });
});
