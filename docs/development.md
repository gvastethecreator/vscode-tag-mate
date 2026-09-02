# Development

Package manager is pnpm (`packageManager: pnpm@12.1.0`). Do not switch to npm or yarn.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm install` | Install deps from `pnpm-lock.yaml` |
| `pnpm test` | Node test runner on `src/**/*.test.ts` |
| `pnpm run check-types` | `tsc --noEmit` |
| `pnpm run compile` | Types then Node and browser bundles |
| `pnpm run watch` | esbuild watch |
| `pnpm run package` | Production bundle |
| `pnpm run test:performance` | Parser and bundle budgets |
| `pnpm run test:integration` | Desktop extension-host behavior |
| `pnpm run test:web` | Browser host plus writable virtual workspace |
| `pnpm run vsix` | Build `tag-mate.vsix` from the strict package allowlist |
| `pnpm run inspect:vsix` | Audit archive contents, bundles, manifest, and media |
| `pnpm run test:vsix` | Install the VSIX into a clean profile and run the desktop suite |
| `pnpm run quality` | Unit, types, bundles, performance, and media checks |

GitHub Actions runs quality on Linux, Windows, and macOS; desktop tests against minimum, stable, and Insiders hosts; a Chromium web-host test; and a clean-profile VSIX smoke test.

## Extension Host

`.vscode/launch.json` uses the default build task, then opens `test-workspace/` with `--extensionDevelopmentPath` set to this repo.

Parser rationale and measured boundaries: [ADR 001](adr/001-html-parser-strategy.md).

Marketplace packaging: [publishing](publishing.md).
