---
title: Task 1 E2E Tool Name Cleanup
summary: Task 1 cleanup renamed stale e2e public tool names and confirmed no remaining direct old registry call sites in tests.
tags: []
related: [facts/conventions/rlm_curate_workflow.md]
keywords: []
createdAt: '2026-05-26T10:30:47.747Z'
updatedAt: '2026-05-26T10:30:47.747Z'
---
## Reason
Capture the durable outcome of the Task 1 stale e2e tool name cleanup and test verification

## Raw Concept
**Task:**
Record the Task 1 stale e2e tool name cleanup and verification outcome

**Changes:**
- Renamed stale e2e tool calls in the integration test suite
- Checked for any remaining direct old public tool names in tests
- Verified the targeted unit and integration tests passed

**Files:**
- tests/integration/e2e.test.ts
- tests/unit/toolRegistration.test.ts
- tests/integration/serverTools.test.ts

**Flow:**
identify stale tool names -> update direct call sites -> search for remaining old names -> run focused tests -> confirm pass

**Timestamp:** 2026-05-26T10:30:26.976Z

**Author:** ByteRover context engineer

## Narrative
### Structure
This note captures a focused test-suite cleanup for Task 1, centered on public tool registration name changes in e2e coverage.

### Dependencies
Depends on the test suite remaining aligned with the renamed public tool registry names and on focused verification via the targeted pnpm test command.

### Highlights
No direct old public tool call sites remained after the update, and the targeted tests passed.

### Rules
Update only the stale direct call sites that break because of the registration rename; do not broaden the change scope.

### Examples
Direct registry names were changed to format_document, execute_command, and code_actions.

## Facts
- **e2e_tool_name_rename**: Task 1 required updating stale e2e tool names in tests/integration/e2e.test.ts from lsp_format_document to format_document, lsp_execute_command to execute_command, and lsp_code_actions to code_actions. [project]
- **remaining_old_tool_calls**: The follow-up search found no remaining direct old Task 1 public tool call sites in the tests that needed updates. [project]
- **focused_test_result**: The focused test command pnpm test tests/unit/toolRegistration.test.ts tests/integration/serverTools.test.ts tests/integration/e2e.test.ts passed with 14 tests. [project]
