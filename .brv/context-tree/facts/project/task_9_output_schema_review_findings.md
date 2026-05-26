---
title: Task 9 Output Schema Review Findings
summary: 'Task 9 review findings: raw server config may leak through list_servers/server_status, server output schemas are not strict, and some new schema fields are broader than needed.'
tags: []
related: []
keywords: []
createdAt: '2026-05-26T16:41:08.014Z'
updatedAt: '2026-05-26T16:41:08.014Z'
---
## Reason
Preserve durable review findings about output schema strictness and server info exposure.

## Raw Concept
**Task:**
Document the important findings from the Task 9 review of output schema changes and server output handling

**Changes:**
- Observed a high-severity concern that list_servers and server_status may expose raw internal server config, including env and other sensitive fields
- Observed a medium-severity issue that the list_servers registered output schema is not strict or discriminated
- Observed a low-severity issue that newly added schema fields use broader types than needed

**Files:**
- src/tools/outputSchemas.ts
- src/tools/serverTools.ts
- src/lsp/sessionManager.ts
- tests/unit/toolRegistration.test.ts

**Flow:**
review implementation -> identify schema and server output risks -> verify tests -> record actionable findings

**Timestamp:** 2026-05-26T16:40:55.601Z

**Author:** assistant

## Narrative
### Structure
The review centered on output schema definitions and server response shaping, with tests covering only part of the new validation surface.

### Dependencies
The findings depend on server status objects, output schema definitions, and the strictness expectations from Task 9.

### Highlights
The most important risk is exposing internal server config through public server info responses; strict schemas and explicit shaping are recommended.
