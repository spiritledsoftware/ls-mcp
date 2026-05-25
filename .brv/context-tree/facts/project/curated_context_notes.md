---
title: Curated Context Notes
summary: Project curation notes capturing docs/plans active curation, durable knowledge retention, context-tree updates, and recon/extraction/curate workflow.
tags: []
related: [facts/project/curated_context_notes.md, facts/project/context.md]
keywords: []
createdAt: '2026-05-24T09:52:30.266Z'
updatedAt: '2026-05-25T10:07:31.330Z'
---
## Reason
Preserve project curation workflow and docs/plans context as durable knowledge

## Raw Concept
**Task:**
Document project curation workflow and knowledge preservation for docs/plans context

**Changes:**
- Extracted key statements from inline context
- Organized content into facts/project
- Confirmed the recon result recommends single-pass processing
- Recorded the requirement to pass taskId as a bare variable for mapExtract
- Recorded the verification rule to use applied file paths instead of readFile
- Recorded the working module as an actively curated module surfaced during curate
- Captured the recon -> extraction -> curate apply workflow used in session 295fceb8
- Preserved durable knowledge instead of chat-only context
- Captured the working module as an actively curated topic
- Recorded the durable-knowledge preservation practice
- Preserved the recommended RLM workflow sequence
- Recorded single-pass workflow guidance
- Recorded extraction and verification constraints
- Recorded that docs/plans is an actively curated module
- Captured the practice of preserving findings as durable knowledge
- Captured the recon -> extraction -> curate apply workflow

**Flow:**
context discovered -> facts extracted -> knowledge curated -> durable record stored

**Timestamp:** 2026-05-25T10:07:24.689Z

**Author:** ByteRover context engineer

## Narrative
### Structure
Notes describe how working module findings are preserved and curated into the context tree.

### Dependencies
Uses the context tree as the durable store for extracted project knowledge.

### Highlights
The docs/plans module is actively curated, and the established workflow is recon -> extraction -> curate apply.

## Facts
- **docs_plans_module**: The project has a docs/plans module that is actively curated. [project]
- **knowledge_retention_policy**: This session preserved working module findings as durable knowledge instead of chat-only context. [project]
- **context_tree_curation**: This session curated working module knowledge into the context tree. [project]
- **curation_workflow**: The workflow used for docs/plans was recon -> extraction -> curate apply. [convention]

---

## Overview

- Captures curated context notes as factual knowledge entries for the project knowledge tree.
- States the purpose as converting inline context into facts-oriented knowledge, with a flow of context -> statement extraction -> knowledge curation.
- Records that the entry is a single-pass curation from a compact context input, authored by “ByteRover context engineer” with a timestamp.
- Includes factual notes emphasizing that only lasting-value information should be kept, such as facts, decisions, technical details, preferences, and notable outcomes.
- Preserves a series of extracted conversation statements, including repo assessment, greenfield architecture framing, and an initial architecture question about TypeScript/Node vs Rust.
- Highlights a concrete recommendation: implement the server in TypeScript/Node 22, justified by the maturity of the official MCP TypeScript SDK and the suitability of `vscode-jsonrpc` / `vscode-languageserver-protocol` for LSP JSON-RPC.
- Structure is simple: metadata block, Reason, Raw Concept, Narrative, and Facts sections with individual `context_note` entries.
