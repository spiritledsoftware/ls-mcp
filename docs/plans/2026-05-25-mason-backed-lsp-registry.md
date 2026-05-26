# Mason-Backed LSP Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` or `executing-plans` to implement this task-by-task. Follow test-driven development for behavior changes.

## Goal

Support the LSP servers documented by opencode out of the box while avoiding a fully hand-written and quickly stale registry. Use Mason registry data as an upstream development-time source for package metadata and aliases, but keep `language-server-mcp`'s runtime registry deterministic, offline, and product-owned.

## Locked Decisions

| Area             | Decision                                                                                                                                             |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canonical IDs    | Use opencode LSP server IDs as the primary built-in server IDs.                                                                                      |
| Aliases          | Use Mason/nvim-lspconfig names as aliases where Mason provides `neovim.lspconfig`.                                                                   |
| Runtime behavior | Do not fetch Mason registry data at runtime.                                                                                                         |
| Snapshot         | Commit hand-curated static Mason metadata so runtime behavior is deterministic and offline.                                                          |
| Product behavior | Keep canonical IDs, command, args, extensions, activation rules, root markers, install policy, and compatibility aliases in a hand-authored overlay. |
| Mason role       | Treat Mason data as enrichment: package names, versions, source metadata, and lspconfig aliases.                                                     |
| Installer scope  | Add only the installer adapters needed for selected supported built-ins. Do not implement the entire Mason installer runtime.                        |
| Downloads        | No runtime `latest` lookups. Downloads must use pinned snapshot versions and deterministic URLs or package versions.                                 |
| Existing aliases | Preserve current compatibility aliases: `go`, `python`, and `yaml`.                                                                                  |

## Target Architecture

The built-in registry is assembled from three layers:

1. **Core overlay**: hand-authored opencode-compatible server behavior.
2. **Mason snapshot**: hand-curated static metadata from selected Mason package specs.
3. **Installer adapters**: npm first, selected archive/download support, and system-only fallback where needed.

The overlay remains the source of truth for what `language-server-mcp` supports and how each LSP server starts. The Mason snapshot supplies upstream package information without controlling runtime behavior.

## Supported Server Coverage

Support opencode's documented LSP set:

- `astro`
- `bash`
- `clangd`
- `csharp`
- `clojure-lsp`
- `dart`
- `deno`
- `elixir-ls`
- `eslint`
- `fsharp`
- `gleam`
- `gopls`
- `hls`
- `jdtls`
- `julials`
- `kotlin-ls`
- `lua-ls`
- `nixd`
- `ocaml-lsp`
- `oxlint`
- `php intelephense`
- `prisma`
- `pyright`
- `razor`
- `ruby-lsp`
- `rust`
- `sourcekit-lsp`
- `svelte`
- `terraform`
- `tinymist`
- `typescript`
- `vue`
- `yaml-ls`
- `zls`

Keep `json` as an existing additional built-in because it already ships and is useful, even though it is not in the opencode LSP table.

## Alias Policy

Use Mason/nvim-lspconfig aliases when available. Examples include:

- `astro` -> `astro`
- `bashls` -> `bash`
- `clangd` -> `clangd`
- `clojure_lsp` -> `clojure-lsp`
- `denols` -> `deno`
- `elixirls` -> `elixir-ls`
- `fsautocomplete` -> `fsharp`
- `gopls` -> `gopls`
- `hls` -> `hls`
- `jdtls` -> `jdtls`
- `julials` -> `julials`
- `lua_ls` -> `lua-ls`
- `ocamllsp` -> `ocaml-lsp`
- `oxlint` -> `oxlint`
- `intelephense` -> `php intelephense`
- `prismals` -> `prisma`
- `pyright` -> `pyright`
- `ruby_lsp` -> `ruby-lsp`
- `rust_analyzer` -> `rust`
- `svelte` -> `svelte`
- `terraformls` -> `terraform`
- `tinymist` -> `tinymist`
- `ts_ls` -> `typescript`
- `vue_ls` -> `vue`
- `yamlls` -> `yaml-ls`
- `zls` -> `zls`

Preserve existing compatibility aliases:

- `go` -> `gopls`
- `python` -> `pyright`
- `yaml` -> `yaml-ls`

## Activation Rules

Add activation filtering so optional and overlapping servers do not start noisily. Examples:

- Deno should only activate when `deno.json` or `deno.jsonc` is present.
- TypeScript should avoid Deno workspaces.
- ESLint should only activate when an ESLint dependency/config signal is present.
- Oxlint should only activate when an Oxlint dependency/config signal is present.
- Framework servers such as Astro, Svelte, Vue, Prisma, and Terraform should prefer project markers when practical.
- System-tool servers should report a clear not-applicable or not-installed state instead of failing unrelated file-targeted calls.

## Implementation Tasks

### Task 1: Registry Plan and Tests

Write this plan to `docs/plans/2026-05-25-mason-backed-lsp-registry.md`. Add failing tests for alias resolution, expected server coverage, duplicate alias rejection, and compatibility aliases before production changes.

### Task 2: Mason Snapshot and Overlay

Add a hand-curated static Mason snapshot module and a hand-authored server overlay. The overlay defines canonical server behavior; the snapshot enriches it with Mason package names, package versions, source metadata, and lspconfig aliases.

### Task 3: Built-In Registry Assembly and Activation Filtering

Merge overlay plus snapshot into built-in metadata. Implement `getBuiltInServer(idOrAlias)` alias resolution. Add activation rules and apply them before matching file-targeted servers so irrelevant optional servers do not create noisy failures.

### Task 4: Installer Adapter Support

Extend install strategies only as needed for selected supported built-ins. Preserve current npm behavior. Add deterministic archive/download support for selected pinned assets where practical, and leave unsupported ecosystems as system-only with clear status messages.

### Task 5: Status and Documentation

Expose aliases and upstream Mason metadata in server list/status output. Update README and config docs with built-in coverage, aliases, activation behavior, downloads, and system-only notes. Add a changeset.

### Task 6: Verification and Review

Run full verification:

```sh
pnpm run lint
pnpm run typecheck
pnpm test
pnpm run build
pnpm run format:check
```

Request final code review after all tasks pass.

## Guardrails

- Do not perform runtime fetches from Mason.
- Do not use unpinned runtime `latest` downloads.
- Do not implement the full Mason installer runtime.
- Do not remove existing built-ins or compatibility aliases without a migration reason.
- Do not make activation filtering block explicit `serverId` targeting unless the server is truly unknown.

## Expected Outcome

`language-server-mcp` supports opencode's built-in LSP server set with Mason-compatible aliases, deterministic package metadata, less hand-maintained registry drift, and clear behavior for managed, system-only, and activation-gated servers.
