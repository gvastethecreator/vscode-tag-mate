Repo: `X:\vscode-extensions\tag-mate`
Remote: private (`gvastethecreator/tag-mate`)

# PDR — Tag Mate

## Status
Scaffolded · Priority P1

## Product summary

Tag Mate is a focused structured-markup editing extension that combines reliable paired-tag operations into one modern tool: rename, close, navigate, select, remove, wrap and change matching tags across common markup languages.

## Opportunity

Auto Rename Tag and Auto Close Tag historically reached very large audiences, proving strong demand. VS Code now covers portions of these jobs natively through linked editing and language services, so a new product must not merely duplicate old behavior. Tag Mate differentiates through **consistent cross-language tag operations** and precise explicit commands.

Historical category references:
- https://marketplace.visualstudio.com/items?itemName=formulahendry.auto-rename-tag
- https://marketplace.visualstudio.com/items?itemName=formulahendry.auto-close-tag
- VS Code language features: https://code.visualstudio.com/api/language-extensions/programmatic-language-features

## Target languages

Initial support candidates:

- HTML
- XML
- JSX
- TSX
- Vue
- Svelte
- Astro

Ship only languages with robust parsing/fixture coverage. It is better to support four languages correctly than seven heuristically.

## MVP commands

- `Tag Mate: Change Tag`
- `Tag Mate: Go to Matching Tag`
- `Tag Mate: Select Tag Pair`
- `Tag Mate: Remove Surrounding Tag`
- `Tag Mate: Wrap Selection with Tag`

Paired auto-rename may be included only if it adds reliable coverage beyond native linked editing for supported languages.

## Core behavior

Given:

```html
<div class="card">hello</div>
```

`Change Tag` -> `article` produces:

```html
<article class="card">hello</article>
```

Only the tag names change. Attributes/content/formatting are preserved.

## Parsing strategy

Do not use broad regex matching for nested markup. The architecture must provide a syntax-aware tag-pair locator.

Preferred strategy order:

1. use existing VS Code/language information where stable and sufficient;
2. lightweight language-specific parsers/tokenizers;
3. Tree-sitter only if dependency cost is justified and packaging/web implications are understood.

Keep a common `TagPair` domain model and language adapters.

```ts
interface TagPair {
  name: string;
  openNameRange: Range;
  closeNameRange?: Range;
  openElementRange: Range;
  closeElementRange?: Range;
  selfClosing: boolean;
}
```

## Required edge cases

- nested same-name elements;
- self-closing tags;
- void HTML elements;
- JSX components vs intrinsic tags;
- fragments `<>...</>`;
- namespaced XML;
- attributes containing `>` or strings;
- template expressions;
- malformed/incomplete documents while typing;
- comments/scripts/styles containing tag-like text;
- multiline opening tags.

## Auto-close behavior

Do not override native behavior blindly. If implemented:

- default to disabled where VS Code/language service already provides equivalent behavior;
- expose only for language modes where measured benefit exists;
- avoid duplicate closing tags;
- respect configured void/self-closing semantics.

## Commands UX

- `Change Tag`: Input Box prefilled with current tag name.
- `Wrap Selection`: Quick Pick/Input Box for tag name; never inject unsanitized arbitrary syntax beyond a validated tag identifier.
- matching-tag navigation should work from opening name, closing name and element body when unambiguous.

## Non-goals

- full HTML/XML language server;
- formatting engine;
- Emmet replacement;
- component rename refactoring across files;
- DOM visualization;
- JSX semantic type analysis.

## Architecture

```text
src/
├─ extension.ts
├─ core/
│  ├─ tagPair.ts
│  └─ transforms.ts
├─ adapters/
│  ├─ html.ts
│  ├─ xml.ts
│  ├─ jsx.ts
│  └─ ...
├─ commands/
│  ├─ changeTag.ts
│  ├─ matchTag.ts
│  ├─ removeTag.ts
│  ├─ wrapSelection.ts
│  └─ selectTag.ts
└─ platform/
   └─ editor.ts
```

Transform generation should be pure and tested separately from edit application.

## VS Code APIs

- language/document selectors;
- `TextEditor`, `TextDocument`, `Range`, `Selection`;
- `WorkspaceEdit` / editor edits;
- commands and context menus;
- configuration.

Avoid Proposed APIs.

## Compatibility

| Environment | Goal |
| --- | --- |
| Desktop | Full |
| Web | Full if parser dependencies are browser-safe |
| Virtual Workspace | Full; document-only operations |
| Restricted Mode | Full; no code execution |
| Remote | Full |

This project should be designed as web-compatible from the beginning unless parser choice prevents it.

## Performance

- parse only active/relevant document;
- incremental or bounded scanning where possible;
- never scan workspace;
- debounce live auto-rename behavior if added;
- commands should feel instantaneous on normal source files;
- establish stress fixtures for very large generated HTML and define a safe fallback.

## Testing

Fixture suite per supported language with cursor positions and expected matching ranges.

Required regression families:

- nested tags;
- malformed tags;
- mixed embedded languages;
- JSX fragments/components;
- XML namespaces;
- unicode attributes/content;
- large files;
- CRLF/LF.

Integration:

- commands apply one atomic workspace edit;
- undo restores both opening and closing names together;
- context menu visibility matches language selectors;
- web host if supported.

## Acceptance criteria

- no regex-only pair matching;
- no duplicate native auto-close behavior by default;
- paired edits are atomic/undoable;
- unsupported syntax fails safely without destructive edits;
- supported-language claims are backed by fixture suites;
- web compatibility is maintained if feasible.

## Post-MVP

- optional paired live rename for coverage gaps;
- expand/shrink selection through ancestor tags;
- swap tag preset (`div` -> `section`, etc.) via Quick Pick;
- customizable void/custom-element rules;
- additional templating adapters based on demand.

## Definition of done

Parser/adapters, transformations, tests, web/remote review, README, Marketplace assets, release automation and explicit comparison with native VS Code capabilities are complete.
