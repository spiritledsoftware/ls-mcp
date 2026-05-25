# LSP MCP Output Schemas

## Goal

Add MCP `outputSchema` definitions to LSP tools so clients can filter structured results without the project hand-maintaining LSP payload schemas.

## Decisions

- Check generated schema files into the repository.
- Add freshness checks so generated schema files stay synchronized with the installed LSP library types.
- Use a TypeScript-to-Zod generator rather than hand-maintaining LSP result schemas.
- Generate schemas from installed `vscode-languageserver-types` and `vscode-languageserver-protocol` types.
- Keep the maintained layer limited to project-specific MCP result envelopes and tool-to-result-schema mapping.
- Keep schemas permissive enough for normalized result fields such as `filePath`, `outsideWorkspace`, `targetFilePath`, and 1-based positions.

## Implementation Tasks

1. Add `ts-to-zod` as a dev dependency.
2. Add deterministic generation scripts for LSP output schemas.
3. Commit generated Zod schema output under `src/tools/generated/` with a do-not-edit header.
4. Add a maintained `src/tools/outputSchemas.ts` layer that composes MCP output envelopes with generated LSP schemas.
5. Map each standard LSP tool to the appropriate generated result schema.
6. Add generic output schemas for raw tools where request-specific output cannot be known statically.
7. Add output schemas for diagnostics, edit-producing tools, and lifecycle/status tools.
8. Wire `outputSchema` through `createToolRegistry()` for all applicable tools.
9. Add tests that confirm schemas are exposed through the registry and MCP `listTools()`.
10. Add tests that representative structured responses validate against their schemas.
11. Add a freshness check script and wire it into CI.
12. Update `docs/tools.md` with output schema behavior and generation workflow.

## Verification

- `pnpm generate:lsp-output-schemas`
- `pnpm check:lsp-output-schemas`
- `pnpm test`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm format:check`
