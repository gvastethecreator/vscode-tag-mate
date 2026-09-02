# Tag Mate — Complete delivery plan

Status: execution specification and parser decision plan  
Repository: `gvastethecreator/vscode-tag-mate`  
Product phase: scaffold  
First public target: `0.1.0`  
Planned language milestones: HTML → JSX/TSX → XML  
Last reviewed: 2026-09-01

This document converts `docs/PDR.md` into an executable plan. It deliberately narrows the first release and makes parser selection a blocking architecture decision. Tag editing is deceptively difficult: correctness on malformed and nested markup matters more than claiming support for many languages.

---

## 1. Current state

The repository contains a sound common scaffold:

- strict TypeScript, esbuild, pnpm, CI;
- five contributed commands;
- PDR, security/development/publishing notes, agent guidance, icon, and preview;
- aspirational Virtual Workspace, Restricted Mode, remote, and web support.

The implementation is currently empty:

- every command calls the shared not-implemented handler;
- the only test verifies the Node test runner;
- no parser, language adapter, tag-pair model, command implementation, edit planner, or editor integration exists;
- no browser entry, Extension Host integration suite, or packaged VSIX smoke test exists;
- `package.json` declares ESM while esbuild emits a CommonJS `.js` entry;
- supported languages are listed as candidates but no parser strategy has been selected.

The largest project risk is pretending that HTML, XML, JSX, TSX, Vue, Svelte, and Astro share one safe parser or can be handled with broad regular expressions. They cannot.

---

## 2. Delivery milestones

### `0.1.0` — reliable explicit HTML operations

Supported language mode:

- HTML.

Commands:

- Change Tag;
- Go to Matching Tag;
- Select Tag Pair;
- Remove Surrounding Tag;
- Wrap Selection with Tag.

No live auto-rename or auto-close behavior.

### `0.2.0` — JSX and TSX adapters

- intrinsic and component tags;
- member component names such as `UI.Button`;
- fragments;
- self-closing components;
- expression-aware parsing;
- same explicit command set where semantics are proven.

### `0.3.0` — XML adapter

- case-sensitive names;
- namespaces;
- self-closing elements;
- XML comments, processing instructions, and CDATA handling;
- same explicit command set with XML-specific validation.

### Later evaluation

Vue, Svelte, Astro, templating languages, live paired rename, and auto-close require separate adapter research and demand evidence. They are not launch blockers.

---

## 3. Parser strategy decision — blocking ADR

Before implementing commands, create `docs/adr/001-parser-strategy.md` and compare at least these approaches.

### Candidate A — language-service libraries

Examples:

- `vscode-html-languageservice` for HTML;
- TypeScript compiler/scanner APIs for JSX/TSX;
- an XML-specific parser for XML.

Evaluate:

- source ranges and recovery on incomplete documents;
- browser compatibility;
- bundle size and activation cost;
- license and maintenance;
- ability to distinguish comments/raw text/attributes;
- dependency update risk.

### Candidate B — Tree-sitter/WASM

Evaluate:

- grammar quality per language;
- native versus WASM packaging;
- web extension viability;
- query/range ergonomics;
- startup and memory costs;
- Marketplace/VSIX packaging;
- maintenance burden for multiple grammars.

### Candidate C — focused custom scanners

Evaluate:

- correctness on nested same-name elements;
- malformed/incomplete input;
- raw `script`/`style` text;
- quoted attributes containing `>`;
- JSX expressions and regex/template strings;
- total fixture burden;
- long-term maintenance.

A custom scanner may be acceptable for HTML if bounded and extensively tested. It is unlikely to be sufficient as one generic implementation for every target language.

### Decision requirements

The ADR must include:

- prototypes on representative fixtures;
- measured minified bundle size;
- activation/parse timing on 100 KiB and 1 MiB fixtures;
- browser-host result;
- malformed-document behavior;
- dependency/license table;
- selected fallback when parsing fails;
- reasons rejected alternatives are not used.

No feature ticket depending on tag-pair location should begin before this ADR is approved.

---

## 4. Common domain model

All adapters map into a shared immutable model.

```ts
interface OffsetRange {
  start: number;
  end: number;
}

interface TagPair {
  language: "html" | "jsx" | "tsx" | "xml";
  name: string;
  openNameRange: OffsetRange;
  closeNameRange?: OffsetRange;
  openTagRange: OffsetRange;
  closeTagRange?: OffsetRange;
  elementRange: OffsetRange;
  contentRange: OffsetRange;
  selfClosing: boolean;
  voidElement: boolean;
  fragment: boolean;
}

type LocateResult =
  | { ok: true; pair: TagPair; position: "open" | "close" | "content" }
  | { ok: false; reason: LocateFailure };
```

Requirements:

- ranges use offsets in the current immutable source version;
- name ranges exclude `<`, `/`, whitespace, attributes, and `>`;
- `closeNameRange` is absent for self-closing/void elements;
- fragments have no editable name;
- adapters fail safely when a pair cannot be proven;
- command logic consumes only this common model;
- parser-specific AST objects do not leak into command modules.

---

## 5. Command behavior specification

### 5.1 Change Tag

Flow:

1. locate the tag pair under the cursor;
2. reject fragments and unsupported/malformed pairs;
3. open an Input Box prefilled with the current name;
4. validate the new name for the active language;
5. update opening and closing name ranges atomically;
6. update only opening name for self-closing tags;
7. preserve attributes, whitespace, content, and case exactly except for changed names;
8. one undo restores all edits.

For HTML, renaming to a void element is rejected in `0.1` when content or a closing tag exists. Renaming a void element to a normal element is rejected unless the command can construct a correct closing tag through an explicitly designed future flow.

### 5.2 Go to Matching Tag

`0.1` behavior:

- cursor in opening tag/name → move to closing tag name;
- cursor in closing tag/name → move to opening tag name;
- self-closing/void element → concise status feedback, no movement;
- cursor only in arbitrary body content → no ancestor guessing in the first release unless parser UX testing proves it unambiguous.

Preserve editor focus and reveal the destination range.

### 5.3 Select Tag Pair

Initial meaning:

- select the complete element range from opening `<` through closing `>`;
- for self-closing/void elements, select the complete single tag;
- preserve one selection per original cursor where ranges do not overlap;
- deduplicate identical targets;
- reject conflicting overlapping targets rather than producing unpredictable selection sets.

Ancestor expand/shrink selection is post-MVP.

### 5.4 Remove Surrounding Tag

- remove opening and closing tag ranges only;
- preserve content bytes/text exactly;
- self-closing/void elements with no content are rejected because removing them deletes the element itself, which is a different command;
- fragments may be removable only when adapter semantics are explicit;
- do not autoformat or aggressively trim whitespace;
- if removing standalone multiline tags creates empty boundary lines, use a separately tested conservative cleanup rule or leave formatting unchanged;
- one undo restores both tags.

### 5.5 Wrap Selection with Tag

- require at least one non-empty selection in `0.1`;
- prompt once for a valid tag name;
- wrap each non-overlapping selection with opening/closing tags;
- preserve selected text and EOL;
- reject overlapping selections;
- support a configurable or Quick Pick choice for inline versus newline wrapper only after basic behavior is stable;
- no attributes/snippet syntax in the initial release;
- one undo restores all selections.

---

## 6. Language-specific rules

### 6.1 HTML `0.1`

Required cases:

- nested same-name tags;
- attributes containing `>` or `<` inside quotes;
- comments and doctypes;
- raw text in `script` and `style`;
- void elements;
- custom elements;
- multiline opening tags;
- mixed-case source names;
- malformed/incomplete opening and closing tags;
- stray closing tags;
- optional HTML end tags.

Important policy:

HTML source matching may be case-insensitive for pairing, but edits preserve the exact source spelling unless the user enters a new spelling.

Initial void set follows current HTML elements and is centralized/tested. Do not infer voidness merely from a missing closing tag.

Optional-end-tag elements are a high-risk case. If the parser does not provide a concrete closing tag, Change Tag may edit only the opening name when doing so cannot invalidate semantics, while matching/removal operations may reject the pair. Document exact behavior.

### 6.2 JSX/TSX `0.2`

Required cases:

- intrinsic lowercase tags;
- PascalCase components;
- member expressions (`UI.Button`);
- namespaced names only if parser supports them;
- fragments `<>...</>`;
- expressions containing tag-like strings;
- comments;
- template strings and regex inside expressions;
- self-closing components;
- generic/type syntax near JSX;
- incomplete code while typing.

Do not rename component definitions/imports. Tag Mate changes paired syntax in the current element only.

### 6.3 XML `0.3`

Required cases:

- case-sensitive matching;
- namespace prefixes;
- self-closing elements;
- comments;
- processing instructions;
- CDATA;
- entities;
- multiline attributes;
- malformed nesting.

Tag name validation differs by adapter; do not reuse a simplistic HTML validator for XML or JSX.

---

## 7. Explicit non-goals

- full language server;
- Emmet replacement;
- formatter;
- component/refactor rename across files;
- DOM outline/visualizer;
- arbitrary expression editing;
- broad regex-only matching;
- workspace scanning;
- live auto-rename in `0.1`;
- auto-close in `0.1`;
- Vue/Svelte/Astro claims before adapters and tests exist;
- generating attributes or framework components from AI;
- executing workspace code.

---

## 8. Architecture

Recommended layout:

```text
src/
├─ extension.ts
├─ core/
│  ├─ model.ts
│  ├─ locate.ts
│  ├─ validators.ts
│  ├─ edits.ts
│  ├─ selections.ts
│  └─ failures.ts
├─ adapters/
│  ├─ adapter.ts
│  ├─ html/
│  │  ├─ parser.ts
│  │  ├─ locator.ts
│  │  ├─ names.ts
│  │  └─ voidElements.ts
│  ├─ jsx/
│  └─ xml/
├─ commands/
│  ├─ changeTag.ts
│  ├─ goToMatchingTag.ts
│  ├─ selectTagPair.ts
│  ├─ removeSurroundingTag.ts
│  └─ wrapSelection.ts
└─ platform/
   ├─ editor.ts
   ├─ input.ts
   ├─ configuration.ts
   └─ feedback.ts
```

### Core purity

Models, validation, edit planning, selection normalization, and adapter transformations should be testable without VS Code. Parser libraries may live behind adapter boundaries.

### Document cache

- cache parse result by URI + document version;
- parse only supported active documents;
- command invocation may parse synchronously/async depending on selected library;
- no workspace cache or watcher;
- cap supported file size;
- cancel or reject stale asynchronous results;
- clear cache on close/language change.

### Error handling

Normal malformed source returns a typed failure. Commands do not throw or partially edit. Unexpected exceptions are logged without source content and surfaced as one generic error.

---

## 9. Manifest and runtime requirements

### Build

Fix the current module mismatch. Recommended:

- Node entry: `dist/node/extension.cjs`;
- web entry: `dist/web/extension.js` only if the selected parser stack supports browser/WebWorker execution;
- parser dependencies bundled intentionally;
- source maps excluded or hidden appropriately in production;
- package inspection verifies parser assets/WASM if any.

### Activation

- activate only for commands and supported language modes;
- no `onStartupFinished`;
- no workspace scans;
- if supporting VS Code below 1.74, declare explicit command/language events.

### Command contexts

Use language-aware `when` clauses. In `0.1`, commands should appear only in HTML editors. Add languages milestone by milestone.

### Compatibility matrix

| Environment | HTML target | JSX/TSX target | XML target |
| --- | --- | --- | --- |
| Desktop | Full | Full | Full |
| Remote | Full | Full | Full |
| Web | Required if parser is browser-safe | Required if parser is browser-safe | Required if parser is browser-safe |
| Virtual Workspace | Full; document-only | Full | Full |
| Restricted Mode | Full; no code execution | Full | Full |

If parser choice blocks web, state that before release and remove/adjust `browser`/capabilities rather than shipping a false claim.

Derive `engines.vscode` from actual APIs and test the minimum/current versions.

---

## 10. Security and privacy

- no network access;
- zero telemetry initially;
- no source content, tag content, attributes, or filenames in logs;
- no persistence of source/AST/cache;
- validate command arguments from other extensions;
- validate tag names per language;
- do not treat Input Box content as raw markup;
- no attribute/snippet injection in `0.1`;
- no `eval` or workspace code execution;
- dependency/license/supply-chain review for parser packages and WASM;
- bounded parsing for hostile/very large input;
- no edits after source document version changes during an async parse;
- Restricted Mode declaration reflects no workspace execution.

---

## 11. UX and accessibility

- native Input Box, Quick Pick, selections, commands, and context menus;
- no webview/status item/Tree View;
- keyboard-only operation;
- successful operations silent;
- concise typed feedback for no tag, unmatched tag, invalid name, void/self-closing behavior, stale parse, or unsupported language;
- preserve focus and scroll context;
- one undo per command;
- command names use consistent “Tag Mate:” category;
- no default keybindings until conflicts and ergonomics are tested;
- context menu should not show five noisy items ungrouped; consider one primary command and Command Palette for the rest;
- README shows exact supported language/operation matrix.

---

## 12. Performance budgets

Targets to verify:

- no idle work;
- activation under 50 ms excluding parser bundle load requested by command;
- parse 100 KiB HTML under 20 ms and 1 MiB under 150 ms on a typical desktop;
- default maximum analyzed document size: 2 MiB;
- cache only current version results for a bounded number of open documents;
- no catastrophic backtracking;
- no parse of every open editor unless a command is invoked;
- browser bundle size justified in ADR;
- stale asynchronous parses discarded.

Include generated deeply nested and malformed stress fixtures.

---

## 13. Test matrix

### Common edit tests

- atomic two-range rename;
- self-closing rename;
- overlapping/multiple cursors;
- duplicate target cursors;
- offset ordering;
- one-step undo;
- cursor/selection restoration;
- invalid name;
- stale document version;
- CRLF/LF;
- Unicode content;
- no source formatting changes outside targeted ranges.

### HTML adapter fixtures

- nested same-name elements;
- siblings;
- attributes containing angle brackets and escaped quotes;
- comments/doctypes;
- script/style raw text;
- void elements;
- custom elements;
- multiline tags;
- optional end tags;
- mismatched/stray/incomplete tags;
- mixed-case tags;
- very deep nesting;
- large generated document.

### Command integration

- cursor in open/close/name/attribute/body;
- each command activation;
- Input Box cancel/validation;
- selection pair meaning;
- remove wrapper formatting behavior;
- wrap multiple selections;
- context menu visibility;
- unsupported language;
- Restricted Mode;
- untitled document;
- non-file URI;
- minimum/current VS Code.

### JSX/TSX fixtures

- intrinsic/component/member tags;
- fragments;
- expressions/comments;
- self-closing;
- generics/types;
- tag-like strings/regex/templates;
- malformed source.

### XML fixtures

- case and namespace;
- self-closing;
- CDATA/entities/comments/processing instructions;
- malformed nesting.

### Web/package

- browser parser/bundle activation;
- `@vscode/test-web` command flows;
- VSIX parser assets included;
- clean-profile install;
- no source fixtures accidentally shipped;
- package size recorded.

---

## 14. Ordered ticket backlog

Use these IDs in GitHub Issues, branches, commits, and PR descriptions.

### Foundation and parser decision

#### TAG-001 — Align module format and build outputs
Priority: P0  
Depends on: none

Create explicit Node/browser artifact strategy, remove ESM/CommonJS ambiguity, update manifest/tasks/launch/ignore rules, and add packaged activation check.

#### TAG-002 — Establish unit and Extension Host test harnesses
Priority: P0  
Depends on: TAG-001

Add pure fixture runner, desktop integration, optional web integration baseline, test workspace, CI timeouts, and minimum/current VS Code plan.

#### TAG-003 — Define shared tag-pair/range/failure models
Priority: P0  
Depends on: none

Create parser-independent immutable types and selection/edit contracts.

#### TAG-004 — Complete parser strategy prototypes and ADR
Priority: P0  
Depends on: TAG-002, TAG-003

Compare language services, Tree-sitter/WASM, and focused scanners using correctness, malformed input, web, bundle, license, and performance evidence.

#### TAG-005 — Implement document-versioned adapter registry/cache
Priority: P0  
Depends on: TAG-004

Select adapter by language, cache current source version, reject stale async results, enforce size limits, and clear on close/language change.

### HTML `0.1`

#### TAG-006 — Implement HTML parser adapter
Priority: P0  
Depends on: TAG-004, TAG-005

Parse supported HTML into an adapter-owned structure with safe recovery.

#### TAG-007 — Implement HTML tag-pair locator
Priority: P0  
Depends on: TAG-006

Map cursor offsets to precise common `TagPair`, including nested tags, raw text, comments, multiline attributes, and malformed failures.

#### TAG-008 — Implement HTML name validation and void-element policy
Priority: P0  
Depends on: TAG-003

Support standard/custom element names, case behavior, current void set, and safe rename restrictions.

#### TAG-009 — Implement common selection normalization and edit planner
Priority: P0  
Depends on: TAG-003

Deduplicate targets, reject overlap, order edits, preserve source, and support atomic application.

#### TAG-010 — Implement Change Tag for HTML
Priority: P0  
Depends on: TAG-007, TAG-008, TAG-009

Add prefilled Input Box, typed failures, atomic open/close edit, self-closing behavior, stale-version guard, and one-step undo.

#### TAG-011 — Implement Go to Matching Tag for HTML
Priority: P0  
Depends on: TAG-007

Navigate opening↔closing names, reveal range, and handle void/self-closing/unmatched cases.

#### TAG-012 — Implement Select Tag Pair for HTML
Priority: P0  
Depends on: TAG-007, TAG-009

Select exact complete element ranges, deduplicate multiple cursors, and reject conflicts.

#### TAG-013 — Implement Remove Surrounding Tag for HTML
Priority: P0  
Depends on: TAG-007, TAG-009

Remove only wrapper tags, preserve content, define conservative multiline whitespace behavior, reject void/self-closing deletion ambiguity.

#### TAG-014 — Implement Wrap Selection with HTML Tag
Priority: P0  
Depends on: TAG-008, TAG-009

Validate one tag name and wrap one/multiple non-overlapping selections with exact EOL/content preservation.

#### TAG-015 — Add command contexts and HTML-only UX
Priority: P1  
Depends on: TAG-010 through TAG-014

Scope menu visibility, decide submenu/default keybindings, and provide concise feedback without UI noise.

#### TAG-016 — Complete HTML correctness and stress fixture suite
Priority: P0  
Depends on: TAG-006 through TAG-014

Cover every required HTML edge case, deeply nested/large/malformed files, CRLF, Unicode, and source-preservation snapshots.

#### TAG-017 — Complete HTML desktop/web/virtual integration matrix
Priority: P0  
Depends on: TAG-015, TAG-016

Test packaged commands, undo, untitled/non-file documents, Restricted Mode, browser host if supported, minimum/current VS Code.

#### TAG-018 — Release `0.1.0`
Priority: P0  
Depends on: TAG-017, TAG-031, TAG-032, TAG-033

Publish HTML-only claims and parser limitations truthfully.

### JSX/TSX `0.2`

#### TAG-019 — Prototype and approve JSX/TSX adapter extension
Priority: P0  
Depends on: TAG-004, TAG-018

Validate compiler/scanner/parser choice, web/bundle impact, malformed source, and range mapping.

#### TAG-020 — Implement JSX/TSX pair locator
Priority: P0  
Depends on: TAG-019

Cover intrinsic/component/member tags, fragments, expressions, self-closing elements, and incomplete syntax.

#### TAG-021 — Implement JSX/TSX name validation and operation policies
Priority: P0  
Depends on: TAG-020

Define valid intrinsic/component/member names, fragment restrictions, and operation matrix.

#### TAG-022 — Enable supported commands for JSX/TSX
Priority: P0  
Depends on: TAG-020, TAG-021

Reuse common edit logic, add language contexts, and preserve JSX syntax.

#### TAG-023 — Complete JSX/TSX fixtures, web, package, and release `0.2`
Priority: P0  
Depends on: TAG-022

### XML `0.3`

#### TAG-024 — Select and approve XML adapter strategy
Priority: P1  
Depends on: TAG-004, TAG-018

#### TAG-025 — Implement XML locator and name validation
Priority: P1  
Depends on: TAG-024

Cover case-sensitive names, namespaces, CDATA, processing instructions, comments, and malformed nesting.

#### TAG-026 — Enable command matrix for XML
Priority: P1  
Depends on: TAG-025

#### TAG-027 — Complete XML fixtures, compatibility, package, and release `0.3`
Priority: P1  
Depends on: TAG-026

### Cross-cutting hardening and release

#### TAG-028 — Security and stale-edit review
Priority: P0  
Depends on: implemented commands

Audit Input Box validation, command arguments, source logging, async parser staleness, dependency risk, and no partial edits.

#### TAG-029 — Performance and bundle benchmark suite
Priority: P0  
Depends on: parser/adapter implementation

Measure parse latency, large/malformed input, cache, activation, browser load, and package size against ADR budgets.

#### TAG-030 — Derive capabilities, extension location, and minimum VS Code
Priority: P0  
Depends on: TAG-017 and later adapter matrices

Set `engines.vscode`, `browser`, `capabilities`, `extensionKind`, language contexts, and activation from evidence.

#### TAG-031 — Replace scaffold README and preview
Priority: P1  
Depends on: current milestone implementation

Document exact language/command matrix, unsupported cases, examples, privacy, performance limit, troubleshooting, parser choice, and real screenshots. Update CHANGELOG.

#### TAG-032 — Harden CI and VSIX inspection
Priority: P0  
Depends on: TAG-002 and current milestone tests

Run unit, desktop, web where supported, type, build, package-content inspection, clean-profile activation, and package-size checks.

#### TAG-033 — Dependency/license/supply-chain review
Priority: P0  
Depends on: TAG-004 and final parser set

Record every runtime parser dependency, license notice, update policy, bundling assets, and vulnerability response.

#### TAG-034 — Evaluate live paired rename only after explicit-command stability
Priority: P2  
Depends on: stable usage feedback

Research native linked-edit overlap, language gaps, debounce, composition/IME behavior, and duplicate-edit prevention. Requires separate approval.

#### TAG-035 — Evaluate Vue/Svelte/Astro adapters
Priority: P2  
Depends on: stable adapter architecture and demand

Create one decision ticket per language; never batch unsupported claims into a release.

---

## 15. Launch gate for `0.1.0`

Do not publish until:

- parser ADR is approved with evidence;
- HTML is the only claimed supported language unless additional adapters are complete;
- no regex-only pair matching exists;
- every command fails safely on malformed/unmatched/void cases;
- paired edits are atomic and one-step undoable;
- source outside target ranges is byte/text-identical;
- stale asynchronous parse results cannot edit newer documents;
- deep nesting/large/malformed fixtures meet budgets;
- Node/browser claims match packaged artifacts;
- Restricted/Virtual/Remote behavior is tested;
- minimum VS Code version is derived and tested;
- parser licenses/notices are correct;
- VSIX installs and all five commands work from a clean profile;
- README contains a precise support matrix and no placeholder media.

---

## 16. Primary references

- https://code.visualstudio.com/api
- https://code.visualstudio.com/api/language-extensions/programmatic-language-features
- https://code.visualstudio.com/api/references/extension-manifest
- https://code.visualstudio.com/api/references/activation-events
- https://code.visualstudio.com/api/extension-guides/web-extensions
- https://code.visualstudio.com/api/extension-guides/virtual-workspaces
- https://code.visualstudio.com/api/extension-guides/workspace-trust
- https://code.visualstudio.com/api/advanced-topics/extension-host
- https://code.visualstudio.com/api/advanced-topics/remote-extensions
- https://code.visualstudio.com/api/ux-guidelines/command-palette
- https://code.visualstudio.com/api/ux-guidelines/context-menus
- https://code.visualstudio.com/api/working-with-extensions/testing-extension
- https://code.visualstudio.com/api/working-with-extensions/bundling-extension
- https://code.visualstudio.com/api/working-with-extensions/publishing-extension
- https://github.com/microsoft/vscode-extension-samples
- https://github.com/microsoft/vscode-test-web
- https://marketplace.visualstudio.com/items?itemName=formulahendry.auto-rename-tag
- https://marketplace.visualstudio.com/items?itemName=formulahendry.auto-close-tag
