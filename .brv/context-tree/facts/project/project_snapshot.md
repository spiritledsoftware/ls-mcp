---
title: Project Snapshot
summary: Project snapshot for nimble-wizard covering TypeScript MCP/LSP server structure, docs, tools, registry, security, and tests.
tags: []
related: [facts/project/project_snapshot.md, facts/project/plan_execution_directive.md, facts/project/curated_context_notes.md]
keywords: []
createdAt: '2026-05-24T11:01:08.890Z'
updatedAt: '2026-05-25T20:38:16.984Z'
---
## Reason
Curate project snapshot and implementation context from RLM input

## Raw Concept
**Task:**
Document the project snapshot and implementation context for nimble-wizard.

**Changes:**
- Identified the main source files and test file in the repository.
- Noted the presence of planning documentation for the LSP MCP server.
- Recognized existing curated project knowledge in the context tree.
- Recorded repository name and high-level directory layout
- Recorded the semantic knowledge store location
- Recorded that the current task is RLM-based curation
- Captured project snapshot details from the context
- Preserved plan execution directives and curation notes
- Recorded repository state and workflow constraints
- Documented project snapshot details from the current context
- Preserved plan execution directives and workflow rules
- Recorded implementation observations about the working module and curation process
- Captured the current project snapshot and plan directives
- Captured the current repository structure and major implementation areas
- Preserved the docs, scripts, source modules, and test suite layout

**Files:**
- src/mcp/server.ts
- src/mcp/stdio.ts
- src/index.ts
- tests/mcp/server.test.ts
- docs/plans/lsp-mcp-server.md
- src/
- tests/
- .brv/context-tree/
- package.json
- tsconfig.json
- .brv/config.json
- src/lsp/session.ts
- src/lsp/sessionManager.ts
- src/lsp/commandPolicy.ts
- src/lsp/methodRegistry.ts
- src/lsp/transport.ts
- src/lsp/stdioTransport.ts
- docs/architecture.md
- docs/config.md
- docs/tools.md
- src/lsp/
- src/mcp/
- src/registry/
- src/security/
- src/tools/

**Flow:**
project overview -> source modules -> tooling and registry -> tests

**Timestamp:** 2026-05-25T20:38:10.408Z

**Author:** ByteRover context engine

## Narrative
### Structure
The repository centers on src/config, src/lsp, src/mcp, src/registry, src/security, src/tools, and supporting docs and tests.

### Dependencies
The curated context references architecture, configuration, tool generation, registry installation, and integration tests as the main areas of concern.

### Highlights
The project appears to be an MCP/LSP-oriented TypeScript service with dedicated docs plans and a substantial test suite.

### Rules
Use RLM approach. Do not print raw context. Do not call tools.curation.recon when pre-computed. For chunked extraction use tools.curation.mapExtract(). Pass taskId as a bare variable, not a string. Any code_exec call containing mapExtract MUST use timeout: 300000 on the code_exec tool call itself. Use tools.curation.groupBySubject() and tools.curation.dedup() to organize extractions. Verify via result.applied[].filePath — do NOT call readFile for verification.

### Examples
The curation workflow for this task is: extract facts, deduplicate them, group by subject, upsert durable context, then verify the applied file paths.

## Facts
- **project_overview**: Project is a TypeScript-based MCP/LSP server named nimble-wizard with curated docs and tests [project]
