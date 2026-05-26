---
title: AGENTS.md Creation Guidance
summary: AGENTS.md should be compact, verify commands from executable sources first, preserve only high-signal repo-specific guidance, and reflect the repo’s Node/pnpm, generated-schema, and LSP/MCP workflow constraints.
tags: []
related: []
keywords: []
createdAt: '2026-05-25T19:58:44.525Z'
updatedAt: '2026-05-25T19:58:44.525Z'
---
## Reason
Capture repo-specific instructions for future agent sessions

## Raw Concept
**Task:**
Curate repo-specific guidance for future AGENTS.md updates.

**Changes:**
- Captured the required investigation order and writing rules for AGENTS.md.
- Recorded repo-specific workflow facts including pnpm/Node, CI verification, generated schemas, and LSP/MCP architecture.
- Preserved the instruction-file constraints about compactness, verification, and avoiding unverified or generic content.

**Flow:**
Read executable sources -> inspect representative code if needed -> extract only high-signal repo-specific facts -> write compact AGENTS.md guidance

**Timestamp:** 2026-05-25

## Narrative
### Structure
This guidance applies to repository-level instruction curation and emphasizes source-first investigation, compactness, and verified workflow notes.

### Dependencies
Future instructions depend on repo manifests, CI workflows, existing instruction files, and a small set of representative code files when architecture is unclear.

### Highlights
The main repo-specific anchors are pnpm/Node, the CI verification sequence, generated LSP output schemas, and the LSP-backed MCP server architecture.

### Rules
Include only high-signal, repo-specific guidance such as exact commands and shortcuts the agent would otherwise guess wrong; architecture notes that are not obvious from filenames; conventions that differ from language or framework defaults; setup requirements, environment quirks, and operational gotchas; references to existing instruction sources that matter. Exclude generic software advice, long tutorials or exhaustive file trees, obvious language conventions, speculative claims or anything you could not verify, and content better stored in another file referenced via opencode.json instructions.

## Facts
- **agents_md_scope**: AGENTS.md should be compact and include only high-signal, repo-specific guidance that an agent would likely miss without help. [convention]
- **investigation_sources**: Investigate executable sources first, including README files, root manifests, workspace config, lockfiles, build/test/lint/formatter/typecheck/codegen config, CI workflows, pre-commit/task runner config, existing instruction files, and repo-local OpenCode config. [convention]
- **architecture_investigation**: If architecture is still unclear after reading config and docs, inspect a small number of representative code files that show real entrypoints, package boundaries, and execution flow. [convention]
- **source_of_truth**: Prefer executable sources of truth over prose; if docs conflict with config or scripts, trust the executable source and only keep what can be verified. [convention]
- **command_documentation**: Record exact developer commands, especially non-obvious ones, including how to run a single test, a single package, or a focused verification step. [convention]
- **command_order**: Capture required command order when it matters, such as lint -> typecheck -> test. [convention]
- **repo_boundaries**: Document monorepo or multi-package boundaries, ownership of major directories, and real app or library entrypoints when relevant. [convention]
- **toolchain_quirks**: Document framework or toolchain quirks such as generated code, migrations, build artifacts, special env loading, dev servers, and infra deploy flow. [convention]
- **testing_quirks**: Document testing quirks such as fixtures, integration prerequisites, snapshot workflows, required services, and flaky or expensive suites. [convention]
- **writing_constraints**: Preserve important constraints from existing instruction files and avoid generic software advice, long tutorials, exhaustive file trees, speculation, and unverified claims. [convention]
- **repo_type**: The repo is a pnpm/Node package rather than a monorepo. [project]
- **ci_verification_sequence**: CI has a specific verification sequence. [project]
- **generated_lsp_output_schemas**: Generated LSP output schema files are a notable workflow gotcha. [project]
- **lsp_mcp_server_architecture**: The codebase includes an LSP-backed MCP server with sessions, transport, method registry, command policy, result normalization, document store, diagnostic store, edit applier, and registry/installers for builtins, npm, and GitHub-based LSP acquisition. [project]
- **output_schema_generation_script**: The project generates output schemas with scripts/generate-lsp-output-schemas.mjs. [project]
- **planning_docs**: Documentation includes CI/CD, LSP schema generation, and mason-backed registry planning in docs/plans. [project]
