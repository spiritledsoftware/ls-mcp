---
title: Context Notes
summary: RLM curation workflow guidance covering recon, single-pass extraction, curation, and verification requirements
tags: []
related: []
keywords: []
createdAt: '2026-05-26T13:09:06.759Z'
updatedAt: '2026-05-26T13:09:06.759Z'
---
## Reason
Curate RLM curation workflow guidance from provided context

## Raw Concept
**Task:**
Document RLM curation workflow guidance for context engineering tasks

**Changes:**
- Captured single-pass curation guidance
- Preserved verification and summary requirements
- Recorded context-aware extraction and curation workflow

**Flow:**
recon -> single-pass extraction -> curate -> verify applied files -> record progress

**Timestamp:** 2026-05-26T13:08:57.811Z

**Author:** ByteRover context engineering guidance

## Narrative
### Structure
This guidance explains how to curate context using the RLM approach, including recon, extraction, curation, and verification steps. It emphasizes using the pre-computed recon result when suggestedMode is single-pass and avoiding unnecessary chunking.

### Dependencies
Requires sandbox variables for context, history, metadata, and task ID. Verification must rely on applied file paths rather than readFile checks.

### Highlights
The workflow prioritizes direct execution, compact reasoning, and preservation of structured facts, rawConcept, and narrative content.

### Rules
Do NOT print raw context. Do NOT call tools.curation.recon when recon is already pre-computed. For chunked extraction, pass taskId as a bare variable and set timeout: 300000 on the code_exec call itself. Verify via result.applied[].filePath and do NOT call readFile for verification.

## Facts
- **curation_guidance**: -- [project]
- **curation_guidance**: Use TDD: update session-manager tests first and run to fail, then implement. Use pnpm only. Do not commit. [project]
- **curation_guidance**: Refactor LspSessionManager to use server identity resolution from src/lsp/serverIdentity.ts. [project]
- **curation_guidance**: Make ServerDefinition.id the public canonical serverId. [project]
- **curation_guidance**: Preserve registryId separately for built-ins. [project]
- **curation_guidance**: Add configuredId when a configured key differs from canonical ID. [project]
- **curation_guidance**: Resolve exact canonical IDs first. [project]
- **curation_guidance**: Resolve exact non-language aliases when unique. [project]
- **curation_guidance**: Resolve language aliases with file/language/activation context. [project]
- **curation_guidance**: Throw structured unknown_server and ambiguous_server errors using ServerResolutionError. [project]
- **curation_guidance**: Update session-manager tests for canonical IDs like typescript-language-server. [project]
- **curation_guidance**: Ensure listServers/listServerStatuses expose id as canonical serverId, registryId as old internal built-in ID, configuredId where applicable, aliases and aliasDetails where possible. [project]
- **curation_guidance**: Task 5 will add config serverId override, so do not implement config serverId yet unless absolutely required. [project]
- **curation_guidance**: Preserve configured registry-backed keys as aliases, but for now canonical for registry-backed configured servers should come from metadata.serverId. [project]
- **curation_guidance**: Fully custom servers without registry metadata remain canonical by configured key. [project]
- **curation_guidance**: Existing behavior that starts matching servers by file/language should keep working. [project]
- **curation_guidance**: Deno activation behavior should remain intact. [project]
- **curation_guidance**: pnpm test tests/unit/sessionManager.test.ts [project]
- **curation_guidance**: pnpm test tests/integration/serverTools.test.ts [project]
- **curation_guidance**: pnpm run typecheck [project]
