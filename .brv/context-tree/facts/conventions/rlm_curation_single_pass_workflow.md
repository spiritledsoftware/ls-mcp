---
title: RLM Curation Single-Pass Workflow
summary: RLM curation workflow uses recon results to proceed directly to single-pass curation when suggestedMode is single-pass, with verification via applied file paths and mandatory status reporting.
tags: []
related: [facts/project/rlm_curate_execution_guidance.md, facts/conventions/rlm_curate_single_pass_workflow.md]
keywords: []
createdAt: '2026-05-26T18:31:24.268Z'
updatedAt: '2026-05-26T22:27:38.282Z'
---
## Reason
Document the single-pass RLM curation workflow and requirements from the provided context.

## Raw Concept
**Task:**
Document the RLM single-pass curation workflow and execution requirements.

**Changes:**
- Use pre-computed recon output to avoid redundant analysis
- Proceed directly to extraction when suggestedMode is single-pass
- Organize extracted facts with deduplication and grouping
- Curate via UPSERT and verify through applied file paths
- Use recon output to choose single-pass mode when suggestedMode is single-pass
- Skip chunking entirely for small contexts
- Curate directly without additional extraction steps

**Flow:**
recon -> single-pass decision -> curate -> verify applied file paths -> report status

**Timestamp:** 2026-05-26T22:27:31.244Z

**Author:** ByteRover context engineer

## Narrative
### Structure
This context describes the small-context RLM path where recon already determined the mode and no chunking or map extraction is needed.

### Dependencies
Depends on precomputed recon metadata and the curation result object for verification.

### Highlights
The workflow is optimized for concise contexts by skipping extraction overhead and relying on direct UPSERT curation.

### Rules
Do not call tools.curation.recon when recon is already precomputed. Do not print raw context. Verify via result.applied[].filePath.

## Facts
- **rlm_single_pass_mode**: When recon suggests single-pass, chunking is skipped entirely. [convention]
- **rlm_single_pass_calls**: For single-pass contexts, the workflow should proceed in 2 code_exec calls: recon and curate. [convention]
- **rlm_verification_method**: Verification should use result.applied[].filePath rather than readFile. [convention]
- **mapextract_timeout_ms**: Any code_exec call containing mapExtract must use timeout 300000 on the tool call itself. [convention]
