// Season 1 guide — "how the season works" in five steps + the Hunger level
// ladder. Pops on EVERY Season-tab visit for now (see season.tsx's
// GUIDE_EVERY_VISIT) so the flow can be tested repeatedly; before public S1
// it flips to a once-per-user AsyncStorage stamp like the intro storybook.
//
// The ladder shows named LEVELS with big hunger-credit numbers — the
// obfuscation layer from hooks/useHungerMeter: display numbers are the raw
// server totals × HUNGER_CREDIT_SCALE, so the real (tiny, tunable)
// thresholds never show and can be retuned mid-season.
//
// Chrome: `AdaptiveModalScaffold` + `Sticker` + `DialogCloseRow` — the scaffold
// owns the Modal, the scrim, the safe-area frame and the scroll path, so the
// hand-rolled backdrop / card / maxHeight trio is gone [C-09, spec §3.4].

import { useState } from "react";
import { StyleSheet, View } from "react-native";
import {
	AdaptiveModalScaffold,
	Avatar,
	BodySm,
	Button,
	ConfirmDialog,
	DialogCloseRow,
	Hand,
	Kicker,
	Label,
	ListRow,
	PageTitle,
	Sticker,
	Tag,
	useUnmanagedModalHold,
	type GlyphName,
} from "@/components/ui";
import { CREW_CAP_WORD } from "@/constants/crews";
import {
	useHungerMeter,
	HUNGER_STAGES,
	HUNGER_LEVEL_NAME,
	HUNGER_LEVEL_CREDIT_PREVIEW,
	formatCredit,
} from "@/hooks/useHungerMeter";
import { AVATAR_SIZE, RADII, SPACE, TILT } from "@/constants/theme";

const STEPS: { g: GlyphName; title: string; line: string }[] = [
	{
		g: "friends",
		title: "Join a Sounder",
		line: `${CREW_CAP_WORD} snouts, one banner. Ask into an open Sounder, answer a friend's invite, or found your own — the dig needs a herd.`,
	},
	{
		g: "gem",
		title: "Dig every feeding",
		line: "Every 8 hours the Hungerer gorges — dig the Truffle Patch open through his first four hours, then he guards it the next four while he digests. Every truffle is yours to keep.",
	},
	{
		g: "trophy",
		title: "Earn herd milestones",
		line: "Your Sounder's finds add up for good. Cross a milestone and every member earns a title and a snout purse.",
	},
	{
		g: "star",
		title: "Race the week",
		line: "Every find counts forever on the season board. Each week the best diggers take spoils — the standings settle every Monday.",
	},
	{
		g: "ogre",
		title: "Starve the Hungerer",
		line: "Every truffle the herd digs back drains him, level by level, until the whole valley starves him to Famished and every digger with ten finds takes his crown.",
	},
];

export function SeasonGuideModal({
	visible,
	onDismiss,
	onLeave,
}: {
	visible: boolean;
	onDismiss: () => void;
	/** When set (caller is in a Sounder), a quiet leave action shows in the
	    footer with a two-tap in-world confirm. */
	onLeave?: () => void;
}) {
	// Unmanaged native Modal (season-tab guide, outside the popup queue): hold the
	// queue while visible so a foreground poll can't present a queued popup over it
	// — the #50152 wedge (issue #4). The hold also covers the nested leave-confirm
	// ConfirmDialog.
	useUnmanagedModalHold(visible);
	const meter = useHungerMeter();

	// Two-tap leave confirm — an in-world ConfirmDialog, not a native Alert.
	const [leaveConfirm, setLeaveConfirm] = useState(false);

	const confirmLeave = () => setLeaveConfirm(true);
	const doLeave = () => {
		setLeaveConfirm(false);
		onLeave?.();
		onDismiss();
	};

	return (
		<AdaptiveModalScaffold
			visible={visible}
			onRequestClose={onDismiss}
			maxWidth={400}
			bare
		>
			<ConfirmDialog
				open={leaveConfirm}
				title="Leave your Sounder?"
				body="You'll stop digging with this herd. You can join another any time."
				confirmLabel="Leave"
				cancelLabel="Stay"
				tone="destructive"
				onConfirm={doLeave}
				onCancel={() => setLeaveConfirm(false)}
			/>
			<Sticker
				color="paper"
				rotate={TILT.dialog}
				radius={RADII.xxl}
				border={3}
				style={styles.card}
			>
				<DialogCloseRow onPress={onDismiss} label="To the patch" />
				<Kicker align="center" style={styles.kicker}>
					the season, in five steps ★
				</Kicker>
				<PageTitle align="center" style={styles.headline}>
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
										{here ? " — he is here" : ""}
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
					He ate the valley&apos;s tickles. Every dig and blessing pries
					them back — starve him from Gorged to Famished.
				</Hand>

				<Button
					size="md"
					variant="primary"
					full
					onPress={onDismiss}
					style={styles.cta}
				>
					To the patch
				</Button>
				{onLeave && (
					<Button
						size="sm"
						variant="handLink"
						onPress={confirmLeave}
						accessibilityLabel="Leave your Sounder"
						accessibilityHint="Asks you to confirm before you stop digging with this herd"
						style={styles.leave}
					>
						leave your Sounder ›
					</Button>
				)}
			</Sticker>
		</AdaptiveModalScaffold>
	);
}

const styles = StyleSheet.create({
	card: {
		width: "100%",
		paddingHorizontal: SPACE.lg,
		paddingBottom: SPACE.lg,
	},
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
	leave: { alignSelf: "center", marginTop: SPACE.sm },
});
