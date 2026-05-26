---
title: RLM Curate Workflow Guidance
summary: RLM curation guidance emphasizing precomputed recon, single-pass handling for small contexts, mapExtract for chunked extraction, and verification through applied file paths.
tags: []
related: [facts/project/context_notes.md, facts/project/curate_workflow_notes.md]
keywords: []
createdAt: '2026-05-26T14:18:51.020Z'
updatedAt: '2026-05-26T15:40:39.071Z'
---
## Reason
Capture the curation workflow instructions and verification constraints from the provided context.

## Raw Concept
**Task:**
Document the RLM curation workflow and execution constraints for this session.

**Changes:**
- Use recon before curation when context is available
- Prefer single-pass mode for small contexts
- Verify curated files through result.applied[].filePath
- Use the precomputed recon result instead of recomputing it
- Proceed directly to extraction for a single-pass context
- Use mapExtract with the bare taskId only when chunking is needed
- Verify curation through result.applied[].filePath

**Flow:**
precomputed recon -> direct extraction -> curate -> verify applied file paths

**Timestamp:** 2026-05-26T15:40:32.113Z

## Narrative
### Structure
This note records the execution path for the current curation task, including the recon status, extraction approach, and verification rule.

### Dependencies
Depends on the precomputed recon result, the provided context/history/metadata variables, and the curate tool output.

### Highlights
The context is small enough for single-pass handling, and the workflow explicitly avoids rereading raw context during verification.

## Facts
- **curation_approach**: Context should be curated using the RLM approach. [convention]
- **context_size**: The provided context variable contains 390 characters across 8 lines and no messages. [project]
- **recon_mode**: The recon result already computed suggested single-pass mode with one chunk. [project]
- **map_extract_usage**: For chunked extraction, tools.curation.mapExtract should be used with the provided taskId as a bare variable. [convention]
- **verification_method**: Verification must use result.applied[].filePath and should not call readFile. [convention]
