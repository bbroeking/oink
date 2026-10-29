// Authoring sources and build evidence are not runtime dependencies. Keep
// their large images, revisions, and recordings out of Metro's file map.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const config = getDefaultConfig(__dirname);

if (!config.resolver.assetExts.includes("riv")) {
	config.resolver.assetExts.push("riv");
}

const prior = config.resolver.blockList;
config.resolver.blockList = [
	...(Array.isArray(prior) ? prior : prior ? [prior] : []),
	// Raw intermediate art — never imported by the app.
	/assets[/\\]images[/\\]hats[/\\]_mudwar_raw[/\\].*/,
];

const sourceOnlyDirectories = [
	"artifacts", "docs", "assets/concepts", "assets/marketing",
	"assets/rive/backups",
];
// Runtime data that still lives with its design source. The Halloween 2026
// content.json is the single source for the card catalog and its art script,
// and features/cards/data imports it; blocking it fails the iOS bundle.
const runtimeExceptions = {
	docs: ["design/halloween-2026/content.json"],
};
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
for (const directory of sourceOnlyDirectories) {
	const absolutePath = path.resolve(__dirname, directory);
	// The crawler tests directories too, so each exception's parent folders
	// must pass (only the folders themselves, not their other files).
	const allowed = (runtimeExceptions[directory] ?? [])
		.flatMap((file) => file.split("/").map((_, i, parts) => parts.slice(0, i + 1).join("/")))
		.map((entry) => `(?!${escapeRegExp(entry)}$)`)
		.join("");
	config.resolver.blockList.push(new RegExp(
		`^${escapeRegExp(absolutePath)}[/\\\\]${allowed}`,
	));
}
config.resolver.blockList.push(/\.rev$/);

module.exports = config;
