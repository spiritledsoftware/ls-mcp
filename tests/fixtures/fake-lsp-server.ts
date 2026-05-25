import process from "node:process";
import { appendFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  createMessageConnection,
  StreamMessageReader,
  StreamMessageWriter,
} from "vscode-jsonrpc/node.js";

const capabilities = {
  textDocumentSync: 1,
  hoverProvider: true,
  documentFormattingProvider: true,
  codeActionProvider: true,
  executeCommandProvider: {
    commands: ["source.fixAll.fake"],
  },
  completionProvider: {
    triggerCharacters: ["."],
    resolveProvider: true,
  },
  workspace: {
    workspaceFolders: {
      supported: true,
      changeNotifications: true,
    },
  },
};

let initialized = false;
let shutdown = false;

const hangMethods = new Set((process.env.FAKE_LSP_HANG_METHODS ?? "").split(",").filter(Boolean));
const failMethods = new Set((process.env.FAKE_LSP_FAIL_METHODS ?? "").split(",").filter(Boolean));

function record(event: Record<string, unknown>): void {
  const line = `${JSON.stringify(event)}\n`;
  process.stderr.write(line);
  if (process.env.FAKE_LSP_EVENT_LOG) {
    appendFileSync(process.env.FAKE_LSP_EVENT_LOG, line);
  }
}

const connection = createMessageConnection(
  new StreamMessageReader(process.stdin),
  new StreamMessageWriter(process.stdout),
);

connection.onRequest("initialize", (params) => {
  record({ method: "initialize", params });
  if (process.env.FAKE_LSP_FAIL_INITIALIZE === "1") {
    throw new Error("initialize failed by fixture request");
  }
  return {
    capabilities,
    serverInfo: {
      name: "fake-lsp-server",
      version: "0.0.0-test",
    },
  };
});

connection.onNotification("initialized", () => {
  initialized = true;
  record({ method: "initialized" });
});

connection.onNotification("$/cancelRequest", (params) => {
  record({ method: "$/cancelRequest", params });
});

connection.onRequest((method, params, token) => {
  record({ method, params });
  token.onCancellationRequested(() => {
    record({ method: "$/cancelRequest", params: { method } });
  });
  if (failMethods.has(method)) {
    throw new Error("failed by fixture request");
  }
  if (hangMethods.has(method)) {
    return new Promise(() => {});
  }
  if (method === "test/echo") {
    return params;
  }
  if (method === "textDocument/hover") {
    return {
      contents: {
        kind: "markdown",
        value: `${process.env.FAKE_LSP_LABEL ?? "fake"} hover`,
      },
    };
  }
  if (method === "textDocument/formatting") {
    return [
      {
        range: { start: { line: 0, character: 6 }, end: { line: 0, character: 11 } },
        newText: process.env.FAKE_LSP_FORMAT_TEXT ?? "formatted",
      },
    ];
  }
  if (method === "textDocument/codeAction") {
    const outsidePath = resolve(process.env.FAKE_LSP_OUTSIDE_PATH ?? "outside.ts");
    return [
      {
        title: "Edit outside workspace",
        kind: "quickfix",
        edit: {
          documentChanges: [
            {
              kind: "create",
              uri: `file://${outsidePath}`,
            },
          ],
        },
      },
    ];
  }
  if (method === "workspace/executeCommand") {
    return { executed: params };
  }
  throw new Error(`Unhandled method ${method}`);
});

connection.onNotification("textDocument/didOpen", (params) => {
  record({ method: "textDocument/didOpen", params });
});

connection.onNotification("textDocument/didChange", (params) => {
  record({ method: "textDocument/didChange", params });
});

connection.onRequest("shutdown", () => {
  shutdown = true;
  record({ method: "shutdown", initialized });
  if (process.env.FAKE_LSP_IGNORE_SHUTDOWN === "1") {
    return new Promise(() => {});
  }
  return null;
});

connection.onNotification("exit", () => {
  record({ method: "exit", shutdown });
  if (process.env.FAKE_LSP_IGNORE_EXIT === "1") {
    return;
  }
  process.exit(shutdown ? 0 : 1);
});

connection.listen();
