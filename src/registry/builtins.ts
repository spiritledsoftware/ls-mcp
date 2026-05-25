export type InstallStrategy =
  | { type: "npm"; package: string }
  | { type: "github"; repository: string; assetPattern?: string }
  | { type: "system" };

export interface BuiltInServerMetadata {
  id: string;
  languages: string[];
  languageIds: string[];
  extensions: string[];
  rootMarkers: string[];
  command: string;
  args: string[];
  installStrategy: InstallStrategy;
  version: string;
  platforms: string[];
  checksum?: string;
}

function server(metadata: Omit<BuiltInServerMetadata, "languages">): BuiltInServerMetadata {
  return { ...metadata, languages: metadata.languageIds };
}

export const builtInServers = {
  typescript: server({
    id: "typescript",
    languageIds: ["typescript", "typescriptreact", "javascript", "javascriptreact"],
    extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"],
    rootMarkers: ["tsconfig.json", "jsconfig.json", "package.json"],
    command: "typescript-language-server",
    args: ["--stdio"],
    installStrategy: { type: "npm", package: "typescript-language-server" },
    version: "5.3.0",
    platforms: ["linux", "darwin", "win32"],
  }),
  json: server({
    id: "json",
    languageIds: ["json", "jsonc"],
    extensions: [".json", ".jsonc"],
    rootMarkers: ["package.json"],
    command: "vscode-json-language-server",
    args: ["--stdio"],
    installStrategy: { type: "npm", package: "vscode-langservers-extracted" },
    version: "4.10.0",
    platforms: ["linux", "darwin", "win32"],
  }),
  yaml: server({
    id: "yaml",
    languageIds: ["yaml"],
    extensions: [".yaml", ".yml"],
    rootMarkers: [".yamllint", ".prettierrc", "package.json"],
    command: "yaml-language-server",
    args: ["--stdio"],
    installStrategy: { type: "npm", package: "yaml-language-server" },
    version: "1.23.0",
    platforms: ["linux", "darwin", "win32"],
  }),
  python: server({
    id: "python",
    languageIds: ["python"],
    extensions: [".py", ".pyi"],
    rootMarkers: ["pyproject.toml", "setup.py", "requirements.txt", ".python-version"],
    command: "pyright-langserver",
    args: ["--stdio"],
    installStrategy: { type: "npm", package: "pyright" },
    version: "1.1.409",
    platforms: ["linux", "darwin", "win32"],
  }),
  rust: server({
    id: "rust",
    languageIds: ["rust"],
    extensions: [".rs"],
    rootMarkers: ["Cargo.toml", "rust-project.json"],
    command: "rust-analyzer",
    args: [],
    installStrategy: { type: "system" },
    version: "system",
    platforms: ["linux", "darwin", "win32"],
  }),
  go: server({
    id: "go",
    languageIds: ["go"],
    extensions: [".go"],
    rootMarkers: ["go.mod", "go.work"],
    command: "gopls",
    args: [],
    installStrategy: { type: "system" },
    version: "system",
    platforms: ["linux", "darwin", "win32"],
  }),
  clangd: server({
    id: "clangd",
    languageIds: ["c", "cpp", "objective-c", "objective-cpp"],
    extensions: [".c", ".h", ".cc", ".cpp", ".cxx", ".hpp", ".hh", ".hxx"],
    rootMarkers: ["compile_commands.json", "compile_flags.txt", ".clangd"],
    command: "clangd",
    args: [],
    installStrategy: { type: "system" },
    version: "system",
    platforms: ["linux", "darwin", "win32"],
  }),
} satisfies Record<string, BuiltInServerMetadata>;

export type BuiltInServerId = keyof typeof builtInServers;

export function getBuiltInServer(id: string): BuiltInServerMetadata | undefined {
  return builtInServers[id as BuiltInServerId];
}
