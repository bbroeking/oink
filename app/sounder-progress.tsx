// Your Sounder — the full referral page (reached via "Your sounder + rewards"
// on the Me tab). Shows every invited friend still on the way with their
// progress toward counting (100 tickles · 3 active days), and the full reward
// ladder (3 → 1000) with earned / next / locked states. Data: my_referral_summary.
import React, { useCallback, useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import {
	View,
	Text,
	StyleSheet,
	ScrollView,
	SafeAreaView,
	Pressable,
} from "react-native";
import { Stack, router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Sticker } from "../components/ui/Sticker";
import { Icon } from "../components/ui/Icon";
import { EmptyState } from "../components/ui/EmptyState";
import { FONTS, KICKER_PILL, RADII, SPACE, WHIMSY, PAGE_PAD, TAB_SAFE } from "@/constants/theme";
import {
	myReferralSummary,
	REFERRAL_LADDER,
	type ReferralSummary,
	type ReferralFriend,
} from "@/utils/referrals";

function FriendProgress({ friend }: { friend: ReferralFriend }) {
	const done = !!friend.completed;
	const tRatio = Math.max(0, Math.min(1, friend.tickles / 100));
	const dRatio = Math.max(0, Math.min(1, friend.active_days / 3));
	return (
		<View style={styles.friendRow}>
			<View style={styles.friendTop}>
				<Text style={styles.friendName} numberOfLines={1}>
					{friend.username ?? "a new pig"}
				</Text>
				{done ? (
					<View style={styles.friendDone}>
						<Icon name="check" size={12} color={WHIMSY.ink} strokeWidth={2.4} />
						<Text style={styles.friendDoneText}>counted</Text>
					</View>
				) : (
					<Text style={styles.friendProg}>
						{friend.tickles}/100 tickles · {friend.active_days}/3 days
					</Text>
				)}
			</View>
			{!done && (
				<View style={styles.friendBars}>
					<View style={styles.barTrack}>
						<View style={[styles.barFill, { width: `${tRatio * 100}%` }]} />
					</View>
					<View style={styles.barTrack}>
						<View style={[styles.barFill, { width: `${dRatio * 100}%` }]} />
					</View>
				</View>
			)}
		</View>
	);
}

export default function SounderProgressScreen() {
	const [summary, setSummary] = useState<ReferralSummary | null>(null);

	useFocusEffect(
		useCallback(() => {
			let cancelled = false;
			myReferralSummary().then((r) => {
				if (!cancelled && r && (r as ReferralSummary).ok) {
					setSummary(r as ReferralSummary);
				}
			});
			return () => {
				cancelled = true;
			};
		}, [])
	);

	const completed = summary?.referrals_completed ?? 0;
	const pending = summary?.pending_friends ?? [];

	return (
		<>
			<Stack.Screen options={{ headerShown: false }} />
			<View style={styles.bg}>
				<SafeAreaView style={{ flex: 1 }}>
					<PageHeader
						kicker="your sounder"
						title="Your Sounder"
						onBack={() => router.back()}
						below={
							<Text style={styles.statsLine}>
								<Text style={styles.statsStrong}>{completed} brought in</Text>
								{pending.length > 0 && (
									<Text style={styles.statsMute}>
										{"  ·  "}
										{pending.length} on the way
									</Text>
								)}
							</Text>
						}
					/>

					<ScrollView
						contentContainerStyle={styles.content}
						showsVerticalScrollIndicator={false}
					>
						{pending.length > 0 && (
							<Sticker color="rose" rotate={-0.5} radius={16} style={styles.card}>
								<Text style={styles.cardKicker}>★ on the way</Text>
								<Text style={styles.cardSub}>
									A friend counts once they hit 100 tickles AND play on 3
									separate days.
								</Text>
								<View style={styles.friendList}>
									{pending.map((f, i) => (
										<FriendProgress key={(f.username ?? "p") + i} friend={f} />
									))}
								</View>
							</Sticker>
						)}

						<Sticker color="cream" rotate={0.4} radius={16} style={styles.card}>
							<Text style={styles.cardKicker}>★ reward ladder</Text>
							<Text style={styles.cardSub}>
								Every completed referral also pays +100 snouts.
							</Text>
							<View style={styles.ladder}>
								{REFERRAL_LADDER.map((rung) => {
									const earned = completed >= rung.count;
									const isNext =
										!earned && summary?.next_milestone_at === rung.count;
									return (
										<View
											key={rung.count}
											style={[
												styles.rung,
												earned && styles.rungEarned,
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
														size={13}
														color={WHIMSY.ink}
														strokeWidth={2.4}
													/>
												) : (
													<Text style={styles.rungCount}>{rung.count}</Text>
												)}
											</View>
											<View style={{ flex: 1, minWidth: 0 }}>
												<Text
													style={[styles.rungReward, !earned && styles.rungLocked]}
												>
													{rung.reward}
												</Text>
												<Text style={styles.rungMeta}>
													{earned
														? "earned"
														: isNext
															? `${rung.count - completed} more to go`
															: `at ${rung.count} referrals`}
												</Text>
											</View>
										</View>
									);
								})}
							</View>
						</Sticker>

						{pending.length === 0 && completed === 0 && (
							<EmptyState
								glyph="friends"
								title="No sounder yet"
								sub="Share your code from the Me tab to start your sounder."
							/>
						)}
					</ScrollView>
				</SafeAreaView>
			</View>
		</>
	);
}

const styles = StyleSheet.create({
	bg: { flex: 1, backgroundColor: WHIMSY.cream },
	statsLine: { fontSize: 13 },
	statsStrong: { fontFamily: FONTS.bodyExtra, fontSize: 13, color: WHIMSY.ink },
	statsMute: { fontFamily: FONTS.hand, fontSize: 13, color: WHIMSY.mute },
	content: { paddingHorizontal: PAGE_PAD, paddingTop: SPACE.sm, paddingBottom: TAB_SAFE, gap: 14 },
	card: { padding: SPACE.lg },
	cardKicker: {
		...KICKER_PILL,
		marginBottom: 4,
	},
	cardSub: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.mute,
		lineHeight: 17,
		marginBottom: SPACE.md,
	},
	friendList: { gap: SPACE.md },
	friendRow: { gap: 5 },
	friendTop: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	friendName: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 14,
		color: WHIMSY.ink,
		flex: 1,
		minWidth: 0,
	},
	friendProg: { fontFamily: FONTS.hand, fontSize: 12, color: WHIMSY.mute, marginLeft: 8 },
	friendDone: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: 8 },
	friendDoneText: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		color: WHIMSY.ink,
		letterSpacing: 0.3,
	},
	friendBars: { flexDirection: "row", gap: 6 },
	barTrack: {
		flex: 1,
		height: 7,
		borderRadius: 4,
		backgroundColor: WHIMSY.cream2,
		borderWidth: 1,
		borderColor: WHIMSY.ink,
		overflow: "hidden",
	},
	barFill: { height: "100%", backgroundColor: WHIMSY.angel },
	ladder: { gap: 9 },
	rung: {
		flexDirection: "row",
		alignItems: "center",
		gap: 11,
		padding: 10,
		borderRadius: RADII.md,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.paper,
		opacity: 0.55,
	},
	rungEarned: { opacity: 1, backgroundColor: WHIMSY.paper },
	rungNext: { opacity: 1, backgroundColor: WHIMSY.cream2, borderWidth: 2 },
	rungBadge: {
		width: 30,
		height: 30,
		borderRadius: 15,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.cream,
		alignItems: "center",
		justifyContent: "center",
	},
	rungBadgeEarned: { backgroundColor: WHIMSY.sun },
	rungCount: { fontFamily: FONTS.whimsy, fontSize: 13, color: WHIMSY.ink },
	rungReward: { fontFamily: FONTS.bodyExtra, fontSize: 13, color: WHIMSY.ink },
	rungLocked: { color: WHIMSY.mute },
	rungMeta: { fontFamily: FONTS.hand, fontSize: 11, color: WHIMSY.mute, marginTop: 1 },
});
