---
title: Curated Context Notes
summary: Project curation guidance covering context-tree organization, knowledge source handling, and RLM workflow expectations.
tags: []
related: [facts/project/curated_context_notes.md, facts/project/context.md, facts/project/project_context_notes.md]
keywords: []
createdAt: '2026-05-24T09:52:30.266Z'
updatedAt: '2026-05-25T20:11:08.757Z'
---
## Reason
Preserve project-specific curation guidance and context notes from the provided RLM context

## Raw Concept
**Task:**
Document the project-wide curation guidance and current context notes captured in the RLM source context.

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
- Recorded curation workflow guidance for the context tree
- Captured handling rules for local and shared knowledge sources
- Preserved constraints for query and curation operations

**Files:**
- .brv/context-tree/
- .brv/context-tree/facts/project/

**Flow:**
context source -> guidance extraction -> deduplication -> UPSERT into facts/project

**Timestamp:** 2026-05-25T20:11:02.015Z

**Author:** ByteRover context engineer

## Narrative
### Structure
This knowledge belongs under the facts/project domain as reusable project guidance rather than a feature-specific topic.

### Dependencies
Depends on the RLM workflow conventions, the writable local context tree, and the distinction between local and shared knowledge sources.

### Highlights
Preserves autonomous execution rules, verification expectations, and the requirement to use curated knowledge as the source of truth.

## Facts
- **curation_context**: -- [project]
- **curation_context**: maintainability of `src/registry/builtins.ts` and `src/registry/masonSnapshot.ts` [project]
- **curation_context**: correctness and performance of alias validation/resolution [project]
- **curation_context**: correctness of activation filtering in `src/lsp/sessionManager.ts` [project]
- **curation_context**: test quality and brittleness in registry/session tests [project]
- **curation_context**: accidental scope creep or risky behavior changes [project]
- **curation_context**: High: compatibility aliases resolve only as registry IDs, not as `serverId` targets. [project]
- **curation_context**: Location: `src/registry/builtins.ts:311-321`, `src/registry/builtins.ts:422-432`, `src/lsp/sessionManager.ts:394-399`, `src/lsp/sessionManager.ts:427-431` [project]
- **curation_context**: Evidence: legacy built-ins were renamed to canonical IDs like `pyright`, `gopls`, and `yaml-ls`, with aliases `python`, `go`, and `yaml`. However `resolveWorkspaceServers(serverId)` and explicit file targeting compare only `definition.id === serverId`; default built-in definitions are created with `metadata.id`, so `serverId: "python"`, `"go"`, or `"yaml"` now throws `Unknown LSP server`. [project]
- **curation_context**: Impact: existing users who explicitly target prior built-in IDs or use lifecycle/status commands by those IDs will regress, even though alias support appears to preserve compatibility. [project]
- **curation_context**: Recommended action: either preserve the old built-in `serverId`s for compatibility, or resolve `serverId` through the alias map anywhere user-supplied server IDs are accepted, including file targeting, workspace targeting, stop/status paths, and tests. [project]
- **curation_context**: Medium: tests miss the alias path most likely to regress. [project]
- **curation_context**: Location: `tests/unit/registry.test.ts:67-91`, `tests/unit/sessionManager.test.ts:162-181` [project]
- **curation_context**: Evidence: tests verify `getBuiltInServer(alias)` and configured `registry: "yamlls"`, but not user-facing explicit `serverId` aliases such as `getSessionsForFile({ serverId: "python" })`, `getSessionsForWorkspace({ serverId: "yaml" })`, or `stopServer({ serverId: "go" })`. [project]
- **curation_context**: Impact: current tests pass while compatibility server targeting is broken. [project]
- **curation_context**: Recommended action: add session-manager tests for explicit legacy/Mason alias `serverId` behavior, or document that aliases are registry-only and update docs/API expectations accordingly. [project]
- **curation_context**: Ran targeted tests: `pnpm test tests/unit/registry.test.ts tests/unit/sessionManager.test.ts` [project]
- **curation_context**: Result: passed, 2 files / 27 tests. [project]
- **curation_context**: Gap: full CI sequence was not run; review was limited to registry/session changes as requested. [project]

---

## Overview

- Captures curated context notes as factual knowledge entries for the project knowledge tree.
- States the purpose as converting inline context into facts-oriented knowledge, with a flow of context -> statement extraction -> knowledge curation.
- Records that the entry is a single-pass curation from a compact context input, authored by “ByteRover context engineer” with a timestamp.
- Includes factual notes emphasizing that only lasting-value information should be kept, such as facts, decisions, technical details, preferences, and notable outcomes.
- Preserves a series of extracted conversation statements, including repo assessment, greenfield architecture framing, and an initial architecture question about TypeScript/Node vs Rust.
- Highlights a concrete recommendation: implement the server in TypeScript/Node 22, justified by the maturity of the official MCP TypeScript SDK and the suitability of `vscode-jsonrpc` / `vscode-languageserver-protocol` for LSP JSON-RPC.
- Structure is simple: metadata block, Reason, Raw Concept, Narrative, and Facts sections with individual `context_note` entries.
