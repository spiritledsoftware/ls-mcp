import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { ManagedLspSession } from "./sessionManager.js";

export interface OpenedDocumentState {
  uri: string;
  filePath: string;
  version: number;
  contentHash: string;
  languageId: string;
  lastAccessedAt: number;
}

export interface EnsureDocumentOpenOptions {
  session: ManagedLspSession;
  filePath: string;
  languageId?: string;
  serverLanguageIds?: readonly string[];
  serverExtensions?: readonly string[];
}

export interface DocumentStoreOptions {
  maxOpenDocumentsPerSession?: number;
}

export interface McpPosition {
  line: number;
  character: number;
}

const EXTENSION_LANGUAGE_IDS = new Map<string, string>([
  [".c", "c"],
  [".cc", "cpp"],
  [".cpp", "cpp"],
  [".cjs", "javascript"],
  [".cs", "csharp"],
  [".css", "css"],
  [".cxx", "cpp"],
  [".go", "go"],
  [".h", "c"],
  [".hh", "cpp"],
  [".hpp", "cpp"],
  [".html", "html"],
  [".hxx", "cpp"],
  [".java", "java"],
  [".js", "javascript"],
  [".jsx", "javascriptreact"],
  [".json", "json"],
  [".jsonc", "jsonc"],
  [".lua", "lua"],
  [".m", "objective-c"],
  [".md", "markdown"],
  [".mjs", "javascript"],
  [".mm", "objective-cpp"],
  [".php", "php"],
  [".py", "python"],
  [".pyi", "python"],
  [".rb", "ruby"],
  [".rs", "rust"],
  [".sh", "shellscript"],
  [".ts", "typescript"],
  [".tsx", "typescriptreact"],
  [".vue", "vue"],
  [".yaml", "yaml"],
  [".yml", "yaml"],
]);

export class DocumentStore {
  private readonly documents = new WeakMap<ManagedLspSession, Map<string, OpenedDocumentState>>();
  private readonly syncing = new WeakMap<
    ManagedLspSession,
    Map<string, Promise<OpenedDocumentState>>
  >();
  private readonly maxOpenDocumentsPerSession: number;

  constructor(options: DocumentStoreOptions = {}) {
    this.maxOpenDocumentsPerSession = options.maxOpenDocumentsPerSession ?? 256;
  }

  async ensureDocumentOpen(options: EnsureDocumentOpenOptions): Promise<OpenedDocumentState> {
    const filePath = resolve(options.filePath);
    const uri = filePathToUri(filePath);
    const sessionDocuments = this.getSessionDocuments(options.session);
    const sessionSyncing = this.getSessionSyncing(options.session);
    const pending = sessionSyncing.get(uri);
    if (pending) {
      return pending;
    }

    const sync = this.syncDocument(options, filePath, uri, sessionDocuments);
    sessionSyncing.set(uri, sync);
    void sync.then(
      () => {
        if (sessionSyncing.get(uri) === sync) {
          sessionSyncing.delete(uri);
        }
        this.retryEviction(options.session, sessionDocuments);
      },
      () => {
        if (sessionSyncing.get(uri) === sync) {
          sessionSyncing.delete(uri);
        }
        this.retryEviction(options.session, sessionDocuments);
      },
    );
    return sync;
  }

  clearSession(session: ManagedLspSession): void {
    this.documents.delete(session);
    this.syncing.delete(session);
  }

  private async syncDocument(
    options: EnsureDocumentOpenOptions,
    filePath: string,
    uri: string,
    sessionDocuments: Map<string, OpenedDocumentState>,
  ): Promise<OpenedDocumentState> {
    const opened = sessionDocuments.get(uri);

    if (!opened) {
      return this.openDocument(options, filePath, uri, sessionDocuments);
    }

    const content = await readFile(filePath, "utf8");
    const contentHash = hashContent(content);
    opened.lastAccessedAt = Date.now();

    if (opened.contentHash !== contentHash) {
      const nextVersion = opened.version + 1;
      await options.session.sendNotification("textDocument/didChange", {
        textDocument: { uri, version: nextVersion },
        contentChanges: [{ text: content }],
      });
      opened.version = nextVersion;
      opened.contentHash = contentHash;
    }
    this.markRecentlyUsed(sessionDocuments, uri, opened);
    return opened;
  }

  private async openDocument(
    options: EnsureDocumentOpenOptions,
    filePath: string,
    uri: string,
    sessionDocuments: Map<string, OpenedDocumentState>,
  ): Promise<OpenedDocumentState> {
    const content = await readFile(filePath, "utf8");
    const contentHash = hashContent(content);
    const languageId = inferLanguageId({
      filePath,
      languageId: options.languageId,
      serverLanguageIds: options.serverLanguageIds,
      serverExtensions: options.serverExtensions,
    });
    const now = Date.now();

    const state: OpenedDocumentState = {
      uri,
      filePath,
      version: 1,
      contentHash,
      languageId,
      lastAccessedAt: now,
    };
    await options.session.sendNotification("textDocument/didOpen", {
      textDocument: { uri, languageId, version: state.version, text: content },
    });
    sessionDocuments.set(uri, state);
    await this.evictOverflowDocuments(options.session, sessionDocuments, uri);
    return state;
  }

  private markRecentlyUsed(
    sessionDocuments: Map<string, OpenedDocumentState>,
    uri: string,
    state: OpenedDocumentState,
  ): void {
    sessionDocuments.delete(uri);
    sessionDocuments.set(uri, state);
  }

  private async evictOverflowDocuments(
    session: ManagedLspSession,
    sessionDocuments: Map<string, OpenedDocumentState>,
    protectedUri?: string,
  ): Promise<void> {
    if (sessionDocuments.size <= this.maxOpenDocumentsPerSession) {
      return;
    }

    const sessionSyncing = this.getSessionSyncing(session);
    for (const [uri, state] of sessionDocuments) {
      if (sessionDocuments.size <= this.maxOpenDocumentsPerSession) {
        return;
      }
      if (uri === protectedUri || sessionSyncing.has(uri)) {
        continue;
      }
      try {
        await session.sendNotification("textDocument/didClose", {
          textDocument: { uri: state.uri },
        });
      } catch {
        // didClose is best-effort during eviction; the local cap still has to be enforced.
      }
      sessionDocuments.delete(uri);
    }
  }

  private retryEviction(
    session: ManagedLspSession,
    sessionDocuments: Map<string, OpenedDocumentState>,
  ): void {
    if (this.documents.get(session) !== sessionDocuments) {
      return;
    }
    void this.evictOverflowDocuments(session, sessionDocuments).catch(() => undefined);
  }

  private getSessionDocuments(session: ManagedLspSession): Map<string, OpenedDocumentState> {
    let sessionDocuments = this.documents.get(session);
    if (!sessionDocuments) {
      sessionDocuments = new Map();
      this.documents.set(session, sessionDocuments);
    }
    return sessionDocuments;
  }

  private getSessionSyncing(session: ManagedLspSession): Map<string, Promise<OpenedDocumentState>> {
    let sessionSyncing = this.syncing.get(session);
    if (!sessionSyncing) {
      sessionSyncing = new Map();
      this.syncing.set(session, sessionSyncing);
    }
    return sessionSyncing;
  }
}

export function filePathToUri(filePath: string): string {
  return pathToFileURL(resolve(filePath)).toString();
}

export function uriToFilePath(uri: string): string {
  return fileURLToPath(uri);
}

export function mcpPositionToLspPosition(position: McpPosition): McpPosition {
  return {
    line: Math.max(0, position.line - 1),
    character: Math.max(0, position.character - 1),
  };
}

export function inferLanguageId(options: {
  filePath: string;
  languageId?: string;
  serverLanguageIds?: readonly string[];
  serverExtensions?: readonly string[];
}): string {
  if (options.languageId) {
    return options.languageId;
  }

  const extension = extname(options.filePath).toLowerCase();
  const extensions = options.serverExtensions?.map(normalizeExtension) ?? [];
  const matchesServerExtension = extensions.includes(extension);
  if (matchesServerExtension && options.serverLanguageIds?.length === 1) {
    return options.serverLanguageIds[0] ?? "plaintext";
  }
  const mappedLanguageId = EXTENSION_LANGUAGE_IDS.get(extension);
  if (mappedLanguageId) {
    return mappedLanguageId;
  }
  if (matchesServerExtension && options.serverLanguageIds?.[0]) {
    return options.serverLanguageIds[0];
  }

  return "plaintext";
}

function normalizeExtension(extension: string): string {
  return extension.startsWith(".") ? extension.toLowerCase() : `.${extension.toLowerCase()}`;
}

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}
