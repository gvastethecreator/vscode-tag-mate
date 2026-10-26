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

  // Prompt stubs affect only the development extension API instance. Installed
  // smoke uses a separate runner extension; the full prompt cases run above that
  // packaging layer in test:integration. Keep noninteractive installed checks.
  if (process.env.VSIX_SMOKE !== "1") {
  const originalInput = vscode.window.showInputBox;
  const originalWarning = vscode.window.showWarningMessage;
  const comparisons = [];
  let refusal;
  vscode.window.showInputBox = async () => "section";
  vscode.window.showWarningMessage = async (message) => { refusal = message; };
  try {
    for (const fixture of [
      { name: "paired", source: '<div class="card">hello</div>', needle: "div", action: "rename", parity: true },
      { name: "custom-element", source: "<my-card>hello</my-card>", needle: "my-card", action: "rename", parity: true },
      { name: "unwrap", source: "<main><div>hello</div></main>", needle: "div", action: "remove", parity: true },
      { name: "void-transition", source: '<img alt="x">', needle: "img", action: "rename", parity: false },
      { name: "missing-end", source: "<div>hello", needle: "div", action: "remove", parity: false },
    ]) {
      const candidate = await openHtml(fixture.source);
      candidate.selection = cursor(candidate.document, fixture.needle);
      await vscode.commands.executeCommand(fixture.action === "rename" ? "tagMate.changeTag" : "tagMate.removeSurroundingTag");
      const tagMateText = candidate.document.getText();
      const baseline = await openHtml(fixture.source);
      baseline.selection = cursor(baseline.document, fixture.needle);
      await vscode.commands.executeCommand(fixture.action === "rename" ? "editor.emmet.action.updateTag" : "editor.emmet.action.removeTag", "section");
      await delay(100);
      const emmetText = baseline.document.getText();
      if (fixture.parity) assert.equal(tagMateText, emmetText, `Emmet parity failed: ${fixture.name}`);
      else assert.equal(tagMateText, fixture.source, `Unsafe fixture was edited: ${fixture.name}`);
      comparisons.push({ fixture: fixture.name, tagMateChanged: tagMateText !== fixture.source, emmetChanged: emmetText !== fixture.source, sameResult: tagMateText === emmetText });
    }
    const refusalEditor = await openHtml("<div>safe</div>\n<img alt=\"private fixture\">");
    refusalEditor.selections = [cursor(refusalEditor.document, "div"), cursor(refusalEditor.document, "img")];
    const before = refusalEditor.document.getText();
    await vscode.commands.executeCommand("tagMate.changeTag");
    assert.equal(refusalEditor.document.getText(), before);
    assert.match(refusal, /Cursor 2, line 2, column 2/);
    assert.equal(refusal.includes("private fixture"), false);
  } finally {
    vscode.window.showInputBox = originalInput;
    vscode.window.showWarningMessage = originalWarning;
  }
  console.log("Emmet comparison:", JSON.stringify(comparisons));
  }
  console.log("Tag Mate desktop integration passed.");
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

module.exports = { run };
