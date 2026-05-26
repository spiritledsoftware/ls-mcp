---
title: RLM Curation Single-pass Workflow
summary: Single-pass RLM curation workflow uses recon data, direct extraction, dedup/grouping, UPSERT curation, and verification via applied file paths.
tags: []
related: [facts/project/rlm_curate_execution_guidance.md, facts/conventions/rlm_curate_single_pass_workflow.md]
keywords: []
createdAt: '2026-05-26T18:31:24.268Z'
updatedAt: '2026-05-26T18:31:24.268Z'
---
## Reason
Curate the single-pass RLM workflow guidance from the provided context

## Raw Concept
**Task:**
Document the RLM curation approach for a single-pass context.

**Changes:**
- Use pre-computed recon output to avoid redundant analysis
- Proceed directly to extraction when suggestedMode is single-pass
- Organize extracted facts with deduplication and grouping
- Curate via UPSERT and verify through applied file paths

**Flow:**
pre-computed recon -> extraction -> dedup/group -> curate -> verify

**Timestamp:** 2026-05-26T18:31:12.025Z

**Author:** ByteRover context engineer

## Narrative
### Structure
The guidance is an execution recipe for small RLM curation jobs: rely on the existing recon result, skip chunking, and complete the operation in one pass.

### Dependencies
Depends on the pre-computed recon result, the curation history variable, the metadata variable, and the taskId variable supplied by the caller.

### Highlights
Emphasizes direct extraction, use of tools.curation.dedup() and tools.curation.groupBySubject(), and final verification through applied file paths.

## Facts
- **curation_mode**: The context was small enough for single-pass curation. [convention]
- **recon_status**: Recon had already been computed before curation. [convention]
- **recon_usage**: The task requires proceeding directly to extraction without recomputing recon. [convention]
- **mapextract_task_id**: Map extraction should pass the taskId as a bare variable when used. [convention]
- **verification_method**: Verification should use result.applied[].filePath and not readFile. [convention]
