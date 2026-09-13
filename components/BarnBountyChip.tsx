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
// like useBuriedTruffle / useDigEntry's crew read). Cheap PK-count RPC; the
// tab badge's 30s loop stays the only ambient poller.
import { useCallback, useState } from "react";
import { View, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router/react-navigation";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { rpc } from "@/utils/rpc";
import { AVATAR_SIZE, SPACE, PAGE_PAD, TILT } from "@/constants/theme";
import { BodySm, Glyph, Kicker, Sticker } from "./ui";

// The trophy's slot — the portrait-mark frame (`AVATAR_SIZE`'s smallest step),
// so the two copy lines start on the same vertical rule as every other
// mark-plus-copy row in the Barn band.
const MARK_SLOT = AVATAR_SIZE[0];
const MARK_SIZE = 22;

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
			{/* The Sticker owns the press: the shadow-collapse shove, the
			    accessibility forwarding, and the 2px ink outline — so the chip
			    can't grow its own pressed opacity. */}
			<Sticker
				color="sun"
				rotate={TILT.dialog}
				shadow="sm"
				onPress={() => {
					Haptics.selectionAsync().catch(() => {});
					router.push("/(tabs)/season");
				}}
				accessibilityRole="button"
				accessibilityLabel="Claim your weekly bounty"
				accessibilityHint="Opens the weekly bounty board on the Season tab"
				style={styles.chip}
			>
				<View style={styles.iconWrap}>
					<Glyph name="trophy" size={MARK_SIZE} />
				</View>
				<View style={styles.text}>
					<Kicker star={false}>WEEKLY BOARD</Kicker>
					<BodySm>{line}</BodySm>
				</View>
			</Sticker>
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
		gap: SPACE.md,
		paddingVertical: SPACE.sm,
		paddingHorizontal: SPACE.md,
	},
	iconWrap: {
		width: MARK_SLOT,
		height: MARK_SLOT,
		alignItems: "center",
		justifyContent: "center",
	},
	text: { flex: 1, minWidth: 0 },
});
