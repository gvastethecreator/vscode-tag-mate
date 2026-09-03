import { TokenType } from "vscode-html-languageservice/lib/umd/htmlLanguageTypes.js";
import { createScanner } from "vscode-html-languageservice/lib/umd/parser/htmlScanner.js";
import {
  DOCUMENT_SIZE_LIMIT,
  type CoreResult,
  type LocatedTagPair,
  type OffsetRange,
  type TagLocation,
  type TagPair,
  rangeContains,
} from "./model.ts";
import { isOptionalEndElement, isVoidElement, normalizeHtmlTagName } from "./htmlPolicy.ts";

interface HtmlNode {
  tag?: string;
  start: number;
  startTagEnd?: number;
  end: number;
  endTagStart?: number;
  closed: boolean;
  children: HtmlNode[];
  parent?: HtmlNode;
}

function asRange(start: number, end: number): OffsetRange {
  return { start, end };
}

function isSelfClosingOpening(text: string, start: number, end: number): boolean {
  let index = end - 2;
  while (index >= start && /\s/u.test(text[index] ?? "")) {
    index -= 1;
  }
  return text[index] === "/";
}

function createPair(text: string, node: HtmlNode): TagPair | undefined {
  if (!node.tag || node.startTagEnd === undefined) {
    return undefined;
  }

  const openingName = asRange(node.start + 1, node.start + 1 + node.tag.length);
  if (openingName.end > node.startTagEnd) {
    return undefined;
  }

  const normalizedName = normalizeHtmlTagName(node.tag);
  const isVoid = isVoidElement(normalizedName);
  const isSelfClosing = isSelfClosingOpening(text, node.start, node.startTagEnd);
  const openingTag = asRange(node.start, node.startTagEnd);

  if (node.endTagStart === undefined) {
    return {
      name: node.tag,
      openingTag,
      openingName,
      full: openingTag,
      isVoid,
      isSelfClosing,
      isOptionalEnd: isOptionalEndElement(normalizedName),
    };
  }

  const closingName = asRange(node.endTagStart + 2, node.endTagStart + 2 + node.tag.length);
  const closingSourceName = text.slice(closingName.start, closingName.end);
  if (normalizeHtmlTagName(closingSourceName) !== normalizedName || node.end <= closingName.end) {
    return undefined;
  }

  return {
    name: node.tag,
    openingTag,
    openingName,
    closingTag: asRange(node.endTagStart, node.end),
    closingName,
    inner: asRange(node.startTagEnd, node.endTagStart),
    full: asRange(node.start, node.end),
    isVoid,
    isSelfClosing,
    isOptionalEnd: isOptionalEndElement(normalizedName),
  };
}

function flattenNodes(nodes: readonly HtmlNode[], target: HtmlNode[]): void {
  for (const node of nodes) {
    target.push(node);
    flattenNodes(node.children, target);
  }
}

function parseNodes(text: string): readonly HtmlNode[] {
  const root: HtmlNode = { start: 0, end: text.length, closed: true, children: [] };
  let current = root;
  let endTagStart = -1;
  let endTagName: string | undefined;
  const scanner = createScanner(text, undefined, undefined, true);

  for (let token = scanner.scan(); token !== TokenType.EOS; token = scanner.scan()) {
    if (token === TokenType.StartTagOpen) {
      const child: HtmlNode = {
        start: scanner.getTokenOffset(),
        end: text.length,
        closed: false,
        children: [],
        parent: current,
      };
      current.children.push(child);
      current = child;
    } else if (token === TokenType.StartTag) {
      current.tag = scanner.getTokenText();
    } else if (token === TokenType.StartTagClose) {
      if (!current.parent) continue;
      current.end = scanner.getTokenEnd();
      if (scanner.getTokenLength() === 0) {
        current = current.parent;
      } else {
        current.startTagEnd = scanner.getTokenEnd();
        if (current.tag && isVoidElement(current.tag)) {
          current.closed = true;
          current = current.parent;
        }
      }
    } else if (token === TokenType.StartTagSelfClose) {
      if (!current.parent) continue;
      current.closed = true;
      current.end = scanner.getTokenEnd();
      current.startTagEnd = scanner.getTokenEnd();
      current = current.parent;
    } else if (token === TokenType.EndTagOpen) {
      endTagStart = scanner.getTokenOffset();
      endTagName = undefined;
    } else if (token === TokenType.EndTag) {
      endTagName = scanner.getTokenText().toLowerCase();
    } else if (token === TokenType.EndTagClose) {
      let matched = current;
      while (matched.parent && normalizeHtmlTagName(matched.tag ?? "") !== endTagName) {
        matched = matched.parent;
      }
      if (!matched.parent) continue;
      while (current !== matched) {
        current.end = endTagStart;
        current.closed = false;
        current = current.parent!;
      }
      current.closed = true;
      current.endTagStart = endTagStart;
      current.end = scanner.getTokenEnd();
      current = current.parent!;
    }
  }

  while (current.parent) {
    current.end = text.length;
    current.closed = false;
    current = current.parent;
  }
  return root.children;
}

function pairLocation(pair: TagPair, offset: number): TagLocation | undefined {
  if (rangeContains(pair.openingTag, offset)) {
    return "opening";
  }
  if (pair.closingTag && rangeContains(pair.closingTag, offset)) {
    return "closing";
  }
  if (pair.inner && rangeContains(pair.inner, offset)) {
    return "body";
  }
  return undefined;
}

export class ParsedHtmlDocument {
  readonly #pairs: readonly TagPair[];
  readonly text: string;

  private constructor(text: string, roots: readonly HtmlNode[]) {
    this.text = text;
    const nodes: HtmlNode[] = [];
    flattenNodes(roots, nodes);
    this.#pairs = nodes
      .map((node) => createPair(text, node))
      .filter((pair): pair is TagPair => pair !== undefined)
      .sort((left, right) => {
        const lengthDifference = left.full.end - left.full.start - (right.full.end - right.full.start);
        return lengthDifference !== 0 ? lengthDifference : right.full.start - left.full.start;
      });
  }

  static parse(text: string, version = 1, uri = "untitled:tag-mate.html"): CoreResult<ParsedHtmlDocument> {
    if (new TextEncoder().encode(text).byteLength > DOCUMENT_SIZE_LIMIT) {
      return { ok: false, reason: "document-too-large" };
    }
    try {
      return {
        ok: true,
        value: new ParsedHtmlDocument(text, parseNodes(text)),
      };
    } catch {
      return { ok: false, reason: "malformed-tag" };
    }
  }

  locate(offset: number): CoreResult<LocatedTagPair> {
    const boundedOffset = Math.max(0, Math.min(offset, Math.max(0, this.text.length - 1)));
    for (const pair of this.#pairs) {
      const location = pairLocation(pair, boundedOffset);
      if (location) {
        return { ok: true, value: { pair, location } };
      }
    }
    return { ok: false, reason: "no-tag" };
  }

  locateTagSyntax(offset: number): CoreResult<LocatedTagPair> {
    const located = this.locate(offset);
    if (!located.ok) {
      return located;
    }
    return located.value.location === "body" ? { ok: false, reason: "not-in-tag" } : located;
  }
}
