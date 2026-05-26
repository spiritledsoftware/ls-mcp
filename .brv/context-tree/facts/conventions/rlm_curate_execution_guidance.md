---
title: RLM Curate Execution Guidance
summary: RLM curation guidance emphasizing recon-first workflow, single-pass handling for small contexts, no raw-context printing, and verification via curate results.
tags: []
related: []
keywords: []
createdAt: '2026-05-26T15:40:49.281Z'
updatedAt: '2026-05-26T18:50:45.197Z'
---
## Reason
Curate concise RLM curation execution guidance from the provided context

## Raw Concept
**Task:**
Document the required RLM curation workflow and execution constraints for context engineering tasks

**Changes:**
- Single-pass mode was selected by recon
- Mandatory variables for context, history, metadata, and task ID were provided
- Verification must use applied file paths without readFile
- Reinforces recon-first assessment and single-pass execution for small contexts
- Requires direct extraction without printing raw context
- Requires verification through curate result file paths and summary checks

**Flow:**
recon -> single-pass extraction or chunked extraction -> curate -> verify applied file paths -> report status

**Timestamp:** 2026-05-26T18:50:38.064Z

**Author:** ByteRover context engineering guidance

## Narrative
### Structure
Applies to RLM-based curation workflows for contexts that are already assessed as single-pass. It emphasizes using the precomputed recon result, skipping additional reconnaissance, and curating directly from the supplied context variables.

### Dependencies
Depends on the precomputed recon result, the curate tool, and the task/history/metadata variables provided in the curation request.

### Highlights
The context is small enough for single-pass handling. Do not print raw context, do not call recon again, and verify success from result.applied[].filePath and result.summary.

### Rules
IMPORTANT: Do NOT print raw context. Do NOT call tools.curation.recon — it has been pre-computed. Proceed directly to extraction. For chunked extraction use tools.curation.mapExtract(). Pass taskId as a bare variable. IMPORTANT: Any code_exec call containing mapExtract MUST use timeout: 300000 on the code_exec tool call itself (not inside mapExtract options). Use tools.curation.groupBySubject() and tools.curation.dedup() to organize extractions. Verify via result.applied[].filePath — do NOT call readFile for verification.
