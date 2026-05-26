export const serverAliasKinds = [
  "configured-id",
  "registry-id",
  "legacy-id",
  "mason",
  "lspconfig",
  "language-id",
  "command",
  "package",
] as const;

export type ServerAliasKind = (typeof serverAliasKinds)[number];

export interface ServerAliasDetail {
  value: string;
  kind: ServerAliasKind;
}

export interface ServerIdentity {
  id: string;
  configuredId?: string;
  registryId?: string;
  aliases?: readonly ServerAliasDetail[];
  command?: string;
  packageName?: string;
  languageIds?: readonly string[];
  extensions?: readonly string[];
}

export interface ServerSuggestion {
  id: string;
  score: number;
  reasons: readonly string[];
  aliases: readonly string[];
  aliasDetails: readonly ServerAliasDetail[];
  registryId?: string;
  configuredId?: string;
  languageIds: readonly string[];
  extensions: readonly string[];
}

export type ServerResolutionErrorCode = "unknown_server" | "ambiguous_server";

export class ServerResolutionError extends Error {
  readonly code: ServerResolutionErrorCode;
  readonly serverId: string;
  readonly suggestions: readonly ServerSuggestion[];

  constructor(options: {
    code: ServerResolutionErrorCode;
    serverId: string;
    message: string;
    suggestions?: readonly ServerSuggestion[];
  }) {
    super(options.message);
    this.name = "ServerResolutionError";
    this.code = options.code;
    this.serverId = options.serverId;
    this.suggestions = options.suggestions ?? [];
  }
}

export interface BuildAliasDetailsOptions {
  configuredId?: string;
  registryId?: string;
  legacyIds?: readonly string[];
  masonIds?: readonly string[];
  lspconfigIds?: readonly string[];
  languageIds?: readonly string[];
  command?: string;
  packageName?: string;
}

export interface RankServerIdentitiesOptions {
  query: string;
  filePath?: string;
  languageId?: string;
  activationApplies?: (identity: ServerIdentity) => boolean | undefined;
}

interface ScoreMatch {
  score: number;
  reason: string;
}

export function buildAliasDetails(options: BuildAliasDetailsOptions): ServerAliasDetail[] {
  return dedupeAliasDetails([
    aliasDetail(options.configuredId, "configured-id"),
    aliasDetail(options.registryId, "registry-id"),
    ...aliasDetails(options.legacyIds, "legacy-id"),
    ...aliasDetails(options.masonIds, "mason"),
    ...aliasDetails(options.lspconfigIds, "lspconfig"),
    ...aliasDetails(options.languageIds, "language-id"),
    aliasDetail(options.command, "command"),
    aliasDetail(options.packageName, "package"),
  ]);
}

export function dedupeAliasDetails(
  aliases: readonly (ServerAliasDetail | undefined)[],
): ServerAliasDetail[] {
  const seen = new Set<string>();
  const deduped: ServerAliasDetail[] = [];

  for (const alias of aliases) {
    const value = alias?.value.trim();
    if (!alias || !value) {
      continue;
    }

    const key = `${alias.kind}\0${value}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push({ value, kind: alias.kind });
  }

  return deduped;
}

export function rankServerIdentities(
  identities: readonly ServerIdentity[],
  options: RankServerIdentitiesOptions,
): ServerSuggestion[] {
  const query = normalize(options.query);
  if (!query) {
    return [];
  }

  return identities
    .map((identity) => rankServerIdentity(identity, query, options))
    .filter((suggestion): suggestion is ServerSuggestion => suggestion !== undefined)
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
}

export function formatUnknownServerError(
  serverId: string,
  suggestions: readonly ServerSuggestion[] = [],
): ServerResolutionError {
  return new ServerResolutionError({
    code: "unknown_server",
    serverId,
    message: formatResolutionMessage("Unknown LSP server", serverId, suggestions),
    suggestions,
  });
}

export function formatAmbiguousServerError(
  serverId: string,
  suggestions: readonly ServerSuggestion[] = [],
): ServerResolutionError {
  return new ServerResolutionError({
    code: "ambiguous_server",
    serverId,
    message: formatResolutionMessage("Ambiguous LSP server", serverId, suggestions),
    suggestions,
  });
}

function rankServerIdentity(
  identity: ServerIdentity,
  query: string,
  options: RankServerIdentitiesOptions,
): ServerSuggestion | undefined {
  const aliasDetails = getIdentityAliasDetails(identity);
  const matches = getScoreMatches(identity, aliasDetails, query);
  if (matches.length === 0) {
    return undefined;
  }

  const bestScore = Math.max(...matches.map((match) => match.score));
  const reasons = matches
    .filter((match) => match.score === bestScore)
    .map((match) => match.reason)
    .sort();

  let score = bestScore;
  const contextMatches = matchesContext(identity, options);
  if (contextMatches) {
    score += 10;
    reasons.push("context match");
  }

  const activation = options.activationApplies?.(identity);
  if (activation === true) {
    score += 10;
    reasons.push("activation applies");
  } else if (activation === false) {
    score -= 20;
    reasons.push("activation does not apply");
  }

  return {
    id: identity.id,
    score,
    reasons,
    aliases: aliasDetails.map((alias) => alias.value),
    aliasDetails,
    registryId: identity.registryId,
    configuredId: identity.configuredId,
    languageIds: [...(identity.languageIds ?? [])],
    extensions: [...(identity.extensions ?? [])],
  };
}

function getScoreMatches(
  identity: ServerIdentity,
  aliasDetails: readonly ServerAliasDetail[],
  query: string,
): ScoreMatch[] {
  const matches: ScoreMatch[] = [];

  addExactMatch(matches, query, identity.id, 100, "exact canonical id");
  for (const alias of aliasDetails) {
    const score = exactAliasScore(alias.kind);
    if (score !== undefined) {
      addExactMatch(matches, query, alias.value, score, `exact ${alias.kind} alias`);
    }
  }

  for (const extension of identity.extensions ?? []) {
    const normalizedExtension = normalizeExtension(extension);
    if (query === normalizedExtension || query === normalizedExtension.slice(1)) {
      matches.push({ score: 65, reason: "exact extension" });
    }
  }

  if (
    includesQuery(query, [
      identity.id,
      identity.command,
      identity.packageName,
      ...aliasDetails.filter((alias) => alias.kind !== "language-id").map((alias) => alias.value),
    ])
  ) {
    matches.push({ score: 60, reason: "identifier substring" });
  }

  if (includesQuery(query, [...(identity.languageIds ?? []), ...(identity.extensions ?? [])])) {
    matches.push({ score: 50, reason: "language metadata substring" });
  }

  return matches;
}

function getIdentityAliasDetails(identity: ServerIdentity): ServerAliasDetail[] {
  return buildAliasDetails({
    configuredId: identity.configuredId,
    registryId: identity.registryId,
    languageIds: identity.languageIds,
    command: identity.command,
    packageName: identity.packageName,
  }).concat(dedupeAliasDetails(identity.aliases ?? []));
}

function exactAliasScore(kind: ServerAliasKind): number | undefined {
  switch (kind) {
    case "configured-id":
      return 95;
    case "registry-id":
    case "legacy-id":
      return 90;
    case "mason":
    case "lspconfig":
      return 85;
    case "command":
    case "package":
      return 80;
    case "language-id":
      return 70;
  }
}

function matchesContext(identity: ServerIdentity, options: RankServerIdentitiesOptions): boolean {
  const languageId = normalize(options.languageId);
  if (
    languageId &&
    (identity.languageIds ?? []).some((candidate) => normalize(candidate) === languageId)
  ) {
    return true;
  }

  const filePath = normalize(options.filePath);
  if (!filePath) {
    return false;
  }

  return (identity.extensions ?? []).some((extension) =>
    filePath.endsWith(normalizeExtension(extension).toLowerCase()),
  );
}

function formatResolutionMessage(
  label: string,
  serverId: string,
  suggestions: readonly ServerSuggestion[],
): string {
  const suggestionText = suggestions.length
    ? ` Suggestions: ${suggestions.map((suggestion) => suggestion.id).join(", ")}.`
    : "";
  return `${label} "${serverId}".${suggestionText}`;
}

function addExactMatch(
  matches: ScoreMatch[],
  query: string,
  value: string | undefined,
  score: number,
  reason: string,
): void {
  if (value !== undefined && normalize(value) === query) {
    matches.push({ score, reason });
  }
}

function includesQuery(query: string, values: readonly (string | undefined)[]): boolean {
  return values.some((value) => {
    const normalized = normalize(value);
    return normalized.length > 0 && normalized.includes(query);
  });
}

function aliasDetails(
  values: readonly string[] | undefined,
  kind: ServerAliasKind,
): ServerAliasDetail[] {
  return (values ?? []).map((value) => ({ value, kind }));
}

function aliasDetail(
  value: string | undefined,
  kind: ServerAliasKind,
): ServerAliasDetail | undefined {
  return value === undefined ? undefined : { value, kind };
}

function normalize(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function normalizeExtension(extension: string): string {
  const normalized = normalize(extension);
  return normalized.startsWith(".") ? normalized : `.${normalized}`;
}
