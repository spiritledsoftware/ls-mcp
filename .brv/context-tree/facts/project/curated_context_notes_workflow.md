---
title: Curated Context Notes Workflow
summary: RLM curation workflow with recon precomputed, single-pass preferred for this context, no raw context printing, and verification via applied file paths.
tags: []
related: []
keywords: []
createdAt: '2026-05-26T09:17:38.355Z'
updatedAt: '2026-05-26T09:17:38.355Z'
---
## Reason
Capture the curation workflow constraints and execution guidance from the provided context.

## Raw Concept
**Task:**
Document the RLM-based curation workflow for processing curated context with precomputed recon data.

**Changes:**
- Recon is precomputed and should not be rerun.
- Single-pass extraction is the suggested mode for this context.
- Verification should use result.applied[].filePath.

**Flow:**
recon precomputed -> extract facts -> curate -> verify applied file paths

**Timestamp:** 2026-05-26T09:17:26.033Z

**Author:** ByteRover context engineer

## Narrative
### Structure
This note captures the operational rules for curating a small context block using the RLM approach.

### Dependencies
Depends on precomputed recon variables, taskId, and the curation toolchain.

### Highlights
The context explicitly forbids printing raw context, recommends direct single-pass processing, and instructs verification through the curate result rather than file rereads.

### Rules
IMPORTANT: Do NOT print raw context. Do NOT call tools.curation.recon — it has been pre-computed. Proceed directly to extraction. For chunked extraction use tools.curation.mapExtract(). Pass taskId as a bare variable. Verify via result.applied[].filePath — do NOT call readFile for verification.
