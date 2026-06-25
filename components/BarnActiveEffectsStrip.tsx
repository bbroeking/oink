// Active-effect chips that sit on the Barn screen, just below the
// stat tickets — gives the player at-a-glance awareness of what
// blessings/curses are currently on them, with sender attribution.
//
// Tapping a chip opens the HoofprintsSheet (the full read). Renders
// nothing when no effects are active so it doesn't clutter a clean
// Barn. The fetch + realtime live in useActiveEffects.

import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { HoofprintsSheet } from "./HoofprintsSheet";
import { RitualIconWell } from "./ui/RitualIconWell";
import { useActiveEffectsContext } from "../hooks/ActiveEffectsProvider";
import { effectMeta } from "../utils/activeEffects";
import { FONTS, WHIMSY, SPACE, PAGE_PAD, RADII, SHADOW_SM } from "@/constants/theme";

export function BarnActiveEffectsStrip() {
	const { effects, formatLeft } = useActiveEffectsContext();
	// Tap a chip → open the full Hoofprints recap sheet so the
	// player can read the actual effect (e.g. "1-in-3 taps slip")
	// instead of just the kind name.
	const [sheetOpen, setSheetOpen] = useState(false);

	if (effects.length === 0) return null;

	return (
		<>
		<View style={styles.strip}>
			{effects.slice(0, 2).map((e, i) => {
				const { blessed, meta, senderName, initial } = effectMeta(e);
				return (
					<Pressable
						key={`${e.source}-${e.kind}-${i}`}
						onPress={() => setSheetOpen(true)}
						style={[
							styles.chip,
							blessed ? styles.chipBless : styles.chipCurse,
							{ transform: [{ rotate: i % 2 === 0 ? "-0.8deg" : "0.8deg" }] },
						]}
					>
						<RitualIconWell
							icon={meta?.icon}
							blessed={blessed}
							size={36}
						/>
						<View style={{ flex: 1, minWidth: 0 }}>
							<Text style={styles.name} numberOfLines={1}>
								{meta?.name ?? e.kind}
							</Text>
							{meta?.blurb && (
								<Text style={styles.blurb} numberOfLines={2}>
									{meta.blurb}
								</Text>
							)}
							<View style={styles.metaRow}>
								<View
									style={[
										styles.senderDot,
										blessed
											? styles.senderDotBless
											: styles.senderDotCurse,
									]}
								>
									<Text style={styles.senderInitial}>{initial}</Text>
								</View>
								<Text style={styles.meta} numberOfLines={1}>
									{senderName} · {formatLeft(e.expires_at)}
								</Text>
							</View>
						</View>
					</Pressable>
				);
			})}
		</View>
		<HoofprintsSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
		</>
	);
}

const styles = StyleSheet.create({
	strip: {
		flexDirection: "row",
		gap: SPACE.md,
		// Match the statsRow edge so the band lines up left/right (PAGE_PAD).
		paddingHorizontal: PAGE_PAD,
		// Top gap is owned by statsRow.marginBottom so the band spacing holds
		// whether or not this (conditional) strip renders.
		marginTop: 0,
	},
	chip: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
		paddingHorizontal: SPACE.sm,
		paddingVertical: SPACE.sm,
		borderRadius: RADII.md,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		...SHADOW_SM,
	},
	chipBless: { backgroundColor: WHIMSY.lilac },
	chipCurse: { backgroundColor: WHIMSY.cream },
	name: {
		fontFamily: FONTS.whimsy,
		fontSize: 13,
		color: WHIMSY.ink,
		lineHeight: 14,
	},
	blurb: {
		fontFamily: FONTS.hand,
		fontSize: 11,
		color: WHIMSY.ink,
		lineHeight: 13,
		marginTop: 1,
	},
	metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
	senderDot: {
		width: 16,
		height: 16,
		borderRadius: 8,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
	},
	senderDotBless: { backgroundColor: WHIMSY.rose },
	senderDotCurse: { backgroundColor: WHIMSY.sage },
	senderInitial: {
		fontFamily: FONTS.whimsy,
		fontSize: 9,
		color: WHIMSY.ink,
	},
	meta: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 10,
		color: WHIMSY.ink,
		flex: 1,
	},
});
