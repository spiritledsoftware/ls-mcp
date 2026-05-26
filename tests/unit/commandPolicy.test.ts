import { describe, expect, it } from "vitest";

import { assertCommandAllowed, isCommandAllowed } from "../../src/lsp/commandPolicy.js";

describe("command execution policy", () => {
  it("allows all commands by default", () => {
    expect(isCommandAllowed({}, "ts", "source.fixAll.ts")).toBe(true);
  });

  it("blocks all commands when disabled", () => {
    expect(isCommandAllowed({ commands: { enabled: false } }, "ts", "source.fixAll.ts")).toBe(
      false,
    );
    expect(() =>
      assertCommandAllowed({ commands: { enabled: false } }, "ts", "source.fixAll.ts"),
    ).toThrow("Command execution is disabled");
  });

  it("allows listed commands and blocks unlisted commands for a server allowlist", () => {
    const config = { commands: { allow: { ts: ["source.fixAll.ts"] } } };

    expect(isCommandAllowed(config, "ts", "source.fixAll.ts")).toBe(true);
    expect(isCommandAllowed(config, "ts", "source.organizeImports.ts")).toBe(false);
    expect(isCommandAllowed(config, "eslint", "source.organizeImports.ts")).toBe(true);
    expect(() => assertCommandAllowed(config, "ts", "source.organizeImports.ts")).toThrow(
      'Command "source.organizeImports.ts" is not allowed for server ts',
    );
  });

  it("normalizes allowlist keys through a canonical server ID resolver", () => {
    const config = { commands: { allow: { typescript: ["source.fixAll.ts"] } } };
    const resolveServerId = (serverId: string) =>
      serverId === "typescript" ? "typescript-language-server" : serverId;

    expect(
      isCommandAllowed(config, "typescript-language-server", "source.fixAll.ts", {
        resolveServerId,
      }),
    ).toBe(true);
    expect(
      isCommandAllowed(config, "typescript-language-server", "source.organizeImports.ts", {
        resolveServerId,
      }),
    ).toBe(false);
  });

  it("fails closed when an allowlist key cannot be resolved unambiguously", () => {
    const config = { commands: { allow: { typescript: ["source.fixAll.ts"] } } };
    const resolveServerId = () => {
      throw new Error(
        'Ambiguous LSP server "typescript". Did you mean: typescript-language-server, eslint-lsp?',
      );
    };

    expect(() =>
      assertCommandAllowed(config, "typescript-language-server", "source.fixAll.ts", {
        resolveServerId,
      }),
    ).toThrow(
      'Invalid commands.allow key "typescript": Ambiguous LSP server "typescript". Did you mean: typescript-language-server, eslint-lsp?',
    );
  });

  it("fails closed when allowlist normalization is required but no resolver is provided", () => {
    const config = { commands: { allow: { typescript: ["source.fixAll.ts"] } } };

    expect(() =>
      assertCommandAllowed(config, "typescript-language-server", "source.fixAll.ts", {
        requireResolvedAllowlist: true,
      }),
    ).toThrow("Command allowlist requires server ID resolution");
  });
});
