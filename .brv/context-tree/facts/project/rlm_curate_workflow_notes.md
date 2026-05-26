---
title: RLM Curate Workflow Notes
summary: RLM curation uses recon-first single-pass processing for small contexts, preserves raw context briefly, extracts facts, and verifies results through applied file paths and summary checks.
tags: []
related: []
keywords: []
createdAt: '2026-05-26T10:01:26.824Z'
updatedAt: '2026-05-26T13:09:09.768Z'
---
## Reason
Curate the RLM single-pass workflow guidance and verification rules

## Raw Concept
**Task:**
Document the RLM curation workflow for small single-pass contexts and verification expectations.

**Changes:**
- Captured the precomputed single-pass RLM curation directive.
- Recorded the project identity, workspace location, and current date for recall.
- Captured the single-pass path recommended by recon for small contexts
- Recorded the requirement to use bare taskId for mapExtract when needed
- Recorded verification via applied file paths without readFile

**Files:**
- .brv/context-tree/facts/project

**Flow:**
recon -> determine mode -> extract directly in single-pass -> curate -> verify via applied file paths -> report status

**Timestamp:** 2026-05-26T13:08:57.815Z

**Author:** ByteRover context engineer

## Narrative
### Structure
The guidance describes an RLM curation flow that starts with precomputed recon metadata, uses single-pass processing for compact inputs, and avoids chunking unless suggested otherwise.

### Dependencies
Relies on sandbox variables for context, history, metadata, and task id; uses tools.curate for persistence and result.applied for verification.

### Highlights
This context emphasizes avoiding raw-context printing, preserving concise operational notes, and ensuring success checks through curate summary fields.

### Rules
IMPORTANT: Do NOT print raw context. Do NOT call tools.curation.recon — it has been pre-computed. Proceed directly to extraction. For chunked extraction use tools.curation.mapExtract(). Pass taskId as a bare variable, not a string. Verify via result.applied[].filePath — do NOT call readFile for verification.

## Facts
- **curation_mode**: For small contexts, recon can suggest single-pass mode and chunking should be skipped. [project]
- **rlm_curation_inputs**: When curation is requested with Context variable, History variable, and Metadata variable, the workflow should use the provided sandbox variables directly. [project]
- **verification_method**: Verification should use result.applied[].filePath and should not call readFile for verification. [project]
- **mapextract_timeout**: Any code_exec call containing mapExtract must set timeout: 300000 on the tool call itself. [project]
