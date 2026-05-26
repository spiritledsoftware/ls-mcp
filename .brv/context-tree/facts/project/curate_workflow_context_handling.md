---
title: Curate Workflow Context Handling
summary: RLM curation context covering single-pass handling for small contexts, extraction guidance, organize-with-dedup workflow, and verification by applied file paths.
tags: []
related: []
keywords: []
createdAt: '2026-05-26T14:02:15.216Z'
updatedAt: '2026-05-26T14:28:17.828Z'
---
## Reason
Capture RLM curation guidance, context handling, and verification notes from the provided context.

## Raw Concept
**Task:**
Curate the precomputed RLM curation context into durable knowledge.

**Changes:**
- Captured the current context as structured knowledge
- Recorded that recon was already computed and indicated single-pass handling.
- Captured the required mapExtract invocation rule for taskId and timeout.
- Captured the verification rule to rely on applied file paths instead of readFile.

**Flow:**
recon precomputed -> single-pass extraction -> dedup/group if needed -> curate -> verify applied file paths

**Timestamp:** 2026-05-26T14:28:06.479Z

**Author:** ByteRover context engineer

## Narrative
### Structure
This context is operational guidance for RLM curation workflows, especially handling precomputed recon and small contexts in single-pass mode.

### Dependencies
Depends on tools.curation.mapExtract() for chunked extraction, tools.curation.dedup() for deduplication, tools.curation.groupBySubject() for organization, and tools.curate() for persistence.

### Highlights
The context emphasizes not printing raw context, not rerunning recon, and using the precomputed task metadata directly.

### Rules
IMPORTANT: Do NOT print raw context. Do NOT call tools.curation.recon — it has been pre-computed. Proceed directly to extraction. For chunked extraction use tools.curation.mapExtract(). Pass taskId as a bare variable, not a string. IMPORTANT: Any code_exec call containing mapExtract MUST use timeout: 300000 on the code_exec tool call itself (not inside mapExtract options). Use tools.curation.groupBySubject() and tools.curation.dedup() to organize extractions. Verify via result.applied[].filePath — do NOT call readFile for verification.

### Examples
Recommended flow for this task: use the precomputed recon result, curate the small context in a single pass, then confirm the applied file path from the curate result.

## Facts
- **curate_context_size**: The provided context was 1536 characters across 24 lines with 0 messages. [project]
- **recon_mode**: Recon had already been computed and suggested single-pass mode with one chunk. [project]
- **map_extract_task_id**: For chunked extraction, tools.curation.mapExtract() must receive taskId as a bare variable. [project]
- **map_extract_timeout**: Any code_exec call containing mapExtract must use timeout 300000 on the code_exec call itself. [convention]
- **verification_method**: Verification must use result.applied[].filePath and must not call readFile for verification. [convention]
