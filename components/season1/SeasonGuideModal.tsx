// Season 1 guide — "how the season works" in three steps + the Hunger level
// ladder. Rewritten 2026-09-21 with the page itself
// (docs/design/2026-09-21-season-page-rewrite.md §1, §4): the herd race and the
// herd-milestone pages left with the race, and Monday's drum took the one slot
// they held — three verbs on the page, three steps in the guide.
//
// Opened from the title row's `?` chooser, never by itself (season.tsx).
//
// Polish pass 2026-10-04: the × is a "Close" and the button says where it
// lands ("Back to the season" — it never opened the patch it used to name);
// the "leave your Sounder" door is gone, because the Sounder keeps no door on
// this page (§1) and Friends ▸ Sounder has its own Leave; and the copy follows
// the dig that ships — a truffle is yours once you tie it off, and only the
// herd's truffles drain the Hungerer (Snout Deep credits truffles, never
// blessings or things).
//
// The ladder shows named LEVELS with big hunger-credit numbers — the
// obfuscation layer from hooks/useHungerMeter: display numbers are the raw
// server totals × HUNGER_CREDIT_SCALE, so the real (tiny, tunable)
// thresholds never show and can be retuned mid-season.
//
// Chrome: `AdaptiveModalScaffold card` owns the Modal, the scrim, the
// safe-area frame and the scroll path [C-09, spec §3.4]; its frame IS the
// sticker card and its pinned close is the card's ×, so the × stays put while
// the long guide scrolls under it (it used to scroll away, 051).

import { StyleSheet, View } from "react-native";
import {
	AdaptiveModalScaffold,
	Avatar,
	BodySm,
	Button,
	Hand,
	Kicker,
	Label,
	ListRow,
	PageTitle,
	Tag,
	useUnmanagedModalHold,
} from "@/components/ui";
import {
	useHungerMeter,
	HUNGER_STAGES,
	HUNGER_LEVEL_CREDIT_PREVIEW,
	formatCredit,
} from "@/hooks/useHungerMeter";
import { AVATAR_SIZE, SPACE } from "@/constants/theme";
import { seasonTheme, type SeasonTheme } from "@/utils/seasonTheme";

// The three steps, the ladder's words and the headline are the season's own
// (utils/seasonTheme.ts): Season 1 starves the Hungerer, Season 2 fills the
// Larder, over the same six stage ids.

export function SeasonGuideModal({
	visible,
	onDismiss,
	theme = seasonTheme("snout_season_1"),
}: {
	visible: boolean;
	onDismiss: () => void;
	/** The active season's fiction; Season 1's when absent. */
	theme?: SeasonTheme;
}) {
	// Unmanaged native Modal (season-tab guide, outside the popup queue): hold the
	// queue while visible so a foreground poll can't present a queued popup over it
	// — the #50152 wedge (issue #4).
	useUnmanagedModalHold(visible);
	const meter = useHungerMeter();

	return (
		<AdaptiveModalScaffold
			visible={visible}
			onRequestClose={onDismiss}
			maxWidth={400}
			card
		>
			<Kicker align="center" style={styles.kicker}>
				the season, in three steps ★
			</Kicker>
			<PageTitle align="center" accessibilityRole="header" style={styles.headline}>
				{theme.seasonName}
			</PageTitle>

			{theme.guideSteps.map((s, i) => (
				<View key={s.title} style={styles.stepRow}>
					<Avatar
						size={AVATAR_SIZE[1]}
						fill="cream"
						glyph={s.g}
						label={s.title}
					/>
					<View style={styles.stepText}>
						<Label style={styles.stepTitle}>
							{i + 1}. {s.title}
						</Label>
						<BodySm tone="secondary">{s.line}</BodySm>
					</View>
				</View>
			))}

			{/* The ladder — gorged → famished, counted in tickles
			    reclaimed. He ate the valley's tickles; the barnyard
			    steals every last one back. */}
			<Kicker align="center" style={styles.ladderKicker}>
				{theme.ladderKicker}
			</Kicker>
			<View style={styles.ladder}>
				{HUNGER_STAGES.map((stage, i) => {
					const here = meter.available && meter.stageIndex === i;
					return (
						<ListRow
							key={stage}
							tilt={false}
							fill={here ? "sun" : "paper"}
							selected={here}
							title={
								<Label>
									{theme.levelNames[stage]}
									{here ? theme.ladderHere : ""}
								</Label>
							}
							trailing={
								<Tag
									label={formatCredit(HUNGER_LEVEL_CREDIT_PREVIEW[i])}
									tone={here ? "sun" : "paper"}
								/>
							}
						/>
					);
				})}
			</View>
			<Hand tone="secondary" align="center" style={styles.ladderFoot}>
				{theme.ladderFoot}
			</Hand>

			<Button
				size="md"
				variant="primary"
				full
				onPress={onDismiss}
				accessibilityLabel="Back to the season"
				accessibilityHint="Closes the guide"
				style={styles.cta}
			>
				Back to the season
			</Button>
		</AdaptiveModalScaffold>
	);
}

const styles = StyleSheet.create({
	kicker: { marginBottom: SPACE.xs },
	headline: { marginBottom: SPACE.md },
	stepRow: {
		flexDirection: "row",
		alignItems: "flex-start",
		gap: SPACE.md,
		marginBottom: SPACE.md,
	},
	stepText: { flex: 1, minWidth: 0 },
	stepTitle: { marginBottom: SPACE.xxs },
	ladderKicker: { marginTop: SPACE.sm, marginBottom: SPACE.sm },
	ladder: { gap: SPACE.sm },
	ladderFoot: { marginTop: SPACE.sm },
	cta: { marginTop: SPACE.md },
});
