// One drawing per Satchel find — the painted mark a find wears in the bag
// strip, the wish bubble, the catalog grid and the tally's line. Never an
// emoji. `silhouette` is the same mark ink-tinted at ghost opacity: what the
// catalog shows of a find the player has never carried (the Field Guide's
// rule — a thing is a mystery until you meet it).
import { StyleSheet } from "react-native";
import type { SatchelFindId } from "@/constants/satchel";
import { ART_SIZE, OPACITY, WHIMSY } from "@/constants/theme";
import { Glyph, type GlyphName } from "../ui";

const ART: Readonly<Record<SatchelFindId, GlyphName>> = {
	river_pebble: "findRiverPebble",
	blue_feather: "findBlueFeather",
	clover: "findClover",
	snail_shell: "findSnailShell",
	brass_button: "findBrassButton",
	wool_tuft: "findWoolTuft",
	red_berries: "findRedBerries",
	pinecone: "findPinecone",
	old_key: "findOldKey",
	honeycomb: "findHoneycomb",
	marble: "findMarble",
	tin_whistle: "findTinWhistle",
};

/** The glyph a find draws. */
export function findArtGlyph(id: SatchelFindId): GlyphName {
	return ART[id];
}

export function FindArt({
	id,
	size = ART_SIZE.glyphSm,
	silhouette = false,
}: {
	id: SatchelFindId;
	size?: number;
	silhouette?: boolean;
}) {
	return (
		<Glyph
			name={ART[id]}
			size={size}
			style={silhouette ? [styles.silhouette, { tintColor: WHIMSY.ink }] : undefined}
		/>
	);
}

const styles = StyleSheet.create({
	silhouette: { opacity: OPACITY.ghost },
});
