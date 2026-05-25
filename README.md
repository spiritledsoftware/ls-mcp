<div align="center">
  <h1>ls-mcp</h1>
  <p><strong>Language Server Protocol tools for any Model Context Protocol host.</strong></p>
  <p>
    <a href="https://www.npmjs.com/package/@spiritledsoftware/ls-mcp"><img alt="npm version" src="https://img.shields.io/npm/v/@spiritledsoftware/ls-mcp?color=cb3837"></a>
    <a href="https://www.npmjs.com/package/@spiritledsoftware/ls-mcp"><img alt="npm downloads" src="https://img.shields.io/npm/dm/@spiritledsoftware/ls-mcp"></a>
    <a href="https://www.npmjs.com/package/@spiritledsoftware/ls-mcp"><img alt="Node.js version" src="https://img.shields.io/node/v/@spiritledsoftware/ls-mcp"></a>
    <a href="https://github.com/spiritledsoftware/ls-mcp/actions/workflows/ci.yml"><img alt="CI status" src="https://img.shields.io/github/actions/workflow/status/spiritledsoftware/ls-mcp/ci.yml?branch=main&label=CI"></a>
    <a href="LICENSE"><img alt="License" src="https://img.shields.io/npm/l/@spiritledsoftware/ls-mcp"></a>
  </p>
  <p>
    <a href="https://www.npmjs.com/package/@spiritledsoftware/ls-mcp">NPM</a>
    · <a href="docs/config.md">Configuration</a>
    · <a href="docs/tools.md">Tools</a>
    · <a href="docs/architecture.md">Architecture</a>
    · <a href="https://github.com/spiritledsoftware/caplets">Caplets</a>
  </p>
</div>

`ls-mcp` gives MCP hosts access to LSP features such as hover, definitions, references, diagnostics, symbols, formatting, code actions, and workspace edits.

It runs over stdio, starts local LSP servers on demand, and is designed to be launched directly by an MCP host with `npx`. Requires Node.js 22+.

## MCP Host Configuration

Configure your MCP host to run the published package over stdio:

```json
{
  "mcpServers": {
    "ls-mcp": {
      "command": "npx",
      "args": ["-y", "@spiritledsoftware/ls-mcp"]
    }
  }
}
```

This keeps the MCP host on the latest published package version unless your host pins or caches `npx` packages.

> [!TIP]
> **Using `ls-mcp` with agents?** [`caplets`](https://github.com/spiritledsoftware/caplets) is the best way to expose this MCP server to agent workflows. `ls-mcp` provides a large LSP surface area with many tools and rich project context; Caplets helps curate that surface into focused, agent-friendly capabilities instead of handing every tool to every agent directly.

For local development from a checkout, build first and point your host at the compiled entrypoint:

```json
{
  "mcpServers": {
    "ls-mcp-local": {
      "command": "node",
      "args": ["/absolute/path/to/checkout/dist/index.js"]
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

## Development

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

After `pnpm run build`, the CLI entrypoint is `dist/index.js`. The installed package binary name is `ls-mcp`.

## Safety Defaults

`ls-mcp` defaults to conservative behavior for file modification and process execution:

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
