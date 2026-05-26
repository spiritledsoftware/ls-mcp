# Configuration

`lsp-mcp` loads JSON or JSONC configuration from user-level and project-level files. Later files override earlier files with recursive object merging.

## Paths And Priority

Config files are loaded in this order:

1. User JSON: `$XDG_CONFIG_HOME/lsp-mcp/config.json`, or `~/.config/lsp-mcp/config.json` when `XDG_CONFIG_HOME` is not set.
2. User JSONC: `$XDG_CONFIG_HOME/lsp-mcp/config.jsonc`, or `~/.config/lsp-mcp/config.jsonc`.
3. Project JSON: `<workspaceRoot>/.lsp-mcp.json`.
4. Project JSONC: `<workspaceRoot>/.lsp-mcp.jsonc`.

The project paths require an explicit workspace root. MCP tools require `workspaceRoot`; marker, Git, and parent-directory root inference exists as an internal resolver but is not currently applied to tool inputs. The stdio MCP server loads user config at startup and loads project config lazily for workspace-scoped tool calls that include `workspaceRoot`. Project config is scoped to that workspace and is not applied to unrelated workspace calls.

Project config is loaded once per normalized workspace root per MCP process. Changes to `.lsp-mcp.json` or `.lsp-mcp.jsonc` after the first tool call for that workspace require restarting the MCP server process before they take effect. If embedding the registry API directly, shutting down and recreating the configured registry has the same effect.

All config files are parsed with JSONC support, so comments and trailing commas are accepted in both `.json` and `.jsonc` files.

## Shape

```jsonc
{
  "logLevel": "info",
  "lsp": {
    "servers": {
      "typescript": {
        "registry": "typescript",
        "serverId": "workspace-typescript-language-server",
        "profile": "managed",
        "command": "typescript-language-server",
        "args": ["--stdio"],
        "env": {
          "EXAMPLE": "value",
        },
        "cwd": "/absolute/path/to/working-directory",
        "languageIds": ["typescript", "typescriptreact"],
        "extensions": [".ts", ".tsx"],
        "initializationOptions": {},
      },
    },
  },
  "sessions": {
    "maxActiveServers": 8,
    "maxOpenDocumentsPerSession": 256,
    "maxConcurrentRequestsPerServer": 4,
    "idleTimeoutMs": 300000,
    "requestTimeoutMs": 30000,
    "workspaceRequestTimeoutMs": 90000,
    "methodTimeoutsMs": {
      "workspace/symbol": 120000,
    },
    "diagnosticsWaitMs": 750,
  },
  "security": {
    "allowExternalFiles": false,
  },
  "downloads": {
    "enabled": true,
  },
  "commands": {
    "enabled": true,
    "allow": {
      "typescript-language-server": ["source.organizeImports.ts"],
    },
  },
}
```

Unknown top-level keys are allowed but produce warnings. Nested config objects are strict and reject unsupported keys.

## LSP Servers

Servers are configured under `lsp.servers`. For custom servers, the object key is the canonical `serverId` unless `serverId` is set inside the server object. For registry-backed servers, the object key is a configured-ID alias and the built-in canonical language-server ID remains the public ID unless overridden.

Built-in servers use recognizable language-server IDs as public canonical IDs, for example `typescript-language-server`, `vscode-json-language-server`, `vscode-eslint-language-server`, `pyright-langserver`, `gopls`, `rust-analyzer`, `yaml-language-server`, `svelte-language-server`, `intelephense`, and `julia-language-server`. Internal registry IDs such as `typescript`, `json`, `eslint`, `pyright`, `rust`, and `yaml-ls` are aliases for lookup and configuration.

The `registry` field accepts canonical IDs, internal registry IDs, and Mason/nvim-lspconfig aliases. Explicit tool and lifecycle `serverId` targeting also accepts those aliases when they resolve unambiguously. Common aliases include `bashls`, `clojure_lsp`, `denols`, `elixirls`, `fsautocomplete`, `lua_ls`, `ocamllsp`, `prismals`, `ruby_lsp`, `rust_analyzer`, `terraformls`, `ts_ls`, `vue_ls`, and `yamlls`.

Compatibility aliases from earlier built-ins are also preserved: `go` -> `gopls`, `python` -> `pyright-langserver`, and `yaml` -> `yaml-language-server`. Language IDs are aliases too, but they can be ambiguous; ambiguous aliases fail with structured suggestions and can be resolved with `search_servers`.

Server options:

- `registry`: built-in registry ID to inherit command, args, extensions, language IDs, and install behavior from.
- `serverId`: optional public canonical ID override. When set, the config object key remains an alias.
- `profile`: `managed` or `system`. `system` disables automatic install for built-ins and requires the command to be available manually.
- `command`: explicit executable to run. When provided, it is used instead of registry command resolution and must exist on `PATH` or be an absolute executable path.
- `args`: command arguments.
- `env`: additional environment variables for the LSP process.
- `cwd`: working directory for the LSP process. Defaults to the workspace root.
- `languageIds`: LSP language IDs matched by file-targeted tools.
- `extensions`: file extensions matched by file-targeted tools. Values may include or omit the leading dot.
- `initializationOptions`: value sent in the LSP `initialize` request.

Configured servers override the built-in server with the same canonical ID. If a configured server uses a `registry` that points to a built-in server, it also suppresses the default built-in definition for that registry ID to avoid duplicate tool execution. Duplicate canonical IDs or aliases are rejected during server definition construction.

Some built-ins have activation filters so optional or overlapping servers do not start for unrelated files. For example, `deno` requires `deno.json` or `deno.jsonc`, `eslint` requires an ESLint config marker, and `oxlint` requires an Oxlint config marker. Activation filtering affects automatic file matching; explicit `serverId` targeting still resolves known servers and reports normal command/install status.

### Biome Example

Biome is not a built-in registry entry, so configure it as a custom stdio server:

```jsonc
{
  "lsp": {
    "servers": {
      "biome": {
        "command": "biome",
        "args": ["lsp-proxy"],
        "languageIds": [
          "javascript",
          "javascriptreact",
          "typescript",
          "typescriptreact",
          "json",
          "jsonc",
        ],
        "extensions": [".js", ".jsx", ".ts", ".tsx", ".json", ".jsonc"],
      },
    },
  },
  "commands": {
    "allow": {
      "biome": ["biome.applyUnsafeFixes", "biome.applySafeFixes"],
    },
  },
}
```

The command must already be installed and visible to the MCP server process.

## Lazy Managed Downloads

Built-in servers with supported install strategies can be installed lazily. Mason package metadata is vendored in the package as a generated snapshot; `lsp-mcp` does not fetch the Mason registry at runtime. The snapshot is used for deterministic upstream metadata and aliases, while the hand-authored built-in overlay controls canonical IDs, commands, args, activation rules, root markers, and install policy.

On first use, command resolution checks in this order:

1. A configured `command`, if present.
2. A system command matching the built-in metadata.
3. A cached managed install under the lsp-mcp cache directory.
4. A new managed install, if downloads are enabled and the install strategy supports it.

The cache root is `$XDG_CACHE_HOME/lsp-mcp` or `~/.cache/lsp-mcp`. npm-backed servers are cached under `servers/<registryId>` with lock files under `install-locks` to serialize concurrent installs.

Managed downloads are pinned and limited to built-ins whose install strategy is explicitly supported, such as npm-backed language servers and selected deterministic archive downloads. Built-ins marked as system-only are never downloaded automatically; install the command yourself or provide an explicit `command` in config.

Disable managed downloads globally:

```jsonc
{
  "downloads": {
    "enabled": false,
  },
}
```

When downloads are disabled, built-ins still work if their command is already installed on `PATH` or if an explicit `command` is configured.

## Commands Policy

The raw `execute_command` tool and code actions that include commands call LSP `workspace/executeCommand`. Command execution is enabled by default.

Disable all command execution:

```jsonc
{
  "commands": {
    "enabled": false,
  },
}
```

Restrict commands for a server:

```jsonc
{
  "commands": {
    "allow": {
      "typescript-language-server": ["source.organizeImports.ts"],
    },
  },
}
```

If a server has no allowlist, all commands are allowed for that server unless `commands.enabled` is `false`. If a server has an allowlist, only listed command strings are allowed. Allowlist keys are normalized through the server identity resolver, so configured IDs and aliases such as `typescript` or `ts_ls` can be used when unambiguous, but enforcement happens by canonical server ID.

## Sessions

Session options control LSP process lifecycle and request handling:

- `maxActiveServers`: maximum number of active LSP sessions in the session manager that loaded this config. In the stdio runtime, user-only calls share the startup registry's session manager, and each project workspace config gets its own cached workspace registry and session manager. Defaults to unlimited.
- `maxOpenDocumentsPerSession`: maximum number of opened documents tracked per LSP session. Defaults to `256`. When opening another document would exceed the cap, the least-recently-used non-syncing document is evicted and the server is sent `textDocument/didClose` before local state is removed. If `didClose` cannot be sent, eviction still removes local state to enforce the cap.
- `maxConcurrentRequestsPerServer`: concurrent request limit per LSP process. Defaults to `4`.
- `idleTimeoutMs`: idle shutdown delay after each access. Defaults to `300000` milliseconds. Set to `0` to shut down immediately after use.
- `requestTimeoutMs`: default request timeout. Defaults to `30000` milliseconds.
- `workspaceRequestTimeoutMs`: timeout for workspace-wide requests such as `workspace/symbol` and `workspace/diagnostic`. Defaults to `90000` milliseconds.
- `methodTimeoutsMs`: per-LSP-method timeout overrides keyed by method name.
- `diagnosticsWaitMs`: wait time for push diagnostics when pull diagnostics are unavailable. Defaults to `750` milliseconds.

Timeout values of `0` disable that timeout path in the current implementation.

## Security

Applied edits are workspace-bound by default. When an edit writes a file outside `workspaceRoot`, the operation fails unless external files are explicitly allowed:

```jsonc
{
  "security": {
    "allowExternalFiles": true,
  },
}
```

This check applies to edit application. Read/query tools and raw LSP requests can still send paths or parameters you provide to the selected LSP server, so only run trusted LSP servers for trusted workspaces.
