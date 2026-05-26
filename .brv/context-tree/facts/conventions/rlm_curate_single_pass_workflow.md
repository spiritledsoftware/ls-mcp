---
title: RLM Curate Single-Pass Workflow
summary: 'Single-pass RLM curation workflow: use recon first, skip chunking for small contexts, curate directly with UPSERT, and verify via result.applied[].filePath.'
tags: []
related: [facts/project/current_runtime_timestamp.md, facts/conventions/rlm_curate_workflow.md]
keywords: []
createdAt: '2026-05-26T18:08:33.384Z'
updatedAt: '2026-05-26T21:53:06.950Z'
---
## Reason
Document the single-pass RLM curation workflow requirements and execution guidance

## Raw Concept
**Task:**
Document the RLM curate single-pass workflow and execution requirements.

**Changes:**
- Used precomputed recon output to proceed directly
- Captured the requirement to verify via applied file paths
- Captured the single-pass recommendation for the current context
- Recorded the no-chunking rule for small contexts
- Recorded verification requirements for curate results

**Flow:**
recon -> inspect suggestedMode -> skip chunking when single-pass -> curate directly -> verify applied file paths

**Timestamp:** 2026-05-26T21:52:59.866Z

## Narrative
### Structure
This knowledge entry captures the execution path for single-pass RLM curation, including the expected control flow and verification approach.

### Dependencies
Depends on precomputed recon metadata and the curate result object; mapExtract is optional and only relevant when chunking is needed.

### Highlights
The workflow emphasizes minimal steps for small contexts, direct UPSERT curation, and strict verification through applied file paths.

## Facts
- **rlm_suggested_mode**: Recon was already computed and suggestedMode is single-pass for this context. [convention]
- **rlm_chunking_policy**: For single-pass contexts, chunking should be skipped entirely. [convention]
- **rlm_single_pass_steps**: When a context is small, it should be curated in two code_exec calls: recon and curate. [convention]
- **mapextract_timeout**: If mapExtract is used, code_exec must set timeout: 300000 on the tool call itself. [convention]
- **verification_method**: Verification for curation should use result.applied[].filePath and should not call readFile for verification. [convention]
