// The discovery home — two shelves that share one screen (route dig-collection).
//
// Shelf 1, the BURROW BOOK: the seasonal Pokédex of Season-1 unique relics.
// First catch lights an entry (full art + name + story); undiscovered entries
// show a near-black silhouette + "?". Feature-dark by design: fetchMyUniques() →
// null renders every entry undiscovered, never an error.
//
// Shelf 2, the FIELD GUIDE (spec 16): the evergreen journal of the game's
// economy objects. Each page is a silhouette until the player first MEETS the
// thing; an unlocked page shows its art + a whimsy line + a config-fed value
// line. Fail-soft: fetchFieldGuideUnlocks() reconciles a local AsyncStorage
// mirror with the server, so it works against today's prod schema.
//
// Route/file is technical (dig-collection); player copy says "Burrow Book" /
// "Field Guide". Standalone-page conventions mirror app/race-standings.tsx.

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
import { SectionHeader } from "../components/ui/SectionHeader";
import { Glyph } from "../components/ui/Glyph";
import { LoadingBeat } from "../components/ui/EmptyState";
import { UNIQUE_POOL, UNIQUE_IMAGES } from "@/constants/uniques";
import { fetchMyUniques, type MyUnique } from "@/utils/uniques";
import { FIELD_GUIDE_ENTRIES, type FieldGuideEntry } from "@/constants/fieldGuide";
import {
	fetchFieldGuideUnlocks,
	hydrateFieldGuideCache,
	type FieldGuidePageId,
} from "@/utils/fieldGuide";
import {
	fieldGuideNumbers,
	refreshFieldGuideNumbers,
} from "@/utils/fieldGuideConfig";
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
	// The set of Field Guide pages the player has met (shelf order).
	const [guide, setGuide] = useState<Set<FieldGuidePageId>>(new Set());

	useEffect(() => {
		let cancelled = false;
		fetchMyUniques().then((m) => {
			if (!cancelled) setMine(m ?? null);
		});
		// Field Guide: hydrate the local mirror, freshen the value-line numbers,
		// then reconcile with the server. All fail-soft.
		(async () => {
			await hydrateFieldGuideCache();
			refreshFieldGuideNumbers().catch(() => {});
			const pages = await fetchFieldGuideUnlocks();
			if (!cancelled) setGuide(new Set(pages));
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	const found = mine ?? {};
	const discoveredCount = UNIQUE_POOL.filter((u) => found[u.id]).length;
	const metCount = FIELD_GUIDE_ENTRIES.filter((e) => guide.has(e.id)).length;

	return (
		<>
			<Stack.Screen options={{ headerShown: false }} />
			<View style={styles.bg}>
				<SafeAreaView style={{ flex: 1 }}>
					<PageHeader
						kicker="the truffle patch"
						title="The Collection"
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
							{/* ── Shelf 1: the Burrow Book (seasonal) ─────────────────── */}
							<SectionHeader
								kicker="season 1 relics"
								title="The Burrow Book"
								right={`${discoveredCount}/${UNIQUE_POOL.length}`}
							/>
							<View style={styles.grid}>
								{UNIQUE_POOL.map((u) => (
									<RelicCell key={u.id} def={u} mine={found[u.id] ?? null} />
								))}
							</View>
							<Text style={styles.caption}>
								found {discoveredCount} of {UNIQUE_POOL.length} — the shelf
								remembers
							</Text>

							{/* ── Shelf 2: the Field Guide (evergreen) ────────────────── */}
							<SectionHeader
								kicker="the economy, discovered"
								title="The Field Guide"
								right={`${metCount}/${FIELD_GUIDE_ENTRIES.length}`}
								style={styles.guideHeader}
							/>
							<View style={styles.guideList}>
								{FIELD_GUIDE_ENTRIES.map((e) => (
									<FieldGuideRow key={e.id} entry={e} met={guide.has(e.id)} />
								))}
							</View>
							<Text style={styles.caption}>
								a journal, not a manual — pages light when you meet the thing
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

// One Field Guide page — a journal row (art well left, copy right). Met: art +
// name + whimsy line + config-fed value line. Not-yet-met: an ink silhouette
// well + a muted "not yet met" whisper (a mystery, never a bug).
function FieldGuideRow({ entry, met }: { entry: FieldGuideEntry; met: boolean }) {
	return (
		<View style={styles.guideRow}>
			<View style={styles.guideWell}>
				{met ? (
					entry.image ? (
						<Image
							source={entry.image}
							style={styles.guideArt}
							resizeMode="contain"
						/>
					) : entry.glyph ? (
						<Glyph name={entry.glyph} size={40} />
					) : (
						// Drawn ink-silhouette placeholder (no sprite yet — see art-todo).
						<View style={styles.guidePlaceholder} />
					)
				) : (
					<>
						<View style={styles.guideSilhouette} pointerEvents="none" />
						<Text style={styles.guideQmark}>?</Text>
					</>
				)}
			</View>
			<View style={styles.guideCopy}>
				{met ? (
					<>
						<Text style={styles.guideName}>{entry.name}</Text>
						<Text style={styles.guideWhimsy}>{entry.whimsy}</Text>
						<Text style={styles.guideValue}>
							{entry.value(fieldGuideNumbers())}
						</Text>
					</>
				) : (
					<>
						<Text style={styles.guideNameHidden}>???</Text>
						<Text style={styles.guideWhimsyHidden}>
							a page you haven't met yet
						</Text>
					</>
				)}
			</View>
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
	// ── Field Guide shelf ─────────────────────────────────────────────────────
	guideHeader: { marginTop: SPACE.xl },
	guideList: { rowGap: SPACE.md },
	guideRow: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: WHIMSY.paper,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.md,
		padding: SPACE.sm,
		...SHADOW_SM,
	},
	guideWell: {
		width: 64,
		height: 64,
		borderRadius: RADII.sm,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.cream,
		alignItems: "center",
		justifyContent: "center",
		marginRight: SPACE.md,
	},
	guideArt: { width: 48, height: 48 },
	guidePlaceholder: {
		width: 40,
		height: 40,
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.ink,
		opacity: 0.18,
	},
	guideSilhouette: {
		width: 40,
		height: 40,
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.ink,
		opacity: 0.12,
	},
	guideQmark: {
		position: "absolute",
		fontFamily: FONTS.whimsy,
		fontSize: 22,
		color: WHIMSY.muteSoft,
	},
	guideCopy: { flex: 1 },
	guideName: {
		fontFamily: FONTS.whimsy,
		fontSize: 16,
		color: WHIMSY.ink,
	},
	guideWhimsy: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		lineHeight: 18,
		color: WHIMSY.mute,
		marginTop: 1,
	},
	guideValue: {
		...TYPE.bodySm,
		color: WHIMSY.ink,
		marginTop: SPACE.xs,
	},
	guideNameHidden: {
		fontFamily: FONTS.whimsy,
		fontSize: 16,
		color: WHIMSY.muteSoft,
	},
	guideWhimsyHidden: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.muteSoft,
		marginTop: 1,
	},
});
