// Referral Rewards — the full referral page reached from the Me tab. Shows
// every invited player still on the way with progress toward 100 tickles and
// the full reward
// ladder (3 → 1000) with earned / next / locked states. Data: my_referral_summary.
import React, { useCallback, useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { StackPage } from "../components/ui/StackPage";
import { View, StyleSheet, ScrollView } from "react-native";
import { router } from "expo-router";
import { useFocusEffect } from "expo-router/react-navigation";
import { Sticker } from "../components/ui/Sticker";
import { Icon } from "../components/ui/Icon";
import { Button } from "../components/ui/Button";
import { EmptyState, LoadingBeat } from "../components/ui/EmptyState";
import { ProgressTrack } from "../components/ui/ProgressTrack";
import { Hand, KickerPill, Label, T } from "../components/ui/Text";
import {
	ART_SIZE,
	BORDER,
	DISABLED,
	RADII,
	SPACE,
	WHIMSY,
	UI_COLORS,
	PAGE_PAD,
	TAB_SAFE,
} from "@/constants/theme";
import {
	myReferralSummary,
	REFERRAL_LADDER,
	type ReferralSummary,
	type ReferralFriend,
} from "@/utils/referrals";

// A referral counts at 100 tickles — the meter's max, named once.
const TICKLE_TARGET = 100;
// The ladder rung's count badge — a 30pt drawn disc, not a spacing step.
const RUNG_BADGE = 30;

function FriendProgress({ friend }: { friend: ReferralFriend }) {
	const done = !!friend.completed;
	const name = friend.username ?? "a new pig";
	return (
		<View style={styles.friendRow}>
			<View style={styles.friendTop}>
				<T role="label" numberOfLines={1} style={styles.friendName}>
					{name}
				</T>
				{done ? (
					<View style={styles.friendDone}>
						<Icon name="check" size={ART_SIZE.mark} color={WHIMSY.ink} strokeWidth={2.4} />
						<Label>counted</Label>
					</View>
				) : (
					<Hand tone="secondary" style={styles.friendProg}>
						{friend.tickles}/{TICKLE_TARGET} tickles
					</Hand>
				)}
			</View>
			{!done && (
				<ProgressTrack
					value={friend.tickles}
					max={TICKLE_TARGET}
					tone="lilac"
					height="sm"
					accessibilityLabel={`${name}: ${friend.tickles} of ${TICKLE_TARGET} tickles toward counting as a referral`}
				/>
			)}
		</View>
	);
}

export default function SounderProgressScreen() {
	const [summary, setSummary] = useState<ReferralSummary | null>(null);
	// Three states, not two: a read that never came back is "unknown", and
	// rendering "No referrals yet" over it tells the player something untrue
	// about their own data. [B-14]
	const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

	const load = useCallback(() => {
		let cancelled = false;
		setStatus("loading");
		myReferralSummary().then((r) => {
			if (cancelled) return;
			// The envelope discriminates on `ok`, so the check narrows it directly.
			if (r?.ok) {
				setSummary(r);
				setStatus("ready");
			} else {
				setSummary(null);
				setStatus("error");
			}
		});
		return () => {
			cancelled = true;
		};
	}, []);

	useFocusEffect(useCallback(() => load(), [load]));

	const completed = summary?.referrals_completed ?? 0;
	const pending = summary?.pending_friends ?? [];

	return (
		<>
			<StackPage>
				<PageHeader
					kicker="referrals"
					title="Referral Rewards"
					onBack={() => router.back()}
					below={
						status === "ready" ? (
							<View style={styles.statsLine}>
								<Label>{completed} brought in</Label>
								{pending.length > 0 && (
									<Hand tone="secondary">
										{"  ·  "}
										{pending.length} on the way
									</Hand>
								)}
							</View>
						) : undefined
					}
				/>

				<ScrollView
					contentContainerStyle={styles.content}
					showsVerticalScrollIndicator={false}
				>
					{status === "loading" && <LoadingBeat label="counting your recruits" />}

					{status === "error" && (
						<EmptyState
							kind="error"
							sub="We couldn't read your referrals just now."
							action={
								<Button
									variant="ghost"
									size="sm"
									onPress={load}
									accessibilityHint="Asks for your referral summary again"
								>
									Try again
								</Button>
							}
						/>
					)}

					{status === "ready" && pending.length > 0 && (
						<Sticker color="rose" rotate={-0.5} radius={RADII.xl} style={styles.card}>
							<KickerPill tone="secondary" style={styles.cardKicker}>
								on the way
							</KickerPill>
							<Hand tone="secondary" style={styles.cardSub}>
								A referral counts as soon as the new player reaches {TICKLE_TARGET} tickles.
							</Hand>
							<View style={styles.friendList}>
								{pending.map((f, i) => (
									<FriendProgress key={(f.username ?? "p") + i} friend={f} />
								))}
							</View>
						</Sticker>
					)}

					{status === "ready" && (
						<Sticker color="cream" rotate={0.4} radius={RADII.xl} style={styles.card}>
							<KickerPill tone="secondary" style={styles.cardKicker}>
								reward ladder
							</KickerPill>
							<Hand tone="secondary" style={styles.cardSub}>
								Every completed referral also pays {TICKLE_TARGET} tickles.
							</Hand>
							<View style={styles.ladder}>
								{REFERRAL_LADDER.map((rung) => {
									const earned = completed >= rung.count;
									const isNext =
										!earned && summary?.next_milestone_at === rung.count;
									const meta = earned
										? "earned"
										: isNext
											? `${rung.count - completed} more to go`
											: `at ${rung.count} referrals`;
									return (
										<View
											key={rung.count}
											accessible
											accessibilityRole="text"
											accessibilityLabel={`${rung.reward} — ${meta}`}
											style={[
												styles.rung,
												// A locked rung keeps its outline and mutes its fill;
												// the old blanket opacity crushed the reward line
												// below AA until it was earned. [B-08]
												!earned && !isNext && styles.rungLocked,
												isNext && styles.rungNext,
											]}
										>
											<View
												style={[
													styles.rungBadge,
													earned && styles.rungBadgeEarned,
												]}
											>
												{earned ? (
													<Icon
														name="check"
														size={ART_SIZE.mark}
														color={WHIMSY.ink}
														strokeWidth={2.4}
													/>
												) : (
													<T role="bodySm" tone={isNext ? "primary" : "disabled"}>
														{rung.count}
													</T>
												)}
											</View>
											<View style={styles.rungBody}>
												<Label tone={earned || isNext ? "primary" : "disabled"}>
													{rung.reward}
												</Label>
												<T role="kicker" tone="secondary" style={styles.rungMeta}>
													{meta}
												</T>
											</View>
										</View>
									);
								})}
							</View>
						</Sticker>
					)}

					{status === "ready" && pending.length === 0 && completed === 0 && (
						<EmptyState
							glyph="friends"
							title="No referrals yet"
							sub="Share your code from the Me tab to invite a new player."
						/>
					)}
				</ScrollView>
			</StackPage>
		</>
	);
}

const styles = StyleSheet.create({
	statsLine: { flexDirection: "row", alignItems: "baseline" },
	content: {
		paddingHorizontal: PAGE_PAD,
		paddingTop: SPACE.sm,
		paddingBottom: TAB_SAFE,
		gap: SPACE.card,
	},
	card: { padding: SPACE.lg },
	cardKicker: { marginBottom: SPACE.xs },
	cardSub: { marginBottom: SPACE.md },
	friendList: { gap: SPACE.md },
	friendRow: { gap: SPACE.xs },
	friendTop: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	friendName: { flex: 1, minWidth: 0 },
	friendProg: { marginLeft: SPACE.sm },
	friendDone: { flexDirection: "row", alignItems: "center", gap: SPACE.xs, marginLeft: SPACE.sm },
	ladder: { gap: SPACE.sm },
	rung: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.md,
		padding: SPACE.sm,
		borderRadius: RADII.md,
		borderWidth: BORDER.thin,
		borderColor: UI_COLORS.border,
		backgroundColor: WHIMSY.paper,
	},
	rungLocked: DISABLED,
	rungNext: { backgroundColor: WHIMSY.cream2, borderWidth: BORDER.ink },
	rungBadge: {
		width: RUNG_BADGE,
		height: RUNG_BADGE,
		borderRadius: RUNG_BADGE / 2,
		borderWidth: BORDER.thin,
		borderColor: UI_COLORS.border,
		backgroundColor: WHIMSY.cream,
		alignItems: "center",
		justifyContent: "center",
	},
	rungBadgeEarned: { backgroundColor: WHIMSY.sun },
	rungBody: { flex: 1, minWidth: 0 },
	rungMeta: { marginTop: SPACE.xxs },
});
