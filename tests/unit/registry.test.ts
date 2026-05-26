import { describe, expect, it } from "vitest";

import { configSchema } from "../../src/config/schema.js";
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

  it("resolves Mason and compatibility aliases to canonical opencode IDs", () => {
    expect(Object.fromEntries(getBuiltInServerAliases())).toMatchObject({
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

  it("keeps aliases unique and unambiguous", () => {
    const aliases = getBuiltInServerAliases().map(([alias]) => alias);

    expect(new Set(aliases).size).toBe(aliases.length);
    for (const [alias, canonicalId] of getBuiltInServerAliases()) {
      expect(builtInServers).not.toHaveProperty(alias);
      expect(getBuiltInServer(alias)).toBe(builtInServers[canonicalId]);
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
