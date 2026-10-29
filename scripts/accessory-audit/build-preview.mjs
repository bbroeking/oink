import fs from "node:fs";
import path from "node:path";
import { build } from "esbuild";

const root = path.resolve(import.meta.dirname, "../..");
const sourceDir = path.join(root, "scripts/accessory-audit");
const outdir = path.join(root, "artifacts/accessory-attachment-preview");
const assetDir = path.join(outdir, "assets");

fs.mkdirSync(assetDir, { recursive: true });

const fonts = {
	"Caprasimo.ttf": "node_modules/@expo-google-fonts/caprasimo/400Regular/Caprasimo_400Regular.ttf",
	"Fredoka.ttf": "node_modules/@expo-google-fonts/fredoka/600SemiBold/Fredoka_600SemiBold.ttf",
	"Nunito.ttf": "node_modules/@expo-google-fonts/nunito/400Regular/Nunito_400Regular.ttf",
	"PatrickHand.ttf": "node_modules/@expo-google-fonts/patrick-hand/400Regular/PatrickHand_400Regular.ttf",
};
for (const [name, relative] of Object.entries(fonts)) {
	fs.copyFileSync(path.join(root, relative), path.join(assetDir, name));
}

function catalogCategories() {
	const categories = {};
	const catalogs = [
		"supabase/migrations/20260502030000_shop_catalog.sql",
		"supabase/migrations/20260650000000_mud_war_cosmetics.sql",
	];
	const row = /^\s*\('([^']+)',\s*'[^']*',\s*(?:'[^']*'|NULL),\s*\d+,\s*\d+,\s*'([^']+)',/gm;
	for (const relative of catalogs) {
		const source = fs.readFileSync(path.join(root, relative), "utf8");
		for (const match of source.matchAll(row)) categories[match[1]] = match[2];
	}
	const members = JSON.parse(fs.readFileSync(path.join(root, "docs/members-catalog.json"), "utf8"));
	for (const item of members) categories[item.id] = item.category;
	categories.tophat ??= "hat";
	return categories;
}

fs.writeFileSync(
	path.join(sourceDir, "previewCatalog.generated.json"),
	`${JSON.stringify(catalogCategories(), null, "\t")}\n`,
);

function pngDimensions(bytes) {
	if (bytes.toString("ascii", 1, 4) !== "PNG") return {};
	return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

const previewModules = {
	"preview:navigation": `
		import React from "react";
		export const NavigationContext = React.createContext(undefined);
	`,
	"preview:rive-rollout": `
		export const RIVE_PIG_ROLLOUT_KEY = "preview-disabled";
		export const useRivePigRolloutEnabled = () => false;
		export const getRivePigRolloutEnabled = () => false;
		export const loadRivePigRollout = async () => {};
		export const setRivePigRolloutEnabled = async () => {};
		export const recordRivePigRendererFailure = () => {};
	`,
	"preview:rive-asset": `export const RIVE_PIG_SOURCE = undefined;`,
	"preview:rive-renderer": `
		import React from "react";
		export function RivePig() { return React.createElement(React.Fragment); }
	`,
};

const previewPlugin = {
	name: "accessory-preview-runtime",
	setup(builder) {
		builder.onResolve({ filter: /^\.\/assets\/.*\.ttf$/ }, (args) => ({
			path: args.path,
			external: true,
		}));
		builder.onResolve({ filter: /^expo-router\/react-navigation$/ }, () => ({
			path: "preview:navigation",
			namespace: "preview",
		}));
		builder.onResolve({ filter: /(^@\/utils\/rivePigRollout$|\.\/rivePigRollout$)/ }, () => ({
			path: "preview:rive-rollout",
			namespace: "preview",
		}));
		builder.onResolve({ filter: /(^@\/components\/ui\/rivePigAsset$|\.\/rivePigAsset$)/ }, () => ({
			path: "preview:rive-asset",
			namespace: "preview",
		}));
		builder.onResolve({ filter: /(^@\/components\/ui\/RivePig$|\.\/RivePig$)/ }, () => ({
			path: "preview:rive-renderer",
			namespace: "preview",
		}));
		builder.onLoad({ filter: /.*/, namespace: "preview" }, (args) => ({
			contents: previewModules[args.path],
			loader: "tsx",
			resolveDir: root,
		}));
		builder.onLoad({ filter: /\.png$/ }, (args) => {
			const bytes = fs.readFileSync(args.path);
			const relative = path.relative(root, args.path).replaceAll(path.sep, "__");
			const outputName = relative.replace(/[^a-zA-Z0-9_.-]/g, "_");
			fs.copyFileSync(args.path, path.join(assetDir, outputName));
			return {
				contents: `module.exports = ${JSON.stringify({
					uri: `./assets/${outputName}`,
					...pngDimensions(bytes),
				})}`,
				loader: "js",
			};
		});
	},
};

await build({
	absWorkingDir: root,
	entryPoints: [path.join(sourceDir, "preview.tsx")],
	outfile: path.join(outdir, "preview.js"),
	bundle: true,
	platform: "browser",
	format: "iife",
	target: ["es2022"],
	jsx: "automatic",
	define: {
		__DEV__: "true",
		global: "globalThis",
		"process.env.NODE_ENV": '"development"',
	},
	alias: { "react-native": "react-native-web" },
	loader: { ".jpg": "file", ".jpeg": "file", ".riv": "file" },
	assetNames: "assets/[name]-[hash]",
	resolveExtensions: [".web.tsx", ".web.ts", ".tsx", ".ts", ".web.js", ".js", ".json"],
	plugins: [previewPlugin],
	logLevel: "info",
});

fs.writeFileSync(
	path.join(outdir, "index.html"),
	`<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>Accessory attachment audit</title>
	<link rel="stylesheet" href="./preview.css" />
</head>
<body><div id="root"></div><script src="./preview.js"></script></body>
</html>`,
);

console.log(`Built accessory preview at ${outdir}`);
