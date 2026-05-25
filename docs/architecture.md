# Architecture

`lsp-mcp` bridges MCP tool calls to local Language Server Protocol processes. It is intentionally local-first: MCP uses stdio, LSP servers use stdio, and file edits are applied directly to the local filesystem only when requested.

## MCP Stdio Transport

The CLI entrypoint starts an MCP server over stdio using `@modelcontextprotocol/sdk`'s `StdioServerTransport`. The stdio runtime builds a configured tool registry, connects the MCP server to the transport, and closes the server on transport close, `SIGINT`, or `SIGTERM`.

The MCP server exposes tools through one configured registry facade. The facade loads user config at startup. For workspace-scoped tool calls, it lazily loads project config once per normalized `workspaceRoot` and creates a cached workspace registry for that config. Closing the facade shuts down the startup registry and all cached workspace registries, including their active LSP sessions.

Project config changes are not watched. A workspace registry keeps using the config loaded for its first tool call until the MCP process restarts or the configured registry facade is shut down and recreated by an embedding host.

## Local Stdio LSP Processes

Each LSP session wraps one local stdio LSP process. The session uses `vscode-jsonrpc` to create a message connection over a `StdioLspTransport`, sends `initialize`, stores server capabilities, then sends `initialized`.

LSP process command resolution is handled before session startup. A resolved command may come from explicit config, a system executable, or a managed install cache for supported built-ins.

The client capabilities are static and include support for workspace edits, workspace folders, common text document features, publish diagnostics, semantic tokens, inlay hints, and cancellation via JSON-RPC cancellation messages.

## Lazy Startup And Idle Shutdown

LSP servers are lazy. Listing servers or status does not start processes. A session starts only when a tool needs a matching server.

Active sessions are keyed by normalized workspace root and `serverId`. Repeated requests reuse the same process. Concurrent startup for the same key is coalesced so only one process starts.

After each access, the session manager updates `lastAccessedAt` and schedules idle shutdown. The default idle timeout is five minutes. `sessions.idleTimeoutMs` customizes it:

- A finite positive value schedules shutdown after that many milliseconds.
- `0` shuts the session down immediately after access.
- A non-finite internal value disables idle shutdown, though the public config schema accepts only JSON numbers.

Manual lifecycle tools can stop one server or all servers for a workspace.

## Session Manager Model

The session manager owns server definitions and active sessions.

Server definitions are built from:

- User/project `lsp.servers` config.
- Built-in registry entries not overridden by config.

Matching rules:

- File-targeted requests match by extension or explicit `languageId`.
- A provided `serverId` selects one definition and validates file/language match when that definition has match criteria.
- Omitted `serverId` runs all matching definitions, deduplicated by built-in registry ID to avoid duplicate configured-plus-built-in execution.
- Workspace requests target all workspace server definitions unless `serverId` is provided.

The manager enforces `sessions.maxActiveServers` before starting new sessions. In the stdio runtime this limit applies to the session manager that loaded the relevant config: user-only tool calls use the startup registry's manager, while each project workspace config uses its own cached workspace manager. It reports active process, health, capabilities, access time, and idle deadline through status tools.

## Document Sync Model

Document state is kept per LSP session in memory. When a tool needs a document:

1. The file path is resolved and converted to a file URI.
2. If the document is not open for that session, the file is read from disk and sent with `textDocument/didOpen`.
3. If it is already open, the file is read again and hashed.
4. If the hash changed, a full-text `textDocument/didChange` is sent with an incremented version.

Each session keeps at most `sessions.maxOpenDocumentsPerSession` opened documents in memory, defaulting to 256. The document store treats successful opens and accesses as LRU touches. When opening a new document would exceed the cap, it evicts the least-recently-used document that is not currently syncing, sends `textDocument/didClose` on a best-effort basis, and then removes local state. Documents with in-flight `didOpen` or `didChange` synchronization are skipped during eviction to avoid racing the active sync for that URI; a session can temporarily exceed the cap if every eviction candidate is protected by in-flight sync.

The implementation does not currently send incremental changes, file watching events, or `didSave`. Document versions are maintained only for documents opened by the current MCP process.

Tool input positions are 1-based and converted to LSP 0-based positions before requests are sent.

## Managed Installer And Cache

Built-in servers include metadata such as language IDs, extensions, command, args, install strategy, and version. Current built-ins are `typescript`, `json`, `yaml`, `python`, `rust`, `go`, and `clangd`.

Command resolution checks:

1. Explicit configured command.
2. Built-in command already available on `PATH`.
3. Cached managed install.
4. New managed install, only when the strategy supports it and `downloads.enabled` is not false.

The cache root is `$XDG_CACHE_HOME/lsp-mcp` or `~/.cache/lsp-mcp`. Managed servers are stored under `servers/<serverId>`. Install locks live under `install-locks` and serialize concurrent installs for the same built-in ID and version.

Automatic installation is not supported for built-ins with `system` install strategy, such as `rust`, `go`, and `clangd` in the current registry. Those commands must be installed manually or configured explicitly.

## Concurrency, Timeouts, And Cancellation

Each LSP session limits concurrent requests. The default is four active requests per server, configurable with `sessions.maxConcurrentRequestsPerServer`. Additional requests queue until a slot is available. Queued requests observe abort signals.

Request timeouts:

- `sessions.requestTimeoutMs` defaults to 30000 milliseconds.
- `sessions.workspaceRequestTimeoutMs` defaults to 90000 milliseconds for `workspace/symbol` and `workspace/diagnostic`.
- `sessions.methodTimeoutsMs` overrides individual LSP methods.

On timeout or abort, the session sends JSON-RPC cancellation through `vscode-jsonrpc` cancellation tokens and returns a structured error to the tool caller where the tool supports per-server error wrapping.

Session startup for a single workspace/server key is coalesced. Requests to different servers can run independently, and many multi-server tools collect per-server results with `Promise.all`.

## Security And Workspace Boundary Model

The primary file safety boundary is workspace-root validation before document reads/opening and during edit application. Document-state tools, applied text edits, and workspace edits validate real paths against the real path of `workspaceRoot`. Reads and writes outside the workspace fail unless `security.allowExternalFiles` is true.

Other safety controls:

- Edit-producing tools default to `apply: false` and return edits instead of writing files.
- Applying edits from multiple matching servers requires explicit `serverId`.
- LSP command execution can be disabled globally with `commands.enabled: false`.
- Per-server command allowlists restrict `workspace/executeCommand` command strings.
- Managed downloads can be disabled with `downloads.enabled: false`.

The boundary model does not sandbox LSP server processes. Configured or managed LSP servers run as local child processes with the MCP server process privileges. Raw LSP tools pass through arbitrary methods and params to selected servers. Only configure and run trusted language servers in trusted workspaces.
