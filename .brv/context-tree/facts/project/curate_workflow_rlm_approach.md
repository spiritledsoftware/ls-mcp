---
title: Curate Workflow RLM Approach
summary: RLM-based curation workflow guidance, including recon, extraction, curate application, verification, and current runtime timestamp note.
tags: []
related: [facts/conventions/rlm_curate_workflow.md]
keywords: []
createdAt: '2026-05-26T09:54:12.702Z'
updatedAt: '2026-05-26T09:55:33.579Z'
---
## Reason
Capture curation workflow guidance and project-specific notes from the provided context

## Raw Concept
**Task:**
Document the RLM curation workflow and related project notes used for context engineering.

**Changes:**
- Use the precomputed recon result instead of calling tools.curation.recon again
- Proceed directly to extraction for single-pass context
- Verify curated file paths through result.applied[].filePath
- Recorded the recommended RLM curation workflow.
- Captured the current runtime timestamp note.

**Flow:**
recon -> extract -> dedupe/group -> curate -> verify

**Timestamp:** 2026-05-26T09:55:22.622Z

**Author:** ByteRover context engineering workflow

## Narrative
### Structure
The context describes a small set of curation instructions and project notes rather than source code behavior.

### Dependencies
Relies on the provided context variable, history variable, metadata variable, and task ID for RLM curation.

### Highlights
Recon was already computed and suggested single-pass mode; verification should use applied file paths.
