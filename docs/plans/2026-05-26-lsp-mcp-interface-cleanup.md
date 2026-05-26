# LSP MCP Interface Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` or `executing-plans` to implement this plan task-by-task.

**Goal:** Make the LSP MCP interface agent-friendly before 1.0 by removing inconsistent `lsp_` tool prefixes, switching canonical server IDs to recognizable language-server names, adding server search/discovery, and returning structured resolution errors.

**Architecture:** Introduce a shared server identity layer used by registry listing, session acquisition, command policy, lifecycle tools, and search. Public tools expose canonical server IDs such as `typescript-language-server`, while configured keys, registry IDs, Mason aliases, and language IDs become typed aliases. Tool responses keep the per-server envelope but gain strict server schemas and structured error suggestions.

**Tech Stack:** Node 22, TypeScript ESM, Zod, Vitest, pnpm.

---

## Locked Decisions

- Remove public `lsp_` prefixes from all MCP tool names.
- Keep the per-server result envelope for standard tools.
- Make `list_servers` workspace-aware with optional filters.
- Add `search_servers` as fuzzy/ranked discovery.
- Canonical built-in IDs should be explicit full language-server IDs.
- Configured keys are aliases for registry-backed servers and canonical for custom servers.
- Language IDs are automatic aliases, but ambiguity fails with suggestions.
- Add optional configured `serverId` override with collision validation.
- Normalize server-ID-keyed config maps, especially `commands.allow`, through canonical IDs.
- Define strict shared server output schemas.
- Treat Caplets nested array field selection as out of scope.

## Files To Modify

- `src/config/schema.ts`
- `src/registry/builtins.ts`
- `src/lsp/sessionManager.ts`
- `src/lsp/commandPolicy.ts`
- `src/tools/registerTools.ts`
- `src/tools/serverTools.ts`
- `src/tools/standardTools.ts`
- `src/tools/rawTools.ts`
- `src/tools/editTools.ts`
- `src/tools/diagnosticTools.ts`
- `src/tools/outputSchemas.ts`
- `src/tools/toolErrors.ts`
- `README.md`
- `docs/tools.md`
- `docs/config.md`
- Tests under `tests/unit/*` and `tests/integration/*`

## Files To Add

- `src/lsp/serverIdentity.ts`
- `tests/unit/serverIdentity.test.ts`

---

### Task 1: Rename Public Tools

- [ ] Change registered tool names in `src/tools/registerTools.ts`.
- [ ] Rename lifecycle tools: `lsp_list_servers` to `list_servers`, `lsp_server_status` to `server_status`, `lsp_stop_server` to `stop_server`, `lsp_stop_workspace` to `stop_workspace`.
- [ ] Rename raw tools: `lsp_request` to `request`, `lsp_notify` to `notify`, `lsp_execute_command` to `execute_command`.
- [ ] Rename diagnostics: `lsp_diagnostics` to `diagnostics`.
- [ ] Rename edit tools: `lsp_rename` to `rename`, `lsp_format_document` to `format_document`, `lsp_format_range` to `format_range`, `lsp_format_on_type` to `format_on_type`, `lsp_code_actions` to `code_actions`.
- [ ] Keep existing unprefixed standard tools unchanged.
- [ ] Update tests in `tests/unit/toolRegistration.test.ts`.
- [ ] Run `pnpm test tests/unit/toolRegistration.test.ts`.

### Task 2: Add Server Identity Model

- [ ] Create `src/lsp/serverIdentity.ts`.
- [ ] Define `ServerAliasKind` values: `configured-id`, `registry-id`, `legacy-id`, `mason`, `lspconfig`, `language-id`, `command`, `package`.
- [ ] Define `ServerAliasDetail`, `ServerIdentity`, `ServerSuggestion`, `ServerResolutionError`.
- [ ] Add helpers to build alias details, dedupe aliases, rank search matches, and format unknown/ambiguous errors.
- [ ] Include deterministic search scoring from the grilling decisions.
- [ ] Add `tests/unit/serverIdentity.test.ts`.
- [ ] Run `pnpm test tests/unit/serverIdentity.test.ts`.

### Task 3: Make Built-In Canonical IDs Explicit

- [ ] Add `serverId: string` to `BuiltInServerMetadata` and overlay types in `src/registry/builtins.ts`.
- [ ] Set explicit public IDs for every built-in.
- [ ] Use examples such as `typescript-language-server`, `vscode-json-language-server`, `pyright-langserver`, `rust-analyzer`, `yaml-language-server`, `svelte-language-server`, `intelephense`, `julia-language-server`.
- [ ] Keep existing overlay `id` as internal `registryId`.
- [ ] Ensure old registry IDs become aliases.
- [ ] Ensure Mason/lspconfig aliases remain aliases.
- [ ] Add language IDs as alias details in the identity layer, not directly into the old built-in alias map.
- [ ] Update `tests/unit/registry.test.ts`.
- [ ] Run `pnpm test tests/unit/registry.test.ts`.

### Task 4: Resolve Servers By Canonical ID And Aliases

- [ ] Refactor `LspSessionManager` to use server identity resolution.
- [ ] Make `ServerDefinition.id` the public canonical `serverId`.
- [ ] Preserve `registryId` separately for built-ins.
- [ ] Add `configuredId` when a configured key differs from canonical ID.
- [ ] Resolve exact canonical IDs first.
- [ ] Resolve exact non-language aliases when unique.
- [ ] Resolve language aliases with file/language/activation context.
- [ ] Throw structured `unknown_server` and `ambiguous_server` errors.
- [ ] Update session-manager tests for canonical IDs like `typescript-language-server`.
- [ ] Run `pnpm test tests/unit/sessionManager.test.ts`.

### Task 5: Add Optional Config `serverId`

- [ ] Add `serverId: z.string().optional()` to `lspServerSchema` in `src/config/schema.ts`.
- [ ] Validate collisions during registry/session-manager definition construction.
- [ ] Treat configured `serverId` as canonical for that configured server.
- [ ] Treat the config key as a `configured-id` alias when it differs.
- [ ] Add config tests for registry-backed override, custom override, duplicate canonical IDs, and alias collisions.
- [ ] Run `pnpm test tests/unit/config.test.ts tests/unit/sessionManager.test.ts`.

### Task 6: Normalize Command Allowlist Keys

- [ ] Update `src/lsp/commandPolicy.ts` so command allowlists can be normalized to canonical server IDs.
- [ ] Normalize `commands.allow` keys during tool registry/session-manager setup or inside command-policy lookup using the identity resolver.
- [ ] Ambiguous allowlist keys must fail closed with a clear structured or thrown config error.
- [ ] Update `tests/unit/commandPolicy.test.ts`.
- [ ] Add integration coverage through `rawTools` or `editTools` where command execution uses canonical IDs.
- [ ] Run `pnpm test tests/unit/commandPolicy.test.ts`.

### Task 7: Make `list_servers` Workspace-Aware

- [ ] Change `lspServersInputSchema` in `src/tools/serverTools.ts` to accept optional `workspaceRoot`, `filePath`, `languageId`, and `serverId`.
- [ ] In `createConfiguredToolRegistry`, workspace-aware `list_servers` must load project config when `workspaceRoot` is supplied.
- [ ] Filter by file/language without starting sessions.
- [ ] Filter by `serverId` using the same identity resolver.
- [ ] Return structured errors for unknown or ambiguous `serverId`.
- [ ] Update `tests/integration/serverTools.test.ts`.
- [ ] Run `pnpm test tests/integration/serverTools.test.ts`.

### Task 8: Add `search_servers`

- [ ] Add input schema with `query`, optional `workspaceRoot`, optional `filePath`, optional `languageId`, and optional `limit`.
- [ ] Register public tool `search_servers`.
- [ ] Search canonical IDs, configured IDs, registry IDs, aliases, command names, packages, language IDs, extensions, and upstream Mason/lspconfig names.
- [ ] Return ranked matches with `id`, `score`, `reasons`, `aliases`, `aliasDetails`, `registryId`, `configuredId`, `languageIds`, and `extensions`.
- [ ] Use activation markers and file/language context as ranking modifiers.
- [ ] Add unit tests for exact command match, Mason alias match, language ambiguity, extension match, and activation down-ranking.
- [ ] Add integration tests for `typescript-language-server` search.
- [ ] Run `pnpm test tests/unit/serverIdentity.test.ts tests/integration/serverTools.test.ts`.

### Task 9: Strict Output Schemas

- [ ] Define shared `serverInfoSchema`, `aliasDetailSchema`, and `serverSuggestionSchema` in `src/tools/outputSchemas.ts` or a small adjacent module.
- [ ] Replace `z.record(z.string(), z.unknown())` server arrays with strict `ServerInfo` schemas.
- [ ] Include `id`, `registryId`, `configuredId`, `kind`, `profile`, `command`, `configuredCommand`, `args`, `languageIds`, `extensions`, `aliases`, `aliasDetails`, `upstream`, `install`, and `running`.
- [ ] Extend structured error schemas with `serverId` and `suggestions`.
- [ ] Update schema assertions in `tests/unit/toolRegistration.test.ts`.
- [ ] Run `pnpm test tests/unit/toolRegistration.test.ts`.

### Task 10: Propagate Structured Errors

- [ ] Update `src/tools/toolErrors.ts` to preserve structured server-resolution error fields.
- [ ] Update `standardTools`, `diagnosticTools`, `editTools`, `rawTools`, and `serverTools` to return structured errors instead of plain strings when resolution fails.
- [ ] Ensure failures appear inside existing per-server/acquisition envelopes.
- [ ] Add tests for unknown and ambiguous `serverId` across at least one standard tool, one lifecycle tool, one raw tool, and one edit tool.
- [ ] Run focused tests for affected files.

### Task 11: Update Public Docs

- [ ] Update `README.md` examples to use unprefixed tool names and canonical server IDs.
- [ ] Update `docs/tools.md` with new tool names.
- [ ] Document canonical IDs, aliases, language alias ambiguity, `list_servers`, and `search_servers`.
- [ ] Update `docs/config.md` with `serverId` override and command allowlist normalization.
- [ ] Replace examples using `"serverId": "typescript"` as canonical with `"serverId": "typescript-language-server"`.
- [ ] Keep examples that intentionally demonstrate aliases clearly labeled as aliases.

### Task 12: Full Verification

- [ ] Run `pnpm run check:lsp-output-schemas`.
- [ ] Run `pnpm run lint`.
- [ ] Run `pnpm run typecheck`.
- [ ] Run `pnpm test`.
- [ ] Run `pnpm run build`.
- [ ] Run `pnpm run format:check`.
- [ ] Run `npm pack --dry-run --json`.

## Acceptance Criteria

- All public MCP tool names are unprefixed.
- `typescript-language-server` works as the canonical server ID.
- `typescript`, `ts_ls`, configured keys, and language IDs work as aliases when unambiguous.
- Ambiguous aliases fail with structured suggestions.
- `list_servers` accepts optional workspace/file/language/server filters.
- `search_servers` returns deterministic ranked matches.
- Server listing/status/search outputs use strict schemas.
- Command allowlists accept aliases but normalize to canonical IDs.
- README and docs match the new interface.
- Full repository verification passes.
