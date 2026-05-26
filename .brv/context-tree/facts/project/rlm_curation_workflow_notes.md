---
title: RLM Curation Workflow Notes
summary: RLM curation workflow guidance for single-pass context handling, extraction, verification, and knowledge tree updates
tags: []
related: []
keywords: []
createdAt: '2026-05-26T09:58:54.307Z'
updatedAt: '2026-05-26T14:37:22.548Z'
---
## Reason
Curate single-pass RLM workflow instructions and task-specific context

## Raw Concept
**Task:**
Document the RLM curation workflow guidance and execution requirements from the provided context

**Changes:**
- Recorded the precomputed recon outcome and suggested single-pass mode
- Captured the instruction to use UPSERT for curation writes
- Captured the verification rule to inspect applied file paths and failed count

**Flow:**
recon precomputed -> single-pass extraction -> curate -> verify applied file paths -> report status

**Timestamp:** 2026-05-26T14:37:11.008Z

## Narrative
### Structure
The instructions emphasize using the precomputed recon result, avoiding raw context output, and proceeding directly to extraction and curation.

### Dependencies
Requires the sandbox variables for context, history, metadata, and task ID, plus tools.curation helpers for organization and verification.

### Highlights
Single-pass mode is recommended for small contexts, and verification must use result.applied[].filePath.

### Rules
[assistant]: The new tests fail for the intended missing behavior: the resolver is not called, alias-keyed allowlists do not restrict the canonical server, and ambiguous keys do not fail closed.

## Facts
- **curation_mode**: Use single-pass curation when recon suggests single-pass mode. [convention]
