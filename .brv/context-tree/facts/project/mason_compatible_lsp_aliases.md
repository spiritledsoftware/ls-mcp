---
title: Mason-Compatible LSP Aliases
summary: Built-in LSP server IDs should accept Mason/lspconfig-compatible aliases, expose aliases in listings, and keep canonical opencode IDs as primary.
tags: []
related: []
keywords: []
createdAt: '2026-05-25T19:46:08.028Z'
updatedAt: '2026-05-25T19:46:08.028Z'
---
## Reason
Capture the alias model decision and implementation plan for built-in LSP registry names

## Raw Concept
**Task:**
Document the decision to make built-in LSP aliases match Mason.nvim and lspconfig naming conventions

**Changes:**
- Accepted Mason-style aliasing for server registry lookup
- Defined compatibility mappings for existing shipped IDs
- Outlined implementation updates for metadata, resolution, tests, config, and listings

**Flow:**
canonical built-in ID -> alias resolution -> validation -> listing output

**Timestamp:** 2026-05-25T19:45:50.580Z

**Author:** user and assistant

## Narrative
### Structure
The implementation plan keeps opencode canonical IDs primary while layering Mason/lspconfig-compatible aliases over registry lookup and displayed metadata.

### Dependencies
Requires built-in metadata changes, resolution logic updates, duplicate alias tests, config parsing support, and listing/status output updates.

### Highlights
Examples include lua_ls -> lua-ls, bashls -> bash, ts_ls -> typescript, rust_analyzer -> rust, yamlls -> yaml-ls, terraformls -> terraform, prismals -> prisma, clojure_lsp -> clojure-lsp, ocamllsp -> ocaml-lsp, ruby_lsp -> ruby-lsp, vue_ls -> vue, denols -> deno, elixirls -> elixir-ls, and hls as a special canonical choice consideration. Docs and lsp_list_servers should prefer canonical opencode IDs plus Mason aliases rather than inventing new aliases.

## Facts
- **lsp_alias_model**: The alias model should mirror mason-lspconfig by accepting Neovim lspconfig server names as aliases for the underlying registry entry. [project]
- **canonical_server_ids**: Canonical built-in IDs stay aligned to opencode documented IDs, while registry lookup also accepts Mason/lspconfig aliases. [project]
- **compatibility_aliases**: Existing shipped IDs should continue to resolve, including go -> gopls, python -> pyright, and yaml -> yaml-ls. [project]
- **builtin_metadata_aliases**: Built-in metadata should include an aliases array. [project]
- **server_resolution**: Server resolution should use getBuiltInServer(idOrAlias) to resolve both canonical IDs and aliases. [project]
- **alias_validation**: Duplicate-alias validation should be added in tests so no alias resolves ambiguously. [project]
- **config_alias_input**: Config should accept both registry: lua_ls and registry: lua-ls. [project]
- **server_listing_output**: Status and list output should expose aliases. [project]
- **alias_documentation**: Aliases should be documented as Mason/lspconfig-compatible aliases. [project]
