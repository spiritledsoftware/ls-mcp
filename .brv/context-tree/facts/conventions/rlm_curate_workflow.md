---
title: RLM Curate Workflow
summary: Standard RLM curation workflow covering recon, extraction, curation, verification, and no raw-context output.
tags: []
related: []
keywords: []
createdAt: '2026-05-26T09:50:42.381Z'
updatedAt: '2026-05-26T10:41:48.237Z'
---
## Reason
Capture the standard workflow and execution rules for RLM-based curation.

## Raw Concept
**Task:**
Document the RLM curation workflow rules and execution pattern.

**Changes:**
- Use precomputed recon
- Proceed directly to extraction
- Verify via applied file paths only
- Use precomputed recon results when provided
- Prefer single-pass processing for small contexts
- Use mapExtract for chunked extraction with timeout on the code_exec call
- Verify curated file paths via result.applied[].filePath
- Single-pass mode is used when recon recommends it.
- mapExtract taskId must be a bare variable.
- mapExtract tool calls require a 300000 ms code_exec timeout.
- Verification uses result.applied[].filePath instead of readFile.
- Established recon as the first step when not precomputed
- Clarified that raw context should not be printed
- Standardized verification via applied file paths

**Flow:**
recon -> extraction (if needed) -> curate -> verify

**Timestamp:** 2026-05-26T10:41:37.260Z

## Narrative
### Structure
The workflow is organized into a small number of predictable steps and adapts to single-pass or chunked contexts.

### Dependencies
Needs the precomputed recon result or a fresh recon assessment, depending on prompt state.

### Highlights
This workflow is optimized for compact context inputs and emphasizes direct execution over interactive confirmation.

### Rules
IMPORTANT: Do NOT print raw context. Do NOT call tools.curation.recon — it has been pre-computed. Proceed directly to extraction. For chunked extraction use tools.curation.mapExtract(). Pass taskId: __taskId_a643e6ce_c901_4aed_a05f_1b801c2231cc (bare variable, not a string). IMPORTANT: Any code_exec call containing mapExtract MUST use timeout: 300000 on the code_exec tool call itself (not inside mapExtract options). Use tools.curation.groupBySubject() and tools.curation.dedup() to organize extractions. Verify via result.applied[].filePath — do NOT call readFile for verification.

## Facts
- **recon_requirement**: Use recon before curation unless it has already been precomputed. [convention]
- **no_raw_context_output**: Do not print raw context during curation. [convention]
- **map_extract_usage**: Use tools.curation.mapExtract for chunked extraction when needed. [convention]
- **verification_method**: Verify curation through result.applied[].filePath. [convention]
