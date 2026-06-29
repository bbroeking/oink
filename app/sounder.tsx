// The Sounder leaderboard — top recruiters across the app. Reachable
// from Account's "Your sounder" card. Mirrors the regular leaderboard's
// visual language so it feels native.
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
import { Stack, router, Redirect } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { rpc } from "@/utils/rpc";
import { Sticker } from "../components/ui/Sticker";
import { EmptyState, LoadingBeat } from "../components/ui/EmptyState";
import { FONTS, ROW_TILTS, WHIMSY } from "@/constants/theme";
import { SOUNDER_VISIBLE } from "@/constants/featureFlags";

interface SounderRow {
	rank: number;
	user_id: string;
	username: string | null;
	discriminator: string | null;
	engaged_count: number;
	active_title_id: string | null;
	is_self: boolean;
}

export default function SounderScreen() {
	const [rows, setRows] = useState<SounderRow[]>([]);
	const [loading, setLoading] = useState(true);

	useFocusEffect(
		useCallback(() => {
			// Sounder UI is hidden — skip the fetch while the flag is
			// off; the redirect below bounces the user out anyway.
			if (!SOUNDER_VISIBLE) return;
			rpc<SounderRow[]>("sounder_leaderboard", { limit_n: 50 }).then((data) => {
				setRows(data ?? []);
				setLoading(false);
			});
		}, [])
	);

	// Hooks above run unconditionally (rules-of-hooks); the gate is
	// here, after all hooks. If a stale deep-link lands here while
	// the Sounder is hidden, bounce back to the home tab.
	if (!SOUNDER_VISIBLE) {
		return <Redirect href="/" />;
	}

	const champ = rows[0];
	const rest = rows.slice(1);

	return (
		<>
			<Stack.Screen options={{ headerShown: false }} />
			<View style={styles.bg}>
				<SafeAreaView style={{ flex: 1 }}>
					<PageHeader
						kicker="top recruiters"
						title="The Sounder"
						onBack={() => router.back()}
					/>

					<ScrollView
						style={{ flex: 1 }}
						contentContainerStyle={styles.list}
						showsVerticalScrollIndicator={false}
					>
						{loading && <LoadingBeat label="gathering the sounder" />}
						{!loading && rows.length === 0 && (
							<EmptyState
								glyph="friends"
								title="The Sounder's empty"
								sub="Be the first to bring a friend in."
							/>
						)}

						{champ && (
							<Sticker
								color="rose"
								rotate={-1.5}
								radius={18}
								border={2.5}
								style={styles.champ}
							>
								<Text style={styles.champKicker}>★ sounder sire ★</Text>
								<View style={styles.champRow}>
									<View style={{ flex: 1, minWidth: 0 }}>
										<Text
											style={styles.champName}
											numberOfLines={1}
											adjustsFontSizeToFit
											minimumFontScale={0.6}
										>
											{champ.username ?? "—"}
											{champ.is_self && (
												<Text style={styles.youTag}> · you</Text>
											)}
										</Text>
										<Text style={styles.champCount}>
											{champ.engaged_count}{" "}
											{champ.engaged_count === 1 ? "pig" : "pigs"} brought in
										</Text>
									</View>
									<View style={styles.bigOne}>
										<Text style={styles.bigOneText}>1</Text>
									</View>
								</View>
							</Sticker>
						)}

						{rest.map((r, i) => (
							<Sticker
								key={r.user_id}
								color={r.is_self ? "rose" : "paper"}
								rotate={ROW_TILTS[i % ROW_TILTS.length]}
								radius={10}
								style={styles.row}
							>
								<Text style={styles.rowRank}>#{r.rank}</Text>
								<View style={{ flex: 1, minWidth: 0, marginLeft: 8 }}>
									<Text
										style={styles.rowName}
										numberOfLines={1}
										adjustsFontSizeToFit
										minimumFontScale={0.6}
									>
										{r.username ?? "—"}
										{r.is_self && (
											<Text style={styles.youTag}> · you</Text>
										)}
									</Text>
								</View>
								<Text style={styles.rowCount}>
									{r.engaged_count}
								</Text>
							</Sticker>
						))}
					</ScrollView>
				</SafeAreaView>
			</View>
		</>
	);
}

const styles = StyleSheet.create({
	bg: { flex: 1, backgroundColor: WHIMSY.cream },
	list: { padding: 18, gap: 10 },
	champ: { paddingHorizontal: 18, paddingVertical: 16, marginBottom: 4 },
	champKicker: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 12,
		color: WHIMSY.accent,
		letterSpacing: 1.6,
		marginBottom: 6,
	},
	champRow: { flexDirection: "row", alignItems: "center" },
	champName: {
		fontFamily: FONTS.whimsy,
		fontSize: 22,
		color: WHIMSY.ink,
	},
	champCount: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.mute,
		marginTop: 2,
	},
	bigOne: {
		width: 44,
		height: 44,
		borderRadius: 22,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: WHIMSY.lilac,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		marginLeft: 10,
	},
	bigOneText: {
		fontFamily: FONTS.whimsy,
		fontSize: 22,
		color: WHIMSY.ink,
	},
	row: {
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: 10,
		paddingHorizontal: 14,
		gap: 6,
	},
	rowRank: {
		width: 36,
		fontFamily: FONTS.whimsy,
		fontSize: 15,
		color: WHIMSY.mute,
	},
	rowName: {
		fontFamily: FONTS.whimsy,
		fontSize: 14,
		color: WHIMSY.ink,
	},
	rowCount: {
		fontFamily: FONTS.whimsy,
		fontSize: 16,
		color: WHIMSY.ink,
		minWidth: 28,
		textAlign: "right",
	},
	youTag: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.accent,
	},
});
