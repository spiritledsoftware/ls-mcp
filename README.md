# lsp-mcp

`lsp-mcp` is a Model Context Protocol (MCP) server that exposes Language Server Protocol (LSP) features to MCP hosts. It runs as a stdio MCP server, starts local stdio LSP processes on demand, and translates MCP tool calls into LSP requests, notifications, diagnostics, edits, and server lifecycle operations.

The project is written for Node.js 22+ and TypeScript.

## Install And Build

```sh
pnpm install
pnpm run build
```

Useful development commands:

```sh
pnpm run typecheck
pnpm run lint
pnpm test
pnpm run dev
```

After `pnpm run build`, the CLI entrypoint is `dist/index.js`. The package binary name is `lsp-mcp` when installed as a package.

## MCP Host Configuration

Configure your MCP host to run `lsp-mcp` over stdio. For a local checkout, use Node directly with the absolute path to your checkout:

```json
{
  "mcpServers": {
    "lsp-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/lsp-mcp/dist/index.js"]
    }
  }
}
```

If installed as a package, configure the host to run the package binary instead:

```json
{
  "mcpServers": {
    "lsp-mcp": {
      "command": "lsp-mcp",
      "args": []
    }
  }
}
```

## Quick Start

Create a project config file at `.lsp-mcp.jsonc`:

```jsonc
{
  "lsp": {
    "servers": {
      "typescript": {
        "registry": "typescript",
      },
    },
  },
}
```

Build and start the MCP server through your MCP host. Then call an LSP tool such as `hover`:

```json
{
  "workspaceRoot": "/absolute/path/to/project",
  "filePath": "/absolute/path/to/project/src/index.ts",
  "line": 3,
  "character": 12
}
```

For file-targeted tools, `serverId` is optional. If omitted, the tool runs against every configured or built-in server whose language IDs or file extensions match the target file. Add `"serverId": "typescript"` to target one server.

Built-in registry IDs currently include `typescript`, `json`, `yaml`, `python`, `rust`, `go`, and `clangd`. Managed downloads are available only for built-ins whose install strategy supports them, currently npm-backed built-ins such as TypeScript, JSON, YAML, and Python.

## Safety Defaults

`lsp-mcp` defaults to conservative behavior for file modification and process execution:

- Edit-producing tools return edits by default and do not write files unless `apply: true` is passed.
- `apply: true` requires `serverId` when more than one matching LSP server would produce edits.
- Applied edits are restricted to the workspace root unless `security.allowExternalFiles` is set to `true`.
- `workspace/executeCommand` is enabled by default, but can be disabled globally or restricted with per-server command allowlists.
- LSP servers start lazily on first use and stop after an idle timeout by default.
- Managed downloads are enabled by default for supported built-in servers, but can be disabled with `downloads.enabled: false`.

## Documentation

- [Configuration](docs/config.md)
- [Tools](docs/tools.md)
- [Architecture](docs/architecture.md)
