# Tools

`lsp-mcp` registers lifecycle tools, raw LSP tools, diagnostics, edit-producing tools, and typed standard LSP tools.

## `serverId` Targeting

Most tools accept optional `serverId`.

When `serverId` is omitted:

- File-targeted tools run against every configured or built-in server whose `extensions` or `languageIds` match the file.
- Workspace-targeted raw tools run against all configured and built-in servers, deduplicated by registry entry.
- Results are returned per server ID.

When `serverId` is provided:

- The tool targets exactly that server.
- Unknown server IDs fail.
- For file-targeted tools, a server with match criteria must match the file extension or provided language ID.

For edit-producing tools, `apply: true` requires `serverId` if more than one server matches. This prevents applying edits from multiple servers by accident.

## Standard Typed Tools

Standard tools map directly to LSP methods and validate input with typed schemas. They only run on servers that advertise the required capability.

Read-oriented tools:

- `hover`
- `signatureHelp`
- `declaration`
- `definition`
- `typeDefinition`
- `implementation`
- `references`
- `documentHighlight`

Query-oriented tools:

- `completion`
- `documentSymbols`
- `workspaceSymbols`
- `codeLens`
- `documentLinks`
- `documentColors`
- `colorPresentation`
- `foldingRanges`
- `selectionRanges`
- `semanticTokensFull`
- `semanticTokensFullDelta`
- `semanticTokensRange`
- `linkedEditingRange`
- `monikers`
- `inlayHints`
- `inlineValues`
- `callHierarchyPrepare`
- `callHierarchyIncoming`
- `callHierarchyOutgoing`
- `typeHierarchyPrepare`
- `typeHierarchySupertypes`
- `typeHierarchySubtypes`

Resolve tools:

- `completionResolve`
- `workspaceSymbolResolve`
- `codeLensResolve`
- `documentLinkResolve`
- `inlayHintResolve`

File and position inputs use 1-based `line` and `character` values. They are converted to LSP's 0-based positions before requests are sent.

Tools that need document state validate the file against `workspaceRoot`, then open it with `textDocument/didOpen` on first use. If the file content changes on disk, the next use sends a full-text `textDocument/didChange` with an incremented version. Files outside `workspaceRoot` are rejected unless `security.allowExternalFiles` is true.

## Diagnostics

`lsp_diagnostics` returns diagnostics from matching servers.

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

- `lsp_rename`
- `lsp_format_document`
- `lsp_format_range`
- `lsp_format_on_type`
- `lsp_code_actions`

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
- `lsp_code_actions` applies a single safe default action only when exactly one actionable action is available. If multiple actionable code actions exist, pass `actionIndex`.
- Code action commands are subject to the same command policy as `lsp_execute_command`.

Formatting options currently default to `tabSize: 2` and `insertSpaces: true` unless those values are present in the tool input.

## Command Execution

`lsp_execute_command` sends `workspace/executeCommand` to matching servers.

Input fields:

- `workspaceRoot`: required.
- `filePath`: optional. When present, server matching is file-based.
- `languageId`: optional.
- `serverId`: optional.
- `command`: required LSP command string.
- `arguments`: optional command arguments array.

Command execution is enabled by default. `commands.enabled: false` disables it globally. `commands.allow.<serverId>` restricts the allowed command strings for a server.

## Raw LSP Tools

`lsp_request` sends an arbitrary LSP request:

```json
{
  "workspaceRoot": "/absolute/path/to/project",
  "filePath": "/absolute/path/to/project/src/index.ts",
  "serverId": "typescript",
  "method": "textDocument/hover",
  "params": {
    "textDocument": { "uri": "file:///absolute/path/to/project/src/index.ts" },
    "position": { "line": 0, "character": 0 }
  }
}
```

`lsp_notify` sends an arbitrary LSP notification and returns `null` per successful server.

Raw tool notes:

- `workspaceRoot` is required.
- `filePath` is optional. When omitted, server selection is workspace-wide.
- `method` is the native LSP method string.
- `params` are passed through unchanged.
- Raw request and notify tools use settled acquisition, so one server failing to start can be reported while other matching servers still run.
- Raw tools do not validate whether the method is supported by server capabilities.

## Server Status And Lifecycle

`lsp_servers` lists configured and built-in servers without starting them. It includes server metadata and install status.

`lsp_server_status` reports matching server definitions and active sessions for a workspace. It accepts:

- `workspaceRoot`: required.
- `filePath`: optional. When present, status is filtered to file-matching servers.
- `languageId`: optional.
- `serverId`: optional.

`lsp_stop_server` stops one running server session for a workspace:

```json
{
  "workspaceRoot": "/absolute/path/to/project",
  "serverId": "typescript"
}
```

`lsp_stop_workspace` stops all running LSP sessions for a workspace:

```json
{
  "workspaceRoot": "/absolute/path/to/project"
}
```

Lifecycle tools operate on local sessions managed by the current MCP server process. They do not uninstall managed downloads or modify configuration.
