# Tools

`lsp-mcp` registers lifecycle tools, raw LSP tools, diagnostics, edit-producing tools, and typed standard LSP tools.

## `serverId` Targeting

Most tools accept optional `serverId`.

When `serverId` is omitted:

- File-targeted tools run against every configured or built-in server whose `extensions` or `languageIds` match the file.
- Workspace-targeted raw tools run against all configured and built-in servers, deduplicated by registry entry.
- Standard typed tools use settled acquisition by default, so one matching server failing to start is returned as a per-server error while other matching servers can still succeed.
- Results are returned per server ID.

When `serverId` is provided:

- The tool targets exactly that server after resolving canonical IDs and aliases.
- Unknown or ambiguous server IDs fail with structured `code`, `serverId`, and `suggestions` fields.
- For file-targeted tools, a server with match criteria must match the file extension or provided language ID.

Canonical IDs are public language-server IDs, for example `typescript-language-server`, `vscode-json-language-server`, `pyright-langserver`, `rust-analyzer`, and `yaml-language-server`. Aliases include configured IDs, internal registry IDs, Mason names, nvim-lspconfig names such as `ts_ls`, command/package names, and language IDs. Language aliases can be ambiguous in polyglot ecosystems; for example `javascript` can match multiple servers. Use `search_servers` to inspect ranked candidates and then pass the canonical `id`.

For edit-producing tools, `apply: true` requires `serverId` if more than one server matches. This prevents applying edits from multiple servers by accident.

Standard typed tools also accept `strict: true`. In strict mode, any matching server acquisition failure fails the whole acquisition step. Omit `strict` for agent-friendly partial results.

## Standard Typed Tools

Standard tools map directly to LSP methods and validate input with typed schemas. They only run on servers that advertise the required capability.

Standard tools also advertise MCP `outputSchema` metadata for their structured responses. The project-specific wrapper schemas are maintained in source, while LSP payload schemas are generated from the installed `vscode-languageserver-types` and `vscode-languageserver-protocol` declarations. This lets MCP clients inspect or filter structured content without this project hand-maintaining LSP result shapes.

`workspace_symbols` accepts optional `filePath` and `languageId`. When either is provided, server selection is file/language-based instead of workspace-wide, which avoids starting unrelated language servers in polyglot workspaces.

Read-oriented tools:

- `hover`
- `signature_help`
- `declaration`
- `definition`
- `type_definition`
- `implementation`
- `references`
- `document_highlight`

Query-oriented tools:

- `completion`
- `document_symbols`
- `workspace_symbols`
- `code_lens`
- `document_links`
- `document_colors`
- `color_presentation`
- `folding_ranges`
- `selection_ranges`
- `semantic_tokens_full`
- `semantic_tokens_full_delta`
- `semantic_tokens_range`
- `linked_editing_range`
- `monikers`
- `inlay_hints`
- `inline_values`
- `call_hierarchy_prepare`
- `call_hierarchy_incoming`
- `call_hierarchy_outgoing`
- `type_hierarchy_prepare`
- `type_hierarchy_supertypes`
- `type_hierarchy_subtypes`

Resolve tools:

- `completion_resolve`
- `workspace_symbol_resolve`
- `code_lens_resolve`
- `document_link_resolve`
- `inlay_hint_resolve`

File and position inputs use 1-based `line` and `character` values. They are converted to LSP's 0-based positions before requests are sent.

Tools that need document state validate the file against `workspaceRoot`, then open it with `textDocument/didOpen` on first use. If the file content changes on disk, the next use sends a full-text `textDocument/didChange` with an incremented version. Files outside `workspaceRoot` are rejected unless `security.allowExternalFiles` is true.

## Diagnostics

`diagnostics` returns diagnostics from matching servers.

Input fields:

- `workspaceRoot`: required.
- `filePath`: optional. When provided, diagnostics are collected for that file.
- `languageId`: optional file language override.
- `serverId`: optional server target.

Behavior:

- If a file server supports LSP pull diagnostics, the tool sends `textDocument/diagnostic`.
- File diagnostics validate `filePath` against `workspaceRoot` before opening or reading the document.
- If file pull diagnostics are unavailable, the tool watches `textDocument/publishDiagnostics` and returns cached diagnostics or waits briefly for push diagnostics.
- The push wait timeout is `sessions.diagnosticsWaitMs` or `750` milliseconds by default.
- Workspace diagnostics require `workspace/diagnostic` support. Without `filePath`, servers that do not support workspace diagnostics return a per-server error.

Diagnostic results include a per-server `mode` of `pull`, `push-cache`, or `push-wait` when successful.

## Edit-Producing Tools

Edit-producing tools return edits by default and do not modify files unless `apply: true` is supplied.

Tools:

- `rename`
- `format_document`
- `format_range`
- `format_on_type`
- `code_actions`

Common input fields:

- `workspaceRoot`: required.
- `filePath`: required.
- `languageId`: optional.
- `serverId`: optional, but required for `apply: true` when multiple servers match.
- `apply`: optional, defaults to `false`.

When `apply` is false, responses include the edits or actions and the message `Edits were returned but not applied. Re-run with apply: true to modify files.`

When `apply` is true:

- Workspace edits and text edits are written to disk.
- The input file and changed files are validated against `workspaceRoot` unless `security.allowExternalFiles` is true.
- The implementation tracks the opened document content hash and rejects stale edits for files where it has an expected hash.
- `code_actions` applies a single safe default action only when exactly one actionable action is available. If multiple actionable code actions exist, pass `actionIndex`.
- Code action commands are subject to the same command policy as `execute_command`.

Formatting options currently default to `tabSize: 2` and `insertSpaces: true` unless those values are present in the tool input.

## Command Execution

`execute_command` sends `workspace/executeCommand` to matching servers.

Input fields:

- `workspaceRoot`: required.
- `filePath`: optional. When present, server matching is file-based.
- `languageId`: optional.
- `serverId`: optional.
- `command`: required LSP command string.
- `arguments`: optional command arguments array.

Command execution is enabled by default. `commands.enabled: false` disables it globally. `commands.allow.<serverId>` restricts the allowed command strings for a server. Allowlist keys are resolved through the same canonical ID and alias resolver and are enforced by canonical server ID.

## Raw LSP Tools

`request` sends an arbitrary LSP request:

```json
{
  "workspaceRoot": "/absolute/path/to/project",
  "filePath": "/absolute/path/to/project/src/index.ts",
  "serverId": "typescript-language-server",
  "method": "textDocument/hover",
  "params": {
    "textDocument": { "uri": "file:///absolute/path/to/project/src/index.ts" },
    "position": { "line": 0, "character": 0 }
  }
}
```

`notify` sends an arbitrary LSP notification and returns `null` per successful server.

Raw tool notes:

- `workspaceRoot` is required.
- `filePath` is optional. When omitted, server selection is workspace-wide.
- `method` is the native LSP method string.
- `params` are passed through unchanged.
- Raw request and notify tools use settled acquisition, so one server failing to start can be reported while other matching servers still run.
- Raw tools do not validate whether the method is supported by server capabilities.

## Server Status And Lifecycle

`list_servers` lists configured and built-in servers without starting them. It includes server metadata and install status. Optional `workspaceRoot`, `filePath`, `languageId`, and `serverId` fields filter the result without starting sessions.

`search_servers` searches configured and built-in servers by canonical ID, configured ID, registry ID, alias, command, package, language ID, extension, and upstream names. It returns ranked `matches` with `id`, `score`, `reasons`, aliases, language IDs, and extensions.

`server_status` reports matching server definitions and active sessions for a workspace. It accepts:

- `workspaceRoot`: required.
- `filePath`: optional. When present, status is filtered to file-matching servers.
- `languageId`: optional.
- `serverId`: optional.

`stop_server` stops one running server session for a workspace:

```json
{
  "workspaceRoot": "/absolute/path/to/project",
  "serverId": "typescript-language-server"
}
```

`stop_workspace` stops all running LSP sessions for a workspace:

```json
{
  "workspaceRoot": "/absolute/path/to/project"
}
```

Lifecycle tools operate on local sessions managed by the current MCP server process. They do not uninstall managed downloads or modify configuration.

## Output Schema Generation

Generated LSP payload schemas are checked in under `src/tools/generated/` and must not be edited by hand.

Commands:

- `pnpm run generate:lsp-output-schemas`: regenerates checked-in LSP output schemas from installed LSP library declaration files.
- `pnpm run check:lsp-output-schemas`: regenerates schemas and fails if `src/tools/generated/` differs from the checked-in version.

CI runs the freshness check after dependency installation. When upgrading LSP libraries or changing the generation script, regenerate the schemas and commit the generated diff with the source changes.
