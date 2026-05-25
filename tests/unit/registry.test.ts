import { describe, expect, it } from "vitest";

import { configSchema } from "../../src/config/schema.js";
import { builtInServers, getBuiltInServer } from "../../src/registry/builtins.js";

describe("built-in registry", () => {
  it("contains initial managed and system-only servers", () => {
    expect(Object.keys(builtInServers).sort()).toEqual([
      "clangd",
      "go",
      "json",
      "python",
      "rust",
      "typescript",
      "yaml",
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
    expect(builtInServers.yaml.installStrategy.type).toBe("npm");
    expect(builtInServers.python.installStrategy.type).toBe("npm");
    expect(builtInServers.rust.installStrategy.type).toBe("system");
    expect(builtInServers.go.installStrategy.type).toBe("system");
    expect(builtInServers.clangd.installStrategy.type).toBe("system");
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
