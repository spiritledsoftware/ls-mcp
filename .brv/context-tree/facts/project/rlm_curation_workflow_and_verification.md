---
title: RLM Curation Workflow and Verification
summary: RLM curation guidance emphasizes recon-first assessment, single-pass processing for small contexts, extraction of factual statements, and verification through curate result summaries and applied file paths.
tags: []
related: [facts/conventions/rlm_curate_workflow.md, facts/conventions/rlm_curation_workflow.md, facts/project/curate_workflow_and_verification_notes.md]
keywords: []
createdAt: '2026-05-26T14:42:08.514Z'
updatedAt: '2026-05-26T14:42:08.515Z'
---
## Reason
Curate runtime guidance about the RLM curation workflow, single-pass extraction, and verification requirements.

## Raw Concept
**Task:**
Document the RLM curation workflow and its verification requirements.

**Changes:**
- Captured the recommended single-pass mode for small contexts.
- Recorded extraction and verification requirements for curated contexts.
- Preserved tool usage constraints for mapExtract and curate verification.

**Flow:**
recon assessment -> extraction or direct curate -> dedup/group by subject -> curate -> verify applied file paths

**Timestamp:** 2026-05-26T14:41:57.547Z

**Author:** ByteRover context engineer

## Narrative
### Structure
The guidance distinguishes between single-pass and chunked curation, with recon determining the mode. It also specifies how to organize extracted facts using dedup and groupBySubject before curating.

### Dependencies
Depends on the precomputed recon result and the curate result summary for validation.

### Highlights
Single-pass was recommended for the current context size. Verification is done through applied file paths rather than rereading files.

## Facts
- **curation_mode**: The context was assessed with recon before curation, and the suggested mode was single-pass. [project]
- **single_pass_flow**: For single-pass contexts, the workflow skips chunking and proceeds directly from recon to curate. [convention]
- **mapextract_task_id**: When map extraction is used, the taskId must be passed as a bare variable, not a string. [convention]
- **mapextract_timeout**: Any code_exec call containing mapExtract must use a 300000 ms timeout on the code_exec tool call itself. [convention]
- **verification_method**: Verification must use result.applied[].filePath and must not rely on readFile for verification. [convention]
