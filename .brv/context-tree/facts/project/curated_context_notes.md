---
title: Curated Context Notes
summary: Operational notes on the curated-context workflow and verification requirements.
tags: []
related: [facts/project/curated_context_notes.md, facts/project/context.md]
keywords: []
createdAt: "2026-05-24T09:52:30.266Z"
updatedAt: "2026-05-24T10:28:11.887Z"
---

## Reason

Preserve key curated-context operational notes from RLM input

## Raw Concept

**Task:**
Curate operational notes for RLM-based context processing

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

**Flow:**
context variable -> extract facts -> dedup/group -> curate -> verify applied file paths

**Timestamp:** 2026-05-24T10:28:04.051Z

**Author:** ByteRover context engineer

## Narrative

### Structure

This note captures the curation workflow requirements for RLM processing, including direct extraction after precomputed recon and path-based verification.

### Dependencies

Depends on precomputed recon metadata and the curation tool result object for verification.

### Highlights

Single-pass mode was suggested; mapExtract is only needed for chunked contexts, and verification should use applied file paths.

## Facts

- **curated_context_note_1**: Curate only information with lasting value: facts, decisions, technical details, preferences, or notable outcomes. [project]

---

## Overview

- Captures curated context notes as factual knowledge entries for the project knowledge tree.
- States the purpose as converting inline context into facts-oriented knowledge, with a flow of context -> statement extraction -> knowledge curation.
- Records that the entry is a single-pass curation from a compact context input, authored by “ByteRover context engineer” with a timestamp.
- Includes factual notes emphasizing that only lasting-value information should be kept, such as facts, decisions, technical details, preferences, and notable outcomes.
- Preserves a series of extracted conversation statements, including repo assessment, greenfield architecture framing, and an initial architecture question about TypeScript/Node vs Rust.
- Highlights a concrete recommendation: implement the server in TypeScript/Node 22, justified by the maturity of the official MCP TypeScript SDK and the suitability of `vscode-jsonrpc` / `vscode-languageserver-protocol` for LSP JSON-RPC.
- Structure is simple: metadata block, Reason, Raw Concept, Narrative, and Facts sections with individual `context_note` entries.
