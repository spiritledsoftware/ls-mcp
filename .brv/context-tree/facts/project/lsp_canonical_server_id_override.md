---
title: LSP Canonical Server ID Override
summary: Optional per-server serverId override is recommended with collision validation, while config keys remain configured-id aliases when they differ.
tags: []
related: []
keywords: []
createdAt: '2026-05-26T10:00:39.196Z'
updatedAt: '2026-05-26T10:00:39.196Z'
---
## Reason
Capture the decision and rules around configurable canonical server IDs for LSP server configuration

## Raw Concept
**Task:**
Document the canonical server ID override behavior for project LSP configuration

**Changes:**
- Recommended adding optional serverId to configured servers
- Defined how canonical IDs resolve for registry-backed and custom servers
- Defined collision validation requirements for serverId
- Defined configured-id alias behavior when config keys differ from canonical IDs

**Flow:**
registry-backed or custom server config -> resolve canonical id -> apply optional serverId override -> validate collisions -> add configured-id alias when needed

**Timestamp:** 2026-05-26T10:00:17.064Z

**Author:** ByteRover context engineer

## Narrative
### Structure
The decision splits server identity into built-in metadata, explicit serverId overrides, and config-key aliases, with different handling for registry-backed and fully custom servers.

### Dependencies
This behavior depends on workspace-level collision checks against canonical IDs and non-language aliases.

### Highlights
The recommendation preserves agent-friendly defaults while allowing advanced users and custom deployments to provide stable organization-specific IDs.

### Rules
Rules:
- Registry-backed server without `serverId`: canonical ID comes from built-in metadata, e.g. `typescript-language-server`.
- Registry-backed server with `serverId`: canonical ID becomes the configured value.
- Fully custom server without `serverId`: canonical ID is the config key.
- Fully custom server with `serverId`: canonical ID is the configured value.
- The config key always becomes a `configured-id` alias when it differs.
- `serverId` must not collide with another canonical ID or exact non-language alias in the same workspace.

## Facts
- **server_id_override**: Project config should support an optional per-server serverId override. [project]
- **server_id_collision_rule**: The serverId override must be validated to avoid collisions with another canonical ID or exact non-language alias in the same workspace. [project]
- **configured_id_alias**: When a configured server key differs from the canonical ID, the config key always becomes a configured-id alias. [convention]
