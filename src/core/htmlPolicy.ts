const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

const OPTIONAL_END_GROUPS = [
  ["li"],
  ["dt", "dd"],
  ["p"],
  ["rt", "rp"],
  ["optgroup"],
  ["option"],
  ["colgroup"],
  ["thead"],
  ["tbody", "tfoot"],
  ["tr"],
  ["td", "th"],
] as const;

const OPTIONAL_END_GROUP_BY_TAG = new Map<string, number>();
for (const [groupIndex, group] of OPTIONAL_END_GROUPS.entries()) {
  for (const tag of group) {
    OPTIONAL_END_GROUP_BY_TAG.set(tag, groupIndex);
  }
}

const HTML_TAG_NAME = /^[A-Za-z][A-Za-z0-9._:-]*$/;

export function normalizeHtmlTagName(name: string): string {
  return name.toLowerCase();
}

export function isVoidElement(name: string): boolean {
  return VOID_ELEMENTS.has(normalizeHtmlTagName(name));
}

export function isOptionalEndElement(name: string): boolean {
  return OPTIONAL_END_GROUP_BY_TAG.has(normalizeHtmlTagName(name));
}

export function canRenameMissingOptionalEnd(from: string, to: string): boolean {
  const fromGroup = OPTIONAL_END_GROUP_BY_TAG.get(normalizeHtmlTagName(from));
  const toGroup = OPTIONAL_END_GROUP_BY_TAG.get(normalizeHtmlTagName(to));
  return fromGroup !== undefined && fromGroup === toGroup;
}

export function validateHtmlTagName(value: string): string | undefined {
  if (value.length === 0) {
    return "Enter a tag name.";
  }
  if (!HTML_TAG_NAME.test(value)) {
    return "Use an HTML tag name without brackets, spaces, attributes, or quotes.";
  }
  return undefined;
}
