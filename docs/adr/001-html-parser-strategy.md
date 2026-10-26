# ADR 001: HTML parser strategy

- Status: Accepted
- Date: 2026-09-02
- Release: 0.1.0

## Context

Tag Mate must identify exact opening and closing tags in nested, incomplete, and mixed-content HTML. A broad regular expression cannot distinguish quoted angle brackets, comments, raw `script`/`style` text, same-name nesting, or malformed source. The parser must also run in desktop and web extension hosts.

## Decision

Use the syntax scanner from Microsoft `vscode-html-languageservice` 5.6.2 and convert its token stream into Tag Mate's immutable offset-based `TagPair` model. Keep nesting recovery, validation, void/optional-end policy, edit planning, overlap detection, and cursor mapping in Tag Mate's pure core.

The runtime dependencies are pinned and bundled into both extension entry points. No parser files or `node_modules` ship separately. Parsing is command-driven, limited to the active HTML document, cached by URI plus document version, capped at 64 document versions, and rejected above 2 MiB of UTF-8 input.

Concrete closing-tag ranges are required for navigation and wrapper removal. Void and explicit self-closing elements remain single-tag targets. Missing optional end tags can be renamed only within the same centralized optional-end behavior group; other incomplete structures fail without edits.

An unexpected scanner failure maps to a typed `malformed-tag` result. Commands receive no edit plan, show concise feedback, and leave the document unchanged.

## Evidence

The selected parser was prototyped against nested same-name elements, quoted `>` characters, comments and doctypes, raw script text, void and custom elements, multiline tags, mixed case, malformed nesting, stray closing tags, and optional end tags. It returned stable source offsets and recovered incomplete nodes without inventing a closing range.

Local median command-path parsing on representative HTML measured about 2 ms for 100 KiB and 13 ms for 1 MiB. The committed performance gate enforces less than 20 ms and 150 ms respectively after warmup. Dense adversarial markup is still bounded by the 2 MiB hard limit.

## Dependency and license

| Runtime package | Version | License | Shipped use | Update policy |
| --- | --- | --- | --- | --- |
| `vscode-html-languageservice` | 5.6.2 | MIT, Microsoft | Scanner and entity tables bundled into both entry points | Exact pin; update only with fixtures, bundle audit, desktop/web tests, and performance gates |

The VSIX includes `THIRD_PARTY_NOTICES.md`. Package dependencies are not copied into the archive.

## Alternatives

- VS Code document APIs: rejected because they expose text and language mode, not an HTML syntax tree or tag-pair ranges.
- A custom regex or scanner-only matcher: rejected because correctness for malformed nesting, raw text, comments, and optional-end behavior would become product-owned parser work.
- Tree-sitter: rejected for 0.1.0 because its native/WASM packaging, grammar loading, and web-host cost are unnecessary for the HTML-only release.

## Consequences

- HTML 0.1.0 has one syntax-aware adapter and matching behavior across Node and browser hosts.
- The scanner submodule is version-pinned and guarded by fixtures because the package exposes it below its top-level language-service facade.
- JSX/TSX and XML need separate adapters and parser decisions in later milestones; HTML recovery behavior must not be reused as a compatibility fallback for those languages.
