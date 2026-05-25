import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  DocumentStore,
  filePathToUri,
  inferLanguageId,
  mcpPositionToLspPosition,
  uriToFilePath,
} from "../../src/lsp/documentStore.js";
import type { ManagedLspSession } from "../../src/lsp/sessionManager.js";

describe("document path and position helpers", () => {
  it("round trips file paths through file URIs", () => {
    const filePath = resolve(tmpdir(), "lsp mcp document.ts");
    const uri = filePathToUri(filePath);

    expect(uri).toMatch(/^file:\/\//);
    expect(uriToFilePath(uri)).toBe(filePath);
  });

  it("converts one-based MCP positions to zero-based LSP positions", () => {
    expect(mcpPositionToLspPosition({ line: 1, character: 1 })).toEqual({ line: 0, character: 0 });
    expect(mcpPositionToLspPosition({ line: 4, character: 8 })).toEqual({ line: 3, character: 7 });
    expect(mcpPositionToLspPosition({ line: 0, character: -2 })).toEqual({ line: 0, character: 0 });
  });
});

describe("inferLanguageId", () => {
  it("prefers an explicit language id", () => {
    expect(
      inferLanguageId({
        filePath: "component.tsx",
        languageId: "typescriptreact",
        serverLanguageIds: ["typescript"],
        serverExtensions: [".ts"],
      }),
    ).toBe("typescriptreact");
  });

  it("uses matching server metadata before deterministic extension fallback", () => {
    expect(
      inferLanguageId({
        filePath: "main.ts",
        serverLanguageIds: ["typescript", "javascript"],
        serverExtensions: [".ts", ".js"],
      }),
    ).toBe("typescript");
    expect(
      inferLanguageId({ filePath: "README.md", serverLanguageIds: [], serverExtensions: [] }),
    ).toBe("markdown");
    expect(
      inferLanguageId({ filePath: "unknown.weird", serverLanguageIds: [], serverExtensions: [] }),
    ).toBe("plaintext");
  });

  it("maps multi-extension and multi-language built-ins without relying on array indexes", () => {
    const typeScriptServer = {
      serverLanguageIds: ["typescript", "typescriptreact", "javascript", "javascriptreact"],
      serverExtensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"],
    };
    const clangdServer = {
      serverLanguageIds: ["c", "cpp", "objective-c", "objective-cpp"],
      serverExtensions: [".c", ".h", ".cc", ".cpp", ".cxx", ".hpp", ".hh", ".hxx", ".m", ".mm"],
    };

    expect(inferLanguageId({ filePath: "module.mjs", ...typeScriptServer })).toBe("javascript");
    expect(inferLanguageId({ filePath: "common.cjs", ...typeScriptServer })).toBe("javascript");
    expect(inferLanguageId({ filePath: "source.cc", ...clangdServer })).toBe("cpp");
    expect(inferLanguageId({ filePath: "source.cpp", ...clangdServer })).toBe("cpp");
    expect(inferLanguageId({ filePath: "include/hdr.hpp", ...clangdServer })).toBe("cpp");
    expect(inferLanguageId({ filePath: "legacy.h", ...clangdServer })).toBe("c");
    expect(inferLanguageId({ filePath: "objc.m", ...clangdServer })).toBe("objective-c");
    expect(inferLanguageId({ filePath: "objc.mm", ...clangdServer })).toBe("objective-cpp");
  });

  it("uses one server language id for every matching extension when only one is configured", () => {
    expect(
      inferLanguageId({
        filePath: "template.tmpl",
        serverLanguageIds: ["templ"],
        serverExtensions: [".templ", ".tmpl"],
      }),
    ).toBe("templ");
  });

  it("uses one matching server language id before known extension mappings", () => {
    expect(
      inferLanguageId({
        filePath: "template.html",
        serverLanguageIds: ["handlebars"],
        serverExtensions: [".html", ".hbs"],
      }),
    ).toBe("handlebars");
  });

  it("falls back to the first server language id for unknown but matching extensions", () => {
    expect(
      inferLanguageId({
        filePath: "component.widget",
        serverLanguageIds: ["widgetlang", "widgetreact"],
        serverExtensions: [".widget", ".widgetx"],
      }),
    ).toBe("widgetlang");
  });
});

describe("DocumentStore", () => {
  it("sends didOpen once with document metadata and tracks opened state", async () => {
    const tempDir = await mkdtemp(resolve(tmpdir(), "document-store-"));
    const filePath = resolve(tempDir, "example.ts");
    await writeFile(filePath, "const value = 1;\n");
    const session = createSession();
    const store = new DocumentStore();

    const first = await store.ensureDocumentOpen({
      session,
      filePath,
      serverLanguageIds: ["typescript"],
      serverExtensions: [".ts"],
    });
    const second = await store.ensureDocumentOpen({
      session,
      filePath,
      serverLanguageIds: ["typescript"],
      serverExtensions: [".ts"],
    });

    expect(first).toMatchObject({ filePath, version: 1, languageId: "typescript" });
    expect(second.version).toBe(1);
    expect(session.sendNotification).toHaveBeenCalledTimes(1);
    expect(session.sendNotification).toHaveBeenCalledWith("textDocument/didOpen", {
      textDocument: {
        uri: filePathToUri(filePath),
        languageId: "typescript",
        version: 1,
        text: "const value = 1;\n",
      },
    });
  });

  it("shares concurrent first opens and sends only one didOpen", async () => {
    const tempDir = await mkdtemp(resolve(tmpdir(), "document-store-concurrent-"));
    const filePath = resolve(tempDir, "example.ts");
    await writeFile(filePath, "const value = 1;\n");
    const didOpenGate = deferred();
    const session = createSession();
    session.sendNotification = vi.fn(async () => {
      await didOpenGate.promise;
    });
    const store = new DocumentStore();

    const first = store.ensureDocumentOpen({ session, filePath, languageId: "typescript" });
    const second = store.ensureDocumentOpen({ session, filePath, languageId: "typescript" });
    await vi.waitFor(() => expect(session.sendNotification).toHaveBeenCalledTimes(1));
    didOpenGate.resolve();
    const [firstState, secondState] = await Promise.all([first, second]);

    expect(firstState).toBe(secondState);
    expect(session.sendNotification).toHaveBeenCalledTimes(1);
    expect(session.sendNotification).toHaveBeenCalledWith("textDocument/didOpen", {
      textDocument: {
        uri: filePathToUri(filePath),
        languageId: "typescript",
        version: 1,
        text: "const value = 1;\n",
      },
    });
  });

  it("retries didOpen after failure without producing an unhandled rejection", async () => {
    const tempDir = await mkdtemp(resolve(tmpdir(), "document-store-open-failure-"));
    const filePath = resolve(tempDir, "example.ts");
    await writeFile(filePath, "const value = 1;\n");
    const unhandled = vi.fn();
    process.once("unhandledRejection", unhandled);
    const session = createSession();
    session.sendNotification = vi
      .fn()
      .mockRejectedValueOnce(new Error("open failed"))
      .mockResolvedValueOnce(undefined);
    const store = new DocumentStore();

    await expect(
      store.ensureDocumentOpen({ session, filePath, languageId: "typescript" }),
    ).rejects.toThrow("open failed");
    const opened = await store.ensureDocumentOpen({ session, filePath, languageId: "typescript" });
    await Promise.resolve();

    process.removeListener("unhandledRejection", unhandled);
    expect(opened.version).toBe(1);
    expect(unhandled).not.toHaveBeenCalled();
    expect(session.sendNotification).toHaveBeenCalledTimes(2);
    expect(session.sendNotification).toHaveBeenNthCalledWith(2, "textDocument/didOpen", {
      textDocument: {
        uri: filePathToUri(filePath),
        languageId: "typescript",
        version: 1,
        text: "const value = 1;\n",
      },
    });
  });

  it("sends full-document didChange with an incremented version when disk content changes", async () => {
    const tempDir = await mkdtemp(resolve(tmpdir(), "document-store-change-"));
    const filePath = resolve(tempDir, "example.ts");
    await writeFile(filePath, "const value = 1;\n");
    const session = createSession();
    const store = new DocumentStore();

    await store.ensureDocumentOpen({ session, filePath, languageId: "typescript" });
    await writeFile(filePath, "const value = 2;\n");
    const changed = await store.ensureDocumentOpen({ session, filePath, languageId: "typescript" });

    expect(changed.version).toBe(2);
    expect(session.sendNotification).toHaveBeenCalledTimes(2);
    expect(session.sendNotification).toHaveBeenLastCalledWith("textDocument/didChange", {
      textDocument: { uri: filePathToUri(filePath), version: 2 },
      contentChanges: [{ text: "const value = 2;\n" }],
    });
  });

  it("shares concurrent didChange sync and increments version once", async () => {
    const tempDir = await mkdtemp(resolve(tmpdir(), "document-store-concurrent-change-"));
    const filePath = resolve(tempDir, "example.ts");
    await writeFile(filePath, "const value = 1;\n");
    const didChangeGate = deferred();
    const session = createSession();
    session.sendNotification = vi.fn(async (method) => {
      if (method === "textDocument/didChange") {
        await didChangeGate.promise;
      }
    });
    const store = new DocumentStore();

    await store.ensureDocumentOpen({ session, filePath, languageId: "typescript" });
    await writeFile(filePath, "const value = 2;\n");
    const first = store.ensureDocumentOpen({ session, filePath, languageId: "typescript" });
    const second = store.ensureDocumentOpen({ session, filePath, languageId: "typescript" });
    await vi.waitFor(() => expect(session.sendNotification).toHaveBeenCalledTimes(2));
    didChangeGate.resolve();
    const [firstState, secondState] = await Promise.all([first, second]);

    expect(firstState).toBe(secondState);
    expect(firstState.version).toBe(2);
    expect(session.sendNotification).toHaveBeenCalledTimes(2);
    expect(session.sendNotification).toHaveBeenLastCalledWith("textDocument/didChange", {
      textDocument: { uri: filePathToUri(filePath), version: 2 },
      contentChanges: [{ text: "const value = 2;\n" }],
    });
  });

  it("retries didChange after notification failure without committing hash or version", async () => {
    const tempDir = await mkdtemp(resolve(tmpdir(), "document-store-change-failure-"));
    const filePath = resolve(tempDir, "example.ts");
    await writeFile(filePath, "const value = 1;\n");
    const session = createSession();
    session.sendNotification = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("send failed"))
      .mockResolvedValueOnce(undefined);
    const store = new DocumentStore();

    await store.ensureDocumentOpen({ session, filePath, languageId: "typescript" });
    await writeFile(filePath, "const value = 2;\n");
    await expect(
      store.ensureDocumentOpen({ session, filePath, languageId: "typescript" }),
    ).rejects.toThrow("send failed");
    const changed = await store.ensureDocumentOpen({ session, filePath, languageId: "typescript" });

    expect(changed.version).toBe(2);
    expect(session.sendNotification).toHaveBeenCalledTimes(3);
    expect(session.sendNotification).toHaveBeenNthCalledWith(2, "textDocument/didChange", {
      textDocument: { uri: filePathToUri(filePath), version: 2 },
      contentChanges: [{ text: "const value = 2;\n" }],
    });
    expect(session.sendNotification).toHaveBeenNthCalledWith(3, "textDocument/didChange", {
      textDocument: { uri: filePathToUri(filePath), version: 2 },
      contentChanges: [{ text: "const value = 2;\n" }],
    });
  });

  it("clears tracked documents for a stopped session", async () => {
    const tempDir = await mkdtemp(resolve(tmpdir(), "document-store-clear-"));
    const filePath = resolve(tempDir, "example.ts");
    await writeFile(filePath, "const value = 1;\n");
    const session = createSession();
    const store = new DocumentStore();

    await store.ensureDocumentOpen({ session, filePath, languageId: "typescript" });
    store.clearSession(session);
    await store.ensureDocumentOpen({ session, filePath, languageId: "typescript" });

    expect(session.sendNotification).toHaveBeenCalledTimes(2);
    expect(session.sendNotification).toHaveBeenNthCalledWith(2, "textDocument/didOpen", {
      textDocument: {
        uri: filePathToUri(filePath),
        languageId: "typescript",
        version: 1,
        text: "const value = 1;\n",
      },
    });
  });

  it("evicts the least-recently-used opened document when the cap is exceeded", async () => {
    const tempDir = await mkdtemp(resolve(tmpdir(), "document-store-cap-"));
    const firstPath = resolve(tempDir, "first.ts");
    const secondPath = resolve(tempDir, "second.ts");
    const thirdPath = resolve(tempDir, "third.ts");
    await writeFile(firstPath, "const first = 1;\n");
    await writeFile(secondPath, "const second = 2;\n");
    await writeFile(thirdPath, "const third = 3;\n");
    const session = createSession();
    const store = new DocumentStore({ maxOpenDocumentsPerSession: 2 });

    await store.ensureDocumentOpen({ session, filePath: firstPath, languageId: "typescript" });
    await store.ensureDocumentOpen({ session, filePath: secondPath, languageId: "typescript" });
    await store.ensureDocumentOpen({ session, filePath: thirdPath, languageId: "typescript" });
    await store.ensureDocumentOpen({ session, filePath: firstPath, languageId: "typescript" });

    expect(session.sendNotification).toHaveBeenCalledWith("textDocument/didClose", {
      textDocument: { uri: filePathToUri(firstPath) },
    });
    expect(session.sendNotification).toHaveBeenCalledWith("textDocument/didOpen", {
      textDocument: {
        uri: filePathToUri(firstPath),
        languageId: "typescript",
        version: 1,
        text: "const first = 1;\n",
      },
    });
  });

  it("sends didClose before removing evicted document state", async () => {
    const tempDir = await mkdtemp(resolve(tmpdir(), "document-store-close-"));
    const firstPath = resolve(tempDir, "first.ts");
    const secondPath = resolve(tempDir, "second.ts");
    await writeFile(firstPath, "const first = 1;\n");
    await writeFile(secondPath, "const second = 2;\n");
    const session = createSession();
    const store = new DocumentStore({ maxOpenDocumentsPerSession: 1 });

    await store.ensureDocumentOpen({ session, filePath: firstPath, languageId: "typescript" });
    await store.ensureDocumentOpen({ session, filePath: secondPath, languageId: "typescript" });

    expect(session.sendNotification).toHaveBeenNthCalledWith(3, "textDocument/didClose", {
      textDocument: { uri: filePathToUri(firstPath) },
    });
  });

  it("does not evict a recently accessed opened document", async () => {
    const tempDir = await mkdtemp(resolve(tmpdir(), "document-store-lru-"));
    const firstPath = resolve(tempDir, "first.ts");
    const secondPath = resolve(tempDir, "second.ts");
    const thirdPath = resolve(tempDir, "third.ts");
    await writeFile(firstPath, "const first = 1;\n");
    await writeFile(secondPath, "const second = 2;\n");
    await writeFile(thirdPath, "const third = 3;\n");
    const session = createSession();
    const store = new DocumentStore({ maxOpenDocumentsPerSession: 2 });

    await store.ensureDocumentOpen({ session, filePath: firstPath, languageId: "typescript" });
    await store.ensureDocumentOpen({ session, filePath: secondPath, languageId: "typescript" });
    await store.ensureDocumentOpen({ session, filePath: firstPath, languageId: "typescript" });
    await store.ensureDocumentOpen({ session, filePath: thirdPath, languageId: "typescript" });

    expect(session.sendNotification).toHaveBeenCalledWith("textDocument/didClose", {
      textDocument: { uri: filePathToUri(secondPath) },
    });
    expect(session.sendNotification).not.toHaveBeenCalledWith("textDocument/didClose", {
      textDocument: { uri: filePathToUri(firstPath) },
    });
  });

  it("retries eviction after an in-flight sync settles", async () => {
    const tempDir = await mkdtemp(resolve(tmpdir(), "document-store-sync-"));
    const firstPath = resolve(tempDir, "first.ts");
    const secondPath = resolve(tempDir, "second.ts");
    await writeFile(firstPath, "const first = 1;\n");
    await writeFile(secondPath, "const second = 2;\n");
    const didChangeGate = deferred();
    const session = createSession();
    session.sendNotification = vi.fn(async (method) => {
      if (method === "textDocument/didChange") {
        await didChangeGate.promise;
      }
    });
    const store = new DocumentStore({ maxOpenDocumentsPerSession: 1 });

    await store.ensureDocumentOpen({ session, filePath: firstPath, languageId: "typescript" });
    await writeFile(firstPath, "const first = 2;\n");
    const firstSync = store.ensureDocumentOpen({
      session,
      filePath: firstPath,
      languageId: "typescript",
    });
    await vi.waitFor(() => expect(session.sendNotification).toHaveBeenCalledTimes(2));
    await store.ensureDocumentOpen({ session, filePath: secondPath, languageId: "typescript" });
    didChangeGate.resolve();
    await firstSync;
    await store.ensureDocumentOpen({ session, filePath: firstPath, languageId: "typescript" });

    expect(session.sendNotification).toHaveBeenCalledWith("textDocument/didClose", {
      textDocument: { uri: filePathToUri(secondPath) },
    });
    expect(session.sendNotification).not.toHaveBeenCalledWith("textDocument/didClose", {
      textDocument: { uri: filePathToUri(firstPath) },
    });
    expect(session.sendNotification).toHaveBeenCalledTimes(4);
  });

  it("restores the cap after concurrent first opens settle", async () => {
    const tempDir = await mkdtemp(resolve(tmpdir(), "document-store-concurrent-cap-"));
    const firstPath = resolve(tempDir, "first.ts");
    const secondPath = resolve(tempDir, "second.ts");
    await writeFile(firstPath, "const first = 1;\n");
    await writeFile(secondPath, "const second = 2;\n");
    const firstOpenGate = deferred();
    const session = createSession();
    session.sendNotification = vi.fn(async (_method, params) => {
      if (
        typeof params === "object" &&
        params !== null &&
        "textDocument" in params &&
        typeof params.textDocument === "object" &&
        params.textDocument !== null &&
        "uri" in params.textDocument &&
        params.textDocument.uri === filePathToUri(firstPath)
      ) {
        await firstOpenGate.promise;
      }
    });
    const store = new DocumentStore({ maxOpenDocumentsPerSession: 1 });

    const firstOpen = store.ensureDocumentOpen({
      session,
      filePath: firstPath,
      languageId: "typescript",
    });
    await vi.waitFor(() => expect(session.sendNotification).toHaveBeenCalledTimes(1));
    await store.ensureDocumentOpen({ session, filePath: secondPath, languageId: "typescript" });
    firstOpenGate.resolve();
    await firstOpen;
    await vi.waitFor(() =>
      expect(session.sendNotification).toHaveBeenCalledWith("textDocument/didClose", {
        textDocument: { uri: filePathToUri(secondPath) },
      }),
    );
    await store.ensureDocumentOpen({ session, filePath: secondPath, languageId: "typescript" });

    expect(session.sendNotification).toHaveBeenCalledWith("textDocument/didOpen", {
      textDocument: {
        uri: filePathToUri(secondPath),
        languageId: "typescript",
        version: 1,
        text: "const second = 2;\n",
      },
    });
  });
});

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

function createSession(): ManagedLspSession {
  return {
    start: vi.fn(async () => undefined),
    shutdown: vi.fn(async () => undefined),
    onNotification: vi.fn(() => ({ dispose() {} })),
    sendNotification: vi.fn(async () => undefined),
    async sendRequest<T>() {
      return undefined as T;
    },
  };
}
