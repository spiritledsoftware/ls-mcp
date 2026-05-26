---
title: RLM Curation Workflow Guidance
summary: RLM curation uses single-pass processing when suggested, prefers UPSERT, and verifies applied file paths rather than rereading files.
tags: []
related: []
keywords: []
createdAt: '2026-05-26T10:51:08.735Z'
updatedAt: '2026-05-26T19:32:46.985Z'
---
## Reason
Curate the current RLM curation instructions and verification conventions from the provided context

## Raw Concept
**Task:**
Curate the provided context using the RLM approach

**Changes:**
- Use precomputed recon results when available
- Proceed directly to extraction for single-pass contexts
- Organize extractions with deduplication and subject grouping
- Enforce timeout 300000 for code_exec calls containing mapExtract
- Verify curated files via result.applied[].filePath
- Confirmed single-pass processing for the current context.
- Captured the no-rerun recon rule for precomputed contexts.
- Captured the mapExtract timeout requirement and verification rule.
- Use single-pass RLM processing when recon suggests single-pass
- Prefer UPSERT for curation operations
- Verify curation through result.applied[].filePath

**Files:**
- .brv/context-tree/facts/conventions/context.md

**Flow:**
recon already computed -> extract key facts -> dedup/group -> curate -> verify applied file paths

**Timestamp:** 2026-05-26T19:32:39.707Z

**Author:** ByteRover context engineer

## Narrative
### Structure
This guidance documents the curation workflow conventions used in the project context tree.

### Dependencies
Depends on the RLM flow and the curated knowledge store under .brv/context-tree.

### Highlights
The context emphasizes single-pass processing for small contexts and a no-readback verification pattern.

### Rules
Do NOT print raw context. Do NOT call tools.curation.recon when recon has already been computed. Proceed directly to extraction. Verify via result.applied[].filePath and do NOT call readFile for verification.

## Facts
- **context_tree**: The project uses a centralized curated context tree under .brv/context-tree for durable knowledge. [project]
- **rlm_mode**: Curation workflows in this project prefer RLM single-pass processing when recon suggests single-pass. [convention]
- **curate_operation_preference**: Curation operations should use UPSERT by default rather than ADD or UPDATE. [convention]
- **verification_method**: The current curation guidance emphasizes verifying results via result.applied[].filePath instead of reading files back for verification. [convention]
- **current_task**: The active task is to curate the provided context via the RLM approach. [other]
