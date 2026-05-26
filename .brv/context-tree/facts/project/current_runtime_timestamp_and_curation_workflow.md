---
title: Current Runtime Timestamp and Curation Workflow
summary: The project records the current runtime timestamp in a fixed ISO 8601 format and uses a strict RLM curation workflow with recon, chunking only when needed, curated extraction, verification, and history updates.
tags: []
related: [facts/conventions/rlm_curate_workflow.md, facts/project/current_runtime_timestamp.md, facts/conventions/rlm_curate_workflow_guidance.md, facts/project/curate_workflow_and_verification_notes.md]
keywords: []
createdAt: '2026-05-26T10:09:22.161Z'
updatedAt: '2026-05-26T16:09:03.335Z'
---
## Reason
Curate timestamp handling and curation workflow guidance from RLM context

## Raw Concept
**Task:**
Document current runtime timestamp handling and RLM curation workflow guidance

**Changes:**
- Recorded the current runtime timestamp from the prompt
- Captured the precomputed recon result indicating single-pass processing
- Preserved the verification requirement to inspect result.applied[].filePath
- Captured the timeout rule for any code_exec call that contains mapExtract
- Captured the provided current timestamp
- Recorded the RLM workflow directives for single-pass and chunked curation
- Preserved the verification rule that uses result.applied[].filePath
- Emphasizes using the current runtime timestamp during curation
- Describes the RLM workflow for curation and verification
- Captures the current context size and mode as operational metadata
- Captured the active runtime timestamp used for this curation pass
- Recorded the instruction to proceed directly after precomputed recon when suggestedMode is single-pass
- Recorded the instruction to verify curated files through applied file paths
- Recorded the current runtime timestamp for this curation session
- Captured the instruction to proceed directly to extraction using the precomputed recon result
- Recorded that the suggested mode is single-pass with one chunk
- Captured the runtime timestamp as a durable reference for curation tasks
- Recorded the single-pass workflow guidance for small contexts
- Preserved the verification requirement to check applied file paths
- Captured the current runtime timestamp guidance for curation operations.
- Recorded the workflow pattern for curation tasks.
- Captured the current runtime timestamp from the prompt.
- Recorded the single-pass curation workflow guidance and verification rule.
- Preserved the instruction to avoid printing raw context.
- Recorded the current runtime timestamp
- Captured the RLM curation approach requirements
- Noted that recon was precomputed and single-pass processing is recommended
- Recorded the current runtime timestamp for the session
- Captured the precomputed recon recommendation
- Preserved the curation workflow requirements for extraction, verification, and reporting
- Recorded the current runtime timestamp as an ISO 8601 value
- Defined the curation flow: recon, optional chunking, extraction, curate, verify, and history update

**Files:**
- .brv/context-tree/facts/project/context.md

**Flow:**
recon -> determine mode -> extract -> curate -> verify -> record progress

**Timestamp:** 2026-05-26T16:08:54.387Z

**Author:** ByteRover context engineering guidance

## Narrative
### Structure
The notes emphasize a single-pass curation path for small contexts and reserve chunked extraction for larger inputs.

### Dependencies
Verification relies on curate results, especially result.summary and applied file paths, rather than rereading files.

### Highlights
The workflow requires preserving raw context in compact form, avoiding raw dumps, and updating history after successful curation.

### Rules
Do not print raw context. Do not call tools.curation.recon when recon is already pre-computed. Use the taskId variable as a bare variable when passing to mapExtract. Verify via result.applied[].filePath and result.summary.failed.

### Examples
If suggestedMode is single-pass, proceed directly to curate; if chunked, use mapExtract with timeout 300000 on the code_exec call.

## Facts
- **current_runtime_timestamp**: Current runtime timestamp is 2026-05-26T16:08:54.387Z [project]
- **curation_workflow**: The curation workflow uses the RLM approach with recon before extraction and verification after curate. [project]
- **curation_mode**: When recon suggests single-pass, chunking is skipped and the context is curated directly. [convention]
