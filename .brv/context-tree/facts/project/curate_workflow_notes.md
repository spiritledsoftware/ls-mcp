---
title: Curate Workflow Notes
summary: RLM curation workflow guidance covering single-pass extraction, no raw-context printing, UPSERT-based curation, and verification via applied file paths.
tags: []
related: []
keywords: []
createdAt: '2026-05-26T13:32:59.315Z'
updatedAt: '2026-05-26T13:32:59.315Z'
---
## Reason
Capture RLM curation workflow and verification instructions from the provided context

## Raw Concept
**Task:**
Document the RLM curation workflow guidance and operational constraints

**Changes:**
- Use precomputed recon and proceed directly when suggestedMode is single-pass
- Do not print raw context during curation
- Verify curated output via result.applied[].filePath

**Flow:**
recon -> extraction -> dedup/group -> curate -> verify

**Timestamp:** 2026-05-26T13:32:50.879Z

**Author:** ByteRover context engineer

## Narrative
### Structure
Guidance covers how to handle RLM curation inputs, including direct single-pass handling for small contexts and chunked extraction only when suggested.

### Dependencies
Depends on precomputed recon, tools.curation helpers, and tools.curate UPSERT operations.

### Highlights
Emphasizes efficiency, no raw context logging, and verification by applied file paths rather than rereading files.

### Rules
Do not print raw context. Do not call tools.curation.recon when it has already been computed. For mapExtract calls, set timeout on the code_exec call itself. Verify via result.applied[].filePath.

## Facts
- **curate_workflow**: The following is a conversation between a user and an AI assistant. [project]
- **curate_workflow**: Curate only information with lasting value: facts, decisions, technical details, preferences, or notable outcomes. [project]
- **curate_workflow**: Skip trivial messages such as greetings, acknowledgments ("ok", "thanks", "sure", "got it"), one-word replies, anything with no substantive content. [project]
- **curate_workflow**: Conversation: [project]
- **curate_workflow**: [user]: Reasoning effort set to medium [project]
- **curate_workflow**: [assistant]: I’ll inspect the Task 4 identity-resolution implementation and related tests only, without editing files, then return a spec-compliance verdict. [project]
- **curate_workflow**: [assistant]: The relevant implementation is concentrated in `src/lsp/serverIdentity.ts` and `src/lsp/sessionManager.ts`, with dedicated unit coverage in `tests/unit/serverIdentity.test.ts` and `tests/unit/sessionManager.test.ts`. [project]
- **curate_workflow**: [assistant]: I found one interaction to validate: `server_status` resolves contextual language aliases for server definitions, then re-resolves the raw `serverId` without that context when collecting active sessions. I’m running the focused identity/session/server-tool tests to confirm the current suite coverage. [project]
- **curate_workflow**: [assistant]: STATUS: CHANGES_REQUESTED [project]
- **curate_workflow**: FINDINGS: [project]
- **curate_workflow**: - `src/tools/serverTools.ts:57-63` and `src/lsp/sessionManager.ts:323-328`: `server_status` first resolves `serverId` with `filePath`/`languageId` context via `listServerStatuses`, but then calls `listActiveSessions({ serverId: parsed.serverId })`, which re-resolves the raw ID without context. For language aliases like `javascript`, this can throw `ServerResolutionError` `ambiguous_server` even when the contextual `listServerStatuses` resolution succeeded. This violates the Task 4 requirement that language aliases resolve with file/language/activation context for runtime status output. [project]
- **curate_workflow**: TESTS_REVIEWED: [project]
- **curate_workflow**: - `tests/unit/serverIdentity.test.ts`: covers alias details, ranking, structured unknown/ambiguous errors. [project]
- **curate_workflow**: - `tests/unit/sessionManager.test.ts`: covers canonical IDs, configuredId/registryId/aliasDetails exposure, exact aliases, contextual language alias resolution in `listServerStatuses`/file sessions. [project]
- **curate_workflow**: - `tests/integration/serverTools.test.ts`: covers runtime output for canonical/configured IDs, but not contextual language-alias `server_status`. [project]
- **curate_workflow**: - Focused suite run: `pnpm test tests/unit/serverIdentity.test.ts tests/unit/sessionManager.test.ts tests/integration/serverTools.test.ts` passed, `3` files and `48` tests. [project]
