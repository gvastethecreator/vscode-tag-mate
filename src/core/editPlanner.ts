import { canRenameMissingOptionalEnd, isVoidElement, normalizeHtmlTagName } from "./htmlPolicy.ts";
import {
  type CoreResult,
  type OffsetRange,
  type TagPair,
  type TextEdit,
  rangesEqual,
  rangesOverlap,
} from "./model.ts";

function uniquePairs(pairs: readonly TagPair[]): TagPair[] {
  const result: TagPair[] = [];
  for (const pair of pairs) {
    if (!result.some((candidate) => rangesEqual(candidate.full, pair.full))) {
      result.push(pair);
    }
  }
  return result;
}

function uniqueRanges(ranges: readonly OffsetRange[]): OffsetRange[] {
  const result: OffsetRange[] = [];
  for (const range of ranges) {
    if (!result.some((candidate) => rangesEqual(candidate, range))) {
      result.push(range);
    }
  }
  return result;
}

function hasOverlap(ranges: readonly OffsetRange[]): boolean {
  const sorted = [...ranges].sort((left, right) => left.start - right.start || left.end - right.end);
  return sorted.some((range, index) => index > 0 && rangesOverlap(sorted[index - 1]!, range));
}

function descending(edits: TextEdit[]): TextEdit[] {
  return edits.sort((left, right) => right.range.start - left.range.start || right.range.end - left.range.end);
}

export function planChangeTag(pairs: readonly TagPair[], newName: string): CoreResult<readonly TextEdit[]> {
  const targets = uniquePairs(pairs);
  if (hasOverlap(targets.map((pair) => pair.full))) {
    return { ok: false, reason: "overlapping-targets" };
  }

  const targetIsVoid = isVoidElement(newName);
  const edits: TextEdit[] = [];
  for (const pair of targets) {
    if (pair.closingName) {
      if (targetIsVoid || pair.isVoid || pair.isSelfClosing) {
        return { ok: false, reason: "void-transition" };
      }
      edits.push({ range: pair.openingName, text: newName }, { range: pair.closingName, text: newName });
      continue;
    }

    if (pair.isSelfClosing) {
      if (pair.isVoid && !targetIsVoid) {
        return { ok: false, reason: "void-transition" };
      }
      edits.push({ range: pair.openingName, text: newName });
      continue;
    }

    if (pair.isVoid) {
      if (!targetIsVoid) {
        return { ok: false, reason: "void-transition" };
      }
      edits.push({ range: pair.openingName, text: newName });
      continue;
    }

    if (pair.isOptionalEnd && canRenameMissingOptionalEnd(pair.name, newName)) {
      edits.push({ range: pair.openingName, text: newName });
      continue;
    }

    return { ok: false, reason: "missing-closing-tag" };
  }

  return { ok: true, value: descending(edits) };
}

export function planRemoveSurrounding(pairs: readonly TagPair[]): CoreResult<readonly TextEdit[]> {
  const targets = uniquePairs(pairs);
  if (hasOverlap(targets.map((pair) => pair.full))) {
    return { ok: false, reason: "overlapping-targets" };
  }

  const edits: TextEdit[] = [];
  for (const pair of targets) {
    if (!pair.closingTag || pair.isVoid || pair.isSelfClosing) {
      return { ok: false, reason: "missing-closing-tag" };
    }
    edits.push({ range: pair.openingTag, text: "" }, { range: pair.closingTag, text: "" });
  }
  return { ok: true, value: descending(edits) };
}

export function planWrapSelections(ranges: readonly OffsetRange[], tagName: string): CoreResult<readonly TextEdit[]> {
  const targets = uniqueRanges(ranges).sort((left, right) => left.start - right.start || left.end - right.end);
  if (targets.some((range) => range.start === range.end) || hasOverlap(targets)) {
    return { ok: false, reason: "overlapping-targets" };
  }
  if (isVoidElement(tagName)) {
    return { ok: false, reason: "void-transition" };
  }

  const events: Array<{ readonly offset: number; readonly order: number; readonly text: string }> = [];
  for (const range of targets) {
    events.push(
      { offset: range.end, order: 0, text: `</${tagName}>` },
      { offset: range.start, order: 1, text: `<${tagName}>` },
    );
  }
  const edits: TextEdit[] = [];
  for (const event of events.sort((left, right) => left.offset - right.offset || left.order - right.order)) {
    const existing = edits.at(-1);
    if (existing?.range.start === event.offset) {
      edits[edits.length - 1] = { range: existing.range, text: existing.text + event.text };
    } else {
      edits.push({ range: { start: event.offset, end: event.offset }, text: event.text });
    }
  }
  return { ok: true, value: descending(edits) };
}

export function planPairSelections(pairs: readonly TagPair[]): CoreResult<readonly OffsetRange[]> {
  const targets = uniquePairs(pairs);
  const ranges: OffsetRange[] = [];
  for (const pair of targets) {
    if (!pair.closingTag && !pair.isVoid && !pair.isSelfClosing) {
      return { ok: false, reason: "missing-closing-tag" };
    }
    ranges.push(pair.full);
  }
  if (hasOverlap(ranges)) {
    return { ok: false, reason: "overlapping-targets" };
  }
  return { ok: true, value: ranges.sort((left, right) => left.start - right.start) };
}

export function applyTextEdits(source: string, edits: readonly TextEdit[]): string {
  let result = source;
  for (const edit of descending([...edits])) {
    result = result.slice(0, edit.range.start) + edit.text + result.slice(edit.range.end);
  }
  return result;
}

export function transformOffset(
  offset: number,
  edits: readonly TextEdit[],
  insertionAffinity: "left" | "right" = "right",
): number {
  let delta = 0;
  for (const edit of [...edits].sort((left, right) => left.range.start - right.range.start)) {
    const removedLength = edit.range.end - edit.range.start;
    if (removedLength === 0) {
      if (offset > edit.range.start || (offset === edit.range.start && insertionAffinity === "right")) {
        delta += edit.text.length;
      }
      continue;
    }
    if (offset >= edit.range.end) {
      delta += edit.text.length - removedLength;
      continue;
    }
    if (offset > edit.range.start) {
      return edit.range.start + delta + Math.min(offset - edit.range.start, edit.text.length);
    }
  }
  return offset + delta;
}

export function pairKey(pair: TagPair): string {
  return `${pair.full.start}:${pair.full.end}:${normalizeHtmlTagName(pair.name)}`;
}
