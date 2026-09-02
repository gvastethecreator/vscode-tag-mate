import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { _electron as electron } from "playwright";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const executablePath = process.env.VSCODE_EXECUTABLE_PATH;
assert.ok(executablePath, "Set VSCODE_EXECUTABLE_PATH to the tested VS Code executable.");
const profile = path.join(root, ".scratch", "capture-preview-profile");
const extensions = path.join(root, ".scratch", "capture-extensions");
const fixture = path.join(root, ".scratch", "preview-workspace", "index.html");
const raw = path.join(root, ".scratch", "preview-raw.png");
await mkdir(path.dirname(raw), { recursive: true });
await mkdir(path.join(profile, "User"), { recursive: true });
await writeFile(
  path.join(profile, "User", "settings.json"),
  JSON.stringify({
    "breadcrumbs.enabled": false,
    "telemetry.telemetryLevel": "off",
    "window.commandCenter": false,
    "workbench.secondarySideBar.defaultVisibility": "hidden",
    "workbench.startupEditor": "none",
  }),
  "utf8",
);

const application = await electron.launch({
  executablePath,
  args: [
    "--new-window",
    "--skip-welcome",
    "--skip-release-notes",
    "--disable-workspace-trust",
    "--disable-updates",
    "--disable-gpu",
    "--user-data-dir",
    profile,
    "--extensions-dir",
    extensions,
    fixture,
  ],
  timeout: 60_000,
});

try {
  const window = await application.firstWindow({ timeout: 60_000 });
  await application.evaluate(({ BrowserWindow }) => {
    const active = BrowserWindow.getAllWindows()[0];
    active?.setSize(1280, 800);
  });
  await window.waitForSelector(".monaco-workbench", { timeout: 60_000 });
  await window.waitForTimeout(3_000);
  await window.keyboard.press("Control+f");
  await window.keyboard.type("Build with confidence");
  await window.keyboard.press("Enter");
  await window.keyboard.press("Escape");
  await window.keyboard.press("F1");
  await window.waitForSelector(".quick-input-widget", { state: "visible", timeout: 10_000 });
  await window.keyboard.type("Tag Mate");
  await window.waitForFunction(
    () => document.body.innerText.includes("Tag Mate: Wrap Selection with Tag"),
    undefined,
    { timeout: 10_000 },
  );
  await window.screenshot({ path: raw, animations: "disabled" });

  const framedWidth = 1120;
  const framedHeight = 720;
  const screenshot = await sharp(raw)
    .resize(framedWidth, framedHeight, { fit: "cover", position: "centre" })
    .composite([
      {
        input: Buffer.from(`<svg width="${framedWidth}" height="${framedHeight}"><rect width="100%" height="100%" rx="18" fill="white"/></svg>`),
        blend: "dest-in",
      },
    ])
    .png()
    .toBuffer();
  await sharp({ create: { width: 1200, height: 800, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: screenshot, left: 40, top: 40 }])
    .png()
    .toFile(path.join(root, "media", "preview.png"));
  console.log("Captured media/preview.png from the installed Tag Mate VSIX in VS Code.");
} finally {
  await application.close();
}
