// Visual explainer for the Generous ◄──► Greedy alignment system.
// Pure "how it works" card — no mechanics to configure, alignment is
// an identity (label + schism + leaderboard), so the explainer leans
// almost entirely on the spectrum visual. The closing stakes line is
// season-aware: S0 builds toward Judgement Day titles; S1 has no
// reckoning, so the stakes are the blessing/curse effects themselves.
//
// Tone borrowed wholesale from AlignmentSchismModal: paper Sticker
// card on a dim backdrop, Caprasimo headline, PatrickHand body, the
// three AlignmentEmblem arts (horns / scales / halo).
//
// Wave-4 conformance pass: every string speaks through a text role (C-19), the
// scaffold gains its `DialogCloseRow` exit (C-14), the ▲/▼ move marks are a
// rotated `Icon` rather than semantic dingbats set as text (C-30), and the
// spectrum's radii / borders / spacing come off the token scales (C-17, C-18).
//
// BETA DRAFT — opened from the "how it works" tap on the Account
// screen's alignment story block. Wire-up is intentionally light so
// it's easy to move once the copy + layout are signed off.
import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated } from "react-native";
import * as Haptics from "expo-haptics";
import {
	AdaptiveModalScaffold,
	AlignmentEmblem,
	Button,
	Icon,
	Sticker,
	T,
	useUnmanagedModalHold,
} from "./ui";
import {
	BORDER,
	RADII,
	SPACE,
	STICKER_SHADOW,
	UI_COLORS,
	WHIMSY,
} from "@/constants/theme";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";
import { popIn } from "@/utils/motionRecipes";

interface Props {
	onDismiss: () => void;
	/** Season 1 drops the Judgement Day framing — no reckoning is coming. */
	s1?: boolean;
}

// Drawing geometry: the card's ceiling width, its lean, and the emblem + move
// marks it lays out. Not spacing steps.
const SCAFFOLD_WIDTH = 404;
const CARD_WIDTH = 380;
const TILT_CARD = -1.2;
const EMBLEM_ART = 48;
const MOVE_MARK = 14;
// The tick rail sits under the middle two-thirds of the spectrum, where the
// ±25 breakpoints actually fall.
const TICK_RAIL = "66%";
// `arrowRight` rotated is the app's up / down mark — the 2026-07-13 dingbat
// ruling routes semantic arrows to `Icon`, never to a Text glyph. [C-30]
const ARROW_UP = [{ rotate: "-90deg" }] as const;
const ARROW_DOWN = [{ rotate: "90deg" }] as const;

// The three zones, left → right along the spectrum. range copy mirrors
// the ±25 breakpoints in utils/alignment.ts.
const ZONES = [
	{ emblem: "horns" as const, name: "Greedy", range: "−25 & below", tint: WHIMSY.goblin },
	{ emblem: "scales" as const, name: "Pilgrim", range: "the middle", tint: WHIMSY.cream2 },
	{ emblem: "halo" as const, name: "Generous", range: "+25 & above", tint: WHIMSY.angel },
];

export function AlignmentExplainerModal({ onDismiss, s1 = false }: Props) {
	// Unmanaged native Modal (direct-tap from the season tab, mounted only while
	// open): hold the queue for the component's whole lifetime so a foreground
	// poll can't present a queued popup over it — the #50152 wedge (issue #4).
	useUnmanagedModalHold(true);
	const scale = useRef(new Animated.Value(0)).current;
	const opacity = useRef(new Animated.Value(0)).current;
	const motionPolicy = useMotionPolicy();

	useEffect(() => {
		Haptics.selectionAsync().catch(() => {});
		popIn(scale, opacity, motionPolicy).start();
	}, [scale, opacity, motionPolicy]);

	return (
		<AdaptiveModalScaffold
			visible
			onRequestClose={onDismiss}
			bare
			maxWidth={SCAFFOLD_WIDTH}
			// The exit C-14 found missing in every modal in this area.
			showCloseButton
			closeLabel="Close"
			contentContainerStyle={styles.modalContent}
			testID="alignment-explainer-modal"
		>
			<Animated.View
				style={[styles.cardWrap, { opacity, transform: [{ scale }] }]}
			>
				<Sticker
					color="paper"
					rotate={TILT_CARD}
					radius={RADII.xxl}
					border={BORDER.heavy}
					style={[styles.card, STICKER_SHADOW]}
				>
					<T role="kicker" tone="accent" align="center" style={styles.kicker}>
						★ how alignment works ★
					</T>
					<T
						role="pageTitle"
						align="center"
						accessibilityRole="header"
						style={styles.headline}
					>
						Every pig has a nature
					</T>
					<T role="handLg" tone="secondary" align="center" style={styles.sub}>
						The way you trade shapes who you are.
					</T>

					{/* The centerpiece: the labelled spectrum. */}
					<View style={styles.zonesRow}>
						{ZONES.map((z) => (
							<View key={z.name} style={styles.zoneCol}>
								<AlignmentEmblem kind={z.emblem} size={EMBLEM_ART} />
								<T role="cardTitleSm">{z.name}</T>
								<T role="kickerPillSm" tone="secondary" align="center">
									{z.range}
								</T>
							</View>
						))}
					</View>
					<View
						style={styles.spectrum}
						accessibilityRole="image"
						accessibilityLabel="The alignment spectrum, Greedy on the left through Pilgrim to Generous on the right"
					>
						{ZONES.map((z, i) => (
							<View
								key={z.name}
								style={[
									styles.segment,
									{ backgroundColor: z.tint },
									i === 0 && styles.segmentLeft,
									i === ZONES.length - 1 && styles.segmentRight,
								]}
							/>
						))}
					</View>
					<View style={styles.tickRow}>
						<T role="label" tone="secondary">−25</T>
						<T role="label" tone="secondary">+25</T>
					</View>

					{/* What moves you along it. */}
					<View style={styles.movesBlock}>
						<View style={styles.moveRow}>
							<View style={{ transform: ARROW_UP }}>
								<Icon name="arrowRight" size={MOVE_MARK} color={WHIMSY.angel} />
							</View>
							<T role="handLg" style={styles.moveText}>
								Give freely &amp; bless your friends
							</T>
						</View>
						<View style={styles.moveRow}>
							<View style={{ transform: ARROW_DOWN }}>
								<Icon name="arrowRight" size={MOVE_MARK} color={WHIMSY.goblin} />
							</View>
							<T role="handLg" style={styles.moveText}>
								Ask for tickles &amp; pocket the gains
							</T>
						</View>
					</View>

					<T role="hand" tone="secondary" align="center" style={styles.stakes}>
						{s1
							? "The farther you lean, the stronger your blessings and curses grow. Your nature is yours to feed."
							: "When Judgement Day comes, the most Generous and the most Greedy earn titles no one can claim again."}
					</T>

					<Button
						testID="alignment-explainer-dismiss"
						onPress={onDismiss}
						variant="gold"
						full
						accessibilityLabel="Got it"
						accessibilityHint="Closes the alignment explainer"
					>
						Got it
					</Button>
				</Sticker>
			</Animated.View>
		</AdaptiveModalScaffold>
	);
}

const styles = StyleSheet.create({
	modalContent: {
		flexGrow: 1,
		alignItems: "center",
		justifyContent: "center",
		padding: SPACE.xs,
	},
	cardWrap: { width: "100%", maxWidth: CARD_WIDTH },
	card: {
		paddingHorizontal: SPACE.xl,
		paddingVertical: SPACE.xl,
		alignItems: "center",
	},
	kicker: { marginBottom: SPACE.md },
	headline: { marginBottom: SPACE.xs },
	sub: { marginBottom: SPACE.xl },
	zonesRow: {
		flexDirection: "row",
		width: "100%",
		marginBottom: SPACE.sm,
	},
	zoneCol: { flex: 1, alignItems: "center", gap: SPACE.xxs },
	spectrum: {
		flexDirection: "row",
		width: "100%",
		height: SPACE.lg,
		borderRadius: RADII.pill,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		overflow: "hidden",
	},
	segment: { flex: 1 },
	segmentLeft: {
		borderRightWidth: BORDER.thin,
		borderRightColor: UI_COLORS.border,
	},
	segmentRight: {
		borderLeftWidth: BORDER.thin,
		borderLeftColor: UI_COLORS.border,
	},
	tickRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		width: TICK_RAIL,
		marginTop: SPACE.xs,
		marginBottom: SPACE.xl,
	},
	movesBlock: {
		width: "100%",
		gap: SPACE.sm,
		marginBottom: SPACE.lg,
	},
	moveRow: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
	moveText: {
		flex: 1,
	},
	stakes: { marginBottom: SPACE.xl },
});
