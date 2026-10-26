import { ParsedHtmlDocument } from "./htmlDocument.ts";
import type { CoreResult } from "./model.ts";

export interface TextDocumentLike {
  readonly uri: { toString(): string };
  readonly version: number;
  readonly languageId: string;
  getText(): string;
}

interface CacheEntry {
  readonly version: number;
  readonly languageId: string;
  readonly parsed: ParsedHtmlDocument;
}

export class HtmlDocumentCache {
  readonly #entries = new Map<string, CacheEntry>();
  readonly maxEntries: number;

  constructor(maxEntries = 64) {
    this.maxEntries = maxEntries;
  }

  get(document: TextDocumentLike): CoreResult<ParsedHtmlDocument> {
    const key = document.uri.toString();
    const cached = this.#entries.get(key);
    if (cached?.version === document.version && cached.languageId === document.languageId) {
      this.#entries.delete(key);
      this.#entries.set(key, cached);
      return { ok: true, value: cached.parsed };
    }

    const parsed = ParsedHtmlDocument.parse(document.getText(), document.version, key);
    if (!parsed.ok) {
      return parsed;
    }
    this.#entries.delete(key);
    this.#entries.set(key, { version: document.version, languageId: document.languageId, parsed: parsed.value });
    while (this.#entries.size > this.maxEntries) {
      const oldest = this.#entries.keys().next().value as string | undefined;
      if (oldest === undefined) {
        break;
      }
      this.#entries.delete(oldest);
    }
    return parsed;
  }

  delete(uri: { toString(): string }): void {
    this.#entries.delete(uri.toString());
  }

  clear(): void {
    this.#entries.clear();
  }

  get size(): number {
    return this.#entries.size;
  }
}
