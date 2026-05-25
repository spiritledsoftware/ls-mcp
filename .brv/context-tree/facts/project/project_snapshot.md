---
title: Project Snapshot
summary: Project snapshot and execution directives for the lsp-mcp server, including current implementation status and planned work.
tags: []
related: [facts/project/project_snapshot.md, facts/project/plan_execution_directive.md, facts/project/curated_context_notes.md]
keywords: []
createdAt: '2026-05-24T11:01:08.890Z'
updatedAt: '2026-05-24T18:27:47.831Z'
---
## Reason
Curate project snapshot and planning directives from provided context

## Raw Concept
**Task:**
Document the current project snapshot and execution directives for the lsp-mcp repository

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

**Flow:**
project context -> snapshot -> execution directives -> implementation guidance

**Timestamp:** 2026-05-24T18:27:41.799Z

**Author:** ByteRover context engineering

## Narrative
### Structure
The context describes the project snapshot and a directive-oriented plan for the lsp-mcp server.

### Dependencies
References the project plan document as the source of current status and directives.

### Highlights
Captures the project state and execution guidance in a concise durable form.

### Rules
Use RLM approach. Do not print raw context. Do not call tools.curation.recon when pre-computed. For chunked extraction use tools.curation.mapExtract(). Pass taskId as a bare variable, not a string. Any code_exec call containing mapExtract MUST use timeout: 300000 on the code_exec tool call itself. Use tools.curation.groupBySubject() and tools.curation.dedup() to organize extractions. Verify via result.applied[].filePath — do NOT call readFile for verification.

### Examples
The curation workflow for this task is: extract facts, deduplicate them, group by subject, upsert durable context, then verify the applied file paths.

## Facts
- **project_name**: The repository is lsp-mcp. [project]
- **project_focus**: The current focus is an LSP MCP server implementation. [project]
