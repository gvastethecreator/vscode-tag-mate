const esbuild = require("esbuild");

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

/** @type {import('esbuild').Plugin} */
const esbuildProblemMatcherPlugin = {
  name: "esbuild-problem-matcher",
  setup(build) {
    build.onStart(() => {
      console.log("[watch] build started");
    });
    build.onEnd((result) => {
      for (const { text, location } of result.errors) {
        console.error(`✘ [ERROR] ${text}`);
        if (location) {
          console.error(`  ${location.file}:${location.line}:${location.column}:`);
        }
      }
      console.log("[watch] build finished");
    });
  },
};

async function main() {
  const contexts = await Promise.all(
    [
      { platform: "browser", outfile: "dist/node/extension.cjs" },
      { platform: "browser", outfile: "dist/web/extension.cjs" },
    ].map(({ platform, outfile }) =>
      esbuild.context({
        entryPoints: ["src/extension.ts"],
        bundle: true,
        format: "cjs",
        minify: production,
        sourcemap: !production,
        sourcesContent: false,
        platform,
        mainFields: ["module", "main"],
        outfile,
        external: ["vscode"],
        alias: {
          "vscode-html-languageservice/lib/umd/htmlLanguageTypes.js":
            "vscode-html-languageservice/lib/esm/htmlLanguageTypes.js",
          "vscode-html-languageservice/lib/umd/parser/htmlScanner.js":
            "vscode-html-languageservice/lib/esm/parser/htmlScanner.js",
        },
        logLevel: "silent",
        plugins: [esbuildProblemMatcherPlugin],
      }),
    ),
  );

  if (watch) {
    await Promise.all(contexts.map((ctx) => ctx.watch()));
    return;
  }

  await Promise.all(contexts.map((ctx) => ctx.rebuild()));
  await Promise.all(contexts.map((ctx) => ctx.dispose()));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
