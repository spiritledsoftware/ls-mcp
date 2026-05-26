---
title: Curate Workflow RLM Guidance
summary: RLM curation guidance covering recon-first workflow, single-pass handling for small contexts, extraction/organization steps, and verification rules for curate results.
tags: []
related: []
keywords: []
createdAt: '2026-05-26T17:19:03.399Z'
updatedAt: '2026-05-26T17:19:03.399Z'
---
## Reason
Persist RLM curation workflow guidance and verification requirements from the supplied context

## Raw Concept
**Task:**
Document the RLM curation workflow instructions for this context

**Changes:**
- Recorded that recon was precomputed and single-pass mode was recommended
- Captured the required extraction and verification workflow
- Preserved the bare taskId passing requirement for mapExtract

**Flow:**
precomputed recon -> choose single-pass or chunked extraction -> curate -> verify applied file paths

**Timestamp:** 2026-05-26

**Author:** ByteRover context engineer

## Narrative
### Structure
The guidance emphasizes using the precomputed recon result, avoiding an extra recon call, and handling this small context in a single pass.

### Dependencies
Chunked processing depends on tools.curation.mapExtract, tools.curation.dedup, and tools.curation.groupBySubject when the context is not single-pass.

### Highlights
The instructions stress not printing raw context, using the provided taskId as a bare variable for mapExtract, and verifying curation through applied file paths only.

### Rules
Do NOT print raw context. Do NOT call tools.curation.recon because it has been pre-computed. For chunked extraction use tools.curation.mapExtract(). Pass taskId as a bare variable, not a string. Verify via result.applied[].filePath — do NOT call readFile for verification.

## Facts
- **rlm_curation_mode**: The context uses the RLM curation approach with precomputed recon results and a single-pass mode for small contexts. [convention]
- **single_pass_workflow**: When recon suggests single-pass, the workflow skips chunking and proceeds directly from preview review to curate. [convention]
- **chunked_extraction_workflow**: For chunked contexts, extraction uses tools.curation.mapExtract and results are organized with tools.curation.dedup and tools.curation.groupBySubject. [convention]
- **verification_method**: Verification after curation must use result.applied[].filePath and must not rely on readFile for verification. [convention]
