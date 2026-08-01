// Trims what Metro crawls/hashes at startup — a direct fix for the dev-server
// JS-heap OOMs. Metro builds an in-memory map of every asset (~93 MB / 417
// PNGs); ~19 MB of that was the unused assets/images/hats/_mudwar_raw/ source
// sheets, which the app never requires. Keep them out of Metro's file map.
const { getDefaultConfig } = require("expo/metro-config");

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

module.exports = config;
