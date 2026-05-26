---
title: LSP MCP Project Context
summary: Project context for lsp-mcp including repository structure, curation workflow requirements, and operational guidance.
tags: []
related: [facts/conventions/context.md]
keywords: []
createdAt: '2026-05-26T18:41:53.430Z'
updatedAt: '2026-05-26T18:41:53.430Z'
---
## Reason
Curate project-wide facts and workflow guidance from the provided context.

## Raw Concept
**Task:**
Document project-wide curation workflow and environment facts for the lsp-mcp repository

**Changes:**
- Captured repository identity and current task date
- Recorded the required RLM curation workflow
- Preserved the no-raw-context and no-approval execution constraints

**Flow:**
recon -> extraction -> curate -> verify

**Timestamp:** 2026-05-26T18:41:35.276Z

**Author:** ByteRover context engineer

## Narrative
### Structure
The context emphasizes single-pass curation when recon recommends it, with direct use of the provided sandbox variables and verification through curate results.

### Dependencies
Depends on the .brv/context-tree knowledge structure, curated project notes, and the tools.curation workflow helpers.

### Highlights
The workflow forbids printing raw context, requires UPSERT by default, and expects verification via result.applied[].filePath rather than rereading files.

## Facts
- **repository_name**: The repository is named lsp-mcp. [project]
- **current_date**: The current date in the task context is 2026-05-26. [project]
- **curate_workflow**: Curate tasks use the RLM approach with recon, extraction, curate, and verification. [convention]
