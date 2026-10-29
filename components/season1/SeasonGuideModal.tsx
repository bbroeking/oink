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
	type GlyphName,
} from "@/components/ui";
import {
	useHungerMeter,
	HUNGER_STAGES,
	HUNGER_LEVEL_NAME,
	HUNGER_LEVEL_CREDIT_PREVIEW,
	formatCredit,
} from "@/hooks/useHungerMeter";
import { AVATAR_SIZE, SPACE } from "@/constants/theme";

const STEPS: { g: GlyphName; title: string; line: string }[] = [
	{
		g: "gem",
		title: "Dig every feeding",
		line: "Every 8 hours the Hungerer gorges. Dig the Truffle Patch open through his first four hours, then he guards it the next four while he digests. Whatever you tie off is yours to keep.",
	},
	{
		g: "gift",
		title: "Draw on Monday",
		line: "Every dig drops a ball in Monday's drum. On Monday the drum turns once for you, and the more balls you hold the better your purse tends to be. Nobody else's week changes yours.",
	},
	{
		// His crown, the thing the herd takes at Famished (the story's last beat
		// draws it too). The red ogre this used was a second face for a
		// character the page draws as the crowned pig.
		g: "crown",
		title: "Starve the Hungerer",
		line: "Every truffle the herd digs back drains him, level by level, until the whole valley starves him to Famished and every digger with ten finds takes his crown.",
	},
];

export function SeasonGuideModal({
	visible,
	onDismiss,
}: {
	visible: boolean;
	onDismiss: () => void;
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
				The Season of the Hunger
			</PageTitle>

			{STEPS.map((s, i) => (
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
				steal back the tickles ★
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
									{HUNGER_LEVEL_NAME[stage]}
									{here ? " · he is here" : ""}
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
				He ate the valley&apos;s tickles. Every truffle the herd digs up
				pries them back. Starve him from Gorged to Famished.
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
