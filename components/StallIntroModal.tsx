// The Pop-up Stall's one-time intro (Halloween onboarding canvas, direction A,
// boards Main · A2_Costumes · A3_Where, 2026-10-29). Three cards in the intro
// card chrome (AdaptiveModalScaffold `card`, the GreatHungerIntro frame): the
// stall, full costumes, where to look, ending on "Step in", which lands on the
// stall's New tab (A4). The costume card only draws when the stall sells a
// costume this binary can draw; every name and count reads from the shelf
// payload (utils/stallIntro.ts), so the winter set is a new row, not new code.
//
// The Shop tab owns the trigger (hooks/useStallOnboarding.ts): one PopupQueue
// slot, the seen-key written on present. Skip, Later, the hardware back and
// Step in all end it for good. Heroes are static sprites and the shop's own
// stall card, never an animated stage.

import { useCallback, useMemo, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import {
	AdaptiveModalScaffold,
	Button,
	Glyph,
	Kicker,
	PageDots,
	PageTitle,
	T,
	type GlyphName,
} from "./ui";
import { StallCard } from "./shop/StallCard";
import { COSTUME_FRAMES } from "@/constants/costumeFrames.generated";
import { HAT_IMAGES } from "@/constants/hats";
import { PIG_FRAMES } from "@/constants/pigFrames.generated";
import {
	ART_SIZE,
	BORDER,
	CHROME_TYPE_CAP,
	RADII,
	SHADOW_SM,
	SPACE,
	UI_COLORS,
	WHIMSY,
} from "@/constants/theme";
import type { SeasonalShelf, ShelfItem } from "@/utils/seasonalShelf";
import { stallIntroCards, type StallIntroCard, type StallIntroDoor } from "@/utils/stallIntro";
import type { StallIntroAction } from "@/hooks/useStallOnboarding";

// ── Drawing constants ───────────────────────────────────────────────────────
/** The cards' picture well (the boards' `.shot`). */
const SHOT_H = 210;
/** The stall card drawn inside card 1, a touch under full size. */
const SHOT_CARD_SCALE = 0.92;
/** Rosie and Rosie-in-costume on card 2. */
const COSTUME_PIG_H = 150;
/** Both skins share Rosie's 370x383 canvas. */
const PIG_ASPECT = 370 / 383;
/** The "›" between them sits up at her middle, not her feet. */
const ARROW_LIFT = 60;
/** The backdrop behind the costume pair (A2's porch). */
const COSTUME_BACKDROP = "lantern_porch_bg";

const ROSIE = PIG_FRAMES.rosie.idle_1;

const DOOR_GLYPH: Record<StallIntroDoor["id"], GlyphName> = {
	shop: "signStore",
	closet: "signCloset",
	dailyDrop: "gift",
};

export function StallIntroModal({
	visible,
	shelf,
	items,
	now,
	onDone,
}: {
	visible: boolean;
	shelf: SeasonalShelf | null;
	/** The pieces this binary can draw (useSeasonalShelf().items). */
	items: readonly ShelfItem[];
	now: number;
	/** "step_in" from the last card's CTA, "skip" from Skip / Later / back. */
	onDone: (action: StallIntroAction) => void;
}) {
	const open = visible && !!shelf;
	return (
		<AdaptiveModalScaffold
			visible={open}
			onRequestClose={() => onDone("skip")}
			maxWidth={400}
			// Painted only while up: the content unmounts with `visible` (so the
			// pager restarts on card 1), and a painted frame would fade out empty.
			bare
			card={open}
			showCloseButton={false}
			testID="stall-intro-modal"
		>
			{open && shelf ? (
				<IntroPager shelf={shelf} items={items} now={now} onDone={onDone} />
			) : null}
		</AdaptiveModalScaffold>
	);
}

function IntroPager({
	shelf,
	items,
	now,
	onDone,
}: {
	shelf: SeasonalShelf;
	items: readonly ShelfItem[];
	now: number;
	onDone: (action: StallIntroAction) => void;
}) {
	const cards = useMemo(() => stallIntroCards(shelf, items, now), [shelf, items, now]);
	const [page, setPage] = useState(0);
	const index = Math.min(page, cards.length - 1);
	const card = cards[index];
	const last = index === cards.length - 1;

	const next = useCallback(() => {
		if (last) {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
			onDone("step_in");
			return;
		}
		Haptics.selectionAsync().catch(() => {});
		setPage(index + 1);
	}, [index, last, onDone]);

	return (
		<View style={styles.body} testID={`stall-intro-card-${card.id}`}>
			<Kicker align="center" maxFontSizeMultiplier={CHROME_TYPE_CAP}>
				{card.kicker}
			</Kicker>
			<PageTitle align="center" accessibilityRole="header">
				{card.title}
			</PageTitle>

			<CardArt card={card} shelf={shelf} items={items} now={now} />

			{card.id !== "where" ? (
				<T role="body" align="center">
					{card.body}
				</T>
			) : null}
			<T role="hand" tone="secondary" align="center">
				{card.hand}
			</T>

			<PageDots count={cards.length} index={index} label="Stall intro" />

			<View style={styles.actions}>
				<Button
					variant="primary"
					size="md"
					onPress={next}
					style={styles.action}
					accessibilityLabel={last ? "Step in" : "Next"}
					accessibilityHint={last ? "Opens the stall's new pieces" : "Shows the next card"}
					testID={last ? "stall-intro-step-in" : "stall-intro-next"}
				>
					{last ? "Step in" : "Next"}
				</Button>
				<Button
					variant="ghost"
					size="md"
					onPress={() => onDone("skip")}
					style={styles.action}
					accessibilityLabel={last ? "Later" : "Skip"}
					accessibilityHint="Closes the stall intro"
					testID="stall-intro-skip"
				>
					{last ? "Later" : "Skip"}
				</Button>
			</View>
		</View>
	);
}

function CardArt({
	card,
	shelf,
	items,
	now,
}: {
	card: StallIntroCard;
	shelf: SeasonalShelf;
	items: readonly ShelfItem[];
	now: number;
}) {
	if (card.id === "stall") {
		return (
			<View
				style={[styles.shot, styles.shotStall]}
				pointerEvents="none"
				accessible={false}
				importantForAccessibility="no-hide-descendants"
			>
				<View style={styles.shotCard}>
					<StallCard
						shelf={shelf}
						items={items}
						phase="open"
						now={now}
						ownedCount={0}
						onPress={() => {}}
					/>
				</View>
			</View>
		);
	}
	if (card.id === "costumes") {
		const backdrop = HAT_IMAGES[COSTUME_BACKDROP];
		const skin = COSTUME_FRAMES[card.costume.id]?.idle_1;
		return (
			<View
				style={styles.shot}
				accessible
				accessibilityRole="image"
				accessibilityLabel={card.caption}
			>
				{backdrop ? (
					<Image source={backdrop} style={styles.backdrop} resizeMode="cover" />
				) : null}
				<T role="hand" tone="onDark" style={styles.caption} maxFontSizeMultiplier={CHROME_TYPE_CAP}>
					{card.caption}
				</T>
				<View style={styles.pair} pointerEvents="none">
					<Image source={ROSIE} style={styles.pig} resizeMode="contain" />
					<T role="numeralLg" tone="onDark" style={styles.arrow}>
						›
					</T>
					{skin ? <Image source={skin} style={styles.pig} resizeMode="contain" /> : null}
				</View>
			</View>
		);
	}
	return (
		<View style={styles.doors}>
			{card.doors.map((door) => (
				<View
					key={door.id}
					style={styles.door}
					accessible
					accessibilityLabel={`${door.title}. ${door.line}`}
					testID={`stall-intro-door-${door.id}`}
				>
					<Glyph name={DOOR_GLYPH[door.id]} size={ART_SIZE.glyph} />
					<View style={styles.doorText}>
						<T role="cardTitle">{door.title}</T>
						<T role="hand" tone="secondary">
							{door.line}
						</T>
					</View>
				</View>
			))}
		</View>
	);
}

const styles = StyleSheet.create({
	body: { gap: SPACE.md },
	shot: {
		height: SHOT_H,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		borderRadius: RADII.md,
		overflow: "hidden",
		alignItems: "center",
		justifyContent: "flex-end",
		backgroundColor: WHIMSY.lilac,
	},
	shotStall: {
		justifyContent: "center",
		paddingHorizontal: SPACE.md,
		backgroundColor: WHIMSY.cream2,
	},
	shotCard: { width: "100%", transform: [{ scale: SHOT_CARD_SCALE }] },
	backdrop: { ...StyleSheet.absoluteFill, width: "100%", height: "100%" },
	caption: {
		position: "absolute",
		left: SPACE.md,
		top: SPACE.sm,
	},
	pair: {
		flexDirection: "row",
		alignItems: "flex-end",
		gap: SPACE.xs,
		marginBottom: SPACE.xs,
	},
	pig: { height: COSTUME_PIG_H, width: COSTUME_PIG_H * PIG_ASPECT },
	arrow: { marginBottom: ARROW_LIFT },
	doors: { gap: SPACE.md, paddingVertical: SPACE.xs },
	door: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.md,
		paddingVertical: SPACE.md,
		paddingHorizontal: SPACE.md,
		backgroundColor: UI_COLORS.surface,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		borderRadius: RADII.md,
		...SHADOW_SM,
	},
	doorText: { flex: 1, minWidth: 0, gap: SPACE.xxs },
	actions: { flexDirection: "row", gap: SPACE.md, marginTop: SPACE.xxs },
	action: { flex: 1 },
});
