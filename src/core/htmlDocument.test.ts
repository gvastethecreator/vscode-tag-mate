import assert from "node:assert/strict";
import test from "node:test";
import { ParsedHtmlDocument } from "./htmlDocument.ts";
import { DOCUMENT_SIZE_LIMIT } from "./model.ts";

function parse(source: string): ParsedHtmlDocument {
  const result = ParsedHtmlDocument.parse(source);
  assert.equal(result.ok, true);
  return result.value;
}

test("locates the innermost nested same-name pair", () => {
  const source = '<div class="outer"><div data-value="> <">inner</div></div>';
  const document = parse(source);
  const inner = document.locate(source.indexOf("inner") + 1);
  assert.equal(inner.ok, true);
  assert.equal(inner.value.pair.full.start, source.indexOf("<div data"));
  assert.equal(source.slice(inner.value.pair.closingName!.start, inner.value.pair.closingName!.end), "div");
  assert.equal(inner.value.location, "body");
});

test("ignores comments, doctypes, and tag-like raw text", () => {
  const source = '<!doctype html><!-- <aside> --><script>const x = "</div>";</script><main>ok</main>';
  const document = parse(source);
  assert.equal(document.locate(source.indexOf("aside")).ok, false);
  const script = document.locate(source.indexOf("const"));
  assert.equal(script.ok, true);
  assert.equal(script.value.pair.name, "script");
  const main = document.locate(source.indexOf("ok"));
  assert.equal(main.ok, true);
  assert.equal(main.value.pair.name, "main");
});

test("preserves mixed-case ranges and multiline opening tags", () => {
  const source = '<My-Card\n  data-label="hello">body</my-card>';
  const located = parse(source).locate(source.indexOf("body"));
  assert.equal(located.ok, true);
  assert.equal(located.value.pair.name, "My-Card");
  assert.equal(source.slice(located.value.pair.openingName.start, located.value.pair.openingName.end), "My-Card");
  assert.equal(source.slice(located.value.pair.closingName!.start, located.value.pair.closingName!.end), "my-card");
});

test("models void, self-closing, and missing optional-end tags separately", () => {
  const source = "<img alt=x><custom-item/><ul><li>one<li>two</ul>";
  const document = parse(source);
  const image = document.locate(source.indexOf("img"));
  assert.equal(image.ok, true);
  assert.equal(image.value.pair.isVoid, true);
  assert.equal(image.value.pair.isSelfClosing, false);
  const custom = document.locate(source.indexOf("custom"));
  assert.equal(custom.ok, true);
  assert.equal(custom.value.pair.isSelfClosing, true);
  assert.equal(custom.value.pair.isVoid, false);
  const item = document.locate(source.indexOf("<li>") + 1);
  assert.equal(item.ok, true);
  assert.equal(item.value.pair.isOptionalEnd, true);
  assert.equal(item.value.pair.closingTag, undefined);
});

test("does not invent pairs for malformed or stray closing tags", () => {
  const malformed = parse("<div><span>x</div>");
  const span = malformed.locate("<div><".length + 1);
  assert.equal(span.ok, true);
  assert.equal(span.value.pair.name, "span");
  assert.equal(span.value.pair.closingTag, undefined);
  const stray = parse("text</orphan>").locate("text</".length + 1);
  assert.equal(stray.ok, false);
});

test("matching navigation requires tag syntax, not arbitrary body content", () => {
  const source = "<section>body</section>";
  const document = parse(source);
  assert.deepEqual(document.locateTagSyntax(source.indexOf("body")), { ok: false, reason: "not-in-tag" });
  const opening = document.locateTagSyntax(source.indexOf("section"));
  assert.equal(opening.ok, true);
  assert.equal(opening.value.location, "opening");
  const closing = document.locateTagSyntax(source.lastIndexOf("section"));
  assert.equal(closing.ok, true);
  assert.equal(closing.value.location, "closing");
});

test("rejects documents over the 2 MiB analysis limit", () => {
  const result = ParsedHtmlDocument.parse("x".repeat(DOCUMENT_SIZE_LIMIT + 1));
  assert.deepEqual(result, { ok: false, reason: "document-too-large" });
});

test("applies the document limit to UTF-8 bytes", () => {
  const result = ParsedHtmlDocument.parse("é".repeat(DOCUMENT_SIZE_LIMIT / 2 + 1));
  assert.deepEqual(result, { ok: false, reason: "document-too-large" });
});
