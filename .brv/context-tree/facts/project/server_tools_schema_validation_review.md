---
title: Server Tools Schema Validation Review
summary: Review findings for server tool schemas and public server info validation, including verified raw config stripping and test coverage.
tags: []
related: []
keywords: []
createdAt: '2026-05-26T16:47:20.579Z'
updatedAt: '2026-05-26T16:47:20.579Z'
---
## Reason
Curate the implementation review findings, verified fixes, and test results from the provided context.

## Raw Concept
**Task:**
Document findings from a review of server tool output schemas and server info sanitization

**Changes:**
- Identified two schema breadth issues that remain unvalidated
- Verified raw config leakage is fixed in implementation
- Confirmed strict success/error branching in lspServersSchema
- Recorded passing test results for tool registration and server tools tests

**Files:**
- src/tools/outputSchemas.ts
- src/lsp/sessionManager.ts
- src/registry/masonSnapshot.ts
- src/tools/serverTools.ts
- tests/unit/toolRegistration.test.ts
- tests/integration/serverTools.test.ts

**Flow:**
review implementation -> identify schema breadth risks -> verify sanitization -> confirm tests pass

**Timestamp:** 2026-05-26T16:46:59.327Z

**Author:** assistant

## Narrative
### Structure
The review distinguishes between remaining validation gaps and already verified implementation fixes. It points to the schema definitions, emitted server info shapes, and test coverage.

### Dependencies
The findings depend on the known emitted shapes from sessionManager and masonSnapshot, plus the public server info sanitizer in serverTools.

### Highlights
Two medium-severity issues remain: upstream schema breadth and session schema breadth. Raw config leakage appears fixed, and the relevant tests passed.

### Rules
Success requires { ok: true, servers }; error requires { ok: false, error }; both branches are strict.

### Examples
Test command: pnpm test tests/unit/toolRegistration.test.ts tests/integration/serverTools.test.ts

## Facts
- **server_info_upstream_schema**: serverInfoSchema.upstream is still z.unknown() even though the emitted upstream shape is known. [project]
- **server_status_sessions_schema**: serverStatusOutputSchema.sessions accepts arbitrary records instead of the fixed session shape emitted by toSessionInfo. [project]
- **public_server_info_sanitization**: toServerInfo strips downloads and raw server before returning public server info. [project]
- **server_status_sanitization**: server_status also maps servers through the same sanitizer. [project]
- **lsp_servers_schema_strictness**: lspServersSchema is strict for the success/error split. [project]
- **test_results**: Tests passed for tests/unit/toolRegistration.test.ts and tests/integration/serverTools.test.ts. [project]
