---
title: RLM Curation Execution Requirements
summary: Execution requirements for RLM curation including single-pass handling, sandbox variable usage, and verification rules.
tags: []
related: []
keywords: []
createdAt: '2026-05-26T18:26:18.871Z'
updatedAt: '2026-05-26T18:41:53.434Z'
---
## Reason
Preserve the operational requirements and workflow constraints for RLM curation.

## Raw Concept
**Task:**
Document the required execution rules for RLM curation tasks

**Changes:**
- Established single-pass handling for small contexts
- Recorded tool-use constraints for recon, mapExtract, and verification
- Captured stdout and taskId handling rules
- Captured single-pass guidance from recon
- Recorded the preferred UPSERT-based curation method
- Captured the verification rule using applied file paths

**Flow:**
recon assessment -> choose single-pass or chunked extraction -> curate -> verify

**Timestamp:** 2026-05-26T18:41:35.276Z

**Author:** ByteRover context engineer

## Narrative
### Structure
The requirements define how to execute curation safely and efficiently within the sandboxed workflow.

### Dependencies
Depends on the precomputed recon result, the curation sandbox variables, and the context-tree organization rules.

### Highlights
The instructions explicitly forbid printing raw context and require immediate execution without asking for confirmation.

## Facts
- **single_pass_mode**: When recon suggests single-pass, chunking should be skipped. [convention]
- **curate_operation**: Use tools.curate with UPSERT as the preferred operation. [convention]
- **verification_method**: Verification should use result.applied[].filePath and not require readFile. [convention]
