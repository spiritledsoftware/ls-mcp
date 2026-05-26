---
title: LSP MCP Server Implementation Details
summary: Implementation notes for the LSP MCP server covering transport, session management, diagnostics, edits, capabilities, command policy, and result normalization.
tags: []
related: [facts/project/project_context_snapshot.md, facts/project/context_and_plan_execution_notes.md, facts/project/lsp_mcp_server_knowledge.md, facts/project/verification_and_release_readiness.md]
keywords: []
createdAt: '2026-05-24T21:20:18.489Z'
updatedAt: '2026-05-25T20:31:25.328Z'
---
## Reason
Curate implementation details from the provided context into durable project knowledge

## Raw Concept
**Task:**
Document the implementation details and repository coverage for the LSP MCP server project.

**Changes:**
- Added lazy local stdio LSP session management with idle shutdown
- Added JSON and JSONC user and project config loading
- Added managed on-demand LSP server registry with filesystem-backed locking
- Added diagnostics, edit/apply, command execution, raw request/notify, and server lifecycle tools
- Added MCP registration for implemented handlers
- Captured the project module layout for LSP, MCP, registry, security, tools, and utilities.
- Captured the available test suite and documentation plans relevant to the server implementation.

**Files:**
- src/lsp/session.ts
- src/registry/locks.ts
- src/security/workspace.ts
- src/tools/diagnosticTools.ts
- src/tools/editTools.ts
- src/tools/rawTools.ts
- src/tools/serverTools.ts
- src/tools/registerTools.ts
- src/lsp/capabilities.ts
- src/lsp/commandPolicy.ts
- src/lsp/diagnosticStore.ts
- src/lsp/documentStore.ts
- src/lsp/editApplier.ts
- src/lsp/methodRegistry.ts
- src/lsp/resultNormalization.ts
- src/lsp/sessionManager.ts
- src/lsp/stdioTransport.ts
- src/lsp/transport.ts
- src/mcp/server.ts
- src/mcp/stdio.ts
- src/registry/builtins.ts
- src/registry/githubInstaller.ts
- src/registry/installer.ts
- src/registry/masonSnapshot.ts
- src/registry/npmInstaller.ts
- docs/plans/2026-05-25-ci-cd.md
- docs/plans/2026-05-25-lsp-output-schemas.md
- docs/plans/2026-05-25-mason-backed-lsp-registry.md
- docs/plans/lsp-mcp-server.md
- tests/integration/diagnostics.test.ts
- tests/integration/documentOpen.test.ts
- tests/integration/e2e.test.ts
- tests/integration/editTools.test.ts
- tests/integration/executeCommand.test.ts
- tests/integration/lazyStartup.test.ts
- tests/integration/rawTools.test.ts
- tests/integration/serverTools.test.ts
- tests/integration/session.test.ts
- tests/integration/standardTools.test.ts

**Flow:**
docs/plans and source modules -> LSP/MCP implementation -> registry and tool generation -> integration tests

**Timestamp:** 2026-05-25T20:31:12.848Z

**Author:** assistant

## Narrative
### Structure
The repository is organized around src/lsp for language-server behavior, src/mcp for MCP transport/server wiring, src/registry for installation and snapshot logic, src/security for workspace safety, and src/tools/generated for tool wrappers and schemas.

### Dependencies
The implementation depends on generated schemas/tools, registry installers, session and document stores, and workspace security checks to safely expose LSP behavior through MCP.

### Highlights
The project has dedicated integration coverage for diagnostics, document opening, end-to-end flows, edits, command execution, lazy startup, raw/server tools, sessions, and standard tools.

### Rules
No commit was made.

### Examples
Useful touchpoints include the LSP transport/session pipeline, the registry installers and Mason snapshot support, and the docs/plans covering CI/CD and output schema generation.

## Facts
- **lsp_mcp_server_stack**: The project includes an LSP MCP server implementation with supporting LSP, MCP, registry, security, and tools modules. [project]
- **lsp_module_coverage**: The source tree includes LSP modules for capabilities, command policy, diagnostic store, document store, edit applier, method registry, result normalization, session, session manager, stdio transport, and transport. [project]
- **mcp_module_coverage**: The source tree includes MCP modules for server and stdio handling. [project]
- **registry_module_coverage**: The source tree includes registry modules for builtins, GitHub installer, installer, locks, Mason snapshot, and npm installer. [project]
- **tool_module_coverage**: The source tree includes generated tool modules for diagnostic tools, edit tools, output schemas, raw tools, register tools, server tools, standard tools, tool errors, and tool schemas. [project]
- **docs_plans_coverage**: The repository contains docs/plans files for CI/CD, LSP output schemas, Mason-backed LSP registry, and an LSP MCP server plan. [project]
- **test_coverage**: The repository contains tests for diagnostics, document open, end-to-end behavior, edit tools, execute command, lazy startup, raw tools, server tools, session, and standard tools. [project]
- **current_runtime_timestamp**: The current date in the provided context is 2026-05-25T20:31:12.848Z. [project]
