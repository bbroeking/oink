// The Race panel — this week's Dig-Off. A cream sticker with the top rows of
// the board (rank · name · score; my herd pinned on the sun, nobody dimmed) and
// a door to the full field, then Monday's spoils as two cards (the Barn
// Bunting every digging snout takes, the Gold Bunting for 1st), the Monday
// tickle-draw door when the draw is wired, and ONE gold "Oink at the herd" CTA.
//
// On Monday, while last week's finals are fresh and unseen, the same panel
// reads as the ceremony: `The race is run`, the finals, the spoils ladder (the
// bunting lands in the Barn at payout — the row is a door to it), and the gold
// `Draw your Monday purse`. The reclaim burst + haptic the old RaceSection
// ceremony fired still fire once, on mount.

import { useEffect, useMemo, useRef, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import {
	Avatar,
	Button,
	EmptyState,
	Glyph,
	Hand,
	Icon,
	ListRow,
	LoadingBeat,
	Sticker,
	T,
	Tag,
	TickleIcon,
} from "@/components/ui";
import { ReclaimSlam, type ReclaimSlamHandle } from "@/components/mudwar/ReclaimSlam";
import { HABITAT_CATALOG_BY_ID, HABITAT_THUMBNAILS } from "@/constants/habitat";
import {
	ART_SIZE,
	AVATAR_SIZE,
	BORDER,
	RADII,
	SPACE,
	TILT,
	UI_COLORS,
	WHIMSY,
} from "@/constants/theme";
import {
	cycleEndWeekday,
	formatRaceCountdown,
	raceCycle,
	standingsRows,
	type RaceStandings,
	type StandingsRow,
} from "@/utils/race";
import { countWord, ordinal, raceGapLine } from "./almanacState";
import type { RaceRun } from "./useRaceRun";
import type { MondayDrawState } from "@/utils/mondayDraw";

// The board shows the podium and one more; my herd pins beneath when it is
// further down.
const VISIBLE_ROWS = 4;
// Drawing geometry: the spoils cards' art wells and the art inside, the rank
// column's width, and the sleepy glyph on a cold board.
const SPOILS_WELL = 44;
const SPOILS_ART = 36;
const RANK_COL = 28;
const EMPTY_GLYPH = 28;
// The reclaim burst lands a beat after the finals mount.
const SLAM_DELAY_MS = 260;

// The furnishings the week pays — server-named (prizes.furnishings) once the
// spoils migration is live; these ids are the compiled fallback until then.
const FALLBACK_FURNISHINGS = { allWhoDug: "barn_bunting", first: "gold_bunting" } as const;

interface Spoils {
	allWhoDug: { id: string; name: string };
	first: { id: string; name: string };
}

function spoilsFor(prizes: RaceStandings["prizes"]): Spoils {
	const ids = prizes.furnishings ?? FALLBACK_FURNISHINGS;
	const named = (id: string, fallback: string) => ({
		id,
		name: HABITAT_CATALOG_BY_ID[id]?.name ?? fallback,
	});
	return {
		allWhoDug: named(ids.allWhoDug, "Barn Bunting"),
		first: named(ids.first, "Gold Bunting"),
	};
}

// The furnishing's thumbnail. The Gold Bunting has no asset yet: it wears the
// bunting tinted in the gold ink on a sun well until one lands.
function furnishingArt(id: string) {
	return HABITAT_THUMBNAILS[id] ?? HABITAT_THUMBNAILS.barn_bunting;
}

export interface RacePanelProps {
	raceRun: RaceRun;
	myCrewId: string | null;
	onOinkHerd: () => void;
	onGoHerd: () => void;
	mondayDraw?: MondayDrawState;
	onOpenMondayDraw?: () => void;
	testID?: string;
}

export function RacePanel({
	raceRun,
	myCrewId,
	onOinkHerd,
	onGoHerd,
	mondayDraw,
	onOpenMondayDraw,
	testID,
}: RacePanelProps) {
	const { race, run, finals, dismissRun } = raceRun;
	const state = race.state;

	if (!myCrewId) {
		return (
			<View style={styles.panel} testID={testID}>
				<EmptyState
					glyph="trophy"
					title="Rosie races with a herd."
					sub="Every Sounder races every other — most finds by Monday wins."
					action={
						<Button
							variant="lilac"
							onPress={onGoHerd}
							accessibilityLabel="Find a herd"
							accessibilityHint="Opens the Herd panel"
						>
							Find a herd
						</Button>
					}
				/>
			</View>
		);
	}
	if (state === undefined) {
		return (
			<View style={[styles.panel, styles.center]} testID={testID}>
				<LoadingBeat label="reading the race" />
			</View>
		);
	}
	if (state === null) {
		return (
			<View style={styles.panel} testID={testID}>
				<EmptyState glyph="trophy" title="No race yet" sub="The first Monday starts it." />
			</View>
		);
	}

	if (run) {
		return (
			<RaceRunView
				state={state}
				finals={finals}
				last={run}
				myCrewId={myCrewId}
				mondayDraw={mondayDraw}
				onOpenMondayDraw={onOpenMondayDraw}
				onDismiss={dismissRun}
				testID={testID}
			/>
		);
	}

	return (
		<LiveRaceView
			state={state}
			myCrewId={myCrewId}
			onOinkHerd={onOinkHerd}
			mondayDraw={mondayDraw}
			onOpenMondayDraw={onOpenMondayDraw}
			testID={testID}
		/>
	);
}

// ── The live board ───────────────────────────────────────────────────────────
function LiveRaceView({
	state,
	myCrewId,
	onOinkHerd,
	mondayDraw,
	onOpenMondayDraw,
	testID,
}: {
	state: RaceStandings;
	myCrewId: string;
	onOinkHerd: () => void;
	mondayDraw?: MondayDrawState;
	onOpenMondayDraw?: () => void;
	testID?: string;
}) {
	const rows = standingsRows(state, myCrewId, VISIBLE_ROWS).rows;
	const herdCount = state.ranked.length + state.unranked.length;
	const gap = raceGapLine(state.ranked, myCrewId);
	const spoils = spoilsFor(state.prizes);
	const endsAtMs = useMemo(() => {
		const t = new Date(state.cycle.ends_at).getTime();
		return Number.isFinite(t) ? t : raceCycle().endsAtMs;
	}, [state.cycle.ends_at]);
	// A slow tick keeps the countdown honest; the chip itself derives at render.
	const [, setTick] = useState(0);
	useEffect(() => {
		const t = setInterval(() => setTick((n) => n + 1), 60000);
		return () => clearInterval(t);
	}, []);
	const countdown = raceCountdownChip(endsAtMs);

	return (
		<View style={styles.panel} testID={testID}>
			<Sticker color="cream" rotate={TILT.card} radius={RADII.xl} style={styles.board}>
				<View style={styles.boardHead}>
					<View style={styles.boardTitle}>
						<T role="sectionTitle" accessibilityRole="header">
							The race
						</T>
						<Hand tone="secondary">most finds by Monday wins · fresh Monday</Hand>
					</View>
					<Button
						variant="handLink"
						size="sm"
						onPress={() =>
							router.push({ pathname: "/race-standings", params: { crew: myCrewId } })
						}
						accessibilityLabel={`All ${herdCount} herds`}
						accessibilityHint="Opens every Sounder in rank order"
					>
						{`all ${herdCount} herds ›`}
					</Button>
				</View>
				<Board rows={rows} />
			</Sticker>

			<View style={styles.spoilsHead}>
				<T role="sectionTitle" accessibilityRole="header">
					Monday&apos;s spoils
				</T>
				<Hand tone="secondary" style={styles.spoilsMeta}>
					{gap ? `${gap} · ${countdown}` : countdown}
				</Hand>
			</View>
			<View style={styles.spoilsRow}>
				<SpoilsCard kicker="all who dug" id={spoils.allWhoDug.id} name={spoils.allWhoDug.name} gold={false} />
				<SpoilsCard kicker="1st place" id={spoils.first.id} name={spoils.first.name} gold />
			</View>

			{mondayDraw && (
				<ListRow
					tilt={false}
					fill="paper"
					leading={
						<Avatar size={AVATAR_SIZE[1]} fill="rose" label="Monday tickle draw">
							<TickleIcon size={ART_SIZE.glyphSm} />
						</Avatar>
					}
					title="Your Monday tickle draw"
					sub={drawLine(mondayDraw)}
					trailing={
						<Icon name="chevronRight" size={ART_SIZE.glyphSm} color={UI_COLORS.textSecondary} />
					}
					onPress={onOpenMondayDraw}
					accessibilityLabel="Your Monday tickle draw"
					accessibilityHint="Opens the Monday draw"
					testID="race-monday-draw-row"
				/>
			)}

			<Button
				variant="gold"
				size="lg"
				full
				onPress={onOinkHerd}
				accessibilityLabel={gap ? `Oink at the herd — ${gap}` : "Oink at the herd"}
				accessibilityHint="Opens the Sounder Oink sheet"
			>
				{gap ? `Oink at the herd — ${gap}` : "Oink at the herd"}
			</Button>
		</View>
	);
}

// ── Monday: the race is run ──────────────────────────────────────────────────
function RaceRunView({
	state,
	finals,
	last,
	myCrewId,
	mondayDraw,
	onOpenMondayDraw,
	onDismiss,
	testID,
}: {
	state: RaceStandings;
	finals: RaceRun["finals"];
	last: NonNullable<RaceRun["run"]>;
	myCrewId: string;
	mondayDraw?: MondayDrawState;
	onOpenMondayDraw?: () => void;
	onDismiss: () => void;
	testID?: string;
}) {
	// The finals table when history answered, else the board as it stands.
	const table: RaceStandings = finals
		? { ...state, ranked: finals.ranked, unranked: finals.unranked, mine: null }
		: state;
	const rows = standingsRows(table, myCrewId, VISIBLE_ROWS).rows;
	const herdCount = table.ranked.length + table.unranked.length;
	const winner = table.ranked.find((r) => r.rank === 1)?.name ?? null;
	const placed = last.rank >= 1;
	const spoils = spoilsFor(state.prizes);
	const openBarn = () => router.push("/barn-interior");

	const slamRef = useRef<ReclaimSlamHandle>(null);
	useEffect(() => {
		const t = setTimeout(() => {
			slamRef.current?.slam({ intensity: "burst", haptic: true });
		}, SLAM_DELAY_MS);
		return () => clearTimeout(t);
	}, []);

	const drawReady = !!mondayDraw && mondayDraw.eligible && !mondayDraw.drawn;

	return (
		<View style={styles.panel} testID={testID}>
			<Sticker color="cream" rotate={TILT.card} radius={RADII.xl} style={[styles.board, styles.clipped]}>
				<View style={styles.boardHead}>
					<View style={styles.boardTitle}>
						<T role="sectionTitle" accessibilityRole="header">
							The race is run
						</T>
						<Hand tone="secondary">last week&apos;s finals · a fresh race starts now</Hand>
					</View>
					<Button
						variant="handLink"
						size="sm"
						onPress={() =>
							router.push({ pathname: "/race-standings", params: { crew: myCrewId } })
						}
						accessibilityLabel={`All ${herdCount} herds`}
						accessibilityHint="Opens every Sounder in rank order"
					>
						{`all ${herdCount} herds ›`}
					</Button>
				</View>
				<Board rows={rows} />
				<ReclaimSlam ref={slamRef} />
			</Sticker>

			<View style={styles.spoilsHead}>
				<T role="sectionTitle" accessibilityRole="header">
					Monday&apos;s spoils
				</T>
				<Hand tone="secondary" style={styles.spoilsMeta}>
					{placed ? `you took ${ordinal(last.rank)} of ${last.of}` : "you dug this week"}
				</Hand>
			</View>
			{/* The bunting is already hanging (it lands at payout) — the row is a
			    door to the Barn, not a claim. */}
			<Sticker
				color="paper"
				rotate={0}
				radius={RADII.xl}
				onPress={placed ? openBarn : undefined}
				accessibilityLabel={placed ? `${spoils.allWhoDug.name} is hanging in your Barn` : "Monday's spoils"}
				accessibilityHint={placed ? "Opens your Barn" : undefined}
				style={styles.ladder}
				testID="race-spoils-door"
			>
				<SpoilsLadderRow
					kicker="all who dug"
					id={spoils.allWhoDug.id}
					name={placed ? `${spoils.allWhoDug.name} · in your Barn` : spoils.allWhoDug.name}
					gold={false}
					trailing={
						placed ? (
							<Icon name="chevronRight" size={ART_SIZE.glyphSm} color={UI_COLORS.textSecondary} />
						) : undefined
					}
				/>
				<View style={styles.ladderRule} />
				<SpoilsLadderRow
					kicker="1st place"
					id={spoils.first.id}
					name={winner ? `${spoils.first.name} · ${winner}${winner.endsWith("s") ? "'" : "'s"} this week` : spoils.first.name}
					gold
				/>
			</Sticker>

			{drawReady ? (
				<View style={styles.drawBlock}>
					<Button
						variant="gold"
						size="lg"
						full
						onPress={onOpenMondayDraw}
						accessibilityLabel="Draw your Monday purse"
						accessibilityHint="Opens the Monday tickle draw"
						testID="race-monday-draw-cta"
					>
						Draw your Monday purse
					</Button>
					{mondayDraw && (
						<Hand tone="secondary" align="center">
							{drawLine(mondayDraw)}
						</Hand>
					)}
				</View>
			) : (
				<Button
					variant="handLink"
					size="sm"
					full
					onPress={onDismiss}
					accessibilityLabel="See this week's race"
					accessibilityHint="Folds the finals away and shows the live board"
				>
					see this week&apos;s race ›
				</Button>
			)}
		</View>
	);
}

// ── Pieces ───────────────────────────────────────────────────────────────────
function Board({ rows }: { rows: StandingsRow[] }) {
	if (rows.length === 0) {
		return (
			<View style={styles.emptyBeat}>
				<Glyph name="zzz" size={EMPTY_GLYPH} />
				<Hand tone="secondary" align="center">
					the patch is quiet — first finds take this week&apos;s lead
				</Hand>
			</View>
		);
	}
	return (
		<View style={styles.rows}>
			{rows.map((r, i) => {
				if (r.kind === "separator") {
					return (
						<T key={`sep-${i}`} role="kicker" tone="secondary" align="center">
							· · ·
						</T>
					);
				}
				const mine = r.highlighted;
				const rank = r.kind === "ranked" ? String(r.rank) : "—";
				const label = `${rank} ${r.name}${mine ? ", your Sounder" : ""}, ${r.total_finds} finds`;
				const inner = (
					<>
						<T role="numeral" style={styles.rank}>
							{rank}
						</T>
						<T role="body" style={styles.rowName}>
							{mine ? `${r.name} · you` : r.name}
						</T>
						<T role="cardTitle">{r.total_finds}</T>
					</>
				);
				return mine ? (
					<Sticker
						key={`${r.crew_id}-${i}`}
						color="sun"
						rotate={0}
						radius={RADII.md}
						shadow="sm"
						style={styles.mineRow}
						accessibilityRole="text"
						accessibilityLabel={label}
					>
						{inner}
					</Sticker>
				) : (
					<View
						key={`${r.crew_id}-${i}`}
						style={styles.row}
						accessible
						accessibilityRole="text"
						accessibilityLabel={label}
					>
						{inner}
					</View>
				);
			})}
		</View>
	);
}

function SpoilsCard({ kicker, id, name, gold }: { kicker: string; id: string; name: string; gold: boolean }) {
	return (
		<Sticker
			color={gold ? "sun" : "cream"}
			rotate={0}
			radius={RADII.lg}
			shadow="sm"
			style={styles.spoilsCard}
			accessibilityRole="text"
			accessibilityLabel={`${kicker}: ${name}`}
		>
			<T role="kickerPill" tone="secondary">
				{kicker}
			</T>
			<View style={styles.spoilsBody}>
				<FurnishingWell id={id} gold={gold} />
				<View style={styles.spoilsText}>
					<T role="body">
						{name}
					</T>
					<Tag tone="sage" label="barn" />
				</View>
			</View>
		</Sticker>
	);
}

function SpoilsLadderRow({
	kicker,
	id,
	name,
	gold,
	trailing,
}: {
	kicker: string;
	id: string;
	name: string;
	gold: boolean;
	trailing?: React.ReactNode;
}) {
	return (
		<View style={styles.ladderRow} accessibilityLabel={`${kicker}: ${name}`}>
			<FurnishingWell id={id} gold={gold} />
			<View style={styles.ladderText}>
				<View style={styles.ladderCap}>
					<T role="kickerPill" tone="secondary">
						{kicker}
					</T>
					<Tag tone="sage" label="barn" />
				</View>
				<T role="body">
					{name}
				</T>
			</View>
			{trailing}
		</View>
	);
}

function FurnishingWell({ id, gold }: { id: string; gold: boolean }) {
	// Tint only while the gold piece is borrowing the plain bunting's art.
	const borrowed = gold && !HABITAT_THUMBNAILS[id];
	return (
		<View style={[styles.well, gold && styles.wellGold]}>
			<Image
				source={furnishingArt(id)}
				style={[styles.wellArt, borrowed && styles.wellArtGold]}
				resizeMode="contain"
				accessibilityIgnoresInvertColors
			/>
		</View>
	);
}

function drawLine(d: Pick<MondayDrawState, "mondaysSinceRare" | "nextRareOddsOneIn">): string {
	const since =
		d.mondaysSinceRare <= 0
			? "a rare last Monday"
			: `${countWord(d.mondaysSinceRare)} ${d.mondaysSinceRare === 1 ? "Monday" : "Mondays"} since a rare`;
	return `${since} · 1 in ${Math.max(1, Math.round(d.nextRareOddsOneIn))} for rare or better`;
}

// "ends Monday" while far out, "ends in 22h" in the last day, "ends any moment" at the bell.
function raceCountdownChip(endsAtMs: number, nowMs: number = Date.now()): string {
	const left = endsAtMs - nowMs;
	if (left <= 0) return "ends any moment";
	if (left >= 24 * 3600_000) return `ends ${cycleEndWeekday(endsAtMs)}`;
	return `ends in ${formatRaceCountdown(endsAtMs, nowMs)}`;
}

const styles = StyleSheet.create({
	panel: { gap: SPACE.md },
	center: { alignItems: "center", justifyContent: "center" },
	board: {
		paddingHorizontal: SPACE.card,
		paddingVertical: SPACE.md,
		gap: SPACE.sm,
	},
	clipped: { overflow: "hidden" },
	boardHead: {
		flexDirection: "row",
		alignItems: "flex-start",
		justifyContent: "space-between",
		gap: SPACE.sm,
	},
	boardTitle: { flex: 1, minWidth: 0, gap: SPACE.xxs },
	rows: { gap: SPACE.xxs },
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.md,
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.xs,
	},
	mineRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.md,
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.xs,
		borderWidth: BORDER.ink,
	},
	rank: { width: RANK_COL },
	rowName: { flex: 1, minWidth: 0 },
	emptyBeat: { alignItems: "center", gap: SPACE.xs, paddingVertical: SPACE.sm },
	spoilsHead: {
		flexDirection: "row",
		alignItems: "baseline",
		justifyContent: "space-between",
		gap: SPACE.sm,
	},
	spoilsMeta: { flexShrink: 1 },
	spoilsRow: { flexDirection: "row", gap: SPACE.md },
	spoilsCard: {
		flex: 1,
		minWidth: 0,
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.md,
		gap: SPACE.sm,
	},
	spoilsBody: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
	spoilsText: { flex: 1, minWidth: 0, gap: SPACE.xs, alignItems: "flex-start" },
	well: {
		width: SPOILS_WELL,
		height: SPOILS_WELL,
		borderRadius: RADII.md,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		backgroundColor: UI_COLORS.surface,
		alignItems: "center",
		justifyContent: "center",
	},
	wellGold: { backgroundColor: WHIMSY.sun },
	wellArt: { width: SPOILS_ART, height: SPOILS_ART },
	wellArtGold: { tintColor: WHIMSY.goldInk },
	ladder: { paddingHorizontal: SPACE.card, paddingVertical: SPACE.sm },
	ladderRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.md,
		paddingVertical: SPACE.sm,
	},
	ladderRule: {
		borderTopWidth: BORDER.thin,
		borderTopColor: UI_COLORS.uiMuted,
		borderStyle: "dashed",
	},
	ladderText: { flex: 1, minWidth: 0, gap: SPACE.xxs },
	ladderCap: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
	drawBlock: { gap: SPACE.xs },
});
