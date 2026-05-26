---
title: RLM Curate Workflow Requirements
summary: Single-pass RLM curation should skip chunking for small contexts, use recon output, and verify curation success from the applied results.
tags: []
related: []
keywords: []
createdAt: '2026-05-26T18:03:13.925Z'
updatedAt: '2026-05-26T18:37:57.120Z'
---
## Reason
Capture the single-pass RLM curation requirements and verification rules

## Raw Concept
**Task:**
Document the RLM curation execution flow for a small context

**Changes:**
- Captured the prescribed single-pass workflow for small contexts
- Captured the chunked workflow using mapExtract for larger contexts
- Captured verification and preservation requirements for curation tasks
- Proceed directly to extraction after recon when suggestedMode is single-pass
- Use tools.curation.groupBySubject and tools.curation.dedup to organize extractions
- Verify curated outputs through applied file paths instead of readFile

**Flow:**
recon -> extraction -> dedup/group -> curate -> verify via applied file paths

**Timestamp:** 2026-05-26T18:37:49.302Z

**Author:** ByteRover context engineer

**Patterns:**
- `suggestedMode=single-pass` - Recon indicator for single-pass processing mode
- `suggestedChunkCount=1` - Recon indicator for a one-chunk small context

## Narrative
### Structure
This note captures the execution guidance for curation of small contexts under the RLM approach, emphasizing direct processing without chunking.

### Dependencies
Depends on precomputed recon output and the curation helpers for extraction organization.

### Highlights
The workflow is optimized for a 406-character, 8-line context with zero messages, and it explicitly forbids readFile-based verification.

### Rules
IMPORTANT: Do NOT print raw context. Do NOT call tools.curation.recon — it has been pre-computed. Proceed directly to extraction. For chunked extraction use tools.curation.mapExtract(). Pass taskId: __taskId_7dfe0ace_eccc_4fc1_bb7c_b0902a46abbb (bare variable, not a string). IMPORTANT: Any code_exec call containing mapExtract MUST use timeout: 300000 on the code_exec tool call itself (not inside mapExtract options). Use tools.curation.groupBySubject() and tools.curation.dedup() to organize extractions. Verify via result.applied[].filePath — do NOT call readFile for verification.

### Examples
Single-pass example: recon plus curate. Chunked example: mapExtract followed by dedup, groupBySubject, and curate.

## Facts
- **single_pass_mode**: For small contexts, single-pass mode should skip chunking entirely. [convention]
- **recon_result**: The recon result already computed suggestedMode=single-pass and suggestedChunkCount=1 for this context. [project]
- **mapextract_timeout**: When mapExtract is used, the code_exec timeout must be set to 300000 on the tool call itself. [convention]
- **verification_method**: Verification should use result.applied[].filePath and must not call readFile for verification. [convention]
