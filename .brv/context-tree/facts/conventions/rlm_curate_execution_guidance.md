---
title: RLM Curate Execution Guidance
summary: RLM curation task variables, single-pass recon guidance, size metadata, and verification constraints for this task
tags: []
related: []
keywords: []
createdAt: '2026-05-26T15:40:49.281Z'
updatedAt: '2026-05-26T15:40:49.281Z'
---
## Reason
Capture curation execution constraints and variables for this RLM task

## Raw Concept
**Task:**
Capture the execution guidance for this RLM curation task

**Changes:**
- Single-pass mode was selected by recon
- Mandatory variables for context, history, metadata, and task ID were provided
- Verification must use applied file paths without readFile

**Flow:**
recon already computed -> single-pass extraction -> dedup/group facts -> curate -> verify via applied file paths

**Timestamp:** 2026-05-26T15:40:31.544Z

**Author:** ByteRover context engineer

## Narrative
### Structure
This note records the operational guidance for an RLM curation task with precomputed recon and single-pass processing.

### Dependencies
Depends on the precomputed recon result and the injected context, history, metadata, and task ID variables.

### Highlights
Single-pass mode is required; no recon call should be made; raw context must not be printed; verification must use the curate result only.

## Facts
- **curation_approach**: Context curation should use the RLM approach. [convention]
- **context_variable**: The context variable for this task is __curate_ctx_04b748e1_5bdb_4887_af8a_fe795897552c. [convention]
- **history_variable**: The history variable for this task is __curate_hist_04b748e1_5bdb_4887_af8a_fe795897552c. [convention]
- **metadata_variable**: The metadata variable for this task is __curate_meta_04b748e1_5bdb_4887_af8a_fe795897552c. [convention]
- **task_id_variable**: The task ID variable for this task is __taskId_04b748e1_5bdb_4887_af8a_fe795897552c. [convention]
- **recon_mode**: Recon was already computed and suggested single-pass mode with one chunk. [convention]
- **context_size**: The context is 652 characters long and spans 12 lines with 0 messages. [project]
- **execution_constraints**: Do not print raw context and do not call tools.curation.recon again. [convention]
- **verification_method**: Verification must use result.applied[].filePath and must not call readFile. [convention]
