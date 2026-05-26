---
title: LSP Registry and Download Strategy
summary: 'Use a three-layer registry: core overlay, Mason snapshot, and installer adapters; avoid runtime latest downloads.'
tags: []
related: []
keywords: []
createdAt: '2026-05-25T19:53:05.652Z'
updatedAt: '2026-05-25T19:53:05.652Z'
---
## Reason
Capture durable architectural guidance on upstream registries and installers

## Raw Concept
**Task:**
Document architectural guidance for upstream LSP registries and download handling

**Changes:**
- Recommended a three-layer registry architecture
- Rejected making Mason the runtime contract
- Defined deterministic download and installer policy

**Flow:**
upstream data source -> overlay/product contract -> installer adapters -> cached installation

**Timestamp:** 2026-05-25

**Author:** assistant

## Narrative
### Structure
The proposed design separates upstream metadata from runtime behavior. A human-authored overlay defines product behavior, a generated Mason snapshot contributes metadata, and installer adapters handle actual installation paths.

### Dependencies
Relies on Mason only for selected metadata enrichment. Runtime downloads depend on pinned versions, deterministic URLs, cache locking, and optional checksum verification.

### Highlights
The central recommendation is to keep ls-mcp’s registry contract independent from Mason while still benefiting from Mason’s ecosystem data.

### Rules
Do not allow latest downloads at runtime. Do not generate all of builtins.ts from Mason. Do not implement the whole Mason installer system.

### Examples
Use Mason for aliases like lua_ls and rust_analyzer, but keep serverOverlay.ts authoritative for canonical IDs, command lines, root markers, and install policy.

## Facts
- **mason_role**: Use Mason as an upstream package and alias data source, not as the runtime registry contract. [project]
- **runtime_registry**: The product should keep its own runtime registry as the contract for supported servers. [project]
- **mason_capabilities**: Mason provides package names, versions, lspconfig aliases, and cross-platform asset metadata, but not opencode launch semantics or root/activation rules. [project]
- **builtins_generation_policy**: Avoid generating all of builtins.ts from Mason because that would make generated code too authoritative. [project]
- **server_overlay**: Keep a human-authored serverOverlay.ts as the source of truth for supported servers and product behavior. [project]
- **mason_snapshot**: Add a generated masonSnapshot.ts containing selected Mason package metadata. [project]
- **registry_merge_strategy**: Merge the overlay and Mason snapshot at build time or module load time into final built-ins. [project]
- **mason_enrichment_scope**: Treat Mason data as enrichment for aliases, package names, versions, and asset templates. [project]
- **overlay_behavior_scope**: Treat overlay data as product behavior for canonical ID, command, args, extensions, activation, root markers, and install policy. [project]
- **runtime_download_policy**: Do not allow latest downloads at runtime. [project]
- **download_determinism**: Downloads should be pinned to a committed snapshot version, resolved to deterministic URLs, installed into cache, and locked per server and version. [project]
- **download_verification**: Checksum verification should be used where upstream checksums are available. [project]
- **downloads_flag**: The downloads feature can be disabled by downloads.enabled: false. [project]
- **npm_installer_policy**: For npm-backed servers, npm install --ignore-scripts is the preferred install approach. [project]
- **archive_installer_scope**: Archive installers should be constrained to the source types actually needed and should not reimplement the entire Mason installer system. [project]
- **three_layer_registry**: The recommended architecture is a three-layer registry: core overlay, Mason snapshot, and installer adapters. [project]
- **installer_adapter_strategy**: Installer adapters should prefer npm first, archive/download only for selected servers, and system-only fallback for the rest. [project]
