<div align="center">
  <a href="https://github.com/gvastethecreator/vscode-tag-mate"><img src="media/icon.png" alt="Tag Mate" width="128" /></a>

# Tag Mate

**Change, match, wrap, and remove paired markup tags**

<p align="center">
  <a href="https://github.com/gvastethecreator/vscode-tag-mate"><img alt="GitHub" src="https://shieldcn.dev/badge/github.png?variant=outline&size=xs&theme=blue&logo=github" /></a>
  <a href="LICENSE"><img alt="MIT license" src="https://shieldcn.dev/github/license/gvastethecreator/vscode-tag-mate.png?variant=outline&size=xs" /></a>
  <a href="https://github.com/gvastethecreator/vscode-tag-mate/actions/workflows/ci.yml"><img alt="CI status" src="https://shieldcn.dev/github/ci/gvastethecreator/vscode-tag-mate.png?workflow=ci.yml&branch=main&variant=outline&size=xs" /></a>
</p>
</div>

---

### Use

Open an HTML file. Run a Tag Mate command from the Command Palette. **Change Tag** is also available from the editor context menu.

- **Change Tag** updates opening and closing names together.
- **Go to Matching Tag** jumps between concrete opening and closing tags.
- **Select Tag Pair** selects the complete element or one void/self-closing tag.
- **Remove Surrounding Tag** removes only a concrete wrapper pair.
- **Wrap Selection with Tag** wraps one or more non-overlapping selections.

<img src="media/preview.png" alt="Preview" width="100%" />

Tag Mate 0.1 supports HTML. It understands nested same-name elements, quoted angle brackets, comments, raw script/style text, multiline tags, custom elements, void elements, mixed case, and optional end tags. Unsafe, malformed, overlapping, or larger-than-2-MiB operations stop without editing. It adds no webview, telemetry, workspace scan, default keybinding, or automatic rename/close behavior.

### Development

Requires pnpm 12. `pnpm install`, then `pnpm run quality`. Press F5 to run the extension. See [development notes](docs/development.md).

---

<p align="center">
  <a href="https://github.com/gvastethecreator/vscode-tag-mate/stargazers"><img alt="GitHub stars" src="https://shieldcn.dev/github/stars/gvastethecreator/vscode-tag-mate.png?variant=outline&size=xs" /></a>
  <a href="https://github.com/gvastethecreator"><picture><source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/badge/follow%20me-/gvastethecreator.png?size=xs&amp;logo=github&amp;brand=github&amp;mode=dark"><img alt="Follow gvastethecreator" src="https://shieldcn.dev/badge/follow%20me-/gvastethecreator.png?size=xs&amp;logo=github&amp;brand=github&amp;mode=light"></picture></a>
  <a href="https://github.com/sponsors/gvastethecreator"><picture><source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/badge/support%20this-project.png?size=xs&amp;logo=ri%3APiHeartFill&amp;logoColor=b85a90&amp;brand=github&amp;mode=dark"><img alt="Support this project" src="https://shieldcn.dev/badge/support%20this-project.png?size=xs&amp;logo=ri%3APiHeartFill&amp;logoColor=b85a90&amp;brand=github&amp;mode=light"></picture></a>
</p>
