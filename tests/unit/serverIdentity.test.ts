import { describe, expect, it } from "vitest";

import {
  ServerResolutionError,
  buildAliasDetails,
  dedupeAliasDetails,
  formatAmbiguousServerError,
  formatUnknownServerError,
  rankServerIdentities,
  type ServerIdentity,
} from "../../src/lsp/serverIdentity.js";

const identities: ServerIdentity[] = [
  {
    id: "typescript-language-server",
    configuredId: "frontend-ts",
    registryId: "typescript",
    aliases: [
      { value: "tsserver", kind: "legacy-id" },
      { value: "typescript-language-server", kind: "mason" },
      { value: "ts_ls", kind: "lspconfig" },
    ],
    command: "typescript-language-server",
    packageName: "typescript-language-server",
    languageIds: ["typescript", "javascript"],
    extensions: [".ts", ".tsx", ".js"],
  },
  {
    id: "vtsls",
    registryId: "vtsls",
    command: "vtsls",
    packageName: "@vtsls/language-server",
    languageIds: ["typescript", "javascript"],
    extensions: [".ts", ".tsx", ".js"],
  },
  {
    id: "yaml-language-server",
    registryId: "yaml-ls",
    aliases: [{ value: "yamlls", kind: "mason" }],
    command: "yaml-language-server",
    packageName: "yaml-language-server",
    languageIds: ["yaml"],
    extensions: [".yaml", ".yml"],
  },
];

describe("server identity helpers", () => {
  it("builds alias details with requested kinds and dedupes by value and kind", () => {
    const aliases = buildAliasDetails({
      configuredId: "frontend-ts",
      registryId: "typescript",
      legacyIds: ["tsserver", "typescript"],
      masonIds: ["typescript-language-server", "typescript-language-server"],
      lspconfigIds: ["ts_ls"],
      languageIds: ["typescript"],
      command: "typescript-language-server",
      packageName: "typescript-language-server",
    });

    expect(aliases).toEqual([
      { value: "frontend-ts", kind: "configured-id" },
      { value: "typescript", kind: "registry-id" },
      { value: "tsserver", kind: "legacy-id" },
      { value: "typescript", kind: "legacy-id" },
      { value: "typescript-language-server", kind: "mason" },
      { value: "ts_ls", kind: "lspconfig" },
      { value: "typescript", kind: "language-id" },
      { value: "typescript-language-server", kind: "command" },
      { value: "typescript-language-server", kind: "package" },
    ]);

    expect(
      dedupeAliasDetails([
        { value: "typescript", kind: "registry-id" },
        { value: "typescript", kind: "registry-id" },
        { value: "typescript", kind: "language-id" },
      ]),
    ).toEqual([
      { value: "typescript", kind: "registry-id" },
      { value: "typescript", kind: "language-id" },
    ]);
  });

  it("ranks exact matches by canonical id and alias kind", () => {
    expect(
      rankServerIdentities(identities, { query: "typescript-language-server" })[0],
    ).toMatchObject({
      id: "typescript-language-server",
      score: 100,
    });
    expect(rankServerIdentities(identities, { query: "frontend-ts" })[0]).toMatchObject({
      id: "typescript-language-server",
      score: 95,
    });
    expect(rankServerIdentities(identities, { query: "typescript" })[0]).toMatchObject({
      id: "typescript-language-server",
      score: 90,
    });
    expect(rankServerIdentities(identities, { query: "ts_ls" })[0]).toMatchObject({
      id: "typescript-language-server",
      score: 85,
    });
    expect(rankServerIdentities(identities, { query: "@vtsls/language-server" })[0]).toMatchObject({
      id: "vtsls",
      score: 80,
    });
    expect(rankServerIdentities(identities, { query: "yaml" })[0]).toMatchObject({
      id: "yaml-language-server",
      score: 70,
    });
    expect(rankServerIdentities(identities, { query: "yml" })[0]).toMatchObject({
      id: "yaml-language-server",
      score: 65,
    });
  });

  it("ranks isolated command and Mason alias exact matches", () => {
    const commandOnly: ServerIdentity = {
      id: "dart-language-server",
      command: "dart",
      languageIds: ["dart"],
      extensions: [".dart"],
    };
    const masonOnly: ServerIdentity = {
      id: "yaml-language-server",
      aliases: [{ value: "yamlls", kind: "mason" }],
      languageIds: ["yaml"],
      extensions: [".yaml"],
    };

    expect(rankServerIdentities([commandOnly], { query: "dart" })[0]).toMatchObject({
      id: "dart-language-server",
      score: 80,
      reasons: ["exact command alias"],
    });
    expect(rankServerIdentities([masonOnly], { query: "yamlls" })[0]).toMatchObject({
      id: "yaml-language-server",
      score: 85,
      reasons: ["exact mason alias"],
    });
  });

  it("ranks substring matches across identifiers before language metadata", () => {
    expect(
      rankServerIdentities(identities, { query: "language-server" }).map((match) => match.score),
    ).toEqual([60, 60, 60]);

    expect(rankServerIdentities(identities, { query: "java" })).toEqual([
      expect.objectContaining({ id: "typescript-language-server", score: 50 }),
      expect.objectContaining({ id: "vtsls", score: 50 }),
    ]);
  });

  it("applies file, language, and activation context modifiers deterministically", () => {
    expect(
      rankServerIdentities(identities, {
        query: "typescript",
        filePath: "/repo/src/app.ts",
        languageId: "typescript",
        activationApplies: (identity) => identity.id === "typescript-language-server",
      })[0],
    ).toMatchObject({ id: "typescript-language-server", score: 110 });

    expect(
      rankServerIdentities(identities, {
        query: "typescript-language-server",
        activationApplies: () => false,
      })[0],
    ).toMatchObject({ id: "typescript-language-server", score: 80 });
  });

  it("formats unknown server errors with structured suggestions", () => {
    const suggestions = rankServerIdentities(identities, { query: "types" });
    const error = formatUnknownServerError("types", suggestions);

    expect(error).toBeInstanceOf(ServerResolutionError);
    expect(error.code).toBe("unknown_server");
    expect(error.serverId).toBe("types");
    expect(error.suggestions[0]).toMatchObject({ id: "typescript-language-server" });
    expect(error.message).toContain('Unknown LSP server "types"');
    expect(error.message).toContain("typescript-language-server");
  });

  it("formats ambiguous server errors with structured suggestions", () => {
    const suggestions = rankServerIdentities(identities, { query: "typescript" });
    const error = formatAmbiguousServerError("typescript", suggestions);

    expect(error).toBeInstanceOf(ServerResolutionError);
    expect(error).toMatchObject({
      code: "ambiguous_server",
      serverId: "typescript",
      suggestions: [
        expect.objectContaining({ id: "typescript-language-server" }),
        expect.objectContaining({ id: "vtsls" }),
      ],
    });
    expect(error.message).toContain('Ambiguous LSP server "typescript"');
    expect(error.message).toContain("vtsls");
  });
});
