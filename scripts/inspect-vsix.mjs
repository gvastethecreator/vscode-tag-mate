import assert from "node:assert/strict";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yauzl from "yauzl";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requested = process.argv[2];
const filename = requested
  ? path.resolve(root, requested)
  : path.join(root, (await readdir(root)).find((name) => /^tag-mate(?:-.*)?\.vsix$/.test(name)) || "");
assert.ok(filename.endsWith(".vsix"), "No Tag Mate VSIX found.");
assert.ok((await stat(filename)).size < 5 * 1024 * 1024, "VSIX exceeds the 5 MiB budget.");

const { names, contents } = await inspect(filename);
for (const required of [
  "extension/package.json",
  "extension/dist/node/extension.cjs",
  "extension/dist/web/extension.cjs",
  "extension/media/icon.png",
  "extension/media/preview.png",
  "extension/readme.md",
  "extension/changelog.md",
  "extension/LICENSE.txt",
  "extension/SECURITY.md",
  "extension/THIRD_PARTY_NOTICES.md",
]) {
  assert.ok(names.has(required), `Missing packaged file: ${required}`);
}
for (const name of names) {
  assert.ok(!name.includes(".."), `Unsafe archive entry: ${name}`);
  assert.ok(!name.startsWith("extension/src/"), `Source file leaked into VSIX: ${name}`);
  assert.ok(!name.startsWith("extension/test/"), `Test file leaked into VSIX: ${name}`);
  assert.ok(!name.startsWith("extension/scripts/"), `Build script leaked into VSIX: ${name}`);
  assert.ok(!name.startsWith("extension/node_modules/"), `Dependency leaked into VSIX: ${name}`);
  assert.ok(!name.endsWith(".map"), `Source map leaked into VSIX: ${name}`);
}

const manifest = JSON.parse(contents.get("extension/package.json").toString("utf8"));
assert.equal(manifest.name, "tag-mate");
assert.equal(manifest.version, "0.1.0");
assert.equal(manifest.main, "./dist/node/extension.cjs");
assert.equal(manifest.browser, "./dist/web/extension.cjs");
assert.deepEqual(manifest.activationEvents, []);
assert.deepEqual(manifest.extensionKind, ["ui", "workspace"]);
assert.equal(manifest.capabilities.untrustedWorkspaces.supported, true);
assert.equal(manifest.capabilities.virtualWorkspaces.supported, true);
assert.equal(manifest.contributes.commands.length, 5);
assert.equal(manifest.contributes.menus["editor/context"].length, 1);
assert.equal(manifest.contributes.menus["editor/context"][0].command, "tagMate.changeTag");
assert.equal(manifest.contributes.keybindings, undefined, "No default keybinding should ship in 0.1.0.");
assert.equal(manifest.contributes.views, undefined, "Tag Mate must not ship a view or webview.");
assert.equal(manifest.contributes.configuration, undefined, "Tag Mate 0.1.0 must not add settings.");

for (const bundleName of ["extension/dist/node/extension.cjs", "extension/dist/web/extension.cjs"]) {
  const bundle = contents.get(bundleName).toString("utf8");
  assert.ok(Buffer.byteLength(bundle) < 600 * 1024, `${bundleName} exceeds the 600 KiB budget.`);
  for (const forbidden of ["child_process", "XMLHttpRequest", "WebSocket(", "fetch(", "eval("]) {
    assert.equal(bundle.includes(forbidden), false, `${bundleName} contains forbidden runtime surface: ${forbidden}`);
  }
}

console.log(`VSIX inspection passed: ${names.size} entries.`);

function inspect(file) {
  return new Promise((resolve, reject) => {
    yauzl.open(file, { lazyEntries: true }, (error, zip) => {
      if (error || !zip) return reject(error || new Error("Could not open VSIX."));
      const names = new Set();
      const contents = new Map();
      const collected = new Set([
        "extension/package.json",
        "extension/dist/node/extension.cjs",
        "extension/dist/web/extension.cjs",
      ]);
      zip.on("error", reject);
      zip.on("end", () => resolve({ names, contents }));
      zip.on("entry", (entry) => {
        names.add(entry.fileName);
        if (!collected.has(entry.fileName)) return zip.readEntry();
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) return reject(streamError || new Error("Could not read a packaged file."));
          const chunks = [];
          stream.on("data", (chunk) => chunks.push(chunk));
          stream.on("error", reject);
          stream.on("end", () => {
            contents.set(entry.fileName, Buffer.concat(chunks));
            zip.readEntry();
          });
        });
      });
      zip.readEntry();
    });
  });
}
