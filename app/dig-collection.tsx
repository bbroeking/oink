// The Burrow Book — a Pokédex-style shelf of the Season 1 unique relics. First
// catch lights an entry (full art + name + story); undiscovered entries show a
// near-black silhouette + "?". Feature-dark by design: fetchMyUniques() → null
// (table unmigrated / read failed) renders every entry undiscovered, never an
// error. Route/file is technical (dig-collection); player copy says "Burrow Book"
// / "relic". Standalone-page conventions mirror app/race-standings.tsx.

import { useEffect, useState } from "react";
import {
	View,
	Text,
	Image,
	StyleSheet,
	SafeAreaView,
	ScrollView,
} from "react-native";
import { Stack, router } from "expo-router";
import { PageHeader } from "../components/ui/PageHeader";
import { LoadingBeat } from "../components/ui/EmptyState";
import { UNIQUE_POOL, UNIQUE_IMAGES } from "@/constants/uniques";
import { fetchMyUniques, type MyUnique } from "@/utils/uniques";
import {
	FONTS,
	RADII,
	SHADOW_SM,
	SPACE,
	TYPE,
	WHIMSY,
	PAGE_PAD,
	TAB_SAFE,
} from "@/constants/theme";

export default function DigCollectionScreen() {
	// undefined = loading; null = feature-dark; else the caller's catches by id.
	const [mine, setMine] = useState<
		Record<string, MyUnique> | null | undefined
	>(undefined);

	useEffect(() => {
		let cancelled = false;
		fetchMyUniques().then((m) => {
			if (!cancelled) setMine(m ?? null);
		});
		return () => {
			cancelled = true;
		};
	}, []);

	const found = mine ?? {};
	const discoveredCount = UNIQUE_POOL.filter((u) => found[u.id]).length;

	return (
		<>
			<Stack.Screen options={{ headerShown: false }} />
			<View style={styles.bg}>
				<SafeAreaView style={{ flex: 1 }}>
					<PageHeader
						kicker="the truffle patch"
						title="The Burrow Book"
						onBack={() => router.back()}
					/>
					{mine === undefined ? (
						<View style={styles.loadingWrap}>
							<LoadingBeat label="dusting off the shelf" />
						</View>
					) : (
						<ScrollView
							contentContainerStyle={styles.scroll}
							showsVerticalScrollIndicator={false}
						>
							<View style={styles.grid}>
								{UNIQUE_POOL.map((u) => (
									<RelicCell key={u.id} def={u} mine={found[u.id] ?? null} />
								))}
							</View>
							<Text style={styles.caption}>
								found {discoveredCount} of {UNIQUE_POOL.length} — the shelf
								remembers
							</Text>
						</ScrollView>
					)}
				</SafeAreaView>
			</View>
		</>
	);
}

// One relic tile. Discovered: full art + name + story (+ ×N when a dupe).
// Undiscovered: a near-black silhouette of the art + "?" — you know the shape of
// the shelf, not what fills it.
function RelicCell({
	def,
	mine,
}: {
	def: { id: string; name: string; story: string };
	mine: MyUnique | null;
}) {
	const art = UNIQUE_IMAGES[def.id];
	const discovered = !!mine;
	return (
		<View style={styles.cell}>
			<View style={styles.artWrap}>
				{art ? (
					<Image
						source={art}
						style={[styles.art, !discovered && styles.artHidden]}
						resizeMode="contain"
					/>
				) : null}
				{!discovered && (
					<>
						{/* Fallback dark scrim (in case tintColor no-ops on new arch) + a
						    "?" so an undiscovered relic reads as a mystery, not a bug. */}
						<View style={styles.scrim} pointerEvents="none" />
						<Text style={styles.qmark}>?</Text>
					</>
				)}
			</View>
			{discovered ? (
				<>
					<Text style={styles.name} numberOfLines={2}>
						{def.name}
					</Text>
					{/* ★ per best gild ("The One That Got Away"): a relic you caught after
					    it got away comes back shinier — the stars mark how gilded. */}
					{mine.best_gild > 0 && (
						<Text style={styles.gild}>
							{"★".repeat(Math.min(3, mine.best_gild))}
						</Text>
					)}
					<Text style={styles.story} numberOfLines={3}>
						{def.story}
					</Text>
					{mine.found_count > 1 && (
						<Text style={styles.count}>found ×{mine.found_count}</Text>
					)}
				</>
			) : (
				<Text style={styles.nameHidden}>?</Text>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	bg: { flex: 1, backgroundColor: WHIMSY.cream },
	loadingWrap: { marginTop: SPACE.xl, alignItems: "center" },
	scroll: { paddingHorizontal: PAGE_PAD, paddingBottom: TAB_SAFE },
	grid: {
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "space-between",
		rowGap: SPACE.md,
	},
	// Three across — a hair under a third so the space-between gutter breathes.
	cell: {
		width: "31%",
		backgroundColor: WHIMSY.paper,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.md,
		padding: SPACE.sm,
		alignItems: "center",
		...SHADOW_SM,
	},
	artWrap: {
		width: "100%",
		aspectRatio: 1,
		alignItems: "center",
		justifyContent: "center",
		marginBottom: SPACE.xs,
	},
	art: { width: "82%", height: "82%" },
	// Near-black silhouette: tint the art to ink at reduced opacity.
	artHidden: { tintColor: WHIMSY.ink, opacity: 0.18 },
	scrim: {
		...StyleSheet.absoluteFillObject,
		opacity: 0, // the tint carries the silhouette; scrim is a belt-and-braces no-op
	},
	qmark: {
		position: "absolute",
		fontFamily: FONTS.whimsy,
		fontSize: 26,
		color: WHIMSY.mute,
	},
	name: {
		fontFamily: FONTS.whimsy,
		fontSize: 12,
		color: WHIMSY.ink,
		textAlign: "center",
	},
	nameHidden: {
		fontFamily: FONTS.whimsy,
		fontSize: 14,
		color: WHIMSY.muteSoft,
	},
	story: {
		fontFamily: FONTS.hand,
		fontSize: 11,
		color: WHIMSY.mute,
		textAlign: "center",
		marginTop: 2,
	},
	count: {
		fontFamily: FONTS.hand,
		fontSize: 11,
		color: WHIMSY.accent,
		marginTop: 2,
	},
	// The gild stars ("The One That Got Away") — sun-toned, above the story.
	gild: {
		fontSize: 12,
		color: WHIMSY.sun,
		marginTop: 1,
		letterSpacing: 1,
	},
	caption: {
		...TYPE.kicker,
		fontFamily: FONTS.hand,
		color: WHIMSY.mute,
		textAlign: "center",
		marginTop: SPACE.lg,
	},
});
