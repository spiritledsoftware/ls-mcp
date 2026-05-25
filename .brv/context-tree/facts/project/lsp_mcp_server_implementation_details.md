---
title: LSP MCP Server Implementation Details
summary: The server added lazy stdio LSP sessions, managed installer locking, workspace security checks, diagnostics, edits, commands, raw LSP escape hatches, and MCP tool registration.
tags: []
related: []
keywords: []
createdAt: '2026-05-24T21:20:18.489Z'
updatedAt: '2026-05-24T21:20:18.489Z'
---
## Reason
Capture important technical implementation details and safety fixes from the plan execution

## Raw Concept
**Task:**
Document the technical capabilities added by the LSP MCP server implementation

**Changes:**
- Added lazy local stdio LSP session management with idle shutdown
- Added JSON and JSONC user and project config loading
- Added managed on-demand LSP server registry with filesystem-backed locking
- Added diagnostics, edit/apply, command execution, raw request/notify, and server lifecycle tools
- Added MCP registration for implemented handlers

**Files:**
- src/lsp/session.ts
- src/registry/locks.ts
- src/security/workspace.ts
- src/tools/diagnosticTools.ts
- src/tools/editTools.ts
- src/tools/rawTools.ts
- src/tools/serverTools.ts
- src/tools/registerTools.ts

**Flow:**
request -> load config -> resolve workspace -> acquire or start server/session -> apply workspace security -> execute LSP tool -> normalize result

**Timestamp:** 2026-05-24T21:19:59.539Z

**Author:** assistant

## Narrative
### Structure
The architecture spans config loading, path resolution, session management, registry and installer logic, transport, document storage, method registries, tool handlers, and MCP server wiring.

### Dependencies
The release depended on filesystem-backed locks, session lifecycle hardening, request cancellation propagation, and document synchronization correctness.

### Highlights
Major fixes included installer behavior corrections, transport lifecycle fixes, session shutdown hardening, document synchronization race fixes, edit preflight safety, and command-policy enforcement.

### Rules
No commit was made.

### Examples
Managed installs reuse cached binaries, diagnostics can be gathered across pull and push models, and raw request/notification tools serve as escape hatches for unmodeled LSP methods.

## Facts
- **managed_install_policy**: Managed installs are pinned and run with lifecycle scripts disabled. [project]
- **workspace_security**: Workspace security checks now block document reads outside workspace boundaries. [project]
- **document_state**: The document state is bounded with per-session LRU eviction and didClose support. [project]
- **tool_surface**: The implementation includes typed LSP 3.17 tools for diagnostics, edits, command execution, raw requests and notifications, and server lifecycle management. [project]
