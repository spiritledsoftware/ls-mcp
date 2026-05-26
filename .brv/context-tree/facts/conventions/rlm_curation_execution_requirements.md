---
title: RLM Curation Execution Requirements
summary: RLM curation requires precomputed recon, single-pass handling for small contexts, no raw context printing, bare taskId passing for mapExtract, and verification via result.applied[].filePath.
tags: []
related: []
keywords: []
createdAt: '2026-05-26T18:26:18.871Z'
updatedAt: '2026-05-26T18:26:18.871Z'
---
## Reason
Curate the execution requirements and workflow guidance for RLM-based curation

## Raw Concept
**Task:**
Document RLM curation execution requirements and workflow constraints

**Changes:**
- Established single-pass handling for small contexts
- Recorded tool-use constraints for recon, mapExtract, and verification
- Captured stdout and taskId handling rules

**Flow:**
precomputed recon -> single-pass or chunked extraction -> curate -> verify via applied file paths

**Timestamp:** 2026-05-26T18:26:10.477Z

## Narrative
### Structure
Guidance focuses on RLM curation execution, including when to skip recon, how to handle small contexts, and how to validate applied files after curation.

### Dependencies
Depends on precomputed recon data, tools.curation.mapExtract for chunked extraction, and tools.curate for final UPSERT operations.

### Highlights
The workflow emphasizes not printing raw context, using single-pass for compact inputs, and verifying success from curate results rather than extra reads.
