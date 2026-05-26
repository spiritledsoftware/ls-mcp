---
title: RLM Curation Workflow Guidance
summary: RLM curation workflow guidance covering recon, single-pass handling, mapExtract timeouts, and verification rules.
tags: []
related: []
keywords: []
createdAt: '2026-05-26T10:51:08.735Z'
updatedAt: '2026-05-26T14:26:07.876Z'
---
## Reason
Capture curation workflow guidance and verification rules from the provided context.

## Raw Concept
**Task:**
Document the RLM curation workflow guidance for context-driven knowledge curation.

**Changes:**
- Use precomputed recon results when available
- Proceed directly to extraction for single-pass contexts
- Organize extractions with deduplication and subject grouping
- Enforce timeout 300000 for code_exec calls containing mapExtract
- Verify curated files via result.applied[].filePath
- Confirmed single-pass processing for the current context.
- Captured the no-rerun recon rule for precomputed contexts.
- Captured the mapExtract timeout requirement and verification rule.

**Flow:**
recon precomputed -> extract context -> curate knowledge -> verify applied file paths

**Timestamp:** 2026-05-26T14:25:50.483Z

**Author:** ByteRover context engineer

## Narrative
### Structure
This guidance defines how to process curated context when recon is already available and when to switch to mapExtract for chunked inputs.

### Dependencies
Relies on precomputed recon metadata, task-scoped context variables, and curate result inspection.

### Highlights
The workflow emphasizes avoiding redundant recon calls, preserving raw context privacy, enforcing the 300000 ms timeout for mapExtract, and verifying via applied file paths.

### Rules
Do NOT print raw context. Do NOT call tools.curation.recon when recon has already been precomputed. For chunked extraction use tools.curation.mapExtract() with timeout: 300000 on the code_exec call itself. Use tools.curation.groupBySubject() and tools.curation.dedup() to organize extractions. Verify via result.applied[].filePath — do NOT call readFile for verification.

## Facts
- **rlm_curation_workflow**: The curation workflow uses the RLM approach with precomputed recon, single-pass extraction for small contexts, and mapExtract for chunked contexts. [convention]
- **single_pass_recon_rule**: For single-pass contexts, recon is already computed and should not be called again before curating. [convention]
- **mapextract_timeout**: When mapExtract is used, code_exec must set timeout: 300000 on the tool call itself. [convention]
- **verification_rule**: Verification after curation must use result.applied[].filePath and must not use readFile for verification. [convention]
- **no_raw_context_printing**: Context variables should not be printed raw during curation. [convention]
- **current_task_id**: The current curation task references task ID __taskId_ed34ca7d_1074_42ed_966f_0e77b7807351. [project]
