---
title: RLM Curation Execution Guidance
summary: RLM curation task with precomputed single-pass recon, strict no-raw-context output, mapExtract timeout requirement, and verification via applied file paths.
tags: []
related: []
keywords: []
createdAt: '2026-05-26T16:15:00.730Z'
updatedAt: '2026-05-26T16:15:00.730Z'
---
## Reason
Capture the execution constraints and workflow for this curation task.

## Raw Concept
**Task:**
Document the execution requirements for the current RLM curation task.

**Changes:**
- Recorded the precomputed single-pass recon guidance
- Captured the no-raw-context and no-recon-call constraints
- Recorded the mapExtract timeout and verification requirements

**Flow:**
Precomputed recon -> direct extraction -> organize with dedup/groupBySubject -> curate -> verify via applied file paths

**Timestamp:** 2026-05-26T16:14:42.621Z

**Author:** ByteRover context engineer

## Narrative
### Structure
This note captures the execution constraints for the current curation request, including the recommended single-pass mode and the required verification path.

### Dependencies
Depends on the precomputed recon result and the sandbox curation helpers for extraction organization.

### Highlights
The task explicitly forbids printing raw context, forbids calling tools.curation.recon again, and requires a 300000 ms timeout for any mapExtract call.

### Rules
Do NOT print raw context. Do NOT call tools.curation.recon. For any code_exec call containing mapExtract, use timeout 300000 on the code_exec call itself. Verify via result.applied[].filePath and do NOT call readFile for verification.

## Facts
- **curation_workflow**: The curation workflow uses an RLM approach with a precomputed recon result. [convention]
- **suggested_mode**: The suggested mode for this context is single-pass. [convention]
- **suggested_chunk_count**: The suggested chunk count for this context is 1. [convention]
- **context_size**: The context is 593 characters long and spans 10 lines with 0 messages. [project]
- **curation_constraints**: The task instructs not to print raw context or call tools.curation.recon because recon is precomputed. [convention]
- **mapextract_timeout**: The task instructs any code_exec call containing mapExtract to use a 300000 ms timeout. [convention]
- **extraction_organization**: The task instructs using tools.curation.groupBySubject() and tools.curation.dedup() to organize extractions. [convention]
- **verification_method**: Verification must use result.applied[].filePath and must not call readFile for verification. [convention]
