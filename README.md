<div align="center">
  <h1>language-server-mcp</h1>
  <p><strong>Language Server Protocol tools for any Model Context Protocol host.</strong></p>
  <p>
    <a href="https://www.npmjs.com/package/language-server-mcp"><img alt="npm version" src="https://img.shields.io/npm/v/@spiritledsoftware/language-server-mcp?color=cb3837"></a>
    <a href="https://www.npmjs.com/package/language-server-mcp"><img alt="npm downloads" src="https://img.shields.io/npm/dm/@spiritledsoftware/language-server-mcp"></a>
    <a href="https://www.npmjs.com/package/language-server-mcp"><img alt="Node.js version" src="https://img.shields.io/node/v/@spiritledsoftware/language-server-mcp"></a>
    <a href="https://github.com/spiritledsoftware/language-server-mcp/actions/workflows/ci.yml"><img alt="CI status" src="https://img.shields.io/github/actions/workflow/status/spiritledsoftware/language-server-mcp/ci.yml?branch=main&label=CI"></a>
    <a href="LICENSE"><img alt="License" src="https://img.shields.io/npm/l/language-server-mcp"></a>
  </p>
  <p>
    <a href="https://www.npmjs.com/package/language-server-mcp">NPM</a>
    · <a href="docs/config.md">Configuration</a>
    · <a href="docs/tools.md">Tools</a>
    · <a href="docs/architecture.md">Architecture</a>
    · <a href="https://github.com/spiritledsoftware/caplets">Caplets</a>
  </p>
</div>

`language-server-mcp` gives MCP hosts access to LSP features such as hover, definitions, references, diagnostics, symbols, formatting, code actions, and workspace edits.

It runs over stdio, starts local LSP servers on demand, and is designed to be launched directly by an MCP host with `npx`. Requires Node.js 22+.

## MCP Host Configuration

Configure your MCP host to run the published package over stdio:

```json
{
  "mcpServers": {
    "lsp": {
      "command": "npx",
      "args": ["-y", "language-server-mcp"]
    }
  }
}
```

This keeps the MCP host on the latest published package version unless your host pins or caches `npx` packages.

> [!TIP]
> **Using `language-server-mcp` with agents?** [`caplets`](https://github.com/spiritledsoftware/caplets) is the best way to expose this MCP server to agent workflows. `language-server-mcp` provides a large LSP surface area with many tools and rich project context; Caplets helps curate that surface into focused, agent-friendly capabilities instead of handing every tool to every agent directly.

For local development from a checkout, build first and point your host at the compiled entrypoint:

```json
{
  "mcpServers": {
    "lsp": {
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

Built-in registry coverage follows opencode's documented LSP server set, plus the existing `json` built-in. Canonical built-in IDs include `astro`, `bash`, `clangd`, `clojure-lsp`, `csharp`, `dart`, `deno`, `elixir-ls`, `eslint`, `fsharp`, `gleam`, `gopls`, `hls`, `jdtls`, `json`, `julials`, `kotlin-ls`, `lua-ls`, `nixd`, `ocaml-lsp`, `oxlint`, `php intelephense`, `prisma`, `pyright`, `razor`, `ruby-lsp`, `rust`, `sourcekit-lsp`, `svelte`, `terraform`, `tinymist`, `typescript`, `vue`, `yaml-ls`, and `zls`.

The built-in registry also accepts Mason and nvim-lspconfig aliases where available, such as `bashls`, `clojure_lsp`, `denols`, `elixirls`, `fsautocomplete`, `lua_ls`, `ocamllsp`, `intelephense`, `prismals`, `ruby_lsp`, `rust_analyzer`, `terraformls`, `ts_ls`, `vue_ls`, and `yamlls`. Compatibility aliases `go`, `python`, and `yaml` continue to resolve to `gopls`, `pyright`, and `yaml-ls`.

Mason data is vendored as a generated snapshot and never fetched at runtime, so built-in metadata and aliases are deterministic and offline. Managed downloads are available only for built-ins with supported pinned install strategies; other built-ins use system commands or explicit configured commands.

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

After `pnpm run build`, the CLI entrypoint is `dist/index.js`. The installed package binary name is `language-server-mcp`.

## Safety Defaults

`language-server-mcp` defaults to conservative behavior for file modification and process execution:

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
