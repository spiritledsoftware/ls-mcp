---
title: RLM Curate Single-Pass Workflow
summary: Curation workflow guidance for single-pass RLM processing, including recon-aware execution and verification.
tags: []
related: []
keywords: []
createdAt: '2026-05-26T18:08:33.384Z'
updatedAt: '2026-05-26T18:08:33.384Z'
---
## Reason
Preserve the curation workflow requirement inferred from the task instructions.

## Raw Concept
**Task:**
Document the single-pass RLM curation workflow and verification rule.

**Changes:**
- Used precomputed recon output to proceed directly
- Captured the requirement to verify via applied file paths

**Flow:**
recon -> single-pass extraction -> curate -> verify applied paths

**Timestamp:** 2026-05-26T18:08:21.401Z

## Narrative
### Structure
This entry records the operational guidance for handling small contexts in one pass.

### Dependencies
Relies on precomputed recon metadata and the curated result summary.

### Highlights
Emphasizes efficiency by skipping chunking when the context is already small enough.

## Facts
- **curation_mode**: The recon result already computed suggests single-pass processing. [convention]
- **verification_method**: Verification should use applied file paths rather than readFile reads. [convention]
