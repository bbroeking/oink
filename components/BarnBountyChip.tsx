// A quiet home-screen entry point to the weekly bounty board, which lives as a
// SECTION at the top of the Season tab (components/BountyBoard.tsx). The board
// doesn't own a tab, so this chip surfaces "you've got a bounty to claim" on the
// Barn and routes there on tap — so a ready reward isn't stranded behind a tab
// the player has to remember to open.
//
// The count comes from the SAME bounty_ready_count RPC the tab-bar hanging-sign
// badge already polls in app/(tabs)/_layout.tsx. That poll's result lives in
// _layout's local state with no shared context, and Barn is a sibling tab screen
// that can't read it — so rather than lift/rewire the badge (risking it) or add a
// second polling LOOP, this does a single one-shot read on focus (useFocusEffect,
// like useBuriedTruffle / BarnSounderChip's crew read). Cheap PK-count RPC; the
// tab badge's 30s loop stays the only ambient poller.
import { useCallback, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { rpc } from "@/utils/rpc";
import { WHIMSY, FONTS, SPACE, PAGE_PAD, RADII, TYPE } from "@/constants/theme";
import { Sticker } from "./ui/Sticker";
import { Glyph } from "./ui/Glyph";

export function BarnBountyChip() {
	// -1 = not-yet-loaded (never flash a stale chip); 0 = nothing ready (hidden).
	const [ready, setReady] = useState(-1);

	useFocusEffect(
		useCallback(() => {
			let cancelled = false;
			rpc<number>("bounty_ready_count").then((n) => {
				if (!cancelled) setReady(typeof n === "number" ? n : 0);
			});
			return () => {
				cancelled = true;
			};
		}, [])
	);

	// Gate: only when something's actually claimable. Hidden while loading and
	// whenever the count is zero — no empty chip, and it self-clears the instant
	// the player claims (the count drops on their next focus).
	if (ready <= 0) return null;

	const line = ready === 1 ? "a bounty's ready ›" : `${ready} bounties ready ›`;

	return (
		<View style={styles.slot}>
			<Pressable
				onPress={() => {
					Haptics.selectionAsync().catch(() => {});
					router.push("/(tabs)/season");
				}}
				style={({ pressed }) => [pressed && { opacity: 0.92 }]}
				accessibilityRole="button"
				accessibilityLabel="Claim your weekly bounty"
			>
				<Sticker color="sun" rotate={-0.8} radius={RADII.lg} style={styles.chip}>
					<View style={styles.iconWrap}>
						<Glyph name="trophy" size={22} />
					</View>
					<View style={styles.text}>
						<Text style={styles.kicker}>WEEKLY BOARD</Text>
						<Text style={styles.line}>{line}</Text>
					</View>
				</Sticker>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	// In-flow band, matching the stat cluster's gutters + the Sounder chip's slot.
	// No absolute positioning — it rides the flex column above the pig, so it can
	// never cover Rosie or eat her taps (no pointerEvents footgun).
	slot: {
		paddingHorizontal: PAGE_PAD,
		marginBottom: SPACE.sm,
		zIndex: 2,
	},
	chip: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		paddingVertical: SPACE.sm,
		paddingHorizontal: SPACE.md,
	},
	iconWrap: {
		width: 30,
		height: 30,
		alignItems: "center",
		justifyContent: "center",
	},
	text: { flex: 1, minWidth: 0 },
	kicker: {
		...TYPE.kicker,
		color: WHIMSY.accent,
		marginBottom: 1,
	},
	line: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 13,
		color: WHIMSY.ink,
		lineHeight: 17,
	},
});
