// The Pass panel — the ladder, three rungs at a time. `The ladder` with the XP
// still to earn for the next tier, three LadderRows in one bordered sticker
// (every ready tier, then what's next; ready rungs on the sun), a paper door to
// the full track (`See all 26 tiers · 8 more for the Barn`), and this week's
// quests as two one-line rows with a bar and a claim.
//
// A `habitat` rung (a Barn furnishing) claims through `onClaimHabitat` when the
// owner wires it — the BarnRewardClaimSheet — and through the ordinary claim
// until then.

import { StyleSheet, View } from "react-native";
import {
	Button,
	Hand,
	Icon,
	Label,
	ProgressTrack,
	SnoutCoin,
	Sticker,
	T,
} from "@/components/ui";
import {
	ART_SIZE,
	BORDER,
	RADII,
	SPACE,
	TAP_MIN,
	UI_COLORS,
} from "@/constants/theme";
import type { PassTrack, TiersByNumber } from "@/utils/seasonPass";
import { barnRewardsAhead, passLadderWindow, xpToNextTier } from "./almanacState";
import { LadderRow } from "./LadderRow";
import type { WeeklyBounty } from "./useWeeklyQuests";


export interface PassPanelProps {
	xp: number;
	xpPerTier: number;
	currentTier: number;
	totalTiers: number;
	tiersByNumber: TiersByNumber;
	claimedSet: Set<string>;
	track: PassTrack;
	busy: boolean;
	onClaim: (tier: number, track: PassTrack) => void;
	/** A Barn furnishing's claim — opens the claim sheet once the owner wires it. */
	onClaimHabitat?: (tier: number) => void;
	/** Opens the full pass track (the existing list) in a sheet. */
	onOpenTrack: () => void;
	quests: WeeklyBounty[] | null;
	questBusyCode?: string | null;
	onClaimQuest: (code: string) => void;
	testID?: string;
}

export function PassPanel({
	xp,
	xpPerTier,
	currentTier,
	totalTiers,
	tiersByNumber,
	claimedSet,
	track,
	busy,
	onClaim,
	onClaimHabitat,
	onOpenTrack,
	quests,
	questBusyCode,
	onClaimQuest,
	testID,
}: PassPanelProps) {
	const rungs = passLadderWindow(tiersByNumber, track, claimedSet, currentTier, xp, xpPerTier);
	const toNext = xpToNextTier(xp, xpPerTier, currentTier, totalTiers);
	const barnAhead = barnRewardsAhead(tiersByNumber, track, claimedSet);
	const doorLabel =
		barnAhead > 0
			? `See all ${totalTiers} tiers · ${barnAhead} more for the Barn`
			: `See all ${totalTiers} tiers`;

	return (
		<View style={styles.panel} testID={testID}>
			<View style={styles.head}>
				<T role="sectionTitle" accessibilityRole="header">
					The ladder
				</T>
				<Hand tone="secondary">
					{currentTier >= totalTiers ? "every tier reached" : `${toNext} XP to tier ${currentTier + 1}`}
				</Hand>
			</View>
			<Sticker color="paper" rotate={0} radius={RADII.xl} style={styles.ladder}>
				{rungs.map((r, i) => (
					<View key={r.tier} style={i > 0 && styles.rule}>
						<LadderRow
							tier={r.tier}
							state={r.state}
							reward={r.reward}
							xpAway={r.xpAway}
							busy={busy}
							onClaim={() =>
								r.reward.reward_type === "habitat" && onClaimHabitat
									? onClaimHabitat(r.tier)
									: onClaim(r.tier, track)
							}
							testID={`ladder-row-${r.tier}`}
						/>
					</View>
				))}
				{rungs.length === 0 && (
					<Hand tone="secondary" align="center" style={styles.empty}>
						every reward on this track is yours
					</Hand>
				)}
			</Sticker>

			<Sticker
				color="paper"
				rotate={0}
				radius={RADII.pill}
				shadow="sm"
				onPress={onOpenTrack}
				accessibilityLabel={doorLabel}
				accessibilityHint="Opens the whole pass track"
				style={styles.door}
				testID="pass-open-track"
			>
				<Label>{doorLabel}</Label>
			</Sticker>

			{quests && quests.length > 0 && (
				<Sticker
					color="paper"
					rotate={0}
					radius={RADII.xl}
					title={
						<T role="sectionTitle" accessibilityRole="header">
							This week&apos;s quests
						</T>
					}
					right={<Hand tone="secondary">fresh ones Monday</Hand>}
					style={styles.quests}
				>
					{quests.map((q, i) => {
						const ready = q.progress >= q.goal && !q.claimed;
						const shown = Math.min(q.progress, q.goal);
						return (
							<View key={q.code} style={[styles.quest, i > 0 && styles.rule]}>
								<View style={styles.questText}>
									<View style={styles.questName}>
										<T role="body" numberOfLines={1} style={styles.questTitle}>
											{q.name}
										</T>
										{!!q.description && (
											<Hand tone="secondary" numberOfLines={1} style={styles.questDesc}>
												{`· ${q.description}`}
											</Hand>
										)}
									</View>
									<ProgressTrack
										value={shown}
										max={q.goal}
										tone="sage"
										height="sm"
										accessibilityLabel={`${q.name}: ${shown} of ${q.goal}`}
									/>
								</View>
								{q.claimed ? (
									<Icon name="check" size={ART_SIZE.glyphSm} color={UI_COLORS.successText} strokeWidth={3} />
								) : ready ? (
									<Button
										size="sm"
										variant="gold"
										onPress={() => onClaimQuest(q.code)}
										loading={questBusyCode === q.code}
										icon={<SnoutCoin size={ART_SIZE.mark} />}
										accessibilityLabel={`Claim ${q.reward_snouts} snouts for ${q.name}`}
										accessibilityHint="Adds the snouts to your pouch"
										testID={`quest-claim-${q.code}`}
									>
										{`Claim ${q.reward_snouts}`}
									</Button>
								) : (
									<Hand tone="secondary">{`${shown} of ${q.goal}`}</Hand>
								)}
							</View>
						);
					})}
				</Sticker>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	panel: { gap: SPACE.md },
	head: {
		flexDirection: "row",
		alignItems: "baseline",
		justifyContent: "space-between",
		gap: SPACE.sm,
	},
	// The rungs fill to the sticker's edge (a ready rung is a full sun band).
	ladder: { overflow: "hidden", paddingVertical: SPACE.xs },
	rule: {
		borderTopWidth: BORDER.thin,
		borderTopColor: UI_COLORS.uiMuted,
		borderStyle: "dashed",
	},
	empty: { paddingVertical: SPACE.md },
	door: {
		alignSelf: "center",
		minHeight: TAP_MIN,
		justifyContent: "center",
		paddingHorizontal: SPACE.lg,
		paddingVertical: SPACE.sm,
	},
	quests: {
		paddingHorizontal: SPACE.card,
		paddingVertical: SPACE.md,
	},
	quest: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.md,
		paddingVertical: SPACE.xs,
	},
	questText: { flex: 1, minWidth: 0, gap: SPACE.xs },
	questName: { flexDirection: "row", alignItems: "baseline", gap: SPACE.xs },
	questTitle: { flexShrink: 0 },
	questDesc: { flexShrink: 1 },
});
