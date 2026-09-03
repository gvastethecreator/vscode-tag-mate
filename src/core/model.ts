export interface OffsetRange {
  readonly start: number;
  readonly end: number;
}

export type TagLocation = "opening" | "body" | "closing";

export interface TagPair {
  readonly name: string;
  readonly openingTag: OffsetRange;
  readonly openingName: OffsetRange;
  readonly closingTag?: OffsetRange;
  readonly closingName?: OffsetRange;
  readonly inner?: OffsetRange;
  readonly full: OffsetRange;
  readonly isVoid: boolean;
  readonly isSelfClosing: boolean;
  readonly isOptionalEnd: boolean;
}

export interface LocatedTagPair {
  readonly pair: TagPair;
  readonly location: TagLocation;
}

export interface TextEdit {
  readonly range: OffsetRange;
  readonly text: string;
}

export type CoreResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: FailureReason };

export type FailureReason =
  | "document-too-large"
  | "invalid-tag-name"
  | "malformed-tag"
  | "missing-closing-tag"
  | "no-tag"
  | "not-in-tag"
  | "overlapping-targets"
  | "void-transition";

export const DOCUMENT_SIZE_LIMIT = 2 * 1024 * 1024;

export function rangeContains(range: OffsetRange, offset: number): boolean {
  return offset >= range.start && offset < range.end;
}

export function rangesEqual(left: OffsetRange, right: OffsetRange): boolean {
  return left.start === right.start && left.end === right.end;
}

export function rangesOverlap(left: OffsetRange, right: OffsetRange): boolean {
  return left.start < right.end && right.start < left.end;
}
