const assert = require("node:assert/strict");
const vscode = require("vscode");

const commands = [
  "tagMate.changeTag",
  "tagMate.goToMatchingTag",
  "tagMate.selectTagPair",
  "tagMate.removeSurroundingTag",
  "tagMate.wrapSelection",
];

async function openHtml(content) {
  const document = await vscode.workspace.openTextDocument({ content, language: "html" });
  return vscode.window.showTextDocument(document, { preview: false });
}

function cursor(document, needle, delta = 0) {
  const offset = document.getText().indexOf(needle);
  assert.ok(offset >= 0, `Missing fixture text: ${needle}`);
  const position = document.positionAt(offset + delta);
  return new vscode.Selection(position, position);
}

async function run() {
  const extension = vscode.extensions.getExtension("gvastethecreator.tag-mate");
  assert.ok(extension, "Tag Mate was not discovered.");
  assert.deepEqual(extension.packageJSON.extensionKind, ["ui", "workspace"]);
  assert.equal(extension.packageJSON.capabilities.untrustedWorkspaces.supported, true);
  assert.equal(extension.packageJSON.capabilities.virtualWorkspaces.supported, true);
  await extension.activate();
  const registered = await vscode.commands.getCommands(true);
  for (const id of commands) assert.ok(registered.includes(id), `${id} was not registered.`);

  const source = "<main><div class=\"card\">hello</div></main>";
  const editor = await openHtml(source);
  editor.selection = cursor(editor.document, "<div", 1);
  await vscode.commands.executeCommand("tagMate.goToMatchingTag");
  assert.equal(editor.document.offsetAt(editor.selection.active), source.lastIndexOf("div"));
  await vscode.commands.executeCommand("tagMate.goToMatchingTag");
  assert.equal(editor.document.offsetAt(editor.selection.active), source.indexOf("div"));

  editor.selection = cursor(editor.document, "hello", 2);
  await vscode.commands.executeCommand("tagMate.selectTagPair");
  assert.equal(editor.document.getText(editor.selection), '<div class="card">hello</div>');

  editor.selection = cursor(editor.document, "hello", 2);
  await vscode.commands.executeCommand("tagMate.removeSurroundingTag");
  assert.equal(editor.document.getText(), "<main>hello</main>");
  await delay(100);
  await vscode.commands.executeCommand("undo");
  await delay(100);
  assert.equal(editor.document.getText(), source, "One undo must restore both wrapper tags.");

  const voidEditor = await openHtml("before<img alt=\"x\">after");
  voidEditor.selection = cursor(voidEditor.document, "img");
  await vscode.commands.executeCommand("tagMate.selectTagPair");
  assert.equal(voidEditor.document.getText(voidEditor.selection), '<img alt="x">');

  const nested = await openHtml("<div><span>x</span></div>");
  nested.selections = [cursor(nested.document, "div"), cursor(nested.document, "span")];
  await vscode.commands.executeCommand("tagMate.selectTagPair");
  assert.equal(nested.selections.length, 2, "Overlapping pair targets must leave selections unchanged.");

  console.log("Tag Mate desktop integration passed.");
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

module.exports = { run };
