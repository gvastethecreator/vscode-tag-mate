# Changelog

## [Unreleased]

- Fixed: Wrap Selection refuses selections that would mis-nest tags or land inside tag syntax.
- Very large documents are refused before they are encoded.
- Refusals identify the first affected cursor and line/column without showing source text. Multi-cursor edits remain all-or-nothing. Compare current HTML actions against the same fixtures in native Emmet before deciding whether a contextual Tag Actions menu is useful. The menu and parser expansion remain outside the accepted implementation.

## 0.1.0 — Unreleased

- Implemented Change Tag, Go to Matching Tag, Select Tag Pair, Remove Surrounding Tag, and Wrap Selection with Tag for HTML.
- Added syntax-aware nested matching, HTML void and optional-end policies, safe malformed-source failures, and atomic multi-cursor edit planning.
- Added desktop, web, virtual-workspace, performance, media, and packaged-VSIX verification.
