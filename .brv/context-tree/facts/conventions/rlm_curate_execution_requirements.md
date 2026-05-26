---
title: RLM Curate Execution Requirements
summary: RLM curation workflow uses precomputed recon, single-pass extraction, dedup/grouping, and verification via applied file paths.
tags: []
related: []
keywords: []
createdAt: '2026-05-26T17:56:57.593Z'
updatedAt: '2026-05-26T17:56:57.593Z'
---
## Reason
Document the required RLM curation workflow and verification constraints.

## Raw Concept
**Task:**
Document the required RLM curation execution workflow for context processing.

**Changes:**
- Use precomputed recon instead of rerunning it
- Proceed directly to extraction in single-pass mode
- Organize extracted items with deduplication and grouping
- Verify curation through result.applied file paths

**Flow:**
precomputed recon -> extraction -> dedup/group -> curate -> verify applied file paths

**Timestamp:** 2026-05-26T17:56:50.515Z

**Author:** ByteRover

## Narrative
### Structure
Captures execution requirements for RLM-based curation when the context is small enough for single-pass handling.

### Dependencies
Relies on the precomputed recon result, the taskId variable, and the curation helpers for organization and verification.

### Highlights
Emphasizes immediate execution, no confirmation, and no raw-context printing during curation.

## Facts
- **curation_approach**: The project uses an RLM approach for curation workflows. [project]
- **recon_mode**: The current context was pre-analyzed with recon and recommended single-pass mode. [project]
- **extraction_organization**: The task requires using tools.curation.groupBySubject() and tools.curation.dedup() to organize extractions. [convention]
