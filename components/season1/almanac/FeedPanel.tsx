// The Feed panel — the feeding, now. A cream hero sticker (the Hungerer at 84pt
// beside the next-feeding readout), the six-stage meter with its one sentence,
// the panel's single gold CTA, and under it the week's ball counter. Every clock
// string comes from the tab's ONE shared feeding CTA, so this panel can never
// tick a minute apart from the dig.
//
// Rewritten 2026-09-21 (docs/design/2026-09-21-season-page-rewrite.md §1): the
// this-feeding herd avatar row is gone with the rest of the page's group-shaped
// parts, and the ball counter took its place — one dig, one ball in Monday's
// drum, and the number is the snout's own.

import { useCallback, useEffect, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Button, Hand, Sticker, T } from "@/components/ui";
import type { FeedingCta } from "@/components/mudwar/useFeedingCta";
import {
	getFeedingPushPreference,
	setFeedingPushPreference,
} from "@/utils/pushNotifications";
import { RADII, SPACE, TILT } from "@/constants/theme";
import { ballsWord, type MondayDrawState } from "@/utils/mondayDraw";
import { StageMeter } from "./StageMeter";

const HUNGERER = require("../../../assets/images/hunger/great_hungerer_chip.png");

// Drawing geometry: the hero's Hungerer sprite.
const HERO_ART = 84;
// Pass XP a banked dig pays. No RPC reports it today (the grant lives in
// submit_rooting — migrations 20260706400000 / 20260714000000), so this is the
// compiled FALLBACK the XP reference sheet also prints; a server value, once
// exposed, arrives through `digPassXp` and wins.
const DIG_PASS_XP_FALLBACK = 20;

// The one sentence under the meter — the day is the season's real last day.
const meterLine = (lastDay: number) =>
	`Every find starves him a little — the herd wants him Famished by day ${lastDay}.`;

/**
 * `3 balls this week · +1 if you dig now` while the patch is open and untaken,
 * `3 balls this week` otherwise. The count is the server's (`runningBalls`);
 * the `+1` is the promise the dig keeps, not a number the client invented.
 */
export function ballCounterLine(runningBalls: number, digNow: boolean): string {
	const line = `${ballsWord(runningBalls)} this week`;
	return digNow ? `${line} · +1 if you dig now` : line;
}

export interface FeedPanelProps {
	cta: FeedingCta;
	/** 0 (Gorged) … 5 (Famished). */
	stageIndex: number;
	/** The season's length in days — the meter sentence's deadline. */
	seasonDays: number;
	/** Pass XP per banked dig, when the server reports it; else the compiled fallback. */
	digPassXp?: number;
	/** The drum, for the ball counter. Null before the first read lands. */
	draw: MondayDrawState | null;
	testID?: string;
}

export function FeedPanel({
	cta,
	stageIndex,
	seasonDays,
	digPassXp,
	draw,
	testID,
}: FeedPanelProps) {
	const open = cta.phaseOpen;
	const xp = digPassXp ?? DIG_PASS_XP_FALLBACK;
	const dug = cta.dugThisWindow;

	// The kicker never contradicts the clock: a snout who dug and is watching the
	// patch close still reads "feeding open"; once it is shut, the same line names
	// the next one. (The old copy said "feeding open" for the whole window.)
	const kicker = dug
		? open
			? `feeding open · ${cta.countdown} left`
			: `next feeding in ${cta.countdown}`
		: open
			? "feeding open"
			: "next feeding";
	const title = dug ? "Rosie dug." : open ? "The patch is open" : `Opens in ${cta.countdown}`;
	const sub = dug
		? `+${xp} Pass XP banked.`
		: open
			? `${cta.countdown} left. +${xp} Pass XP for the dig.`
			: `Dig while it's open. +${xp} Pass XP for the dig.`;

	return (
		<View style={styles.panel} testID={testID}>
			<Sticker color="cream" rotate={TILT.card} radius={RADII.xl} style={styles.hero}>
				<View style={styles.heroRow}>
					<Image
						source={HUNGERER}
						style={styles.heroArt}
						resizeMode="contain"
						accessibilityIgnoresInvertColors
					/>
					<View style={styles.heroText}>
						<T role="kickerPill" tone="secondary">
							{kicker}
						</T>
						<T role="pageTitle" accessibilityRole="header">
							{title}
						</T>
						<Hand tone="secondary">{sub}</Hand>
					</View>
				</View>
				<StageMeter stageIndex={stageIndex} testID="feed-stage-meter" />
				<Hand tone="secondary" align="center" style={styles.meterLine}>
					{meterLine(seasonDays)}
				</Hand>
				{open && !dug ? (
					<Button
						variant="gold"
						size="lg"
						full
						onPress={cta.start}
						accessibilityLabel="Dig the Truffle Patch"
						accessibilityHint={`The patch closes in ${cta.countdown}`}
					>
						Dig the Truffle Patch
					</Button>
				) : (
					<RemindButton nextFeeding={dug && open} />
				)}
				{draw && (
					<Hand tone="secondary" align="center" testID="feed-ball-counter">
						{ballCounterLine(draw.runningBalls, open && !dug)}
					</Hand>
				)}
				{!!cta.note && (
					<Hand tone="accent" align="center" style={styles.note}>
						{cta.note}
					</Hand>
				)}
				{__DEV__ && cta.startPractice && (
					<Button
						size="sm"
						variant="handLink"
						onPress={cta.startPractice}
						accessibilityLabel="Dev: start a practice dig"
					>
						dev · practice dig ›
					</Button>
				)}
			</Sticker>
		</View>
	);
}

// "Remind me when it opens" — the account-level feeding push preference as a
// gold CTA. Once on, the same control reads as the soft lilac "we'll oink you"
// and taps off again. The server is the truth; nothing is inferred locally.
//
// A snout who has already dug is looking at a patch that IS open, so the label
// names the feeding the reminder is actually for — the next one. Same control,
// same preference; only the words move.
function RemindButton({ nextFeeding = false }: { nextFeeding?: boolean }) {
	const [enabled, setEnabled] = useState<boolean | null>(null);
	const [busy, setBusy] = useState(false);
	const [note, setNote] = useState<string | null>(null);
	const offLabel = nextFeeding
		? "Remind me next feeding"
		: "Remind me when it opens";
	useEffect(() => {
		let alive = true;
		getFeedingPushPreference()
			.then((v) => {
				if (alive) setEnabled(v ?? false);
			})
			.catch(() => {
				if (alive) setEnabled(false);
			});
		return () => {
			alive = false;
		};
	}, []);
	const toggle = useCallback(async () => {
		if (busy || enabled == null) return;
		Haptics.selectionAsync().catch(() => {});
		setBusy(true);
		setNote(null);
		try {
			const r = await setFeedingPushPreference(!enabled);
			if (r === "enabled") setEnabled(true);
			else if (r === "disabled") setEnabled(false);
			else if (r === "denied") setNote("Notifications are off for this device — turn them on in Settings.");
			else setNote("Couldn't set the reminder — give it another tap.");
		} catch {
			setNote("Couldn't set the reminder — give it another tap.");
		} finally {
			setBusy(false);
		}
	}, [busy, enabled]);
	return (
		<View style={styles.remind}>
			<Button
				variant={enabled ? "lilac" : "gold"}
				size="lg"
				full
				onPress={toggle}
				loading={busy}
				accessibilityLabel={enabled ? "Reminder set — tap to turn it off" : offLabel}
				accessibilityHint="Oinks you when the patch opens, on every device you're signed in on"
				accessibilityState={{ checked: !!enabled }}
			>
				{enabled ? "Reminder set — we'll oink you" : offLabel}
			</Button>
			{!!note && (
				<Hand tone="accent" align="center" style={styles.note}>
					{note}
				</Hand>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	panel: { gap: SPACE.md },
	hero: {
		paddingHorizontal: SPACE.card,
		paddingVertical: SPACE.card,
		gap: SPACE.sm,
	},
	heroRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.md,
	},
	heroArt: { width: HERO_ART, height: HERO_ART },
	heroText: { flex: 1, minWidth: 0, gap: SPACE.xxs },
	meterLine: { marginBottom: SPACE.xs },
	note: { marginTop: SPACE.xs },
	remind: { gap: SPACE.xs },
});
