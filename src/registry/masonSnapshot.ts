export interface MasonPackageMetadata {
  package: string;
  version: string;
  source: string;
  lspconfig?: string;
}

export const masonSnapshot = {
  astro: {
    package: "astro-language-server",
    version: "2.16.0",
    source: "npm:astro-language-server",
    lspconfig: "astro",
  },
  bash: {
    package: "bash-language-server",
    version: "5.6.0",
    source: "npm:bash-language-server",
    lspconfig: "bashls",
  },
  "clojure-lsp": {
    package: "clojure-lsp",
    version: "system",
    source: "system:clojure-lsp",
    lspconfig: "clojure_lsp",
  },
  csharp: {
    package: "csharp-language-server",
    version: "system",
    source: "system:csharp-ls",
    lspconfig: "csharp_ls",
  },
  deno: { package: "deno", version: "system", source: "system:deno", lspconfig: "denols" },
  "elixir-ls": {
    package: "elixir-ls",
    version: "system",
    source: "system:elixir-ls",
    lspconfig: "elixirls",
  },
  fsharp: {
    package: "fsautocomplete",
    version: "system",
    source: "system:fsautocomplete",
    lspconfig: "fsautocomplete",
  },
  gopls: { package: "gopls", version: "system", source: "system:gopls", lspconfig: "gopls" },
  hls: {
    package: "haskell-language-server",
    version: "system",
    source: "system:haskell-language-server",
    lspconfig: "hls",
  },
  jdtls: { package: "jdtls", version: "system", source: "system:jdtls", lspconfig: "jdtls" },
  julials: {
    package: "julia-lsp",
    version: "system",
    source: "system:julia",
    lspconfig: "julials",
  },
  "lua-ls": {
    package: "lua-language-server",
    version: "system",
    source: "system:lua-language-server",
    lspconfig: "lua_ls",
  },
  "ocaml-lsp": {
    package: "ocaml-lsp",
    version: "system",
    source: "system:ocamllsp",
    lspconfig: "ocamllsp",
  },
  oxlint: {
    package: "oxlint",
    version: "system",
    source: "system:oxc_language_server",
    lspconfig: "oxlint",
  },
  "php intelephense": {
    package: "intelephense",
    version: "1.15.0",
    source: "npm:intelephense",
    lspconfig: "intelephense",
  },
  prisma: {
    package: "prisma-language-server",
    version: "6.20.0",
    source: "npm:@prisma/language-server",
    lspconfig: "prismals",
  },
  pyright: { package: "pyright", version: "1.1.409", source: "npm:pyright", lspconfig: "pyright" },
  "ruby-lsp": {
    package: "ruby-lsp",
    version: "system",
    source: "system:ruby-lsp",
    lspconfig: "ruby_lsp",
  },
  rust: {
    package: "rust-analyzer",
    version: "system",
    source: "system:rust-analyzer",
    lspconfig: "rust_analyzer",
  },
  svelte: {
    package: "svelte-language-server",
    version: "0.18.0",
    source: "npm:svelte-language-server",
    lspconfig: "svelte",
  },
  terraform: {
    package: "terraform-ls",
    version: "system",
    source: "system:terraform-ls",
    lspconfig: "terraformls",
  },
  tinymist: {
    package: "tinymist",
    version: "system",
    source: "system:tinymist",
    lspconfig: "tinymist",
  },
  typescript: {
    package: "typescript-language-server",
    version: "5.3.0",
    source: "npm:typescript-language-server",
    lspconfig: "ts_ls",
  },
  vue: {
    package: "vue-language-server",
    version: "3.1.5",
    source: "npm:@vue/language-server",
    lspconfig: "vue_ls",
  },
  "yaml-ls": {
    package: "yaml-language-server",
    version: "1.23.0",
    source: "npm:yaml-language-server",
    lspconfig: "yamlls",
  },
  zls: { package: "zls", version: "system", source: "system:zls", lspconfig: "zls" },
} satisfies Record<string, MasonPackageMetadata>;
