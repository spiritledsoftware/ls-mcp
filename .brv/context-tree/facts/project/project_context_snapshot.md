---
consolidated_at: '2026-05-26T09:37:43.221Z'
consolidated_from: [{date: '2026-05-26T09:37:43.221Z', path: facts/project/project_snapshot.md, reason: These two files substantially overlap in scope and both function as broad project snapshots for the same repository context. The more complete project_context_snapshot.md should absorb the useful details from project_snapshot.md to avoid duplicate high-level summaries.}]
---
# Topic: project_context_snapshot

## Overview

This file is the durable snapshot of project knowledge for the nimble-wizard repository, capturing implementation details, tooling, schemas, workflow notes, verification/readiness signals, and curation rules.

## Key Concepts

- project is a TypeScript-based MCP/LSP server named nimble-wizard
- source areas include src/config, src/lsp, src/mcp, src/registry, src/security, src/tools, and src/utils
- docs/plans contains CI/CD, LSP output schema generation, and Mason-backed registry planning
- the repository has broad integration and unit test coverage for diagnostics, document open/edit, execute command, lazy startup, raw tools, server tools, session, standard tools, and timeout cancellation
- a semantic knowledge store lives under .brv/context-tree
- curation workflow follows recon -> extraction -> curate apply when recon is precomputed
- verification and release readiness are part of the durable project state
- the project emphasizes durable, source-derived facts over transient context

## Notable Files

- README.md
- docs/architecture.md
- docs/config.md
- docs/tools.md
- src/index.ts
- src/mcp/server.ts
- src/mcp/stdio.ts
- src/lsp/session.ts
- src/lsp/sessionManager.ts
- src/lsp/commandPolicy.ts
- src/lsp/methodRegistry.ts
- src/lsp/transport.ts
- src/lsp/stdioTransport.ts
- src/tools/registerTools.ts
- tests/mcp/server.test.ts
- docs/plans/lsp-mcp-server.md
- docs/plans/2026-05-25-ci-cd.md
- docs/plans/2026-05-25-lsp-output-schemas.md
- docs/plans/2026-05-25-mason-backed-lsp-registry.md