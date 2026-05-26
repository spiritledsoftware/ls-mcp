---
title: Curated Context Notes Workflow
summary: Context notes workflow guidance covering how curated knowledge is organized, preserved, and verified in the context tree.
tags: []
related: [facts/project/context_and_plan_execution_notes.md, facts/project/mason_backed_lsp_registry_implementation.md, facts/project/context.md]
keywords: []
createdAt: '2026-05-26T09:17:38.355Z'
updatedAt: '2026-05-26T09:47:56.922Z'
---
## Reason
Curate the context notes workflow and related guidance from the provided RLM context.

## Raw Concept
**Task:**
Document the curated context notes workflow and related guidance for preserving knowledge in the context tree.

**Changes:**
- Recon is precomputed and should not be rerun.
- Single-pass extraction is the suggested mode for this context.
- Verification should use result.applied[].filePath.
- Captured workflow guidance for curated context notes
- Preserved context tree organization and verification rules
- Recorded facts about single-pass RLM curation mode and verification requirements

**Flow:**
recon -> extract -> curate -> verify

**Timestamp:** 2026-05-26T09:47:47.739Z

**Author:** ByteRover context engineer

## Narrative
### Structure
The context describes an RLM curation workflow with single-pass handling for small contexts, plus explicit verification through applied file paths.

### Dependencies
Uses pre-computed recon metadata, optional chunked extraction for larger contexts, and the context tree as the durable knowledge store.

### Highlights
The guidance emphasizes not printing raw context, using UPSERT by default, and verifying success via result.applied[].filePath.

### Rules
IMPORTANT: Do NOT print raw context. Do NOT call tools.curation.recon — it has been pre-computed. Proceed directly to extraction. For chunked extraction use tools.curation.mapExtract(). Pass taskId as a bare variable. Verify via result.applied[].filePath — do NOT call readFile for verification.

## Facts
- **curated_context**: -- [other]
- **curated_context**: *Question 2: Tool Naming Direction** [other]
- **curated_context**: Rename `hover` -> `lsp_hover` [other]
- **curated_context**: Rename `definition` -> `lsp_definition` [other]
- **curated_context**: Rename `document_symbols` -> `lsp_document_symbols` [other]
- **curated_context**: Keep existing prefixed tools like `lsp_list_servers`, `lsp_diagnostics`, `lsp_rename` [other]
- **curated_context**: Standardize all generated/registered tool names to one public convention [other]
- **curated_context**: Let Caplets expose shorter curated names like `hover` and `definition` if desired [other]
- **curated_context**: MCP tool names usually live in a shared host namespace, not just inside the caplet domain. [other]
- **curated_context**: Unprefixed names like `hover`, `completion`, `references`, and `definition` are collision-prone. [other]
- **curated_context**: This aligns standard tools with existing raw/edit/diagnostic/lifecycle tools. [other]
- **curated_context**: Breaking now avoids supporting aliases forever. [other]
