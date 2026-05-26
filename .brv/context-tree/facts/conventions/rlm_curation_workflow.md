---
title: RLM Curation Workflow
summary: 'Operational guidance for RLM-based curation: single-pass mode, mapExtract timeout requirements, no raw context printing, and verification via applied file paths.'
tags: []
related: []
keywords: []
createdAt: '2026-05-26T10:35:27.947Z'
updatedAt: '2026-05-26T10:58:27.427Z'
---
## Reason
Capture the execution guidance and verification rules for this RLM curation session.

## Raw Concept
**Task:**
Document the RLM curation approach and its execution guidance for this session.

**Changes:**
- Established the recon-first workflow with single-pass handling when suggested.
- Captured the requirement to use mapExtract only for chunked contexts.
- Recorded the verification rule to inspect result.applied[].filePath instead of readFile.
- Established single-pass execution for the current curation context
- Captured instructions for mapExtract timeout and taskId usage
- Recorded verification guidance using applied file paths

**Flow:**
recon already computed -> use single-pass extraction -> curate result -> verify applied file paths -> report status

**Timestamp:** 2026-05-26T10:58:16.563Z

**Author:** ByteRover context engineer

## Narrative
### Structure
This context provides operational instructions for an RLM-based curation run, including how to proceed from a precomputed recon result without re-running reconnaissance.

### Dependencies
Depends on preloaded context, history, metadata, and task ID variables supplied by the orchestration layer.

### Highlights
Single-pass is recommended for the 4097-character context. The workflow emphasizes no raw context printing, use of mapExtract only when chunking is required, and verification through curate results.

### Rules
IMPORTANT: Do NOT print raw context. Do NOT call tools.curation.recon — it has been pre-computed. Proceed directly to extraction. For chunked extraction use tools.curation.mapExtract(). Pass taskId: __taskId_b800849f_a636_466c_9206_e41bd7fdebe4 (bare variable). IMPORTANT: Any code_exec call containing mapExtract MUST use timeout: 300000 on the code_exec tool call itself (not inside mapExtract options). Use tools.curation.groupBySubject() and tools.curation.dedup() to organize extractions. Verify via result.applied[].filePath — do NOT call readFile for verification.

## Facts
- **recon_mode**: The recommended mode for this context is single-pass. [convention]
- **verification_method**: Verification should use result.applied[].filePath rather than readFile. [convention]
