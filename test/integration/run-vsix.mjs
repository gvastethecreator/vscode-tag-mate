import { spawnSync } from "node:child_process";
import { access, cp, mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runTests } from "@vscode/test-electron";
import { downloadVSCode } from "./download-vscode.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const requested = process.env.VSIX_PATH;
const vsix = requested ? path.resolve(root, requested) : path.join(root, (await readdir(root)).find((name) => /^tag-mate(?:-.*)?\.vsix$/.test(name)) || "");
if (!vsix.endsWith(".vsix")) throw new Error("Build the Tag Mate VSIX before the packaged smoke test.");

const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "tag-mate-vsix-"));
const workspace = path.join(temporaryRoot, "workspace");
await cp(path.join(root, "test-workspace"), workspace, { recursive: true });
const dataDirectory = path.join(temporaryRoot, "data");
const extensionsDirectory = path.join(temporaryRoot, "ext");
const vscodeExecutablePath = await downloadVSCode(process.env.VSCODE_TEST_VERSION || "stable");
const cliScript = await findCliScript(vscodeExecutablePath);
const cliEnvironment = { ...process.env, ELECTRON_RUN_AS_NODE: "1" };
delete cliEnvironment.VSCODE_DEV;
const install = spawnSync(vscodeExecutablePath, [cliScript, "--install-extension", vsix, "--force", "--extensions-dir", extensionsDirectory, "--user-data-dir", dataDirectory], { encoding: "utf8", env: cliEnvironment, stdio: "inherit" });
if (install.status !== 0) throw new Error("VSIX installation failed.");
const launchArgs = [workspace, "--skip-welcome", "--skip-release-notes", "--user-data-dir", dataDirectory, "--extensions-dir", extensionsDirectory];
if (process.platform === "linux") {
  launchArgs.push("--disable-gpu");
  if (process.env.CI) launchArgs.push("--no-sandbox");
}

try {
  await runTests({ extensionDevelopmentPath: path.join(root, "test", "runner"), extensionTestsPath: path.join(root, "test", "integration", "suite", "index.cjs"), launchArgs, reuseMachineInstall: true, vscodeExecutablePath });
} finally {
  if (temporaryRoot.startsWith(os.tmpdir() + path.sep)) await rm(temporaryRoot, { force: true, maxRetries: 10, recursive: true, retryDelay: 200 });
}

async function findCliScript(executablePath) {
  const installationRoot = path.dirname(executablePath);
  const direct = path.join(installationRoot, "resources", "app", "out", "cli.js");
  try { await access(direct); return direct; } catch {}
  for (const entry of await readdir(installationRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const candidate = path.join(installationRoot, entry.name, "resources", "app", "out", "cli.js");
    try { await access(candidate); return candidate; } catch {}
  }
  throw new Error("Could not locate VS Code's CLI entry point.");
}
