---
title: Nimble Wizard Project Context
summary: Project context for the Nimble Wizard codebase, including its LSP/MCP server focus, repository layout, and knowledge curation workflow.
tags: []
related: []
keywords: []
createdAt: '2026-05-26T09:55:01.381Z'
updatedAt: '2026-05-26T15:12:47.882Z'
---
## Reason
Curate the provided project context into durable knowledge

## Raw Concept
**Task:**
Document the current Nimble Wizard project context and the instructions embedded in the curation payload.

**Changes:**
- Identified the project as a Nimble Wizard LSP MCP server
- Recorded core capabilities around LSP diagnostics, edits, document handling, and raw tool access
- Captured the runtime timestamp and documentation scope
- Captured the repository structure and major source modules
- Recorded documentation plans related to CI/CD, LSP schemas, and the Mason-backed registry
- Noted the existing curated knowledge areas already present in the context tree
- Identified the repository as a TypeScript-based CLI/server focused on LSP and MCP tooling
- Recorded the main source tree modules and documentation plans
- Noted the current curated knowledge coverage already present in the context tree
- Captured the project as an LSP/MCP server codebase with curated knowledge support.
- Recorded the curation workflow requirements for single-pass RLM processing.
- Preserved the context-tree and verification constraints supplied in the task.

**Files:**
- docs/architecture.md
- docs/config.md
- docs/tools.md
- docs/plans/2026-05-25-ci-cd.md
- docs/plans/2026-05-25-lsp-output-schemas.md
- docs/plans/2026-05-25-mason-backed-lsp-registry.md
- docs/plans/lsp-mcp-server.md
- src/config/loadConfig.ts
- src/lsp/
- src/mcp/
- src/registry/
- src/security/workspace.ts
- src/tools/
- src/utils/
- src/lsp/capabilities.ts
- src/mcp/server.ts
- src/registry/builtins.ts
- src/tools/registerTools.ts
- docs/plans/2026-05-26-lsp-mcp-interface-cleanup.md
- .brv/context-tree/
- docs/
- src/
- tests/

**Flow:**
context provided -> extract durable facts -> upsert curated knowledge -> verify applied file path

**Timestamp:** 2026-05-26T15:12:37.945Z

**Author:** ByteRover context engineering workflow

## Narrative
### Structure
The repository includes docs, src, scripts, tests, and a .brv/context-tree used for curated knowledge. The context tree already contains many LSP, MCP, and curation-related topics under facts/project.

### Dependencies
Curation must follow the RLM workflow, avoid printing raw context, and verify the applied result without reading files back for confirmation.

### Highlights
The supplied context is small enough for single-pass processing, and the task explicitly requires direct extraction and curation with verification via applied file paths.

### Rules
Do NOT print raw context. Do NOT call tools.curation.recon. Proceed directly to extraction. Use tools.curation.mapExtract() for chunked extraction only when needed. Verify via result.applied[].filePath.

### Examples
The curated knowledge can be used as a durable snapshot of the project layout, the curation workflow, and the current date/time at the moment of processing.

## Facts
- **project_scope**: The project is a Nimble Wizard LSP/MCP server codebase with curated knowledge already present in the context tree. [project]
