---
title: LSP Caplet Smoke Test Findings
summary: Broad smoke test across 49 LSP caplet tools succeeded end-to-end; unsupported TypeScript capabilities failed structurally, and edit-tool success schemas were fixed in commit 66e22fa.
tags: []
related: [facts/project/rlm_curate_single_pass_workflow.md]
keywords: []
createdAt: '2026-05-26T22:53:58.838Z'
updatedAt: '2026-05-26T22:53:58.838Z'
---
## Reason
Curate durable findings from a broad smoke test of LSP caplet tools, including success, expected failures, and fixes.

## Raw Concept
**Task:**
Document the results and fixes from a comprehensive LSP caplet tool smoke test.

**Changes:**
- Validated all 49 caplet tools through the CLI
- Confirmed unsupported TypeScript-language features fail structurally rather than crashing
- Fixed edit-tool success output schemas and added a regression test

**Files:**
- tests/fixtures/fake-lsp-server.ts

**Flow:**
smoke test -> observe structured failures/successes -> fix schema issue -> add regression test -> restart stale backend -> confirm success

**Timestamp:** 2026-05-26T22:53:39.920Z

**Author:** assistant

## Narrative
### Structure
The smoke test covered server/control, raw request/notify, diagnostics/edit, and navigation/query tool groups. The outcome separated true transport/schema regressions from expected capability gaps in the TypeScript LSP.

### Dependencies
Relies on the caplet CLI, TypeScript LSP capability behavior, and the edit-tool schema validation path that was corrected in commit 66e22fa.

### Highlights
This run confirmed end-to-end tool plumbing and surfaced a stale-backend issue that masked the schema fix until the backend was restarted.

### Rules
Safe edit tools were tested with apply: false. Stop tools were tested at the end.

### Examples
Examples of working control tools include list_servers and server_status; examples of expected failures include declaration and document_colors.

## Facts
- **caplet_tool_count**: Broad smoke test completed across all 49 LSP caplet tools. [project]
- **caplet_cli_result**: 49/49 tools returned through the caplet CLI without downstream transport/schema failure. [project]
- **unsupported_tools_behavior**: Tools unsupported by the TypeScript LSP returned structured per-server failures instead of crashing. [project]
- **safe_edit_test_mode**: Safe edit tools were tested with apply set to false. [project]
- **stop_tools_tested**: Stop tools were tested at the end of the smoke test. [project]
- **working_tool_examples**: The following tools worked as key examples: list_servers, server_status, search_servers, stop_server, stop_workspace, request, notify, diagnostics, rename, format_document, format_range, code_actions, hover, completion, definition, references, document_symbols, folding_ranges, semantic_tokens_*, and inlay_hints. [project]
- **expected_structured_failures**: Expected structured failures were observed for declaration, document_links, document_colors, call_hierarchy_*, type_hierarchy_*, monikers, inline_values, format_on_type, and some resolve tools with synthetic test items. [project]
- **format_document_schema_fix**: A schema issue was fixed for format_document success results through the caplet wrapper. [project]
- **edit_tool_schema_fix**: Edit-tool success output schemas were fixed and a regression test was added. [project]
- **commit_reference**: The fix was committed as 66e22fa with message: fix: validate edit tool success outputs. [project]
- **backend_restart_effect**: After restarting the stale caplet backend, format_document returned structured success correctly. [project]
