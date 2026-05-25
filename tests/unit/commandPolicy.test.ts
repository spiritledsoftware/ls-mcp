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
});
