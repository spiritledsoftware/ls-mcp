---
title: Curation Context and Verification Notes
summary: RLM curation context describing the current single-pass extraction path, verification expectations, and the requirement to use the supplied variables and task ID.
tags: []
related: []
keywords: []
createdAt: '2026-05-26T10:28:23.659Z'
updatedAt: '2026-05-26T10:28:23.659Z'
---
## Reason
Preserve the curation workflow instructions, verification requirements, and context details from the provided RLM input.

## Raw Concept
**Task:**
Document the supplied RLM curation instructions and operational constraints for this session.

**Changes:**
- Recorded the precomputed recon result and single-pass execution path.
- Captured the requirement to avoid printing raw context.
- Captured the timeout and taskId handling rules for mapExtract.
- Captured the verification rule to rely on result.applied[].filePath.

**Flow:**
recon precomputed -> single-pass extraction -> curate -> verify applied file paths

**Timestamp:** 2026-05-26T10:28:11.650Z

**Author:** ByteRover curation workflow

## Narrative
### Structure
This note records the session-specific curation instructions, including variable names for context, history, metadata, and task ID, plus the recon recommendation to proceed directly without chunking.

### Dependencies
Depends on the precomputed __recon_result_* value and the supplied sandbox variables; if mapExtract is ever used, the code_exec timeout must be set to 300000.

### Highlights
The context is small enough for single-pass processing. The instruction set explicitly forbids printing raw context and forbids using readFile for verification.

## Facts
- **curation_mode**: The curation request uses the RLM approach with precomputed recon and a single-pass mode. [project]
- **context_size**: The provided context variable contains 1831 characters and 45 lines with 0 messages. [project]
- **task_id_passing**: The task ID must be passed as a bare variable to mapExtract when used. [convention]
- **mapextract_timeout**: Any code_exec call containing mapExtract must use timeout: 300000 on the code_exec tool call itself. [convention]
- **verification_method**: Verification should use result.applied[].filePath and must not call readFile for verification. [convention]
