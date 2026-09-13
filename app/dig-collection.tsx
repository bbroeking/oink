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
	Image,
	StyleSheet,
	ScrollView,
} from "react-native";
import { router } from "expo-router";
import { PageHeader } from "../components/ui/PageHeader";
import { StackPage } from "../components/ui/StackPage";
import { SectionHeader } from "../components/ui/SectionHeader";
import { Glyph } from "../components/ui/Glyph";
import { LoadingBeat } from "../components/ui/EmptyState";
import { Sticker } from "../components/ui/Sticker";
import { ListRow } from "../components/ui/ListRow";
import { T } from "../components/ui/Text";
import { UNIQUE_POOL, UNIQUE_IMAGES } from "@/constants/uniques";
import { fetchMyUniques, type MyUnique } from "@/utils/uniques";
import { FIELD_GUIDE_ENTRIES, type FieldGuideEntry } from "@/constants/fieldGuide";
import {
	fetchFieldGuideUnlocks,
	hydrateFieldGuideCache,
	type FieldGuidePageId,
} from "@/utils/fieldGuide";
import {
	ensureFieldGuideNumbersFresh,
	fieldGuideNumbers,
} from "@/utils/fieldGuideConfig";
import {
	ART_SIZE,
	BORDER,
	RADII,
	ROW_TILTS,
	SPACE,
	WHIMSY,
	PAGE_PAD,
	TAB_SAFE,
} from "@/constants/theme";

// The two silhouette veils. Neither is an OPACITY step: the ladder's faintest
// rung is 0.3, which reads as "dimmed control", and these are ink GHOSTS — dark
// enough to show a shape, faint enough to stay a mystery. Named here, once, so
// the shelf and the guide can't drift apart. (See System asks.)
const RELIC_GHOST = 0.18;
const GUIDE_GHOST = 0.12;

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
			ensureFieldGuideNumbersFresh();
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
			<StackPage>
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
							{UNIQUE_POOL.map((u, i) => (
								<RelicCell
									key={u.id}
									index={i}
									def={u}
									mine={found[u.id] ?? null}
								/>
							))}
						</View>
						<T
							role="kicker"
							tone="secondary"
							align="center"
							style={styles.caption}
						>
							found {discoveredCount} of {UNIQUE_POOL.length} — the shelf
							remembers
						</T>

						{/* ── Shelf 2: the Field Guide (evergreen) ────────────────── */}
						<SectionHeader
							kicker="the economy, discovered"
							title="The Field Guide"
							right={`${metCount}/${FIELD_GUIDE_ENTRIES.length}`}
							style={styles.guideHeader}
						/>
						<View style={styles.guideList}>
							{FIELD_GUIDE_ENTRIES.map((e, i) => (
								<FieldGuideRow
									key={e.id}
									index={i}
									entry={e}
									met={guide.has(e.id)}
								/>
							))}
						</View>
						<T
							role="kicker"
							tone="secondary"
							align="center"
							style={styles.caption}
						>
							a journal, not a manual — pages light when you meet the thing
						</T>
					</ScrollView>
				)}
			</StackPage>
		</>
	);
}

// One relic tile. Discovered: full art + name + story (+ ×N when a dupe).
// Undiscovered: a near-black silhouette of the art + "?" — you know the shape of
// the shelf, not what fills it.
function RelicCell({
	def,
	mine,
	index,
}: {
	def: { id: string; name: string; story: string };
	mine: MyUnique | null;
	index: number;
}) {
	const art = UNIQUE_IMAGES[def.id];
	const discovered = !!mine;
	return (
		<Sticker
			color="paper"
			radius={RADII.md}
			shadow="sm"
			rotate={ROW_TILTS[index % ROW_TILTS.length]}
			accessibilityLabel={
				discovered ? def.name : "An undiscovered relic"
			}
			style={styles.cell}
		>
			<View style={styles.artWrap}>
				{art ? (
					<Image
						source={art}
						style={[styles.art, !discovered && styles.artHidden]}
						resizeMode="contain"
					/>
				) : null}
				{/* A "?" over the ink ghost, so an undiscovered relic reads as a
				    mystery rather than as a bug. */}
				{!discovered && (
					<T role="pageTitle" tone="secondary" style={styles.qmark}>
						?
					</T>
				)}
			</View>
			{discovered ? (
				<>
					<T role="cardTitleSm" align="center" numberOfLines={2}>
						{def.name}
					</T>
					{/* ★ per best gild ("The One That Got Away"): a relic you caught after
					    it got away comes back shinier — the stars mark how gilded. */}
					{mine.best_gild > 0 && (
						<T role="kickerPillSm" style={styles.gild}>
							{"★".repeat(Math.min(3, mine.best_gild))}
						</T>
					)}
					<T
						role="kicker"
						tone="secondary"
						align="center"
						numberOfLines={3}
						style={styles.story}
					>
						{def.story}
					</T>
					{mine.found_count > 1 && (
						<T role="kicker" tone="accent" style={styles.story}>
							found ×{mine.found_count}
						</T>
					)}
				</>
			) : (
				<T role="cardTitleSm" tone="secondary">
					?
				</T>
			)}
		</Sticker>
	);
}

// One Field Guide page — a journal row (art well left, copy right). Met: art +
// name + whimsy line + config-fed value line. Not-yet-met: an ink silhouette
// well + a muted "not yet met" whisper (a mystery, never a bug).
function FieldGuideRow({
	entry,
	met,
	index,
}: {
	entry: FieldGuideEntry;
	met: boolean;
	index: number;
}) {
	return (
		<ListRow
			index={index}
			accessibilityLabel={met ? entry.name : "A page you haven't met yet"}
			leading={
				<View style={styles.guideWell}>
					{met ? (
						entry.image ? (
							<Image
								source={entry.image}
								style={styles.guideArt}
								resizeMode="contain"
							/>
						) : entry.glyph ? (
							<Glyph name={entry.glyph} size={ART_SIZE.glyph} />
						) : (
							// Drawn ink-silhouette placeholder (no sprite yet — see art-todo).
							<View style={styles.guidePlaceholder} />
						)
					) : (
						<>
							<View style={styles.guideSilhouette} pointerEvents="none" />
							<T role="sectionTitle" tone="secondary" style={styles.guideQmark}>
								?
							</T>
						</>
					)}
				</View>
			}
			title={
				met ? (
					<T role="cardTitle">{entry.name}</T>
				) : (
					<T role="cardTitle" tone="secondary">
						???
					</T>
				)
			}
			sub={
				met ? (
					<View style={styles.guideCopy}>
						<T role="kicker" tone="secondary">
							{entry.whimsy}
						</T>
						<T role="bodySm">{entry.value(fieldGuideNumbers())}</T>
					</View>
				) : (
					<T role="kicker" tone="secondary">
						a page you haven't met yet
					</T>
				)
			}
		/>
	);
}

const styles = StyleSheet.create({
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
		padding: SPACE.sm,
		alignItems: "center",
	},
	artWrap: {
		width: "100%",
		aspectRatio: 1,
		alignItems: "center",
		justifyContent: "center",
		marginBottom: SPACE.xs,
	},
	art: { width: "82%", height: "82%" },
	// Near-black silhouette: tint the art to ink at the relic ghost veil.
	artHidden: { tintColor: WHIMSY.ink, opacity: RELIC_GHOST },
	qmark: {
		position: "absolute",
	},
	// The gild stars ("The One That Got Away") — sun-toned, above the story.
	gild: {
		color: WHIMSY.sun,
		marginTop: SPACE.xxs,
	},
	story: {
		marginTop: SPACE.xxs,
	},
	caption: {
		marginTop: SPACE.lg,
	},
	// ── Field Guide shelf ─────────────────────────────────────────────────────
	guideHeader: { marginTop: SPACE.xl },
	guideList: { rowGap: SPACE.md },
	guideWell: {
		width: ART_SIZE.thumb,
		height: ART_SIZE.thumb,
		borderRadius: RADII.sm,
		borderWidth: BORDER.ink,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.cream,
		alignItems: "center",
		justifyContent: "center",
	},
	guideArt: { width: ART_SIZE.glyph, height: ART_SIZE.glyph },
	guidePlaceholder: {
		width: ART_SIZE.glyph,
		height: ART_SIZE.glyph,
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.ink,
		opacity: RELIC_GHOST,
	},
	guideSilhouette: {
		width: ART_SIZE.glyph,
		height: ART_SIZE.glyph,
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.ink,
		opacity: GUIDE_GHOST,
	},
	guideQmark: {
		position: "absolute",
	},
	guideCopy: { gap: SPACE.xs },
});
