---
title: LSP MCP Server Knowledge
summary: Project snapshot of the nimble-wizard LSP MCP server repository, including docs, source modules, and test coverage.
tags: []
related: [facts/project/lsp_mcp_server_knowledge.md, facts/project/lsp_registry_and_download_strategy.md, facts/project/lsp_output_schemas_plan_and_generation.md, facts/project/mason_backed_lsp_registry_implementation.md, facts/project/project_context_snapshot.md, facts/project/context_and_plan_execution_notes.md, facts/project/lsp_mcp_server_implementation_details.md, facts/project/verification_and_release_readiness.md]
keywords: []
createdAt: '2026-05-25T20:13:16.215Z'
updatedAt: '2026-05-26T09:53:22.593Z'
---
## Reason
Preserve the current repository snapshot as curated project knowledge

## Raw Concept
**Task:**
Document the current project context for the nimble-wizard LSP MCP server repository, including its documentation, source layout, and test coverage.

**Changes:**
- Captured architecture, config, tools, registry, and security-related project notes
- Preserved output schema generation and Mason-backed registry planning
- Recorded implementation and verification guidance from the project context
- Captured LSP MCP server implementation knowledge
- Captured LSP output schema generation planning
- Captured Mason-backed LSP registry strategy and review notes
- Captured the top-level repository layout and key directories from the working tree snapshot
- Recorded the presence of docs plans and the main TypeScript source modules
- Noted the main test suite areas for server and tool behavior

**Files:**
- docs/architecture.md
- docs/config.md
- docs/tools.md
- docs/plans/lsp-mcp-server.md
- docs/plans/2026-05-25-ci-cd.md
- docs/plans/2026-05-25-lsp-output-schemas.md
- docs/plans/2026-05-25-mason-backed-lsp-registry.md
- src/security/workspace.ts
- src/index.ts
- src/lsp/session.ts
- src/mcp/server.ts
- tests/integration/e2e.test.ts

**Flow:**
repository snapshot -> identify docs and source modules -> capture test coverage -> store curated project knowledge

**Timestamp:** 2026-05-26T09:53:07.590Z

## Narrative
### Structure
The repository is organized around docs/plans, src with config/lsp/mcp/registry/security/tools/utils, and tests with integration suites and fixtures. A .brv context tree already exists for curated knowledge, and this update adds a new fact-oriented project note.

### Dependencies
The curated note depends on the current workspace snapshot rather than runtime execution. It references existing documentation and source files to preserve the repository layout in durable knowledge.

### Highlights
This captures the repository as a TypeScript-based LSP MCP server project with substantial tooling, registry, and session management code, plus integration coverage for diagnostics, edits, commands, and startup behavior.

### Examples
Useful references include architecture, configuration, tools, and plan documents that describe the server and registry workflow.

## Facts
- **current_runtime_timestamp**: The current date and time is 2026-05-26T09:53:07.590Z [project]
- **documentation_plans**: The project contains a docs/plans folder with plans for CI/CD, LSP output schemas, mason-backed LSP registry, and an LSP MCP server document [project]
- **source_modules**: The source tree includes config, lsp, mcp, registry, security, tools, and utils modules [project]
- **test_coverage**: The project includes tests for diagnostics, document open, end-to-end, edit tools, execute command, lazy startup, raw tools, and server tools [project]
