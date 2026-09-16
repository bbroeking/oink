// The Feed panel — the feeding, now. A cream hero sticker (the Hungerer at 84pt
// beside the next-feeding readout), the six-stage meter with its one sentence,
// the panel's single gold CTA, and a second sticker for this / last feeding's
// herd: the avatar row, one line, and — when a crewmate's dig carries a story —
// a 44pt door row to their Barn. Every clock string comes from the tab's ONE
// shared feeding CTA, so this panel can never tick a minute apart from the dig.

import { useCallback, useEffect, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import {
	Button,
	CrewPortrait,
	Hand,
	Icon,
	ListRow,
	Sticker,
	T,
} from "@/components/ui";
import type { FeedingCta } from "@/components/mudwar/useFeedingCta";
import {
	getFeedingPushPreference,
	setFeedingPushPreference,
} from "@/utils/pushNotifications";
import {
	ART_SIZE,
	AVATAR_SIZE,
	BORDER,
	RADII,
	SPACE,
	TILT,
	UI_COLORS,
} from "@/constants/theme";
import { AvatarRow } from "./AvatarRow";
import { StageMeter } from "./StageMeter";
import type { HerdFeeding } from "./useHerdFeeding";

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

export interface FeedPanelProps {
	cta: FeedingCta;
	/** 0 (Gorged) … 5 (Famished). */
	stageIndex: number;
	/** The season's length in days — the meter sentence's deadline. */
	seasonDays: number;
	/** Pass XP per banked dig, when the server reports it; else the compiled fallback. */
	digPassXp?: number;
	herd: HerdFeeding;
	inCrew: boolean;
	/** Opens the Sounder Oink sheet — the herd nudge. */
	onOinkHerd: () => void;
	/** A crewmate's door row — opens their profile sheet (with its Visit). */
	onOpenMember?: (userId: string) => void;
	/** Herdless: the Feed CTA walks the player over to the Herd panel. */
	onGoHerd: () => void;
	testID?: string;
}

export function FeedPanel({
	cta,
	stageIndex,
	seasonDays,
	digPassXp,
	herd,
	inCrew,
	onOinkHerd,
	onOpenMember,
	onGoHerd,
	testID,
}: FeedPanelProps) {
	const open = cta.phaseOpen;
	const xp = digPassXp ?? DIG_PASS_XP_FALLBACK;
	const dug = inCrew && (cta.dugThisWindow || herd.meDug);
	const seatsOpen = Math.max(0, herd.members.length - herd.dugCount);
	const me = herd.members.find((m) => m.me);

	const kicker = dug
		? `feeding open · ${cta.countdown} left`
		: open
			? "feeding open"
			: "next feeding";
	const title = dug ? "Rosie dug." : open ? "The patch is open" : `Opens in ${cta.countdown}`;
	const sub = dug
		? me?.finds != null
			? `${me.finds} ${me.finds === 1 ? "find" : "finds"} this week. +${xp} Pass XP banked.`
			: `+${xp} Pass XP banked.`
		: open
			? `${cta.countdown} left. +${xp} Pass XP for the dig.`
			: `Dig while it's open. +${xp} Pass XP for the dig.`;

	// The one crewmate whose dig carries a story this feeding — a door to their
	// Barn. Never the caller, never anyone who slept.
	const story = herd.members.find((m) => !m.me && m.dug && m.layerLine);

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
				{!inCrew ? (
					<Button
						variant="lilac"
						size="lg"
						full
						onPress={onGoHerd}
						accessibilityLabel="Rosie digs with a herd"
						accessibilityHint="Opens the Herd panel to join or start a Sounder"
					>
						Rosie digs with a herd
					</Button>
				) : dug ? (
					<Button
						variant="gold"
						size="lg"
						full
						onPress={onOinkHerd}
						accessibilityLabel={`Oink at the herd, ${seatsOpen} seats still open`}
						accessibilityHint="Opens the Sounder Oink sheet"
					>
						{`Oink at the herd — ${seatsOpen} ${seatsOpen === 1 ? "seat" : "seats"} still open`}
					</Button>
				) : open ? (
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
					<RemindButton />
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

			{inCrew && (
				<Sticker
					color="paper"
					rotate={0}
					radius={RADII.xl}
					title={open ? "This feeding" : "Last feeding"}
					right={
						<Hand tone="secondary">
							{open ? `${cta.countdown} left` : `next in ${cta.countdown}`}
						</Hand>
					}
					style={styles.herdCard}
				>
					<AvatarRow
						members={herd.members}
						profiles={herd.profiles}
						testID="feed-avatar-row"
					/>
					<Hand tone="secondary" style={styles.totals}>
						{herd.dugCount > 0
							? `${herd.dugCount} ${herd.dugCount === 1 ? "snout" : "snouts"} dug · +${xp} Pass XP each`
							: open
								? `first dig takes the lead · +${xp} Pass XP`
								: `the patch opens in ${cta.countdown}`}
					</Hand>
					{story && (
						<View style={styles.storyRow}>
							<ListRow
								tilt={false}
								fill="cream"
								leading={
									<CrewPortrait
										size={AVATAR_SIZE[1]}
										hatId={herd.profiles.get(story.user_id)?.hatId ?? null}
										bowId={herd.profiles.get(story.user_id)?.bowId ?? null}
										prestigeLevel={herd.profiles.get(story.user_id)?.wallowCount ?? 0}
									/>
								}
								title={
									<Hand>
										{`${story.username} ${story.layerLine} — visit their Barn.`}
									</Hand>
								}
								trailing={
									<Icon name="chevronRight" size={ART_SIZE.glyphSm} color={UI_COLORS.textSecondary} />
								}
								onPress={onOpenMember ? () => onOpenMember(story.user_id) : undefined}
								accessibilityLabel={`${story.username} ${story.layerLine}`}
								accessibilityHint="Opens their profile, with a door to their Barn"
							/>
						</View>
					)}
				</Sticker>
			)}
		</View>
	);
}

// "Remind me when it opens" — the account-level feeding push preference as a
// gold CTA. Once on, the same control reads as the soft lilac "we'll oink you"
// and taps off again. The server is the truth; nothing is inferred locally.
function RemindButton() {
	const [enabled, setEnabled] = useState<boolean | null>(null);
	const [busy, setBusy] = useState(false);
	const [note, setNote] = useState<string | null>(null);
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
				accessibilityLabel={enabled ? "Reminder set — tap to turn it off" : "Remind me when it opens"}
				accessibilityHint="Oinks you when the patch opens, on every device you're signed in on"
				accessibilityState={{ checked: !!enabled }}
			>
				{enabled ? "Reminder set — we'll oink you" : "Remind me when it opens"}
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
	herdCard: {
		paddingHorizontal: SPACE.card,
		paddingVertical: SPACE.card,
	},
	totals: { marginTop: SPACE.sm },
	storyRow: {
		marginTop: SPACE.sm,
		paddingTop: SPACE.sm,
		borderTopWidth: BORDER.thin,
		borderTopColor: UI_COLORS.uiMuted,
		borderStyle: "dashed",
	},
});
