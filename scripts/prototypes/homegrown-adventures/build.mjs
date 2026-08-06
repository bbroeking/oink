import { build } from "esbuild";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../..");
const docsAssets = join(root, "docs/assets/homegrown-adventures");
mkdirSync(docsAssets, { recursive: true });
mkdirSync(join(root, "docs/assets/rive"), { recursive: true });

for (const name of [
	"01-starting-barn.png",
	"01-starting-barn-clean-scene-plate.png",
	"01-starting-barn-growing-clover-scene-plate.png",
	"01-starting-barn-ready-clover-scene-plate.png",
	"01-starting-barn-scene-plate.png",
	"patch-empty.webp",
	"patch-growing.webp",
	"patch-ready.webp",
	"02-first-payoff.png",
	"02-first-payoff-scene-plate.png",
	"03-developed-barn.png",
	"03-developed-barn-scene-plate.png",
]) {
	copyFileSync(join(root, "assets/concepts/homegrown-adventures", name), join(docsAssets, name));
}
const authoredRiveSource = join(
	root,
	"assets/rive/homegrown-adventures/homegrown-adventures.riv",
);
const authoredRiveOutput = join(root, "docs/assets/rive/homegrown-adventures.riv");
const authoredRivePresent = existsSync(authoredRiveSource);
const authoredRiveVersion = authoredRivePresent
	? createHash("sha256").update(readFileSync(authoredRiveSource)).digest("hex").slice(0, 10)
	: null;
const riveAssetUrl = authoredRivePresent
	? `./assets/rive/homegrown-adventures.riv?v=${authoredRiveVersion}`
	: "./assets/rive/runtime-sample.riv";

if (authoredRivePresent) {
	copyFileSync(authoredRiveSource, authoredRiveOutput);
} else {
	rmSync(authoredRiveOutput, { force: true });
	copyFileSync(
		join(root, "assets/rive/prototype/runtime-sample.riv"),
		join(root, "docs/assets/rive/runtime-sample.riv"),
	);
}

const bundleOutput = join(root, "docs/homegrown-adventures.js");
const animationBundleOutput = join(root, "docs/homegrown-animation-lab.js");

const commonBuild = {
	bundle: true,
	minify: true,
	sourcemap: false,
	platform: "browser",
	format: "iife",
	target: ["safari16", "chrome110"],
	loader: { ".riv": "file" },
	external: ["./assets/*"],
	resolveExtensions: [".web.tsx", ".web.ts", ".tsx", ".ts", ".mjs", ".js"],
	define: {
		"process.env.NODE_ENV": '"production"',
		__HOMEGROWN_RIVE_ASSET_URL__: JSON.stringify(riveAssetUrl),
		__HOMEGROWN_RIVE_AUTHORED__: JSON.stringify(authoredRivePresent),
	},
};

await build({
	...commonBuild,
	entryPoints: [join(here, "app.web.tsx")],
	outfile: bundleOutput,
});

await build({
	...commonBuild,
	entryPoints: [join(here, "animation-lab.web.tsx")],
	outfile: animationBundleOutput,
});

const bundleVersion = createHash("sha256")
	.update(readFileSync(bundleOutput))
	.digest("hex")
	.slice(0, 10);
const htmlPath = join(root, "docs/homegrown-adventures.html");
const html = readFileSync(htmlPath, "utf8").replace(
	/\.\/homegrown-adventures\.js(?:\?v=[a-f0-9]+)?/,
	`./homegrown-adventures.js?v=${bundleVersion}`,
);
writeFileSync(htmlPath, html);

const animationBundleVersion = createHash("sha256")
	.update(readFileSync(animationBundleOutput))
	.digest("hex")
	.slice(0, 10);
const animationHtmlPath = join(root, "docs/homegrown-animation-lab.html");
const animationHtml = readFileSync(animationHtmlPath, "utf8").replace(
	/\.\/homegrown-animation-lab\.js(?:\?v=[a-f0-9]+)?/,
	`./homegrown-animation-lab.js?v=${animationBundleVersion}`,
);
writeFileSync(animationHtmlPath, animationHtml);

console.log(
	`Built Homegrown Adventures player and animation labs with ${
		authoredRivePresent ? "authored Homegrown Adventures scene" : "official Rive runtime probe"
	}.`,
);
