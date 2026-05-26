import { describe, expect, it } from "vitest";

import { configSchema } from "../../src/config/schema.js";
import { buildAliasDetails } from "../../src/lsp/serverIdentity.js";
import {
  builtInServers,
  getBuiltInServer,
  getBuiltInServerAliases,
} from "../../src/registry/builtins.js";

describe("built-in registry", () => {
  it("contains opencode documented servers plus json", () => {
    expect(Object.keys(builtInServers).sort()).toEqual([
      "astro",
      "bash",
      "clangd",
      "clojure-lsp",
      "csharp",
      "dart",
      "deno",
      "elixir-ls",
      "eslint",
      "fsharp",
      "gleam",
      "gopls",
      "hls",
      "jdtls",
      "json",
      "julials",
      "kotlin-ls",
      "lua-ls",
      "nixd",
      "ocaml-lsp",
      "oxlint",
      "php intelephense",
      "prisma",
      "pyright",
      "razor",
      "ruby-lsp",
      "rust",
      "sourcekit-lsp",
      "svelte",
      "terraform",
      "tinymist",
      "typescript",
      "vue",
      "yaml-ls",
      "zls",
    ]);

    expect(builtInServers.typescript).toMatchObject({
      id: "typescript",
      serverId: "typescript-language-server",
      languageIds: ["typescript", "typescriptreact", "javascript", "javascriptreact"],
      extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"],
      command: "typescript-language-server",
      args: ["--stdio"],
      installStrategy: { type: "npm", package: "typescript-language-server" },
    });
    expect(builtInServers.json.command).toBe("vscode-json-language-server");
    expect(builtInServers.json.installStrategy.type).toBe("npm");
    expect(builtInServers["yaml-ls"].installStrategy.type).toBe("npm");
    expect(builtInServers.pyright.installStrategy.type).toBe("npm");
    expect(builtInServers.rust.installStrategy.type).toBe("system");
    expect(builtInServers.gopls.installStrategy.type).toBe("system");
    expect(builtInServers.clangd.installStrategy.type).toBe("system");
  });

  it("defines explicit public canonical server IDs separate from registry IDs", () => {
    expect(builtInServers.typescript).toMatchObject({
      id: "typescript",
      serverId: "typescript-language-server",
    });
    expect(builtInServers.json).toMatchObject({
      id: "json",
      serverId: "vscode-json-language-server",
    });
    expect(builtInServers.eslint).toMatchObject({
      id: "eslint",
      serverId: "vscode-eslint-language-server",
    });
    expect(builtInServers.pyright).toMatchObject({ id: "pyright", serverId: "pyright-langserver" });
    expect(builtInServers.rust).toMatchObject({ id: "rust", serverId: "rust-analyzer" });
    expect(builtInServers["yaml-ls"]).toMatchObject({
      id: "yaml-ls",
      serverId: "yaml-language-server",
    });
    expect(builtInServers.svelte).toMatchObject({
      id: "svelte",
      serverId: "svelte-language-server",
    });
    expect(builtInServers["php intelephense"]).toMatchObject({
      id: "php intelephense",
      serverId: "intelephense",
    });
    expect(builtInServers.julials).toMatchObject({
      id: "julials",
      serverId: "julia-language-server",
    });

    for (const server of Object.values(builtInServers)) {
      expect(server.serverId).toEqual(expect.any(String));
      expect(server.serverId).not.toBe("");
    }
  });

  it("resolves Mason, lspconfig, and old registry ID aliases to internal registry IDs", () => {
    expect(Object.fromEntries(getBuiltInServerAliases())).toMatchObject({
      "typescript-language-server": "typescript",
      "vscode-json-language-server": "json",
      "vscode-eslint-language-server": "eslint",
      "pyright-langserver": "pyright",
      "rust-analyzer": "rust",
      "yaml-language-server": "yaml-ls",
      "svelte-language-server": "svelte",
      intelephense: "php intelephense",
      "julia-language-server": "julials",
      bashls: "bash",
      clojure_lsp: "clojure-lsp",
      csharp_ls: "csharp",
      denols: "deno",
      elixirls: "elixir-ls",
      fsautocomplete: "fsharp",
      go: "gopls",
      lua_ls: "lua-ls",
      ocamllsp: "ocaml-lsp",
      prismals: "prisma",
      python: "pyright",
      ruby_lsp: "ruby-lsp",
      rust_analyzer: "rust",
      terraformls: "terraform",
      ts_ls: "typescript",
      vue_ls: "vue",
      yaml: "yaml-ls",
      yamlls: "yaml-ls",
    });

    for (const [alias, canonicalId] of getBuiltInServerAliases()) {
      expect(getBuiltInServer(alias)?.id).toBe(canonicalId);
    }
  });

  it("keeps language IDs out of built-in aliases and adds them through identity alias details", () => {
    const aliases = Object.fromEntries(getBuiltInServerAliases());

    expect(aliases).not.toMatchObject({
      javascript: "typescript",
      jsonc: "json",
      php: "php intelephense",
    });

    expect(
      buildAliasDetails({
        registryId: builtInServers.typescript.id,
        languageIds: builtInServers.typescript.languageIds,
      }),
    ).toEqual(
      expect.arrayContaining([
        { value: "typescript", kind: "registry-id" },
        { value: "javascript", kind: "language-id" },
        { value: "typescriptreact", kind: "language-id" },
      ]),
    );
  });

  it("keeps aliases unique and unambiguous", () => {
    const aliases = getBuiltInServerAliases().map(([alias]) => alias);

    expect(new Set(aliases).size).toBe(aliases.length);
    for (const [alias, canonicalId] of getBuiltInServerAliases()) {
      expect(builtInServers).not.toHaveProperty(alias);
      expect(getBuiltInServer(alias)).toBe(builtInServers[canonicalId]);
    }
  });

  it("keeps each built-in metadata aliases array unique", () => {
    for (const [id, server] of Object.entries(builtInServers)) {
      expect(server.aliases, `${id} aliases`).toEqual([...new Set(server.aliases)]);
    }
  });

  it("aliases languages to languageIds for compatibility", () => {
    const server = getBuiltInServer("typescript");

    expect(server?.languages).toBe(server?.languageIds);
  });

  it("parses downloads config and registry server profile", () => {
    const result = configSchema.parse({
      downloads: { enabled: false },
      lsp: { servers: { ts: { registry: "typescript", profile: "managed" } } },
    });

    expect(result.downloads?.enabled).toBe(false);
    expect(result.lsp?.servers?.ts).toEqual({ registry: "typescript", profile: "managed" });
  });
});
