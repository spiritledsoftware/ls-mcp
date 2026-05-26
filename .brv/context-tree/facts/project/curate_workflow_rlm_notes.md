---
title: Curate Workflow RLM Notes
summary: RLM curation workflow notes covering recon status, single-pass extraction, mapExtract usage, and verification expectations.
tags: []
related: []
keywords: []
createdAt: '2026-05-26T15:16:13.961Z'
updatedAt: '2026-05-26T15:16:13.962Z'
---
## Reason
Persist RLM curation workflow guidance and current task-specific notes

## Raw Concept
**Task:**
Document the RLM curation workflow instructions for this session

**Changes:**
- Use the precomputed recon result instead of calling recon again
- Proceed directly to extraction for the single-pass mode
- Use mapExtract with the provided taskId when chunked extraction is needed
- Verify curation results through applied file paths

**Files:**
- .brv/context-tree/facts/project/curate_workflow_notes.md

**Flow:**
precomputed recon -> extract facts -> deduplicate/group -> curate -> verify applied file paths

**Timestamp:** 2026-05-26T15:16:04.746Z

## Narrative
### Structure
This knowledge captures how to handle RLM curation sessions when context is already small enough for single-pass processing.

### Dependencies
Depends on the precomputed recon result, the provided context/history/metadata variables, and the curate tool verification fields.

### Highlights
The session instruction emphasizes no raw-context printing, no recon rerun, and verification via result.applied[].filePath.
