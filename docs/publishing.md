# Publishing Tag Mate

Extension id: `gvastethecreator.tag-mate`.

This repository starts private. Do not publish to the Marketplace until PDR v1 is done and the user asks.

## Package a VSIX (no token needed)

```bash
pnpm run vsix
```

Output: `tag-mate.vsix` (gitignored). Run `pnpm run inspect:vsix` before installation.

## Browser upload

1. Open https://marketplace.visualstudio.com/manage
2. Sign in with the Microsoft account that owns publisher `gvastethecreator`
3. Choose **New extension** → **Visual Studio Code** → upload the VSIX

`package.json` → `icon` is a direct downsample of the accepted native-alpha Imagegen PNG. The strict `files` allowlist keeps sources, tests, and build tools out of the VSIX.
