import { build } from "esbuild";
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../..");
const docsAssets = join(root, "docs/assets/homegrown-adventures");
mkdirSync(docsAssets, { recursive: true });
mkdirSync(join(root, "docs/assets/rive"), { recursive: true });

for (const name of ["01-starting-barn.png", "02-first-payoff.png", "03-developed-barn.png"]) {
	copyFileSync(join(root, "assets/concepts/homegrown-adventures", name), join(docsAssets, name));
}
copyFileSync(join(root, "assets/rive/prototype/runtime-sample.riv"), join(root, "docs/assets/rive/runtime-sample.riv"));

await build({
	entryPoints: [join(here, "app.web.tsx")],
	bundle: true,
	minify: true,
	sourcemap: false,
	outfile: join(root, "docs/homegrown-adventures.js"),
	platform: "browser",
	format: "iife",
	target: ["safari16", "chrome110"],
	loader: { ".riv": "file" },
	external: ["./assets/*"],
	resolveExtensions: [".web.tsx", ".web.ts", ".tsx", ".ts", ".mjs", ".js"],
	define: { "process.env.NODE_ENV": '"production"' },
});

console.log("Built docs/homegrown-adventures.html assets and bundle.");
