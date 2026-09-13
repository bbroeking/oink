import { build, transform } from "esbuild";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../..");
const jsOutput = join(root, "docs/adventures.js");
const cssOutput = join(root, "docs/adventures.css");
const htmlOutput = join(root, "docs/adventures.html");
const landingOutput = join(root, "landing/adventures");
const landingAssets = join(landingOutput, "assets/homegrown-adventures");

await build({
	entryPoints: [join(here, "app.mjs")],
	outfile: jsOutput,
	bundle: true,
	minify: true,
	sourcemap: false,
	platform: "browser",
	format: "iife",
	target: ["safari16", "chrome110"],
});

const css = await transform(readFileSync(join(here, "styles.css"), "utf8"), {
	loader: "css",
	minify: true,
	target: ["safari16", "chrome110"],
});
writeFileSync(cssOutput, css.code);

const version = (path) => createHash("sha256")
	.update(readFileSync(path))
	.digest("hex")
	.slice(0, 10);

const html = readFileSync(join(here, "shell.html"), "utf8")
	.replace("./adventures.css", `./adventures.css?v=${version(cssOutput)}`)
	.replace("./adventures.js", `./adventures.js?v=${version(jsOutput)}`);
writeFileSync(htmlOutput, html);

mkdirSync(landingAssets, { recursive: true });
const landingHtml = html.replace("<head>", '<head>\n\t<base href="/adventures/" />');
writeFileSync(join(landingOutput, "index.html"), landingHtml);
copyFileSync(jsOutput, join(landingOutput, "adventures.js"));
copyFileSync(cssOutput, join(landingOutput, "adventures.css"));
copyFileSync(join(root, "docs/rosie.png"), join(landingOutput, "rosie.png"));

for (const name of [
	"adventure-clearing-lantern.webp",
	"adventure-clearing-discovery.webp",
	"return-homecoming-discovery.webp",
	"open-adventure-bag.webp",
]) {
	copyFileSync(
		join(root, "docs/assets/homegrown-adventures", name),
		join(landingAssets, name),
	);
}

console.log("Built the standalone Beyond the Hedge Adventure click-through for GitHub Pages and ticklethepig.com.");
