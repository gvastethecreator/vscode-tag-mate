import * as vscode from "vscode";
import { HtmlDocumentCache } from "./core/documentCache.ts";
import {
  planChangeTag,
  planPairSelections,
  planRemoveSurrounding,
  planWrapSelections,
  transformOffset,
} from "./core/editPlanner.ts";
import { validateHtmlTagName } from "./core/htmlPolicy.ts";
import type { CoreResult, FailureReason, OffsetRange, TagPair, TextEdit } from "./core/model.ts";

const FAILURE_MESSAGES: Record<FailureReason, string> = {
  "document-too-large": "Tag Mate supports HTML documents up to 2 MiB.",
  "invalid-tag-name": "Enter a valid HTML tag name.",
  "malformed-tag": "Tag Mate cannot safely edit this malformed tag.",
  "missing-closing-tag": "This element does not have a concrete matching closing tag.",
  "no-tag": "Place the cursor in or inside a supported HTML element.",
  "not-in-tag": "Place the cursor in an opening or closing tag.",
  "overlapping-targets": "Tag Mate cannot apply overlapping multi-cursor targets.",
  "void-transition": "This change would switch between void and paired element forms.",
};

function showFailure(reason: FailureReason): void {
  void vscode.window.showWarningMessage(FAILURE_MESSAGES[reason]);
}

function activeHtmlEditor(): vscode.TextEditor | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showWarningMessage("Open an HTML document first.");
    return undefined;
  }
  if (editor.document.languageId !== "html") {
    void vscode.window.showWarningMessage("Tag Mate 0.1 supports HTML documents.");
    return undefined;
  }
  return editor;
}

function unwrap<T>(result: CoreResult<T>): T | undefined {
  if (!result.ok) {
    showFailure(result.reason);
    return undefined;
  }
  return result.value;
}

function locatePairs(editor: vscode.TextEditor, cache: HtmlDocumentCache, syntaxOnly = false): TagPair[] | undefined {
  const parsed = unwrap(cache.get(editor.document));
  if (!parsed) {
    return undefined;
  }
  const pairs: TagPair[] = [];
  for (const selection of editor.selections) {
    const offset = editor.document.offsetAt(selection.active);
    const located = unwrap(syntaxOnly ? parsed.locateTagSyntax(offset) : parsed.locate(offset));
    if (!located) {
      return undefined;
    }
    pairs.push(located.pair);
  }
  return pairs;
}

function toVsCodeRange(document: vscode.TextDocument, range: OffsetRange): vscode.Range {
  return new vscode.Range(document.positionAt(range.start), document.positionAt(range.end));
}

async function applyEdits(
  editor: vscode.TextEditor,
  expectedVersion: number,
  edits: readonly TextEdit[],
  restoreSelections?: (document: vscode.TextDocument) => readonly vscode.Selection[],
): Promise<boolean> {
  if (editor.document.version !== expectedVersion) {
    void vscode.window.showWarningMessage("The document changed while Tag Mate was waiting. Run the command again.");
    return false;
  }
  const workspaceEdit = new vscode.WorkspaceEdit();
  for (const edit of edits) {
    workspaceEdit.replace(editor.document.uri, toVsCodeRange(editor.document, edit.range), edit.text);
  }
  const applied = await vscode.workspace.applyEdit(workspaceEdit);
  if (!applied) {
    void vscode.window.showErrorMessage("Tag Mate could not apply the edit.");
    return false;
  }
  if (restoreSelections) {
    editor.selections = [...restoreSelections(editor.document)];
  }
  return true;
}

function restoredSelections(
  selections: readonly vscode.Selection[],
  documentBeforeEdit: vscode.TextDocument,
  edits: readonly TextEdit[],
): (document: vscode.TextDocument) => readonly vscode.Selection[] {
  const offsets = selections.map((selection) => ({
    anchor: documentBeforeEdit.offsetAt(selection.anchor),
    active: documentBeforeEdit.offsetAt(selection.active),
  }));
  return (document) =>
    offsets.map(
      ({ anchor, active }) =>
        new vscode.Selection(
          document.positionAt(transformOffset(anchor, edits)),
          document.positionAt(transformOffset(active, edits)),
        ),
    );
}

export function registerTagMateCommands(context: vscode.ExtensionContext, cache: HtmlDocumentCache): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("tagMate.changeTag", async () => {
      const editor = activeHtmlEditor();
      if (!editor) return;
      const pairs = locatePairs(editor, cache);
      if (!pairs) return;
      const version = editor.document.version;
      const newName = await vscode.window.showInputBox({
        title: "Change Tag",
        prompt: "Enter the new HTML tag name.",
        value: pairs[0]!.name,
        valueSelection: [0, pairs[0]!.name.length],
        validateInput: validateHtmlTagName,
      });
      if (newName === undefined) return;
      const edits = unwrap(planChangeTag(pairs, newName));
      if (!edits) return;
      const restore = restoredSelections(editor.selections, editor.document, edits);
      await applyEdits(editor, version, edits, restore);
    }),
    vscode.commands.registerCommand("tagMate.goToMatchingTag", () => {
      const editor = activeHtmlEditor();
      if (!editor) return;
      const parsed = unwrap(cache.get(editor.document));
      if (!parsed) return;
      const destinations: vscode.Selection[] = [];
      for (const selection of editor.selections) {
        const offset = editor.document.offsetAt(selection.active);
        const located = unwrap(parsed.locateTagSyntax(offset));
        if (!located) return;
        const destination = located.location === "opening" ? located.pair.closingName : located.pair.openingName;
        if (!destination) {
          showFailure("missing-closing-tag");
          return;
        }
        const position = editor.document.positionAt(destination.start);
        destinations.push(new vscode.Selection(position, position));
      }
      editor.selections = destinations;
      const primary = destinations[0];
      if (primary) editor.revealRange(primary, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    }),
    vscode.commands.registerCommand("tagMate.selectTagPair", () => {
      const editor = activeHtmlEditor();
      if (!editor) return;
      const pairs = locatePairs(editor, cache);
      if (!pairs) return;
      const ranges = unwrap(planPairSelections(pairs));
      if (!ranges) return;
      editor.selections = ranges.map((range) => new vscode.Selection(editor.document.positionAt(range.start), editor.document.positionAt(range.end)));
      const primary = editor.selections[0];
      if (primary) editor.revealRange(primary, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    }),
    vscode.commands.registerCommand("tagMate.removeSurroundingTag", async () => {
      const editor = activeHtmlEditor();
      if (!editor) return;
      const pairs = locatePairs(editor, cache);
      if (!pairs) return;
      const edits = unwrap(planRemoveSurrounding(pairs));
      if (!edits) return;
      const version = editor.document.version;
      const restore = restoredSelections(editor.selections, editor.document, edits);
      await applyEdits(editor, version, edits, restore);
    }),
    vscode.commands.registerCommand("tagMate.wrapSelection", async () => {
      const editor = activeHtmlEditor();
      if (!editor) return;
      if (editor.selections.some((selection) => selection.isEmpty)) {
        void vscode.window.showWarningMessage("Select text to wrap first.");
        return;
      }
      const ranges = editor.selections.map((selection) => ({
        start: editor.document.offsetAt(selection.start),
        end: editor.document.offsetAt(selection.end),
      }));
      const version = editor.document.version;
      const tagName = await vscode.window.showInputBox({
        title: "Wrap Selection with Tag",
        prompt: "Enter an HTML tag name.",
        validateInput: validateHtmlTagName,
      });
      if (tagName === undefined) return;
      const edits = unwrap(planWrapSelections(ranges, tagName));
      if (!edits) return;
      const uniqueRanges = ranges.filter(
        (range, index) => ranges.findIndex((candidate) => candidate.start === range.start && candidate.end === range.end) === index,
      );
      await applyEdits(editor, version, edits, (document) =>
        uniqueRanges.map(
          (range) =>
            new vscode.Selection(
              document.positionAt(transformOffset(range.start, edits, "right")),
              document.positionAt(transformOffset(range.end, edits, "left")),
            ),
        ),
      );
    }),
  );
}
