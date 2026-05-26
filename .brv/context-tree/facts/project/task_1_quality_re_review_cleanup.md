---
title: Task 1 Quality Re-review Cleanup
summary: Task 1 cleanup updated raw/edit no-server errors to use public tool names, hardened absence assertions, and passed unit, typecheck, and lint checks.
tags: []
related: []
keywords: []
createdAt: '2026-05-26T10:45:03.180Z'
updatedAt: '2026-05-26T10:45:03.180Z'
---
## Reason
Preserve the completed Task 1 quality fix details, test results, and implementation approach for future recall.

## Raw Concept
**Task:**
Document the Task 1 quality re-review cleanup for user-visible no-server error names.

**Changes:**
- Added public-name no-server assertions for raw and edit tools
- Updated raw/edit no-server error text to use public tool names
- Hardened the old-name absence assertion
- Adjusted edit test setup to use a real temp workspace file

**Files:**
- tests/unit/toolRegistration.test.ts
- tests/integration/e2e.test.ts

**Flow:**
review stale names -> add tests -> observe failure -> update handler display names -> adjust test setup -> rerun tests -> typecheck -> lint

**Timestamp:** 2026-05-26T10:44:43.322Z

## Narrative
### Structure
The change set focused on public-facing no-server error strings in raw and edit tool handlers, while keeping internal descriptor keys unchanged. The test suite now validates the public names and uses a more robust absence check.

### Dependencies
The edit test needed a real temporary workspace file to avoid workspace validation failures before session matching.

### Highlights
The work completed with the requested test, typecheck, and lint checks passing.

### Rules
Use public names in user-visible no-server errors. Preserve internal behavior and descriptor lookup. Make old-name absence assertions robust by checking the intersection is empty when needed.

### Examples
Public raw tool names: request, notify, execute_command. Public edit tool names: rename, format_document, format_range, format_on_type, code_actions.

## Facts
- **task1_quality_re_review**: Task 1 quality re-review targeted remaining user-visible stale names in raw and edit tool no-server errors. [project]
- **raw_tool_no_server_names**: Raw tool no-server errors should use public names request, notify, and execute_command instead of internal lsp_request, lsp_notify, and lsp_execute_command. [project]
- **edit_tool_no_server_names**: Edit tool no-server errors should use public names rename, format_document, format_range, format_on_type, and code_actions instead of internal lsp_* names. [project]
- **tool_registration_absence_assertion**: The old-name absence assertion in tests/unit/toolRegistration.test.ts was made robust by checking each old name is absent or the intersection is empty. [project]
- **descriptor_lookup_preserved**: The implementation preserved internal behavior and descriptor lookup while mapping internal keys to public display names for handlers. [project]
- **edit_test_setup**: The focused tests passed after adjusting the edit test setup to use a real temp workspace file. [project]
- **unit_integration_test_result**: pnpm test tests/unit/toolRegistration.test.ts tests/integration/e2e.test.ts passed after the fix with 7 tests. [project]
- **typecheck_result**: pnpm run typecheck passed. [project]
- **lint_result**: pnpm run lint passed. [project]
