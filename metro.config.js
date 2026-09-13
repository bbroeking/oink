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
for (const directory of sourceOnlyDirectories) {
	const absolutePath = path.resolve(__dirname, directory);
	config.resolver.blockList.push(new RegExp(
		`^${absolutePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[/\\\\]`,
	));
}
config.resolver.blockList.push(/\.rev$/);

module.exports = config;
