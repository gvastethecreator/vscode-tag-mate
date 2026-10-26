import assert from "node:assert/strict";
import test from "node:test";
import { HtmlDocumentCache, type TextDocumentLike } from "./documentCache.ts";

function document(uri: string, version: number, text: string, languageId = "html"): TextDocumentLike {
  return { uri: { toString: () => uri }, version, languageId, getText: () => text };
}

test("reuses a document version and replaces stale versions", () => {
  const cache = new HtmlDocumentCache();
  const first = cache.get(document("untitled:one", 1, "<div>x</div>"));
  const repeated = cache.get(document("untitled:one", 1, "ignored"));
  assert.equal(first.ok, true);
  assert.equal(repeated.ok, true);
  assert.equal(first.value, repeated.value);
  const changed = cache.get(document("untitled:one", 2, "<main>x</main>"));
  assert.equal(changed.ok, true);
  assert.notEqual(changed.value, first.value);
});

test("bounds entries and supports close cleanup", () => {
  const cache = new HtmlDocumentCache(2);
  cache.get(document("untitled:one", 1, "<p>one"));
  cache.get(document("untitled:two", 1, "<p>two"));
  cache.get(document("untitled:three", 1, "<p>three"));
  assert.equal(cache.size, 2);
  cache.delete({ toString: () => "untitled:two" });
  assert.equal(cache.size, 1);
  cache.clear();
  assert.equal(cache.size, 0);
});
