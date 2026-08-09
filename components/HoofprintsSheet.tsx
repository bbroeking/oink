// Bottom-sheet recap of every blessing + curse currently on the
// caller. Opens from the BarnActiveEffectsStrip chip tap — the
// chip is a glance, this is the read.
//
// Layout mirrors the design's ActiveEffectsSheet (screens/barn.jsx
// in the handoff bundle): kicker + display title, BLESSINGS / CURSES
// sections separated by a per-curse inline Cleanse pill, and a
// hand-script footer about blessings clearing curses.
//
// Animation uses the same decoupled-backdrop+slide pattern as
// UserSheet — backdrop fades 0→1 while the sheet translates from
// off-screen → resting at the bottom, so the dim doesn't drag with
// the card. Data + cleanse live in useActiveEffects.

import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Sticker } from "./ui/Sticker";
import { SnoutCoin } from "./ui/SnoutCoin";
import { RitualIconWell } from "./ui/RitualIconWell";
import { SectionHeader } from "./ui/SectionHeader";
import { EmptyState } from "./ui/EmptyState";
import { SheetGrabber, SlideUpSheet } from "./ui/SlideUpSheet";
import { CleanseModal } from "./CleanseModal";
import { useUnmanagedModalHold } from "./ui/PopupQueue";
import { useActiveEffectsContext } from "../hooks/ActiveEffectsProvider";
import { effectMeta, formatLeft, type Effect } from "../utils/activeEffects";
import {
	FONTS,
	RADII,
	SPACE,
	STICKER_SHADOW,
	TYPE,
	WHIMSY,
} from "@/constants/theme";

interface Props {
	open: boolean;
	onClose: () => void;
}

export function HoofprintsSheet({ open, onClose }: Props) {
	// Shared instance (always enabled) — see ActiveEffectsProvider. `open` still
	// drives the sheet animation below; it no longer gates the data fetch.
	const { blessings, curses, cleanse } = useActiveEffectsContext();
	const [cleanseOpen, setCleanseOpen] = useState(false);

	// This native Modal lives outside the popup queue (it's opened from the
	// active-effects chip, not arbitrated as a slot). Hold the queue while it's
	// open so a foreground poll (schism/finale/achievements re-firing on AppState
	// "active") can't present a queued popup OVER it — the #50152 wedge (issue #4).
	// The hold drains anything already presented and blocks admission; closing
	// lifts it, so queued popups re-admit after the handoff gap.
	useUnmanagedModalHold(open);

	if (!open) return null;

	const total = blessings.length + curses.length;

	return (
		<SlideUpSheet
			open={open}
			onClose={onClose}
			duration={320}
			overlay={
				cleanseOpen ? (
					<CleanseModal
						curses={curses}
						onDismiss={() => setCleanseOpen(false)}
						onConfirm={cleanse}
					/>
				) : null
			}
		>
			<Pressable onPress={() => {}}>
				<Sticker
					color="paper"
					rotate={-0.6}
					radius={RADII.xxl}
					style={[styles.sheet, STICKER_SHADOW]}
				>
					<SheetGrabber />
					<SectionHeader kicker="left by your friends" title="Hoofprints on you" />

					{total === 0 && (
						<EmptyState
							glyph="pigface"
							title="Nothing on your snout right now."
							sub="Blessings and curses left by your friends show up here."
						/>
					)}

					{blessings.length > 0 && (
						<>
							<Text style={[styles.sectionLabel, styles.sectionBless]}>
								BLESSINGS · +{blessings.length}
							</Text>
							<View style={{ gap: 8 }}>
								{blessings.map((e, i) => (
									<EffectCard key={`b-${i}`} effect={e} />
								))}
							</View>
						</>
					)}

					{curses.length > 0 && (
						<>
							<View style={styles.cursesHeaderRow}>
								<Text style={[styles.sectionLabel, styles.sectionCurse]}>
									CURSES · −{curses.length}
								</Text>
								<Pressable
									onPress={() => setCleanseOpen(true)}
									hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
									style={({ pressed }) => [
										styles.cleansePill,
										pressed && { opacity: 0.7 },
									]}
								>
									<SnoutCoin size={13} />
									<Text style={styles.cleansePillText}>
										Cleanse · 5
									</Text>
								</Pressable>
							</View>
							<View style={{ gap: 8 }}>
								{curses.map((e, i) => (
									<EffectCard key={`c-${i}`} effect={e} />
								))}
							</View>
						</>
					)}

					<Text style={styles.footer}>
						★ a blessing received clears all active curses ★
					</Text>
				</Sticker>
			</Pressable>
		</SlideUpSheet>
	);
}

// One detail card. Blessing = lilac tint + paper icon well; curse =
// cream tint + ink icon well. Matches the design's EffectDetail
// shape from screens/barn.jsx.
function EffectCard({ effect }: { effect: Effect }) {
	const { blessed, meta, senderName } = effectMeta(effect);
	return (
		<Sticker
			color={blessed ? "lilac" : "cream"}
			rotate={0}
			radius={12}
			style={styles.card}
		>
			<View style={styles.cardRow}>
				<RitualIconWell icon={meta?.icon} blessed={blessed} size={48} />
				<View style={{ flex: 1, minWidth: 0 }}>
					<Text style={styles.cardName} numberOfLines={1}>
						{meta?.name ?? effect.kind}
					</Text>
					{meta?.blurb && (
						<Text style={styles.cardBlurb} numberOfLines={2}>
							{meta.blurb}
						</Text>
					)}
					<Text style={styles.cardFrom} numberOfLines={1}>
						from <Text style={styles.cardFromBold}>{senderName}</Text> ·{" "}
						{formatLeft(effect.expires_at)} left
					</Text>
				</View>
			</View>
		</Sticker>
	);
}

const styles = StyleSheet.create({
	sheet: {
		padding: 18,
		paddingTop: 10,
	},
	sectionLabel: {
		...TYPE.kickerPill,
		marginBottom: SPACE.sm,
	},
	sectionBless: {
		color: WHIMSY.lilacDeep,
	},
	sectionCurse: {
		color: WHIMSY.accent,
	},
	cursesHeaderRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginTop: SPACE.lg,
		marginBottom: SPACE.sm,
	},
	cleansePill: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.xs + 2,
		backgroundColor: WHIMSY.sun,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.pill,
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.xs + 2,
	},
	cleansePillText: {
		...TYPE.label,
		color: WHIMSY.ink,
	},
	card: {
		padding: SPACE.md,
	},
	cardRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.md,
	},
	cardName: {
		...TYPE.cardTitle,
		color: WHIMSY.ink,
	},
	cardBlurb: {
		...TYPE.bodySm,
		color: WHIMSY.mute,
		marginTop: 2,
	},
	cardFrom: {
		...TYPE.kickerPill,
		letterSpacing: 0.3,
		textTransform: "none",
		color: WHIMSY.mute,
		marginTop: SPACE.xs + 2,
	},
	cardFromBold: {
		color: WHIMSY.ink,
		fontFamily: FONTS.bodyBlack,
	},
	footer: {
		...TYPE.kicker,
		color: WHIMSY.mute,
		textAlign: "center",
		marginTop: SPACE.lg + 2,
	},
});
