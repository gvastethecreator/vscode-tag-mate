# Tag Mate — additional quality and competitive review

Review date: 2026-09-06. Baseline: `99f7b448e58e4bbc70f12c03269c07cfa7543abd` (`main`).

## Status and evidence

This document is a review and proposed acceptance contract, not implemented functionality. The accompanying PR owns the live work checklist. Existing behavior and shipped PDR are unchanged; any later behavior change must update both product and portfolio contracts.

Current ref, AGENTS, command handling and release publication steps were re-read. The current Microsoft Emmet manifest was also inspected to avoid treating built-in operations as missing. No build, integration, browser, VSIX or benchmark ran: local checkout was blocked by DNS and pnpm was unavailable. Comparative scenarios below have not been executed.

Pinned product sources: [command handlers](https://github.com/gvastethecreator/vscode-tag-mate/blob/99f7b448e58e4bbc70f12c03269c07cfa7543abd/src/commandHandlers.ts), [manifest](https://github.com/gvastethecreator/vscode-tag-mate/blob/99f7b448e58e4bbc70f12c03269c07cfa7543abd/package.json), [release](https://github.com/gvastethecreator/vscode-tag-mate/blob/99f7b448e58e4bbc70f12c03269c07cfa7543abd/.github/workflows/release.yml).

## The main issue is differentiation, not feature count

Tag Mate already provides explicit HTML change/match/select/unwrap/wrap operations, multiple cursors, overlap/void-element restrictions and a document-version guard before applying edits. Preserve these safety checks and the separation of pure edit planning from editor integration.

The [built-in Emmet manifest](https://github.com/microsoft/vscode/blob/main/extensions/emmet/package.json) includes `wrapWithAbbreviation`, `removeTag`, `updateTag`, `matchTag`, `balanceIn` and `balanceOut`. [Official VS Code Emmet documentation](https://code.visualstudio.com/docs/languages/emmet) confirms built-in support and multiple-cursor actions. Therefore, basic wrapping, removal or matching is not by itself a differentiated reason to install Tag Mate.

The right comparison is fewer steps, clearer contextual availability, predictable multi-cursor results or safer documented handling of a specific case. Do not assert superior correctness to Emmet until the same fixtures have been run on both. Automatic rename/highlight extensions are adjacent competitors, but adding continuous rewriting is not required for this explicit-command product.

## Establish the comparative corpus first

Use a small versioned fixture set covering valid nested HTML, custom elements, quoted attributes containing angle brackets, raw-text script/style contents, void elements, optional/missing end tags, malformed markup and independent/overlapping multi-cursor targets. For each operation, record initial text/selections, command invoked, prompts, resulting text/selections, undo behavior and safe refusal.

Run the corresponding Emmet operation where one exists. Distinguish a capability mismatch from an error: balance-selection semantics may differ from selecting only tag names. Record editor/version/configuration so observations can be reproduced. If no meaningful advantage is demonstrated, keep the current feature set stable rather than expanding scope to compensate.

## Optional contextual tag actions

Only after the comparison demonstrates a useful reduction in friction, add one `Tag Actions...` entry in the existing native context menu or Quick Pick. Reuse existing handlers/planners, showing only applicable actions and explaining unavailable operations concisely. Do not build a parallel edit engine or a permanent UI.

Capture the document version and target ranges before asynchronous selection/input and revalidate before applying. Scope the action to the exact active HTML document. Preserve all-or-nothing behavior for unsafe multi-cursor targets, stable selection direction, whitespace/content on unwrap and a single logical undo. Cancelled input must have no effect. Never modify read-only or stale documents merely because the menu was opened earlier.

Primary touchpoints: command routing, manifest/context conditions, existing HTML cache/edit planner and tests. No new parser, background listener that edits as the user types, or language server is justified by this proposal.

## Keep the parser decision evidence-based

The product uses `vscode-html-languageservice`. An embedded parsing service is not the same as deploying a separate language-server process. Do not replace it with handwritten regex scanning just to remove one declared dependency. Measure the production bundle and needed exports first, and preserve license notices. Broad JSX/Vue/Svelte/XML support would require distinct semantic contracts and is outside this change.

## Additional release findings

The inspected GitHub Release job calls `gh release` without checkout or explicit repository context. It does not bind tag creation to the preparation-stage verified commit. The existence check probes a release rather than a tag ref and treats lookup errors like absence. Shown publication consumers do not explicitly verify downloaded SHA256 sidecars.

Require an explicit repository, immutable verified source SHA, tag/ref checks, fail-closed API errors and checksum verification before every publisher. Never retag or rewrite an existing release automatically. Preserve protected environments and artifact-only defaults, and test without publishing. References: [CLI environment](https://cli.github.com/manual/gh_help_environment), [release creation](https://cli.github.com/manual/gh_release_create).

## Acceptance matrix

| Scenario | Required outcome |
| --- | --- |
| Operation already available in Emmet | Product documentation acknowledges it; differentiation needs observed evidence. |
| Context menu on a supported HTML element | Only applicable actions; existing planner reused. |
| Malformed/ambiguous or void-to-paired transformation | Safe refusal, no partial document change. |
| Multi-cursor independent versus overlapping targets | Atomic valid edit or explicit rejection; no silent subset. |
| Document changes while a prompt is open | Abort rather than apply stale ranges. |
| Unwrap, CRLF/LF and backward selections | Content/whitespace and selection mapping preserved. |
| Cancel, read-only editor, undo/redo | No side effects on cancel/refusal; one logical undo for success. |
| Large HTML or parser-cache lifecycle | Existing bounds and resource release remain effective. |
| Wrong checksum/tag SHA or API denial | Publication aborts without retagging. |

Use the existing core, desktop, web and installed-VSIX suites; record fixture and editor versions for the comparative corpus. Separate cold activation, first parse/action and repeated cached action timing. Record executable bundle size, not just repository or node_modules size. No numerical performance advantage is claimed here.

## Exclusions

No automatic rename competitor, permanent matching decoration system, language server, generic structured editor, handwritten parser replacement, broad language matrix, webview or telemetry. A stable, narrowly useful HTML utility is preferable to an undifferentiated large extension.
