# Changelog

## 0.2.0

### Minor Changes

- e78cbd5: Add generated MCP output schemas for LSP tools so clients can inspect and filter structured responses.

## 0.1.3

### Patch Changes

- 9b445dc: Improve README onboarding with a polished header, package badges, npm-based MCP configuration, and Caplets guidance for agent workflows.
- 693ccc5: Improve MCP tool ergonomics with `lsp_list_servers`, partial standard-tool acquisition results, `strict` mode, and safer `workspace_symbols` server targeting.

## 0.1.2

### Patch Changes

- 17dbb27: Snake case naming for tools

## 0.1.1

### Patch Changes

- 2e43f09: Add Changesets release automation and GitHub Actions CI/CD workflows.

## 0.1.0

Initial implementation of `lsp-mcp`.

- Added a stdio MCP server that exposes Language Server Protocol capabilities through MCP tools.
- Added LSP session management, stdio transport support, diagnostics, document lifecycle operations, standard language features, raw LSP calls, and edit application controls.
- Added configuration support for built-in and custom language servers, workspace safety defaults, command policy controls, lazy startup, idle shutdown, and managed server downloads.
- Added user documentation for configuration, tools, and architecture.
