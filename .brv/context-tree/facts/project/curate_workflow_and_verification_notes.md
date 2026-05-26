---
title: Curate Workflow and Verification Notes
summary: 'Workflow notes for RLM-based curation: use recon first, prefer single-pass for small contexts, then curate and verify applied file paths.'
tags: []
related: [facts/conventions/rlm_curation_workflow.md]
keywords: []
createdAt: '2026-05-26T10:02:14.399Z'
updatedAt: '2026-05-26T15:05:33.836Z'
---
## Reason
Document curation workflow notes captured from the provided context

## Raw Concept
**Task:**
Document the RLM curation workflow and verification requirements from the provided context.

**Changes:**
- Captured the pre-computed recon state and the single-pass recommendation
- Recorded the required timeout rule for mapExtract when chunking is needed
- Recorded the verification rule that relies on applied file paths
- Established recon -> extraction -> curate as the working sequence
- Recorded the single-pass recommendation for small contexts
- Captured the verification rule that relies on applied file paths

**Flow:**
recon -> decide mode -> extract if needed -> curate -> verify applied file paths

**Timestamp:** 2026-05-26T15:05:23.123Z

## Narrative
### Structure
The context describes a compact curation workflow oriented around RLM processing and verification.

### Dependencies
Single-pass mode is appropriate because the context is small and recon already provided the mode recommendation.

### Highlights
The workflow emphasizes immediate execution, no raw-context printing, and verification through applied file paths.

## Facts
- **curation_workflow_step**: For curation tasks, start with tools.curation.recon before extraction. [convention]
- **curation_mode**: When recon suggests single-pass, skip chunking and proceed directly to curation. [convention]
- **mapextract_timeout**: When using mapExtract in code_exec, the code_exec timeout must be set to 300000. [convention]
- **verification_method**: Verification should use result.applied[].filePath instead of readFile. [convention]
