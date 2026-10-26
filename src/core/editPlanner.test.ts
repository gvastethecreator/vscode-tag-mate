import assert from "node:assert/strict";
import test from "node:test";
import { applyTextEdits, planChangeTag, planPairSelections, planRemoveSurrounding, planWrapSelections, transformOffset } from "./editPlanner.ts";
import { ParsedHtmlDocument } from "./htmlDocument.ts";
import { canRenameMissingOptionalEnd, isVoidElement, validateHtmlTagName } from "./htmlPolicy.ts";
import type { TagPair } from "./model.ts";

function pairAt(source: string, needle: string, occurrence = 0): TagPair {
  const parsed = ParsedHtmlDocument.parse(source);
  assert.equal(parsed.ok, true);
  let offset = -1;
  for (let index = 0; index <= occurrence; index += 1) {
    offset = source.indexOf(needle, offset + 1);
  }
  assert.notEqual(offset, -1);
  const located = parsed.value.locate(offset);
  assert.equal(located.ok, true);
  return located.value.pair;
}

test("changes paired tag names atomically without touching attributes or content", () => {
  const source = '<DIV class="card">hello</div>';
  const plan = planChangeTag([pairAt(source, "DIV")], "article");
  assert.equal(plan.ok, true);
  assert.equal(applyTextEdits(source, plan.value), '<article class="card">hello</article>');
});

test("deduplicates cursors on the same pair", () => {
  const source = "<section>text</section>";
  const pair = pairAt(source, "text");
  const plan = planChangeTag([pair, pair], "main");
  assert.equal(plan.ok, true);
  assert.equal(plan.value.length, 2);
});

test("rejects nested overlapping multi-cursor targets", () => {
  const source = "<div><span>x</span></div>";
  const outer = pairAt(source, "div");
  const inner = pairAt(source, "span");
  assert.deepEqual(planChangeTag([outer, inner], "main"), { ok: false, reason: "overlapping-targets" });
  assert.deepEqual(planPairSelections([outer, inner]), { ok: false, reason: "overlapping-targets" });
});

test("enforces void, self-closing, and optional-end transitions", () => {
  const pairedSource = "<div>text</div>";
  assert.deepEqual(planChangeTag([pairAt(pairedSource, "div")], "img"), { ok: false, reason: "void-transition" });

  const voidSource = "<img alt=x>";
  const voidPlan = planChangeTag([pairAt(voidSource, "img")], "br");
  assert.equal(voidPlan.ok, true);
  assert.equal(applyTextEdits(voidSource, voidPlan.value), "<br alt=x>");
  assert.deepEqual(planChangeTag([pairAt(voidSource, "img")], "figure"), { ok: false, reason: "void-transition" });

  const selfClosingSource = "<custom-one/>";
  const selfClosingPlan = planChangeTag([pairAt(selfClosingSource, "custom")], "custom-two");
  assert.equal(selfClosingPlan.ok, true);
  assert.equal(applyTextEdits(selfClosingSource, selfClosingPlan.value), "<custom-two/>");
  const selfClosingVoidPlan = planChangeTag([pairAt(selfClosingSource, "custom")], "img");
  assert.equal(selfClosingVoidPlan.ok, true);
  assert.equal(applyTextEdits(selfClosingSource, selfClosingVoidPlan.value), "<img/>");

  const explicitVoidSource = "<img/>";
  assert.deepEqual(planChangeTag([pairAt(explicitVoidSource, "img")], "section"), { ok: false, reason: "void-transition" });

  const optionalSource = "<dl><dt>term<dd>definition</dl>";
  const optionalPlan = planChangeTag([pairAt(optionalSource, "dt")], "dd");
  assert.equal(optionalPlan.ok, true);
  assert.equal(applyTextEdits(optionalSource, optionalPlan.value).startsWith("<dl><dd>term"), true);
  assert.deepEqual(planChangeTag([pairAt(optionalSource, "dt")], "section"), { ok: false, reason: "missing-closing-tag" });
});

test("removes only paired wrapper tags and preserves bytes", () => {
  const source = "<section>\r\n  <strong>x</strong>\r\n</section>";
  const plan = planRemoveSurrounding([pairAt(source, "section")]);
  assert.equal(plan.ok, true);
  assert.equal(applyTextEdits(source, plan.value), "\r\n  <strong>x</strong>\r\n");
  assert.deepEqual(planRemoveSurrounding([pairAt("<br>", "br")]), { ok: false, reason: "missing-closing-tag" });
});

test("wraps non-overlapping selections and preserves LF and CRLF", () => {
  const source = "one\r\ntwo\nthree";
  const plan = planWrapSelections(
    [
      { start: 0, end: 3 },
      { start: 5, end: 8 },
    ],
    "mark",
  );
  assert.equal(plan.ok, true);
  assert.equal(applyTextEdits(source, plan.value), "<mark>one</mark>\r\n<mark>two</mark>\nthree");
  assert.deepEqual(planWrapSelections([{ start: 0, end: 1 }], "img"), { ok: false, reason: "void-transition" });
});

test("rejects overlapping wraps while deduplicating identical selections", () => {
  assert.deepEqual(
    planWrapSelections(
      [
        { start: 0, end: 4 },
        { start: 2, end: 6 },
      ],
      "span",
    ),
    { ok: false, reason: "overlapping-targets" },
  );
  const duplicate = planWrapSelections(
    [
      { start: 0, end: 4 },
      { start: 0, end: 4 },
    ],
    "span",
  );
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.value.length, 2);
});

test("coalesces adjacent wrappers at their shared boundary", () => {
  const plan = planWrapSelections(
    [
      { start: 0, end: 1 },
      { start: 1, end: 2 },
    ],
    "b",
  );
  assert.equal(plan.ok, true);
  assert.equal(plan.value.length, 3);
  assert.equal(applyTextEdits("ab", plan.value), "<b>a</b><b>b</b>");
});

test("transforms offsets with explicit insertion affinity", () => {
  const edits = [
    { range: { start: 3, end: 3 }, text: "</b>" },
    { range: { start: 0, end: 0 }, text: "<b>" },
  ];
  assert.equal(transformOffset(0, edits, "right"), 3);
  assert.equal(transformOffset(3, edits, "left"), 6);
  assert.equal(transformOffset(3, edits, "right"), 10);
});

test("validates supported HTML names and central policies", () => {
  assert.equal(validateHtmlTagName("custom-element"), undefined);
  assert.equal(validateHtmlTagName("custom--element"), undefined);
  assert.equal(validateHtmlTagName("svg:path"), undefined);
  assert.match(validateHtmlTagName("div class=x")!, /without brackets/);
  assert.equal(isVoidElement("IMG"), true);
  assert.equal(canRenameMissingOptionalEnd("DT", "dd"), true);
  assert.equal(canRenameMissingOptionalEnd("p", "div"), false);
});
