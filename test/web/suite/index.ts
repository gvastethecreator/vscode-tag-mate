import * as vscode from "vscode";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension("gvastethecreator.tag-mate");
  assert(extension, "Tag Mate was not discovered in the web host.");
  const folder = vscode.workspace.workspaceFolders?.[0];
  assert(folder, "The virtual test workspace did not open.");
  assert(folder.uri.scheme === "vscode-test-web", "The web test is not using a virtual filesystem.");

  const document = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(folder.uri, "fixture.html"));
  const editor = await vscode.window.showTextDocument(document, { preview: false });
  const source = document.getText();
  const contentOffset = source.indexOf("Virtual workspace");
  assert(contentOffset >= 0, "Web fixture text is missing.");
  const position = document.positionAt(contentOffset);
  editor.selection = new vscode.Selection(position, position);
  await vscode.commands.executeCommand("tagMate.selectTagPair");
  assert(document.getText(editor.selection).includes("<article"), "Web host did not select the containing pair.");
  assert(extension.isActive, "Select Tag Pair did not activate Tag Mate in the web host.");

  editor.selection = new vscode.Selection(position, position);
  await vscode.commands.executeCommand("tagMate.removeSurroundingTag");
  assert(!document.getText().includes("<article"), "Web host did not apply the document-only edit.");
  console.log("Tag Mate web integration passed.");
}
