// Slop Club member perks for the Barn — CLIENT-ONLY PROTOTYPE.
//
// Two member-only affordances, both gated on is_vip by the caller (Barn):
//   1. BarnLoungeChip     — a toggle that swaps the Barn scene to the
//      members-only "slop_club_lounge_bg" background. Controlled; Barn
//      owns the scene state + AsyncStorage persistence + the actual bg
//      swap (PageBackground reads the effective bgId).
//   2. BarnMemberReactions — a small row of cozy member "reactions".
//      Tapping one plays a floating sticker burst over the scene (local
//      only — the real version would send it to a friend's Barn).
//
// Both ride the Barn's in-flow chip column (no absolute chrome that could
// cover Rosie); the reactions burst overlay is pointerEvents="none" so it
// never eats a tap (the documented Fabric overlay footgun). Reactions are
// tasteful existing Glyphs standing in for real member emote art.
import React, { useCallback, useRef, useState } from "react";
import { View, Text, Pressable, Animated, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { router, type Href } from "expo-router";
import { Glyph, glyphSource, type GlyphName } from "./ui/Glyph";
import {
	WHIMSY,
	FONTS,
	SPACE,
	PAGE_PAD,
	SHADOW_SM,
	RADII,
	TYPE,
} from "@/constants/theme";

// ── BarnLoungeChip ─────────────────────────────────────────────
// Entry to the walkable lounge (app/lounge.tsx). Members only — Barn
// renders it only when is_vip. Gold Slop Club identity (slopGold/slopBand).
// (Was a scene-swap toggle in the v0 prototype; the lounge is a PLACE now —
// docs/lounge-farm-spec.md. Props kept optional so the Barn call site can
// shed the old toggle wiring on its own schedule.)
export function BarnLoungeChip(_props: {
	active?: boolean;
	onToggle?: () => void;
}) {
	return (
		<View style={styles.slot}>
			<Pressable
				onPress={() => {
					Haptics.selectionAsync().catch(() => {});
					// Cast: typed routes regenerate on the next dev-server connect;
					// the route file (app/lounge.tsx) exists.
					router.push("/lounge" as Href);
				}}
				style={({ pressed }) => [
					styles.loungeChip,
					pressed && { opacity: 0.92 },
				]}
				accessibilityRole="button"
				accessibilityLabel="Members' Lounge"
			>
				<View style={styles.loungeGlyph}>
					<Glyph name="premium" size={20} />
				</View>
				<View style={styles.loungeText}>
					<Text style={styles.loungeKicker}>SLOP CLUB</Text>
					<Text style={styles.loungeLine}>
						step into the members&apos; lounge ›
					</Text>
				</View>
			</Pressable>
		</View>
	);
}

// ── BarnMemberReactions ────────────────────────────────────────
// A member-only reaction row. Tapping a reaction spawns a floating
// sticker burst over the scene. Members only — Barn renders it only
// when is_vip. Stand-in emotes: cozy existing Glyphs (real member
// emote art would replace these). The burst reuses the Barn's
// HeartFloats motion vocabulary (rise + fade + gentle pop).
const REACTIONS: { glyph: GlyphName; label: string }[] = [
	{ glyph: "coffee", label: "Cozy" },
	{ glyph: "heart", label: "Love" },
	{ glyph: "sparkles", label: "Shine" },
];

type Burst = {
	id: number;
	glyph: GlyphName;
	dx: number;
	rise: number;
	rot: number;
	scaleMax: number;
	duration: number;
	anim: Animated.Value;
};

export function BarnMemberReactions() {
	const [bursts, setBursts] = useState<Burst[]>([]);
	const nextId = useRef(0);

	const play = useCallback((glyph: GlyphName) => {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
		// One big lead sticker + a couple of trailing sparkle-scale copies,
		// staggered so the reaction reads as a little burst, not one blip.
		const count = 3;
		for (let i = 0; i < count; i++) {
			const stagger = i === 0 ? 0 : 60 + Math.floor(Math.random() * 90);
			setTimeout(() => {
				const id = nextId.current++;
				const lead = i === 0;
				const dx = lead ? Math.random() * 40 - 20 : Math.random() * 150 - 75;
				const rise = -(140 + Math.random() * 70);
				const rot = Math.random() * 36 - 18;
				const scaleMax = lead ? 1.15 + Math.random() * 0.25 : 0.6 + Math.random() * 0.3;
				const duration = 1100 + Math.floor(Math.random() * 400);
				const anim = new Animated.Value(0);
				setBursts((b) => [
					...b,
					{ id, glyph, dx, rise, rot, scaleMax, duration, anim },
				]);
				Animated.timing(anim, {
					toValue: 1,
					duration,
					useNativeDriver: true,
				}).start(() => {
					setBursts((b) => b.filter((x) => x.id !== id));
				});
			}, stagger);
		}
	}, []);

	return (
		<>
			<View style={styles.reactSlot}>
				{REACTIONS.map((r) => (
					<Pressable
						key={r.glyph}
						onPress={() => play(r.glyph)}
						style={({ pressed }) => [
							styles.reactBtn,
							pressed && { opacity: 0.85, transform: [{ scale: 0.94 }] },
						]}
						accessibilityRole="button"
						accessibilityLabel={`Send ${r.label} reaction`}
					>
						<Glyph name={r.glyph} size={22} />
					</Pressable>
				))}
			</View>

			{/* Burst overlay — fills the scene, never intercepts touches. */}
			<View pointerEvents="none" style={styles.burstLayer}>
				{bursts.map((f) => {
					const translateY = f.anim.interpolate({
						inputRange: [0, 0.16, 1],
						outputRange: [0, -14, f.rise],
					});
					const opacity = f.anim.interpolate({
						inputRange: [0, 0.16, 0.8, 1],
						outputRange: [0, 1, 1, 0],
					});
					const scale = f.anim.interpolate({
						inputRange: [0, 0.16, 1],
						outputRange: [0.4, f.scaleMax, f.scaleMax * 0.92],
					});
					return (
						<Animated.Image
							key={f.id}
							source={glyphSource(f.glyph)}
							resizeMode="contain"
							style={[
								styles.burstImage,
								{
									transform: [
										{ translateX: f.dx },
										{ translateY },
										{ rotate: `${f.rot}deg` },
										{ scale },
									],
									opacity,
								},
							]}
						/>
					);
				})}
			</View>
		</>
	);
}

const styles = StyleSheet.create({
	// ── Lounge chip ──
	// In-flow band matching the other Barn chips' gutters. No absolute
	// positioning — rides the flex column above the pig, so it can never
	// cover Rosie or eat her taps.
	slot: {
		paddingHorizontal: PAGE_PAD,
		marginBottom: SPACE.sm,
		zIndex: 2,
	},
	loungeChip: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		backgroundColor: WHIMSY.cream,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.lg,
		paddingVertical: SPACE.sm,
		paddingLeft: SPACE.sm,
		paddingRight: SPACE.md,
		transform: [{ rotate: "-0.8deg" }],
		...SHADOW_SM,
	},
	// Active = you're in the lounge: soft Slop Club gold band tint.
	loungeChipOn: {
		backgroundColor: WHIMSY.slopBand,
	},
	loungeGlyph: {
		width: 34,
		height: 34,
		borderRadius: RADII.pill,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.slopGold,
		alignItems: "center",
		justifyContent: "center",
	},
	loungeText: { flex: 1, minWidth: 0 },
	loungeKicker: {
		...TYPE.kicker,
		fontSize: 11,
		letterSpacing: 1.4,
		color: WHIMSY.ink,
		marginBottom: 1,
	},
	loungeLine: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 13,
		color: WHIMSY.mute,
		lineHeight: 17,
	},
	loungeCheck: {
		width: 22,
		height: 22,
		borderRadius: RADII.pill,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.slopGold,
		alignItems: "center",
		justifyContent: "center",
	},
	// ── Reactions row ──
	reactSlot: {
		flexDirection: "row",
		alignSelf: "center",
		gap: SPACE.md,
		marginBottom: SPACE.sm,
		zIndex: 2,
	},
	reactBtn: {
		width: 44,
		height: 44,
		borderRadius: RADII.pill,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.paper,
		alignItems: "center",
		justifyContent: "center",
		...SHADOW_SM,
	},
	// Full-scene burst layer. pointerEvents="none" (Fabric footgun) — it
	// covers the pig but never steals a tap.
	burstLayer: {
		...StyleSheet.absoluteFillObject,
		zIndex: 5,
	},
	// Stickers rise from just above the pig, same screen anchor family as
	// the Barn's HeartFloats.
	burstImage: {
		position: "absolute",
		left: "50%",
		bottom: "42%",
		width: 60,
		height: 60,
		marginLeft: -30,
	},
});
