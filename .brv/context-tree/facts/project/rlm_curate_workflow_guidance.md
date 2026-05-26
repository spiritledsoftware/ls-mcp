---
title: RLM Curate Workflow Guidance
summary: RLM curation guidance covering recon-first processing, single-pass handling for small contexts, and verification requirements.
tags: []
related: []
keywords: []
createdAt: '2026-05-26T14:50:46.042Z'
updatedAt: '2026-05-26T16:00:12.469Z'
---
## Reason
Curate RLM curation workflow guidance and execution requirements from context.

## Raw Concept
**Task:**
Document the RLM curation workflow guidance for autonomous context engineering.

**Changes:**
- Established recon-first processing
- Clarified single-pass handling for small contexts
- Specified chunked extraction with mapExtract for larger contexts
- Defined verification using applied file paths
- Received a precomputed recon result recommending single-pass mode
- Captured the current curation instructions for direct execution
- Use recon result to determine single-pass versus chunked handling.
- Proceed directly to extraction when suggestedMode is single-pass.
- Use mapExtract with taskId for chunked extraction when needed.
- Use groupBySubject and dedup to organize extracted facts.
- Verify curated results via result.applied[].filePath without readFile.

**Flow:**
Recon result -> choose mode -> extract facts -> dedup/group -> curate -> verify applied file paths

**Timestamp:** 2026-05-26T15:59:57.668Z

**Patterns:**
- `suggestedMode=single-pass` - Indicates the context should be processed in a single pass
- `Pass taskId as bare variable` - Task ID must be provided directly, not as a string

## Narrative
### Structure
The workflow emphasizes a precomputed recon result, single-pass processing for small contexts, and chunked extraction only when necessary.

### Dependencies
Depends on tools.curation.mapExtract, tools.curation.dedup, tools.curation.groupBySubject, and tools.curate for applying knowledge.

### Highlights
The instructions explicitly forbid calling tools.curation.recon again, require timeout 300000 for code_exec containing mapExtract, and require verification through result.applied[].filePath.

### Rules
IMPORTANT: Do NOT print raw context. Do NOT call tools.curation.recon — it has been pre-computed. Proceed directly to extraction. For chunked extraction use tools.curation.mapExtract(). Pass taskId: __taskId_3865b4d4_59d9_44ea_a770_d59ba5525ea2 (bare variable). IMPORTANT: Any code_exec call containing mapExtract MUST use timeout: 300000 on the code_exec tool call itself (not inside mapExtract options). Use tools.curation.groupBySubject() and tools.curation.dedup() to organize extractions. Verify via result.applied[].filePath — do NOT call readFile for verification.
