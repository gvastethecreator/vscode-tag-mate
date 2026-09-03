import * as vscode from "vscode";
import { registerTagMateCommands } from "./commandHandlers.ts";
import { HtmlDocumentCache } from "./core/documentCache.ts";

export function activate(context: vscode.ExtensionContext): void {
  const cache = new HtmlDocumentCache();
  registerTagMateCommands(context, cache);
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((document) => cache.delete(document.uri)),
    vscode.workspace.onDidOpenTextDocument((document) => cache.delete(document.uri)),
    { dispose: () => cache.clear() },
  );
}

export function deactivate(): void {}
