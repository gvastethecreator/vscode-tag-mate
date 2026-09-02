import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { ParsedHtmlDocument } from "../src/core/htmlDocument.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const measurements = [];
for (const [label, bytes, budget] of [
  ["100 KiB", 100 * 1024, 20],
  ["1 MiB", 1024 * 1024, 150],
]) {
  const unit = `<article><h2>Title</h2><p>${"content ".repeat(128)}</p></article>\n`;
  const source = unit.repeat(Math.ceil(bytes / unit.length)).slice(0, bytes);
  const warmup = ParsedHtmlDocument.parse(source);
  assert.equal(warmup.ok, true);
  const samples = [];
  for (let index = 0; index < 7; index += 1) {
    const started = performance.now();
    const parsed = ParsedHtmlDocument.parse(source, index + 2);
    assert.equal(parsed.ok, true);
    samples.push(performance.now() - started);
  }
  samples.sort((left, right) => left - right);
  const median = samples[Math.floor(samples.length / 2)];
  assert.ok(median < budget, `${label} parse exceeded ${budget} ms: ${median.toFixed(2)} ms.`);
  measurements.push(`${label} ${median.toFixed(2)} ms`);
}

for (const output of ["dist/node/extension.cjs", "dist/web/extension.cjs"]) {
  const bytes = (await stat(path.join(root, output))).size;
  assert.ok(bytes < 900 * 1024, `${output} exceeds the 900 KiB development-bundle budget.`);
}

const nodeBundle = await readFile(path.join(root, "dist/node/extension.cjs"), "utf8");
const activationSamples = [];
for (let index = 0; index < 7; index += 1) {
  const module = { exports: {} };
  const vscode = {
    commands: { registerCommand: () => ({ dispose() {} }) },
    workspace: {
      onDidCloseTextDocument: () => ({ dispose() {} }),
      onDidOpenTextDocument: () => ({ dispose() {} }),
    },
  };
  const started = performance.now();
  vm.runInNewContext(nodeBundle, {
    Buffer,
    TextDecoder,
    TextEncoder,
    exports: module.exports,
    module,
    require: (id) => {
      assert.equal(id, "vscode", `Unexpected runtime import: ${id}`);
      return vscode;
    },
  });
  module.exports.activate({ subscriptions: [] });
  activationSamples.push(performance.now() - started);
}
activationSamples.sort((left, right) => left - right);
const activationMedian = activationSamples[Math.floor(activationSamples.length / 2)];
assert.ok(activationMedian < 50, `Activation exceeded 50 ms: ${activationMedian.toFixed(2)} ms.`);

console.log(`Performance passed: ${measurements.join("; ")}; activation ${activationMedian.toFixed(2)} ms.`);
