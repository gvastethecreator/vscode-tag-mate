Repo: `X:\vscode-extensions\vscode-tag-mate`
Remote: private (`gvastethecreator/vscode-tag-mate`)

# PDR — Tag Mate

## Status
0.1.0 release candidate · HTML scope complete · Priority P1

## Product summary

Tag Mate is a focused structured-markup editing extension for reliable explicit paired-tag operations: change, navigate, select, remove, and wrap.

## Opportunity

Auto Rename Tag and Auto Close Tag historically reached very large audiences, proving strong demand. VS Code now covers portions of these jobs natively through linked editing and language services, so a new product must not merely duplicate old behavior. Tag Mate differentiates through **consistent cross-language tag operations** and precise explicit commands.

Historical category references:
- https://marketplace.visualstudio.com/items?itemName=formulahendry.auto-rename-tag
- https://marketplace.visualstudio.com/items?itemName=formulahendry.auto-close-tag
- VS Code language features: https://code.visualstudio.com/api/language-extensions/programmatic-language-features

## Release scope

Version 0.1.0 supports HTML. Commands remain disabled in other language modes.

Later adapters are separate milestones:

- 0.2: JSX and TSX;
- 0.3: XML;
- Vue, Svelte, and Astro only after parser-backed demand and fixtures exist.

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

The accepted 0.1.0 decision is recorded in `docs/adr/001-html-parser-strategy.md`: Microsoft's browser-safe HTML language service feeds a common immutable `TagPair` model. It is bundled into Node and web entry points. Parsing is command-driven, cached by document version, bounded to 64 entries, and rejected above 2 MiB of UTF-8 input.

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
- custom elements and HTML mixed case;
- optional HTML end tags;
- attributes containing `>` or strings;
- template expressions;
- malformed/incomplete documents while typing;
- comments/scripts/styles containing tag-like text;
- multiline opening tags.

## Auto-close behavior

Not included in 0.1.0. VS Code's native behavior remains untouched. If later implemented:

- default to disabled where VS Code/language service already provides equivalent behavior;
- expose only for language modes where measured benefit exists;
- avoid duplicate closing tags;
- respect configured void/self-closing semantics.

## Commands UX

- `Change Tag`: Input Box prefilled with current tag name.
- `Wrap Selection`: Quick Pick/Input Box for tag name; never inject unsanitized arbitrary syntax beyond a validated tag identifier.
- matching-tag navigation works from opening or closing tag syntax; arbitrary body content does not trigger ancestor guessing in 0.1.0.
- multi-cursor operations deduplicate identical targets and reject overlapping targets atomically.

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
├─ commandHandlers.ts
└─ core/
   ├─ model.ts
   ├─ htmlPolicy.ts
   ├─ htmlDocument.ts
   ├─ editPlanner.ts
   └─ documentCache.ts
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
| Web | Full |
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
- reject active documents above 2 MiB of UTF-8 input;
- keep representative 100 KiB parsing below 20 ms and 1 MiB below 150 ms after warmup.

## Testing

Fixture suite per supported language with cursor positions and expected matching ranges.

Required regression families:

- nested tags;
- malformed tags;
- mixed embedded languages;
- quoted angle brackets, comments, doctypes, and raw `script`/`style` text;
- optional end tags and stray closing tags;
- unicode attributes/content;
- large files;
- CRLF/LF.

Integration:

- commands apply one atomic workspace edit;
- undo restores both opening and closing names together;
- context menu visibility matches language selectors;
- writable virtual workspace in a web host;
- clean-profile installation from the final VSIX.

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

## Assets

`media/source/tag-mate-imagegen.png` is the accepted native-alpha Imagegen source. `media/icon.png` is its direct 256×256 downsample. The obsolete SVG duplicate is removed so the raster pipeline has one authority. `media/preview.png` remains the real VS Code runtime capture on a transparent 1200×800 canvas.

## Definition of done

The HTML adapter, five transforms, desktop/web/virtual/restricted compatibility, tests, README, direct Imagegen icon, real-product preview, VSIX audit, and release-candidate automation are complete. Later language milestones do not block 0.1.0.
