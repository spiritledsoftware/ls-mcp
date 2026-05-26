---
title: RLM Curate Execution Requirements
summary: RLM curation requires recon first, single-pass handling for small contexts, quiet previewing, extraction of facts, and verification of curate results before reporting completion.
tags: []
related: []
keywords: []
createdAt: '2026-05-26T22:44:04.240Z'
updatedAt: '2026-05-26T22:44:04.240Z'
---
## Reason
Capture concise RLM curation requirements from the provided context

## Raw Concept
**Task:**
Document the execution requirements and workflow constraints for RLM curation in this session

**Changes:**
- Confirmed precomputed recon guidance for a single-pass context
- Captured the required extraction and verification workflow
- Preserved instructions about not printing raw context and not rereading files for verification

**Flow:**
recon -> direct extraction -> curate -> verify applied file paths -> report status

**Timestamp:** 2026-05-26T22:43:57.998Z

**Patterns:**
- `^__taskId_` - Task ID variable naming convention

## Narrative
### Structure
This knowledge captures the operational constraints for RLM-based curation when the context is small and recon has already been computed.

### Dependencies
Depends on precomputed recon metadata, the injected context/history/metadata variables, and curate result verification.

### Highlights
The workflow emphasizes single-pass processing, no raw context printing, no recon rerun, and post-curation verification via applied file paths.

### Rules
Do not print raw context. Do not call tools.curation.recon when recon is already precomputed. For verification, use result.applied[].filePath and do not call readFile.

## Facts
- **rlm_approach**: The context was processed with the RLM curation approach. [other]
- **curation_mode**: The provided context was small enough for single-pass handling. [convention]
- **recon_step**: Recon was already computed before extraction. [convention]
- **verification_method**: Verification should use result.applied[].filePath and should not rely on readFile. [convention]
