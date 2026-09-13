// The recruiter leaderboard — top referrers across the app. Reachable
// from the "Refer friends" card's downline strip on the Me page. Mirrors
// the regular leaderboard's visual language so it feels native.
//
// Header is titled "Your Recruits" (kicker "refer friends"), NOT "The
// Sounder" — the player-facing word "Sounder" was reclaimed for the war
// crew, so the referral downline surface can't wear it.
//
// B-15 (2026-09-11, wave 4): the ROUTE now matches that ruling too. This file
// was `app/sounder.tsx` (with `app/sounder-progress.tsx` beside it) while
// `?seg=sounder` on the Friends hub meant the CREW — one identifier, two
// products, so a deep link to `/sounder` landed on referrals and a deep link
// to the crew did not. The routes are `/recruits` and `/recruits-progress`;
// `sounder` is the crew's word in code as well as on screen.
//
// B-16: a ranked username is a `UserSheet` door here, exactly as it is on the
// Leaderboard and in Friends — the app has taught the player that a pig's name
// in a ranked row opens their page, and a recruit is someone you already know.
// Serves **Connect**: the board is now a way back to the friends you brought in.
import React, { useCallback, useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { StackPage } from "../components/ui/StackPage";
import { View, StyleSheet, ScrollView } from "react-native";
import { router } from "expo-router";
import { useFocusEffect } from "expo-router/react-navigation";
import { rpc } from "@/utils/rpc";
import { Sticker } from "../components/ui/Sticker";
import { ListRow } from "../components/ui/ListRow";
import { Button } from "../components/ui/Button";
import { EmptyState, LoadingBeat } from "../components/ui/EmptyState";
import { KickerPill, SectionTitle, T } from "../components/ui/Text";
import { UserSheet } from "../components/UserSheet";
import {
	BORDER,
	PAGE_PAD,
	RADII,
	SPACE,
	TAP_MIN,
	UI_COLORS,
	WHIMSY,
} from "@/constants/theme";

interface SounderRow {
	rank: number;
	user_id: string;
	username: string | null;
	discriminator: string | null;
	engaged_count: number;
	active_title_id: string | null;
	is_self: boolean;
}

// The champion's count medallion — a 44pt lilac disc. Drawing geometry (a
// drawn coin), not a spacing step, so it is named here.
const MEDALLION = TAP_MIN;
// The rank column: wide enough for "#50" without the name jumping row to row.
const RANK_COL = 36;

export default function SounderScreen() {
	// `null` = we haven't heard back (or the read failed); `[]` = nobody has
	// recruited yet. Only the second is an empty state. [B-14]
	const [rows, setRows] = useState<SounderRow[] | null>(null);
	const [loading, setLoading] = useState(true);
	// The open profile door. `null` closes the sheet. [B-16]
	const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

	const load = useCallback(() => {
		setLoading(true);
		rpc<SounderRow[]>("sounder_leaderboard", { limit_n: 50 }).then((data) => {
			setRows(data ?? null);
			setLoading(false);
		});
	}, []);

	useFocusEffect(
		useCallback(() => {
			load();
		}, [load])
	);

	const champ = rows?.[0];
	const rest = rows?.slice(1) ?? [];

	return (
		<>
			<StackPage>
				<PageHeader
					kicker="refer friends"
					title="Your Recruits"
					onBack={() => router.back()}
				/>

				<ScrollView
					style={styles.scroll}
					contentContainerStyle={styles.list}
					showsVerticalScrollIndicator={false}
				>
					{loading && <LoadingBeat label="gathering your recruits" />}
					{!loading && rows === null && (
						<EmptyState
							kind="error"
							sub="The recruit board didn't come back."
							action={
								<Button
									variant="ghost"
									size="sm"
									onPress={load}
									accessibilityHint="Asks the board again"
								>
									Try again
								</Button>
							}
						/>
					)}
					{!loading && rows?.length === 0 && (
						<EmptyState
							glyph="friends"
							title="No recruits yet"
							sub="Be the first to bring a friend in."
						/>
					)}

					{champ && (
						<Sticker
							color="rose"
							rotate={-1.5}
							radius={RADII.xl}
							border={BORDER.heavy}
							onPress={() => setSelectedUserId(champ.user_id)}
							accessibilityLabel={`Top recruiter ${champ.username ?? "unknown pig"}${
								champ.is_self ? ", you" : ""
							}, ${champ.engaged_count} brought in`}
							accessibilityHint="Opens this pig's page"
							style={styles.champ}
						>
							<KickerPill tone="accent" style={styles.champKicker}>
								top recruiter
							</KickerPill>
							<View style={styles.champRow}>
								<View style={styles.champBody}>
									<SectionTitle numberOfLines={2}>
										{champ.username ?? "—"}
										{champ.is_self && (
											<T role="kicker" tone="accent">
												{" "}
												· you
											</T>
										)}
									</SectionTitle>
									<T role="kicker" tone="secondary" style={styles.champCount}>
										{champ.engaged_count === 1 ? "pig" : "pigs"} brought in
									</T>
								</View>
								{/* The big number is the COUNT (the board's one metric),
								    matching the rows' right-hand numbers — rank is already
								    told by the kicker. It briefly showed rank ("1") here,
								    which read as a count in the count position. */}
								<View style={styles.medallion}>
									<SectionTitle>{champ.engaged_count}</SectionTitle>
								</View>
							</View>
						</Sticker>
					)}

					{rest.map((r, i) => (
						<ListRow
							key={r.user_id}
							index={i}
							fill={r.is_self ? "rose" : "paper"}
							leading={
								<T role="numeral" tone="secondary" style={styles.rowRank}>
									#{r.rank}
								</T>
							}
							title={
								<T role="cardTitleSm" numberOfLines={2}>
									{r.username ?? "—"}
									{r.is_self && (
										<T role="kicker" tone="accent">
											{" "}
											· you
										</T>
									)}
								</T>
							}
							trailing={
								<T role="numeral" style={styles.rowCount}>
									{r.engaged_count}
								</T>
							}
							onPress={() => setSelectedUserId(r.user_id)}
							accessibilityLabel={`Rank ${r.rank}, ${r.username ?? "unknown pig"}${
								r.is_self ? ", you" : ""
							}, ${r.engaged_count} brought in`}
							accessibilityHint="Opens this pig's page"
						/>
					))}
				</ScrollView>
			</StackPage>

			{/* The one door for a pig's page — bless, visit, befriend, block. A
			    friendship change can reorder the board, so re-read on dismiss. */}
			<UserSheet
				targetUserId={selectedUserId}
				onDismiss={() => setSelectedUserId(null)}
				onFriendshipChanged={load}
			/>
		</>
	);
}

const styles = StyleSheet.create({
	scroll: { flex: 1 },
	list: { padding: PAGE_PAD, gap: SPACE.sm },
	champ: { paddingHorizontal: PAGE_PAD, paddingVertical: SPACE.lg, marginBottom: SPACE.xs },
	champKicker: { marginBottom: SPACE.xs },
	champRow: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
	champBody: { flex: 1, minWidth: 0 },
	champCount: { marginTop: SPACE.xxs },
	medallion: {
		width: MEDALLION,
		height: MEDALLION,
		borderRadius: MEDALLION / 2,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: WHIMSY.lilac,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
	},
	rowRank: { width: RANK_COL },
	rowCount: { textAlign: "right" },
});
