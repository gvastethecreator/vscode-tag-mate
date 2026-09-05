# Publishing Tag Mate

Extension id: `gvastethecreator.tag-mate`.

Publishing is an operator action. Building a VSIX does not authorize a tag, a GitHub Release, or a registry upload.

The **Release** workflow starts from **Actions → Release → Run workflow**. Default input `artifact-only` does not publish.

## Candidate

```powershell
pnpm install --frozen-lockfile
pnpm run quality
pnpm run test:integration
pnpm run test:web
pnpm run vsix
pnpm run inspect:vsix
pnpm run test:vsix
```

Output: `tag-mate.vsix` (gitignored).

`package.json` → `icon` is a direct downsample of the accepted native-alpha Imagegen PNG. The `files` allowlist keeps sources, tests, and build tools out of the VSIX.

## GitHub Actions

1. Run **Release** with `artifact-only` from `main`.
2. After approval, run one of `github-release`, `vscode-marketplace`, or `open-vsx`.
3. Run one registry at a time.

Environments `github-release`, `vscode-marketplace`, and `open-vsx` accept `main` only. Do not store `VSCE_PAT` or `OVSX_PAT` until the owner asks to publish.

## Manual fallback

1. Open https://marketplace.visualstudio.com/manage
2. Sign in with the Microsoft account that owns publisher `gvastethecreator`
3. Choose **New extension** → **Visual Studio Code** → upload the verified VSIX

Open VSX:

```powershell
pnpm exec ovsx publish .\tag-mate.vsix -p $env:OVSX_PAT
```

Never place a PAT in a command, an issue, a log, or a document.

## Rollback

Prefer a forward patch. Do not rewrite a public tag or replace bytes under an existing version.
