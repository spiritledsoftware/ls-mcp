# LSP MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` or `executing-plans` to implement this task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Build a fast, low-memory, exhaustive MCP server that exposes LSP capabilities to agents through typed MCP tools, lazy language-server startup, and on-demand managed language-server downloads.

**Architecture:** A Node 22 TypeScript MCP server runs over stdio and manages local stdio LSP server processes. LSP sessions are lazy-created per workspace/server ID, auto-open files from disk, aggregate results across all matching servers by default, and shut down after configurable idle time. Standard LSP 3.17 requests are exposed as typed MCP tools, with `lsp_request`, `lsp_notify`, and `lsp_execute_command` for exhaustive/custom coverage.

**Tech Stack:** Node.js 22, TypeScript, MCP TypeScript SDK, `vscode-jsonrpc/node`, `vscode-languageserver-protocol`, `vscode-uri`, `zod`, `jsonc-parser`, `vitest`, `tsx`, `eslint`.

---

## Locked Decisions

| Area               | Decision                                                                         |
| ------------------ | -------------------------------------------------------------------------------- |
| Runtime            | TypeScript on Node.js 22+                                                        |
| MCP transport      | stdio only in v1                                                                 |
| LSP transport      | local stdio process only in v1                                                   |
| Tool model         | typed standard LSP tools plus raw request/notify escape hatches                  |
| Commands           | single `lsp_execute_command`; command execution allowed by default               |
| Server matching    | run all matching LSP servers when `serverId` is omitted                          |
| Server targeting   | every LSP request tool accepts optional `serverId`                               |
| File input         | `filePath` first, one-based line/character at MCP boundary                       |
| Internal protocol  | file URI and zero-based LSP positions internally                                 |
| Document sync      | auto-open from disk on demand, full-document sync                                |
| Config format      | JSON and JSONC                                                                   |
| Config priority    | user JSON, user JSONC, project JSON, project JSONC                               |
| Config paths       | `$XDG_CONFIG_HOME/lsp-mcp/config.json[c]`, `<workspaceRoot>/.lsp-mcp.json[c]`    |
| Config merge       | LSP definitions merge by ID, arrays replace, objects deep-merge                  |
| Downloads          | lazy managed downloads enabled by default, disableable                           |
| User LSPs          | any custom `command` is allowed; assumed present on PATH if not registry-managed |
| Mutations          | edit-producing tools have `apply?: boolean`, default `false`                     |
| Apply safety       | `apply: true` requires `serverId` when multiple servers match                    |
| Workspace security | outside-workspace file access/editing denied by default, configurable            |
| Diagnostics        | one `lsp_diagnostics` tool supports pull plus cached push diagnostics            |
| Concurrency        | bounded per-server concurrency, timeouts, cancellation forwarding                |
| Spec baseline      | typed tools cover LSP 3.17 stable; raw tools cover 3.18/proposed/vendor          |

---

## Target File Structure

| Path                              | Responsibility                                     |
| --------------------------------- | -------------------------------------------------- |
| `package.json`                    | package metadata, bin entry, scripts               |
| `tsconfig.json`                   | Node 22 TypeScript config                          |
| `vitest.config.ts`                | test config                                        |
| `eslint.config.js`                | lint config                                        |
| `src/index.ts`                    | CLI entrypoint                                     |
| `src/mcp/server.ts`               | create MCP server and register tools               |
| `src/mcp/stdio.ts`                | stdio MCP transport wiring                         |
| `src/tools/registerTools.ts`      | registers all tool handlers                        |
| `src/tools/toolSchemas.ts`        | shared zod schemas for MCP tools                   |
| `src/tools/standardTools.ts`      | generic typed LSP request forwarding               |
| `src/tools/editTools.ts`          | rename, formatting, code actions with `apply`      |
| `src/tools/diagnosticTools.ts`    | diagnostics aggregation                            |
| `src/tools/rawTools.ts`           | `lsp_request`, `lsp_notify`, `lsp_execute_command` |
| `src/tools/serverTools.ts`        | server status/list/stop tools                      |
| `src/lsp/methodRegistry.ts`       | metadata for typed LSP 3.17 request tools          |
| `src/lsp/sessionManager.ts`       | lazy session lookup, lifecycle, idle teardown      |
| `src/lsp/session.ts`              | single LSP server process/session                  |
| `src/lsp/transport.ts`            | LSP transport interface                            |
| `src/lsp/stdioTransport.ts`       | spawn stdio language server process                |
| `src/lsp/documentStore.ts`        | per-server opened document state                   |
| `src/lsp/capabilities.ts`         | capability checks and feature support              |
| `src/lsp/diagnosticStore.ts`      | push diagnostic cache                              |
| `src/lsp/resultNormalization.ts`  | path/URI/range normalization and grouping          |
| `src/lsp/editApplier.ts`          | safe application of `WorkspaceEdit` / `TextEdit`   |
| `src/lsp/commandPolicy.ts`        | command allowlist/narrowing                        |
| `src/config/paths.ts`             | XDG/user/project config path resolution            |
| `src/config/schema.ts`            | config zod schema                                  |
| `src/config/loadConfig.ts`        | load JSON/JSONC and merge precedence               |
| `src/config/rootResolver.ts`      | workspace root resolution                          |
| `src/registry/builtins.ts`        | managed LSP registry metadata                      |
| `src/registry/installer.ts`       | lazy install orchestration                         |
| `src/registry/npmInstaller.ts`    | npm package install strategy                       |
| `src/registry/githubInstaller.ts` | GitHub release binary install strategy             |
| `src/registry/locks.ts`           | install file locks                                 |
| `src/security/workspace.ts`       | workspace boundary checks                          |
| `src/utils/fs.ts`                 | filesystem helpers                                 |
| `src/utils/json.ts`               | JSON/JSONC parsing helpers                         |
| `src/utils/errors.ts`             | structured error helpers                           |
| `tests/fixtures/`                 | fake LSP servers and sample workspaces             |
| `tests/unit/*.test.ts`            | unit tests                                         |
| `tests/integration/*.test.ts`     | integration tests with fake LSPs                   |
| `docs/config.md`                  | config reference                                   |
| `docs/tools.md`                   | MCP tool reference                                 |
| `docs/architecture.md`            | architecture notes                                 |

---

## Implementation Tasks

### Task 1: Project Skeleton

Create package/build/test/lint scaffolding and a minimal stdio MCP server with an `lsp_servers` placeholder tool. Verify `npm run typecheck` and `npm test`.

### Task 2: Config Paths, JSONC Parsing, and Merge

Implement XDG/user/project config path resolution, JSON/JSONC parsing, schema validation, and merge precedence: user JSON, user JSONC, project JSON, project JSONC. Arrays replace, objects deep-merge, LSP definitions merge by ID.

### Task 3: Workspace Root Resolution and Security Boundaries

Implement explicit/marker/git/parent workspace root resolution and default-deny workspace boundary checks with `security.allowExternalFiles` support.

### Task 4: Built-In Registry and Lazy Installer

Implement managed server registry, install decision logic, disabled-download behavior, PATH/system command preference, and install locks. Add initial entries for TypeScript, JSON, YAML, Python, Rust, Go, and clangd.

### Task 5: LSP Stdio Transport

Implement process spawning, JSON-RPC stdio transport wiring, stderr ring buffer, exit status tracking, and graceful/forceful dispose.

### Task 6: LSP Session Initialization

Implement LSP initialize/initialized/shutdown lifecycle against a fake LSP server fixture and store initialized capabilities.

### Task 7: Session Manager, Lazy Startup, and Idle Teardown

Implement per `{ workspaceRoot, serverId }` sessions, matching by extension/language ID, optional server targeting, lazy startup, max active servers, and idle shutdown.

### Task 8: Document Store and Auto-Open From Disk

Track opened documents per session, infer language IDs, convert paths/positions, auto-send `didOpen`, send full-document `didChange` on disk changes, and increment versions.

### Task 9: Method Registry and Generic Forwarding

Define LSP 3.17 typed method registry and shared forwarding handler with capability metadata, per-server aggregation, partial failures, and normalized path/range/location results.

### Task 10: Diagnostics Tool

Implement `lsp_diagnostics` backed by pull diagnostics when available and cached push diagnostics otherwise, with bounded wait for push-only servers.

### Task 11: Edit-Producing Tools With `apply`

Implement safe text/workspace edit application. Edit-producing tools default `apply` to false and return a clear not-applied message. `apply: true` requires `serverId` when multiple servers match and enforces workspace safety.

### Task 12: Command Execution Policy

Implement `commands.enabled`, optional per-server `commands.allow`, `lsp_execute_command`, and code-action command execution during `apply: true` when allowed.

### Task 13: Raw Request and Notify Tools

Implement `lsp_request` and `lsp_notify` for native LSP params, optional `serverId`, and grouped per-server results.

### Task 14: MCP Tool Registration

Register control, raw, diagnostics, edit, and standard registry-driven tools with concise descriptions and correct shared schemas.

### Task 15: Concurrency, Timeouts, and Cancellation

Add per-server request queue, max concurrency, default/workspace request timeouts, LSP cancellation forwarding, and health tracking.

### Task 16: Server Status and Lifecycle Tools

Implement `lsp_servers`, `lsp_server_status`, `lsp_stop_server`, and `lsp_stop_workspace` with install status, running status, capabilities, health, and idle information.

### Task 17: End-to-End Smoke Tests

Cover lazy startup, multi-server aggregation, `serverId` targeting, apply false/true formatting, command execution, outside-workspace edit rejection, and idle shutdown.

### Task 18: Documentation

Write README and docs for config, tools, architecture, lazy downloads, custom LSP servers, `serverId`, `apply`, security, and raw tools.

### Task 19: Release Readiness

Add bin/package files metadata, changelog, build output checks, and verify `lint`, `typecheck`, `test`, `build`, and `npm pack --dry-run`.

---

## Verification Commands

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm pack --dry-run
```
