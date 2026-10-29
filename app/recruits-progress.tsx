// Referral Rewards — the full referral page reached from the Me tab. Shows
// every invited player still on the way with progress toward 100 tickles and
// the full reward ladder (3 → 1,000) with earned / next / locked states.
// Data: my_referral_summary.
//
// Polish 2026-10-04: the empty state takes the "on the way" card's slot, on
// the page's own inset, and carries the Share it used to send the player back
// to the Me tab for. The code itself is not repeated here: the Me row owns it
// and its Share (now a VoiceOver target of its own), and this page is that
// row's door, not a copy of it (SKILL.md 2026-09-20). The rung badges are
// capsules wide enough for "1,000" (the old 30pt disc cut it to "100("); the
// next rung is the one with the heavy outline, not a twin of the locked ones.
import React, { useCallback, useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import {
	StackPage,
	STACK_SCROLL_EDGES,
	useStackScrollPad,
} from "../components/ui/StackPage";
import { View, StyleSheet, ScrollView } from "react-native";
import { router } from "expo-router";
import { useFocusEffect } from "expo-router/react-navigation";
import { Sticker } from "../components/ui/Sticker";
import { Icon } from "../components/ui/Icon";
import { Button } from "../components/ui/Button";
import { EmptyState, LoadingBeat } from "../components/ui/EmptyState";
import { ProgressTrack } from "../components/ui/ProgressTrack";
import { Hand, KickerPill, Label, T } from "../components/ui/Text";
import { ReferralShareButton } from "../components/ReferralShareButton";
import {
	ART_SIZE,
	BORDER,
	CHROME_TYPE_CAP,
	DISABLED,
	RADII,
	SPACE,
	WHIMSY,
	UI_COLORS,
	PAGE_PAD,
} from "@/constants/theme";
import {
	myReferralSummary,
	REFERRAL_LADDER,
	type ReferralSummary,
	type ReferralFriend,
} from "@/utils/referrals";

// A referral counts at 100 tickles — the meter's max, named once.
const TICKLE_TARGET = 100;
// The ladder rung's count badge: a drawn capsule, not a spacing step. One
// width on every rung (so the rewards line up) that holds "1,000" at the
// chrome type cap: 13pt bold digits run ~34pt, ~44pt at 1.3x, inside 49pt of
// capsule between the borders.
const RUNG_BADGE_H = 30;
const RUNG_BADGE_W = 52;

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
	// A stack screen has no tab bar: the list ends one loose step past the
	// home indicator, and the page leaves its bottom edge to the list.
	const scrollPad = useStackScrollPad();

	return (
		<>
			<StackPage edges={STACK_SCROLL_EDGES}>
				<PageHeader
					kicker="grow the herd"
					title="Referral Rewards"
					onBack={() => router.back()}
					right={
						<Button
							variant="handLink"
							size="sm"
							onPress={() => router.push("/recruits")}
							accessibilityLabel="The board"
							accessibilityHint="Opens Top Recruiters, the pigs who have brought the most players in"
						>
							the board ›
						</Button>
					}
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
					contentContainerStyle={[styles.content, { paddingBottom: scrollPad }]}
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

					{/* Nobody brought in, nobody on the way: the empty state takes the
					    "on the way" card's place, on the page's own inset, with the Share. */}
					{status === "ready" && pending.length === 0 && completed === 0 && (
						<EmptyState
							glyph="friends"
							title="No referrals yet"
							sub={`A new pig counts once they reach ${TICKLE_TARGET} tickles.`}
							flush
							action={
								summary?.code ? <ReferralShareButton code={summary.code} label="Share your code" /> : undefined
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
											? `${(rung.count - completed).toLocaleString()} more to go`
											: `at ${rung.count.toLocaleString()} referrals`;
									return (
										<View
											key={rung.count}
											accessible
											accessibilityRole="text"
											accessibilityLabel={`${rung.reward}. ${meta}`}
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
														<T
														role="bodySm"
														tone={isNext ? "primary" : "disabled"}
														numberOfLines={1}
														maxFontSizeMultiplier={CHROME_TYPE_CAP}
													>
														{rung.count.toLocaleString()}
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

				</ScrollView>
			</StackPage>
		</>
	);
}

const styles = StyleSheet.create({
	statsLine: { flexDirection: "row", alignItems: "baseline" },
	// paddingBottom is the stack scroll pad, set inline.
	content: {
		paddingHorizontal: PAGE_PAD,
		paddingTop: SPACE.sm,
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
	// The rung you're climbing toward: bright paper and the heavy outline, the
	// "current" mark. It used to share cream2 + the 2pt ink with every locked
	// rung, so only its text tone set it apart.
	rungNext: { backgroundColor: WHIMSY.paper, borderWidth: BORDER.heavy },
	rungBadge: {
		width: RUNG_BADGE_W,
		height: RUNG_BADGE_H,
		borderRadius: RADII.pill,
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
