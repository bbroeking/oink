import { useCallback, useState } from "react";
import { RefreshControl, SafeAreaView, ScrollView, StyleSheet, View } from "react-native";
import { Stack, router } from "expo-router";
import { useFocusEffect } from "expo-router/react-navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { PrestigeAvatar } from "@/components/ui/PrestigeAvatar";
import { Glyph } from "@/components/ui/Glyph";
import { Sticker } from "@/components/ui/Sticker";
import { Button } from "@/components/ui/Button";
import { EmptyState, LoadingBeat } from "@/components/ui/EmptyState";
import { Body, CardTitle, KickerPill, T } from "@/components/ui/Text";
import { UserSheet } from "@/components/UserSheet";
import { fetchPorchRound, groupPorchPages, type PorchStop, PORCH_PAGE_SIZE } from "@/utils/porchRound";
import {
	ART_SIZE,
	BORDER,
	PAGE_PAD,
	RADII,
	SPACE,
	TAB_SAFE,
	WHIMSY,
} from "@/constants/theme";

// Three friendly doorsteps finish a scrapbook page. `utils/porchRound.ts`
// hard-codes the same 3 in `groupPorchPages`; it belongs there, but that file
// is outside this pass.

// A stop panel's own geometry — the width a pig portrait plus a name needs
// before the row wraps. Drawing, not spacing.
const STOP_MIN_W = 88;
const STOP_NAME_MAX_W = 92;
const STOP_PORTRAIT = 58;

function visitDate(iso: string): string {
	return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// B-16 (2026-09-11, wave 4): a `PrestigeAvatar` + username is the composition
// the app uses everywhere for "tap to open this pig's page" — CrewRow, Friends,
// the Leaderboard. This panel drew it and swallowed the tap. It is now the
// door it looks like: the stop opens `UserSheet`, where the player can bless,
// befriend or walk back over to that Barn. Serves **Connect** directly — the
// scrapbook of who you visited becomes a way to visit them again, which is the
// whole point of keeping it.
function StopPanel({ stop, onPress }: { stop: PorchStop; onPress: () => void }) {
	return (
		<Sticker
			testID="porch-stop"
			color="peach"
			rotate={0}
			radius={RADII.md}
			border={BORDER.hair}
			shadow="none"
			onPress={onPress}
			accessibilityLabel={`${stop.targetName}, visited ${visitDate(stop.visitedAt)}`}
			accessibilityHint="Opens this pig's page"
			style={styles.stop}
		>
			<PrestigeAvatar
				size={STOP_PORTRAIT}
				hatId={stop.activeHatId}
				prestigeLevel={stop.wallowCount}
			/>
			<T role="bodySm" style={styles.stopName}>
				{stop.targetName}
			</T>
			<T role="kicker" tone="secondary" style={styles.stopDate}>
				{visitDate(stop.visitedAt)}
			</T>
		</Sticker>
	);
}

export default function PorchRoundScreen() {
	const [stops, setStops] = useState<PorchStop[] | null>(null);
	const [loading, setLoading] = useState(true);
	// A read that never came back is "unknown", not "you have no visits" — the
	// welcome copy over a failed fetch was a lie about the player's own
	// scrapbook. [B-14]
	const [failed, setFailed] = useState(false);
	const [refreshing, setRefreshing] = useState(false);
	// The open profile door. `null` closes the sheet. [B-16]
	const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

	const refresh = useCallback(async () => {
		const next = await fetchPorchRound();
		setStops(next);
		setFailed(next == null);
		setLoading(false);
		setRefreshing(false);
	}, []);

	useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
	const pages = groupPorchPages(stops ?? []);

	return (
		<>
			<Stack.Screen options={{ headerShown: false }} />
			<View style={styles.bg}>
				<SafeAreaView style={styles.safe}>
					<PageHeader kicker="three friendly doorsteps" title="Porch Round" onBack={() => router.back()} />
					{loading ? (
						<View style={styles.loading}><LoadingBeat label="opening your scrapbook" /></View>
					) : (
						<ScrollView
							contentContainerStyle={styles.scroll}
							showsVerticalScrollIndicator={false}
							refreshControl={
								<RefreshControl
									refreshing={refreshing}
									onRefresh={() => { setRefreshing(true); void refresh(); }}
								/>
							}
						>
							<Sticker
								color="sun"
								rotate={0}
								radius={RADII.lg}
								border={BORDER.thin}
								shadow="none"
								style={styles.intro}
							>
								<Glyph name="barn" size={ART_SIZE.glyphSm} />
								<Body style={styles.introText}>
									Every successful Barn visit belongs here. {PORCH_PAGE_SIZE} different pigs finish a page—no timer, streak, or prize attached.
								</Body>
							</Sticker>

							{failed ? (
								<EmptyState
									kind="error"
									sub="Your scrapbook didn't come back this time."
									action={
										<Button
											variant="ghost"
											size="sm"
											onPress={() => { setLoading(true); void refresh(); }}
											accessibilityHint="Asks for your scrapbook again"
										>
											Try again
										</Button>
									}
								/>
							) : pages.length === 0 ? (
								<EmptyState
									glyph="barn"
									title="Visit a friend when you feel like it."
									sub="Their pig will appear here after the first tickle. Nothing is lost if you stop at one."
								/>
							) : (
								pages.map((page) => (
									<Sticker
										key={page.pageNumber}
										color="paper"
										rotate={0}
										radius={RADII.xl}
										border={BORDER.thin}
										shadow="sm"
										style={styles.page}
									>
										<View style={styles.pageHeading}>
											<View>
												<KickerPill tone="secondary" star={false}>
													Scrapbook page {page.pageNumber}
												</KickerPill>
												<CardTitle style={styles.pageTitle}>
													{page.complete ? "A finished Porch Round" : "Visits worth keeping"}
												</CardTitle>
											</View>
											{page.complete && <Glyph name="sparkle" size={ART_SIZE.glyphSm} />}
										</View>
										<View style={styles.panels}>
											{page.stops.map((stop) => (
												<StopPanel
													key={stop.id}
													stop={stop}
													onPress={() => setSelectedUserId(stop.targetUserId)}
												/>
											))}
										</View>
										{!page.complete && (
											<T role="bodySm" tone="secondary" style={styles.openNote}>
												{page.stops.length === 1
													? "This visit stands on its own. Two future friends can join it."
													: "These visits stand on their own. One future friend can join them."}
											</T>
										)}
									</Sticker>
								))
							)}
						</ScrollView>
					)}
				</SafeAreaView>
			</View>

			{/* The one door for a pig's page. A new visit can add a stop, so the
			    scrapbook re-reads when the sheet closes on a friendship change. */}
			<UserSheet
				targetUserId={selectedUserId}
				onDismiss={() => setSelectedUserId(null)}
				onFriendshipChanged={() => void refresh()}
			/>
		</>
	);
}

const styles = StyleSheet.create({
	bg: { flex: 1, backgroundColor: WHIMSY.cream },
	safe: { flex: 1 },
	loading: { flex: 1, alignItems: "center", justifyContent: "center" },
	scroll: { paddingHorizontal: PAGE_PAD, paddingBottom: TAB_SAFE },
	intro: {
		flexDirection: "row",
		gap: SPACE.sm,
		padding: SPACE.md,
		marginBottom: SPACE.lg,
	},
	introText: { flex: 1 },
	page: {
		padding: SPACE.md,
		marginBottom: SPACE.lg,
	},
	pageHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACE.md },
	pageTitle: { marginTop: SPACE.xxs },
	panels: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
	stop: {
		flexGrow: 1,
		flexBasis: STOP_MIN_W,
		minWidth: STOP_MIN_W,
		alignItems: "center",
		paddingHorizontal: SPACE.xs,
		paddingVertical: SPACE.sm,
	},
	stopName: { marginTop: SPACE.xxs, maxWidth: STOP_NAME_MAX_W },
	stopDate: { marginTop: SPACE.xxs },
	openNote: { marginTop: SPACE.sm },
});
