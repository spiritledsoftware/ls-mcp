import { masonSnapshot, type MasonPackageMetadata } from "./masonSnapshot.js";

export type InstallStrategy =
  | { type: "npm"; package: string }
  | { type: "github"; repository: string; assetPattern: string; binPath: string }
  | { type: "system" };

export interface BuiltInServerMetadata {
  id: string;
  serverId: string;
  languages: string[];
  languageIds: string[];
  extensions: string[];
  rootMarkers: string[];
  command: string;
  args: string[];
  installStrategy: InstallStrategy;
  version: string;
  platforms: string[];
  aliases: string[];
  upstream?: { mason?: MasonPackageMetadata };
  activation?: { requiredRootMarkers?: string[]; excludedRootMarkers?: string[] };
  checksum?: string;
}

type Overlay = Omit<BuiltInServerMetadata, "languages" | "aliases" | "upstream"> & {
  aliases?: string[];
};

const allPlatforms = ["linux", "darwin", "win32"];

function npm(packageName: string): InstallStrategy {
  return { type: "npm", package: packageName };
}

function system(): InstallStrategy {
  return { type: "system" };
}

function overlay(metadata: Overlay): Overlay {
  return metadata;
}

const builtInOverlay = {
  astro: overlay({
    id: "astro",
    serverId: "astro-language-server",
    languageIds: ["astro"],
    extensions: [".astro"],
    rootMarkers: ["astro.config.mjs", "astro.config.ts", "package.json"],
    command: "astro-ls",
    args: ["--stdio"],
    installStrategy: npm("@astrojs/language-server"),
    version: "2.16.0",
    platforms: allPlatforms,
  }),
  bash: overlay({
    id: "bash",
    serverId: "bash-language-server",
    languageIds: ["shellscript", "bash", "sh"],
    extensions: [".sh", ".bash", ".zsh"],
    rootMarkers: [".bashrc", ".shellcheckrc"],
    command: "bash-language-server",
    args: ["start"],
    installStrategy: npm("bash-language-server"),
    version: "5.6.0",
    platforms: allPlatforms,
  }),
  clangd: overlay({
    id: "clangd",
    serverId: "clangd",
    languageIds: ["c", "cpp", "objective-c", "objective-cpp"],
    extensions: [".c", ".h", ".cc", ".cpp", ".cxx", ".hpp", ".hh", ".hxx"],
    rootMarkers: ["compile_commands.json", "compile_flags.txt", ".clangd"],
    command: "clangd",
    args: [],
    installStrategy: system(),
    version: "system",
    platforms: allPlatforms,
  }),
  "clojure-lsp": overlay({
    id: "clojure-lsp",
    serverId: "clojure-lsp",
    languageIds: ["clojure"],
    extensions: [".clj", ".cljs", ".cljc", ".edn"],
    rootMarkers: ["deps.edn", "project.clj", "build.boot"],
    command: "clojure-lsp",
    args: [],
    installStrategy: system(),
    version: "system",
    platforms: allPlatforms,
  }),
  csharp: overlay({
    id: "csharp",
    serverId: "csharp-ls",
    languageIds: ["csharp"],
    extensions: [".cs"],
    rootMarkers: [".sln", ".csproj"],
    command: "csharp-ls",
    args: [],
    installStrategy: system(),
    version: "system",
    platforms: allPlatforms,
  }),
  dart: overlay({
    id: "dart",
    serverId: "dart-analysis-server",
    languageIds: ["dart"],
    extensions: [".dart"],
    rootMarkers: ["pubspec.yaml"],
    command: "dart",
    args: ["language-server", "--protocol=lsp"],
    installStrategy: system(),
    version: "system",
    platforms: allPlatforms,
  }),
  deno: overlay({
    id: "deno",
    serverId: "deno-language-server",
    languageIds: ["typescript", "typescriptreact", "javascript", "javascriptreact"],
    extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs"],
    rootMarkers: ["deno.json", "deno.jsonc"],
    command: "deno",
    args: ["lsp"],
    installStrategy: system(),
    version: "system",
    platforms: allPlatforms,
    activation: { requiredRootMarkers: ["deno.json", "deno.jsonc"] },
  }),
  "elixir-ls": overlay({
    id: "elixir-ls",
    serverId: "elixir-ls",
    languageIds: ["elixir", "eelixir"],
    extensions: [".ex", ".exs", ".heex"],
    rootMarkers: ["mix.exs"],
    command: "elixir-ls",
    args: [],
    installStrategy: system(),
    version: "system",
    platforms: allPlatforms,
  }),
  eslint: overlay({
    id: "eslint",
    serverId: "vscode-eslint-language-server",
    languageIds: ["javascript", "javascriptreact", "typescript", "typescriptreact"],
    extensions: [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"],
    rootMarkers: ["eslint.config.js", ".eslintrc", ".eslintrc.json", "package.json"],
    command: "vscode-eslint-language-server",
    args: ["--stdio"],
    installStrategy: npm("vscode-langservers-extracted"),
    version: "4.10.0",
    platforms: allPlatforms,
    activation: {
      requiredRootMarkers: [
        "eslint.config.js",
        "eslint.config.mjs",
        "eslint.config.cjs",
        ".eslintrc",
        ".eslintrc.json",
        ".eslintrc.js",
        ".eslintrc.cjs",
      ],
    },
  }),
  fsharp: overlay({
    id: "fsharp",
    serverId: "fsautocomplete",
    languageIds: ["fsharp"],
    extensions: [".fs", ".fsx", ".fsi"],
    rootMarkers: [".fsproj", ".sln"],
    command: "fsautocomplete",
    args: ["--adaptive-lsp-server-enabled"],
    installStrategy: system(),
    version: "system",
    platforms: allPlatforms,
  }),
  gleam: overlay({
    id: "gleam",
    serverId: "gleam-language-server",
    languageIds: ["gleam"],
    extensions: [".gleam"],
    rootMarkers: ["gleam.toml"],
    command: "gleam",
    args: ["lsp"],
    installStrategy: system(),
    version: "system",
    platforms: allPlatforms,
  }),
  gopls: overlay({
    id: "gopls",
    serverId: "gopls",
    languageIds: ["go"],
    extensions: [".go"],
    rootMarkers: ["go.mod", "go.work"],
    command: "gopls",
    args: [],
    installStrategy: system(),
    version: "system",
    platforms: allPlatforms,
    aliases: ["go"],
  }),
  hls: overlay({
    id: "hls",
    serverId: "haskell-language-server",
    languageIds: ["haskell"],
    extensions: [".hs", ".lhs"],
    rootMarkers: ["hie.yaml", "stack.yaml", "cabal.project"],
    command: "haskell-language-server-wrapper",
    args: ["--lsp"],
    installStrategy: system(),
    version: "system",
    platforms: allPlatforms,
  }),
  jdtls: overlay({
    id: "jdtls",
    serverId: "jdtls",
    languageIds: ["java"],
    extensions: [".java"],
    rootMarkers: ["pom.xml", "build.gradle", "settings.gradle"],
    command: "jdtls",
    args: [],
    installStrategy: system(),
    version: "system",
    platforms: allPlatforms,
  }),
  json: overlay({
    id: "json",
    serverId: "vscode-json-language-server",
    languageIds: ["json", "jsonc"],
    extensions: [".json", ".jsonc"],
    rootMarkers: ["package.json"],
    command: "vscode-json-language-server",
    args: ["--stdio"],
    installStrategy: npm("vscode-langservers-extracted"),
    version: "4.10.0",
    platforms: allPlatforms,
  }),
  julials: overlay({
    id: "julials",
    serverId: "julia-language-server",
    languageIds: ["julia"],
    extensions: [".jl"],
    rootMarkers: ["Project.toml", "Manifest.toml"],
    command: "julia",
    args: ["--startup-file=no", "--history-file=no", "-e", "using LanguageServer; runserver()"],
    installStrategy: system(),
    version: "system",
    platforms: allPlatforms,
  }),
  "kotlin-ls": overlay({
    id: "kotlin-ls",
    serverId: "kotlin-language-server",
    languageIds: ["kotlin"],
    extensions: [".kt", ".kts"],
    rootMarkers: ["settings.gradle", "settings.gradle.kts", "pom.xml"],
    command: "kotlin-language-server",
    args: [],
    installStrategy: system(),
    version: "system",
    platforms: allPlatforms,
  }),
  "lua-ls": overlay({
    id: "lua-ls",
    serverId: "lua-language-server",
    languageIds: ["lua"],
    extensions: [".lua"],
    rootMarkers: [".luarc.json", ".luarc.jsonc", ".stylua.toml"],
    command: "lua-language-server",
    args: [],
    installStrategy: system(),
    version: "system",
    platforms: allPlatforms,
  }),
  nixd: overlay({
    id: "nixd",
    serverId: "nixd",
    languageIds: ["nix"],
    extensions: [".nix"],
    rootMarkers: ["flake.nix", "default.nix"],
    command: "nixd",
    args: [],
    installStrategy: system(),
    version: "system",
    platforms: ["linux", "darwin"],
  }),
  "ocaml-lsp": overlay({
    id: "ocaml-lsp",
    serverId: "ocaml-lsp",
    languageIds: ["ocaml", "reason"],
    extensions: [".ml", ".mli", ".re", ".rei"],
    rootMarkers: ["dune-project", "dune", "*.opam"],
    command: "ocamllsp",
    args: [],
    installStrategy: system(),
    version: "system",
    platforms: allPlatforms,
  }),
  oxlint: overlay({
    id: "oxlint",
    serverId: "oxlint-language-server",
    languageIds: ["javascript", "javascriptreact", "typescript", "typescriptreact"],
    extensions: [".js", ".jsx", ".ts", ".tsx"],
    rootMarkers: ["oxlint.json", ".oxlintrc.json", "package.json"],
    command: "oxc_language_server",
    args: [],
    installStrategy: system(),
    version: "system",
    platforms: allPlatforms,
    activation: { requiredRootMarkers: ["oxlint.json", ".oxlintrc.json"] },
  }),
  "php intelephense": overlay({
    id: "php intelephense",
    serverId: "intelephense",
    languageIds: ["php"],
    extensions: [".php"],
    rootMarkers: ["composer.json", "index.php"],
    command: "intelephense",
    args: ["--stdio"],
    installStrategy: npm("intelephense"),
    version: "1.15.0",
    platforms: allPlatforms,
  }),
  prisma: overlay({
    id: "prisma",
    serverId: "prisma-language-server",
    languageIds: ["prisma"],
    extensions: [".prisma"],
    rootMarkers: ["schema.prisma", "package.json"],
    command: "prisma-language-server",
    args: ["--stdio"],
    installStrategy: npm("@prisma/language-server"),
    version: "6.20.0",
    platforms: allPlatforms,
  }),
  pyright: overlay({
    id: "pyright",
    serverId: "pyright-langserver",
    languageIds: ["python"],
    extensions: [".py", ".pyi"],
    rootMarkers: ["pyproject.toml", "setup.py", "requirements.txt", ".python-version"],
    command: "pyright-langserver",
    args: ["--stdio"],
    installStrategy: npm("pyright"),
    version: "1.1.409",
    platforms: allPlatforms,
    aliases: ["python"],
  }),
  razor: overlay({
    id: "razor",
    serverId: "razor-language-server",
    languageIds: ["razor"],
    extensions: [".razor", ".cshtml"],
    rootMarkers: [".sln", ".csproj"],
    command: "rzls",
    args: [],
    installStrategy: system(),
    version: "system",
    platforms: allPlatforms,
  }),
  "ruby-lsp": overlay({
    id: "ruby-lsp",
    serverId: "ruby-lsp",
    languageIds: ["ruby"],
    extensions: [".rb"],
    rootMarkers: ["Gemfile", ".ruby-version"],
    command: "ruby-lsp",
    args: [],
    installStrategy: system(),
    version: "system",
    platforms: allPlatforms,
  }),
  rust: overlay({
    id: "rust",
    serverId: "rust-analyzer",
    languageIds: ["rust"],
    extensions: [".rs"],
    rootMarkers: ["Cargo.toml", "rust-project.json"],
    command: "rust-analyzer",
    args: [],
    installStrategy: system(),
    version: "system",
    platforms: allPlatforms,
  }),
  "sourcekit-lsp": overlay({
    id: "sourcekit-lsp",
    serverId: "sourcekit-lsp",
    languageIds: ["swift"],
    extensions: [".swift"],
    rootMarkers: ["Package.swift"],
    command: "sourcekit-lsp",
    args: [],
    installStrategy: system(),
    version: "system",
    platforms: ["darwin", "linux"],
  }),
  svelte: overlay({
    id: "svelte",
    serverId: "svelte-language-server",
    languageIds: ["svelte"],
    extensions: [".svelte"],
    rootMarkers: ["svelte.config.js", "svelte.config.ts", "package.json"],
    command: "svelteserver",
    args: ["--stdio"],
    installStrategy: npm("svelte-language-server"),
    version: "0.18.0",
    platforms: allPlatforms,
  }),
  terraform: overlay({
    id: "terraform",
    serverId: "terraform-ls",
    languageIds: ["terraform", "terraform-vars"],
    extensions: [".tf", ".tfvars"],
    rootMarkers: [".terraform", ".terraform.lock.hcl"],
    command: "terraform-ls",
    args: ["serve"],
    installStrategy: system(),
    version: "system",
    platforms: allPlatforms,
  }),
  tinymist: overlay({
    id: "tinymist",
    serverId: "tinymist",
    languageIds: ["typst"],
    extensions: [".typ"],
    rootMarkers: ["typst.toml"],
    command: "tinymist",
    args: ["lsp"],
    installStrategy: system(),
    version: "system",
    platforms: allPlatforms,
  }),
  typescript: overlay({
    id: "typescript",
    serverId: "typescript-language-server",
    languageIds: ["typescript", "typescriptreact", "javascript", "javascriptreact"],
    extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"],
    rootMarkers: ["tsconfig.json", "jsconfig.json", "package.json"],
    command: "typescript-language-server",
    args: ["--stdio"],
    installStrategy: npm("typescript-language-server"),
    version: "5.3.0",
    platforms: allPlatforms,
    activation: { excludedRootMarkers: ["deno.json", "deno.jsonc"] },
  }),
  vue: overlay({
    id: "vue",
    serverId: "vue-language-server",
    languageIds: ["vue"],
    extensions: [".vue"],
    rootMarkers: ["vue.config.js", "vite.config.ts", "package.json"],
    command: "vue-language-server",
    args: ["--stdio"],
    installStrategy: npm("@vue/language-server"),
    version: "3.1.5",
    platforms: allPlatforms,
  }),
  "yaml-ls": overlay({
    id: "yaml-ls",
    serverId: "yaml-language-server",
    languageIds: ["yaml"],
    extensions: [".yaml", ".yml"],
    rootMarkers: [".yamllint", ".prettierrc", "package.json"],
    command: "yaml-language-server",
    args: ["--stdio"],
    installStrategy: npm("yaml-language-server"),
    version: "1.23.0",
    platforms: allPlatforms,
    aliases: ["yaml"],
  }),
  zls: overlay({
    id: "zls",
    serverId: "zls",
    languageIds: ["zig"],
    extensions: [".zig", ".zon"],
    rootMarkers: ["build.zig", "zls.json"],
    command: "zls",
    args: [],
    installStrategy: system(),
    version: "system",
    platforms: allPlatforms,
  }),
} satisfies Record<string, Overlay>;

function server(metadata: Overlay): BuiltInServerMetadata {
  const mason = (masonSnapshot as Partial<Record<string, MasonPackageMetadata>>)[metadata.id];
  return {
    ...metadata,
    aliases: dedupeAliases([
      ...(metadata.serverId !== metadata.id ? [metadata.serverId] : []),
      ...(mason?.lspconfig && mason.lspconfig !== metadata.id ? [mason.lspconfig] : []),
      ...(metadata.aliases ?? []),
    ]),
    languages: metadata.languageIds,
    upstream: mason ? { mason } : undefined,
  };
}

function dedupeAliases(values: string[]): string[] {
  return [...new Set(values)];
}

export const builtInServers = Object.fromEntries(
  Object.entries(builtInOverlay).map(([id, metadata]) => [id, server(metadata)]),
) as { [Id in keyof typeof builtInOverlay]: BuiltInServerMetadata };

export type BuiltInServerId = keyof typeof builtInServers;

const aliases = buildAliasMap();

export function getBuiltInServer(idOrAlias: string): BuiltInServerMetadata | undefined {
  return builtInServers[(aliases.get(idOrAlias) ?? idOrAlias) as BuiltInServerId];
}

export function getBuiltInServerAliases(): Array<[string, BuiltInServerId]> {
  return [...aliases.entries()];
}

function buildAliasMap(): Map<string, BuiltInServerId> {
  const result = new Map<string, BuiltInServerId>();
  for (const [id, metadata] of Object.entries(builtInServers) as Array<
    [BuiltInServerId, BuiltInServerMetadata]
  >) {
    for (const alias of metadata.aliases) {
      if (alias in builtInServers) {
        throw new Error(`Built-in alias ${alias} conflicts with server id ${alias}`);
      }
      const previous = result.get(alias);
      if (previous && previous !== id) {
        throw new Error(`Built-in alias ${alias} maps to both ${previous} and ${id}`);
      }
      result.set(alias, id);
    }
  }
  return result;
}
