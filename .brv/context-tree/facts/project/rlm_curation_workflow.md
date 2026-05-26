---
title: RLM Curation Workflow
summary: 'RLM curation workflow guidance: use recon first, then single-pass or chunked extraction, curate with UPSERT, preserve facts, and verify success via applied results.'
tags: []
related: []
keywords: []
createdAt: '2026-05-26T10:02:43.488Z'
updatedAt: '2026-05-26T10:02:43.488Z'
---
## Reason
Curate project guidance about RLM-based curation and verification workflow

## Raw Concept
**Task:**
Document the RLM curation workflow and verification approach for this project

**Changes:**
- Established recon-first decision flow for curation
- Defined single-pass vs chunked extraction handling
- Specified verification by curate result summary and applied file paths

**Flow:**
recon -> decide mode -> extract -> dedup/group -> curate -> verify

**Timestamp:** 2026-05-26T10:02:31.023Z

**Author:** ByteRover context engineer

## Narrative
### Structure
The workflow begins with recon, then proceeds directly to single-pass curation for small contexts or mapExtract for chunked contexts. Results are organized with deduplication and grouping before UPSERT curation.

### Dependencies
Uses tools.curation.recon, tools.curation.mapExtract, tools.curation.dedup, tools.curation.groupBySubject, and tools.curate.

### Highlights
The process explicitly forbids printing raw context, requires UPSERT by default, and expects verification through result.summary and result.applied[].filePath.

### Rules
Do NOT print raw context. Do NOT call tools.curation.recon when recon is already precomputed. For chunked extraction, pass taskId as a bare variable. Verify via result.applied[].filePath and do NOT call readFile for verification.

## Facts
- **rlm_curation_workflow_mode_selection**: The RLM curation workflow uses recon before extraction to decide between single-pass and chunked processing. [project]
- **single_pass_curation**: When recon suggests single-pass, the context should be curated without chunking. [convention]
- **map_extract_task_id**: When context is chunked, extraction should use tools.curation.mapExtract with taskId passed as a bare variable. [project]
- **curate_verification_method**: Curate verification should check result.summary.failed and result.applied entries rather than reading files back. [project]
