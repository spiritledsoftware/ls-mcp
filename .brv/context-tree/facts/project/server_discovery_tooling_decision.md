---
title: Server Discovery Tooling Decision
summary: The server interface should include list_servers and search_servers, while execution/status tools handle exact resolution and suggestions; no separate resolve_server tool in this pass.
tags: []
related: []
keywords: []
createdAt: '2026-05-26T09:55:57.658Z'
updatedAt: '2026-05-26T09:55:57.658Z'
---
## Reason
Capture the decision to keep server discovery to search_servers instead of adding resolve_server

## Raw Concept
**Task:**
Document the server discovery and resolution interface decision

**Changes:**
- Chose search_servers as the fuzzy/ranked discovery tool
- Kept exact resolution inside execution/status tools
- Deferred a standalone resolve_server tool

**Flow:**
list_servers -> search_servers -> execution/status tools resolve exact IDs and aliases -> suggestions on ambiguity

**Timestamp:** 2026-05-26T09:55:47.464Z

**Author:** assistant

## Narrative
### Structure
The public interface is intentionally minimal: list_servers handles enumeration, search_servers handles discovery, and resolution remains an internal responsibility of execution/status tools.

### Dependencies
This decision depends on canonical IDs and alias support already being available in execution tools.

### Highlights
The recommendation is to avoid introducing another public concept to document and test unless search_servers proves insufficient.

### Examples
If search_servers returns a top-ranked exact match with canonicalId, agents can use it directly without a separate resolve step.

## Facts
- **list_servers**: The interface should include list_servers to enumerate available servers, optionally filtered by workspace or file. [project]
- **search_servers**: The interface should include search_servers for fuzzy and ranked discovery across suggestions, aliases, command names, packages, and language names. [project]
- **server_resolution**: Execution and status tools should resolve exact canonical IDs and aliases internally and fail with ranked suggestions when names are unknown or ambiguous. [project]
- **resolve_server_tool**: A separate resolve_server tool should be skipped in this pass. [project]
