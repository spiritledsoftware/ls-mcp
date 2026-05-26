---
title: Mason Registry Data Vendoring
summary: Mason registry data should be vendored/generated at development time so runtime stays offline and deterministic, with a script refreshing the snapshot when built-ins are intentionally updated.
tags: []
related: []
keywords: []
createdAt: '2026-05-25T19:51:01.983Z'
updatedAt: '2026-05-25T19:51:01.983Z'
---
## Reason
Capture the decision to vendor or generate Mason registry data at development time

## Raw Concept
**Task:**
Document the Mason registry data sourcing decision

**Changes:**
- Selected vendored or generated registry data at development time
- Preserved offline and deterministic runtime behavior
- Noted snapshot refresh via script when built-ins change intentionally

**Flow:**
development-time snapshot generation -> runtime uses local data -> intentional updates trigger refresh script

## Narrative
### Structure
A project decision about how Mason registry data is sourced and refreshed.

### Dependencies
Depends on a regeneration script for updating the vendored snapshot when built-ins are changed on purpose.

### Highlights
The preferred approach avoids runtime fetching and keeps behavior deterministic and offline-friendly.

## Facts
- **mason_registry_data_strategy**: Mason registry data should be vendored or generated at development time rather than fetched at runtime [project]
- **runtime_behavior**: Runtime should stay offline and deterministic [project]
- **snapshot_refresh_process**: A script refreshes the snapshot when built-ins are intentionally updated [project]
