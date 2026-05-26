---
title: Curation Execution Requirements
summary: Execution requirements for RLM curation, including recon-first workflow, single-pass handling for small contexts, and verification expectations.
tags: []
related: []
keywords: []
createdAt: '2026-05-26T16:00:12.479Z'
updatedAt: '2026-05-26T16:04:03.423Z'
---
## Reason
Curate RLM curation execution requirements and workflow guidance from the provided context

## Raw Concept
**Task:**
Document the required RLM curation execution workflow for small contexts

**Changes:**
- No raw context printing.
- No repeated recon call when recon is precomputed.
- Use a bare taskId variable for mapExtract.
- Apply 300000 ms timeout on any code_exec containing mapExtract.
- Use result.applied[].filePath for verification.
- Use precomputed recon instead of calling recon again
- Proceed directly to extraction for single-pass contexts
- Use tools.curation.groupBySubject and tools.curation.dedup to organize extracted facts
- Verify curated files via applied file paths rather than reading files

**Flow:**
precomputed recon -> single-pass extraction -> dedup/grouping -> curate -> verify applied file paths

**Timestamp:** 2026-05-26T16:03:49.977Z

**Author:** ByteRover context engineering guidance

## Narrative
### Structure
This guidance applies to RLM curation tasks where the context is small enough to process in one pass. It emphasizes skipping redundant recon, using the supplied task id for any map extraction, and organizing extracted items before curation.

### Dependencies
Depends on the precomputed recon result, the provided context/history/metadata variables, and the curate tool result for verification.

### Highlights
The context explicitly instructs not to print raw context, not to call recon again, and to use the output file paths from the curate result as the verification source.

### Rules
IMPORTANT: Do NOT print raw context. Do NOT call tools.curation.recon — it has been pre-computed. Proceed directly to extraction. For chunked extraction use tools.curation.mapExtract(). Pass taskId: __taskId_3865b4d4_59d9_44ea_a770_d59ba5525ea2 (bare variable). IMPORTANT: Any code_exec call containing mapExtract MUST use timeout: 300000 on the code_exec tool call itself (not inside mapExtract options). Use tools.curation.groupBySubject() and tools.curation.dedup() to organize extractions. Verify via result.applied[].filePath — do NOT call readFile for verification.

## Facts
- **recon_requirement**: Recon is already computed for this curation task and should not be called again. [convention]
- **curation_mode**: For small contexts with suggestedMode single-pass, chunking should be skipped. [convention]
- **map_extract_timeout**: When mapExtract is used, the code_exec call must set timeout to 300000 on the tool call itself. [convention]
- **verification_method**: Verification for curation should use result.applied[].filePath and avoid readFile for verification. [convention]
- **context_redaction**: Raw context should not be printed during curation. [convention]
