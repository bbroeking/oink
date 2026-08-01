import { useCallback, useState } from "react";
import { RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { PageHeader } from "@/components/ui/PageHeader";
import { PrestigeAvatar } from "@/components/ui/PrestigeAvatar";
import { Glyph } from "@/components/ui/Glyph";
import { LoadingBeat } from "@/components/ui/EmptyState";
import { fetchPorchRound, groupPorchPages, type PorchStop } from "@/utils/porchRound";
import {
	PAGE_PAD,
	RADII,
	SHADOW_SM,
	SPACE,
	TAB_SAFE,
	TYPE,
	WHIMSY,
} from "@/constants/theme";

function visitDate(iso: string): string {
	return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function StopPanel({ stop }: { stop: PorchStop }) {
	return (
		<View testID="porch-stop" style={styles.stop}>
			<PrestigeAvatar
				size={58}
				hatId={stop.activeHatId}
				prestigeLevel={stop.wallowCount}
			/>
			<Text style={styles.stopName}>{stop.targetName}</Text>
			<Text style={styles.stopDate}>{visitDate(stop.visitedAt)}</Text>
		</View>
	);
}

export default function PorchRoundScreen() {
	const [stops, setStops] = useState<PorchStop[] | null>(null);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);

	const refresh = useCallback(async () => {
		const next = await fetchPorchRound();
		setStops(next ?? []);
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
							<View style={styles.intro}>
								<Glyph name="sparkles" size={20} />
								<Text style={styles.introText}>
									Every successful Barn visit belongs here. Three different pigs finish a page—no timer, streak, or prize attached.
								</Text>
							</View>

							{pages.length === 0 ? (
								<View style={styles.welcome}>
									<Text style={styles.welcomeKicker}>YOUR FIRST PAGE STARTS NATURALLY</Text>
									<Text style={styles.welcomeTitle}>Visit a friend when you feel like it.</Text>
									<Text style={styles.welcomeBody}>
										Their pig will appear here after the first tickle. Nothing is lost if you stop at one.
									</Text>
								</View>
							) : (
								pages.map((page) => (
									<View key={page.pageNumber} style={styles.page}>
										<View style={styles.pageHeading}>
											<View>
												<Text style={styles.pageKicker}>SCRAPBOOK PAGE {page.pageNumber}</Text>
												<Text style={styles.pageTitle}>
													{page.complete ? "A finished Porch Round" : "Visits worth keeping"}
												</Text>
											</View>
											{page.complete && <Glyph name="sparkle" size={22} />}
										</View>
										<View style={styles.panels}>
											{page.stops.map((stop) => <StopPanel key={stop.id} stop={stop} />)}
										</View>
										{!page.complete && (
											<Text style={styles.openNote}>
												{page.stops.length === 1
													? "This visit stands on its own. Two future friends can join it."
													: "These visits stand on their own. One future friend can join them."}
											</Text>
										)}
									</View>
								))
							)}
						</ScrollView>
					)}
				</SafeAreaView>
			</View>
		</>
	);
}

const styles = StyleSheet.create({
	bg: { flex: 1, backgroundColor: WHIMSY.cream },
	safe: { flex: 1 },
	loading: { flex: 1, alignItems: "center", justifyContent: "center" },
	scroll: { paddingHorizontal: PAGE_PAD, paddingBottom: TAB_SAFE + SPACE.xl },
	intro: {
		flexDirection: "row",
		gap: SPACE.sm,
		backgroundColor: WHIMSY.sun,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.lg,
		borderWidth: 1.5,
		padding: SPACE.md,
		marginBottom: SPACE.lg,
	},
	introText: { flex: 1, color: WHIMSY.ink, ...TYPE.body },
	welcome: {
		backgroundColor: WHIMSY.paper,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.xl,
		borderWidth: 1.5,
		padding: SPACE.lg,
		...SHADOW_SM,
	},
	welcomeKicker: { color: WHIMSY.mute, ...TYPE.kickerPill },
	welcomeTitle: { color: WHIMSY.ink, ...TYPE.sectionTitle, marginTop: SPACE.xs },
	welcomeBody: { color: WHIMSY.mute, ...TYPE.body, marginTop: SPACE.sm },
	page: {
		backgroundColor: WHIMSY.paper,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.xl,
		borderWidth: 1.5,
		padding: SPACE.md,
		marginBottom: SPACE.lg,
		...SHADOW_SM,
	},
	pageHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACE.md },
	pageKicker: { color: WHIMSY.mute, ...TYPE.kickerPill },
	pageTitle: { color: WHIMSY.ink, ...TYPE.cardTitle, marginTop: 2 },
	panels: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
	stop: {
		flexGrow: 1,
		flexBasis: 88,
		minWidth: 88,
		alignItems: "center",
		backgroundColor: WHIMSY.peach,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.md,
		borderWidth: 1,
		paddingHorizontal: SPACE.xs,
		paddingVertical: SPACE.sm,
	},
	stopName: { color: WHIMSY.ink, ...TYPE.bodySm, marginTop: 3, maxWidth: 92 },
	stopDate: { color: WHIMSY.mute, ...TYPE.kicker, marginTop: 1 },
	openNote: { color: WHIMSY.mute, ...TYPE.bodySm, marginTop: SPACE.sm },
});
