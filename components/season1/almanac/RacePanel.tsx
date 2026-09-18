// The Race panel — this week's Dig-Off. A cream sticker with the top rows of
// the board (rank · name · score; my herd pinned on the sun, nobody dimmed) and
// a door to the full field, then Monday's spoils as ONE ladder sticker — the
// bunting on one row (the Barn Bunting every digging snout takes, the Gold
// Bunting for 1st), the Monday tickle-draw door and the Barn Draw door as
// flat rows on the same paper (2026-09-18) — and ONE gold "Oink at the herd" CTA.
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
import { herdPrizeLine, type HerdPrizeState } from "@/utils/barnDraw";

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
	/** The Barn Draw — the crew's Monday furnishing draw (dark until the server answers). */
	herdPrize?: HerdPrizeState;
	/** Who I am, so the row can say "you drew". */
	uid?: string | null;
	onOpenHerdPrize?: () => void;
	testID?: string;
}

export function RacePanel({
	raceRun,
	myCrewId,
	onOinkHerd,
	onGoHerd,
	mondayDraw,
	onOpenMondayDraw,
	herdPrize,
	uid,
	onOpenHerdPrize,
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
				herdPrize={herdPrize}
				uid={uid}
				onOpenHerdPrize={onOpenHerdPrize}
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
			herdPrize={herdPrize}
			uid={uid}
			onOpenHerdPrize={onOpenHerdPrize}
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
	herdPrize,
	uid,
	onOpenHerdPrize,
	testID,
}: {
	state: RaceStandings;
	myCrewId: string;
	onOinkHerd: () => void;
	mondayDraw?: MondayDrawState;
	onOpenMondayDraw?: () => void;
	herdPrize?: HerdPrizeState;
	uid?: string | null;
	onOpenHerdPrize?: () => void;
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

			{/* ONE sticker for everything Monday pays (2026-09-18: "simplify this
			    layout" — two prize cards plus two loose rows read as four things;
			    they are one ladder): the bunting for all who dug, the Gold Bunting
			    for 1st, then the two draws as flat rows on the same paper. The gap
			    lives on the CTA alone; the head keeps only the clock. */}
			<View style={styles.spoilsHead}>
				<T role="sectionTitle" accessibilityRole="header">
					Monday&apos;s spoils
				</T>
				<Hand tone="secondary" style={styles.spoilsMeta}>
					{countdown}
				</Hand>
			</View>
			<Sticker color="paper" rotate={0} radius={RADII.xl} style={styles.ladder} testID="race-spoils-ladder">
				<BuntingRow spoils={spoils} />
				{mondayDraw && (
					<>
						<View style={styles.ladderRule} />
						<MondayDrawRow state={mondayDraw} onPress={onOpenMondayDraw} flat />
					</>
				)}
				{herdPrize && (
					<>
						<View style={styles.ladderRule} />
						<HerdPrizeRow state={herdPrize} uid={uid} onPress={onOpenHerdPrize} flat />
					</>
				)}
			</Sticker>

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
	herdPrize,
	uid,
	onOpenHerdPrize,
	onDismiss,
	testID,
}: {
	state: RaceStandings;
	finals: RaceRun["finals"];
	last: NonNullable<RaceRun["run"]>;
	myCrewId: string;
	mondayDraw?: MondayDrawState;
	onOpenMondayDraw?: () => void;
	herdPrize?: HerdPrizeState;
	uid?: string | null;
	onOpenHerdPrize?: () => void;
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

			{herdPrize && <HerdPrizeRow state={herdPrize} uid={uid} onPress={onOpenHerdPrize} />}

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
				<T role="kickerPill" tone="secondary">
					{kicker}
				</T>
				<T role="body">
					{name}
				</T>
			</View>
			{trailing}
		</View>
	);
}

// The week's two furnishings on ONE row (2026-09-18: the two cards, then the
// two ladder rows, were the same fact twice over): both wells side by side,
// one line saying who takes which. They land in the Barn at payout.
function BuntingRow({ spoils }: { spoils: Spoils }) {
	const line = `${spoils.allWhoDug.name} for all who dug · ${spoils.first.name} for 1st`;
	return (
		<View style={styles.ladderRow} accessibilityRole="text" accessibilityLabel={line}>
			<View style={styles.wellPair}>
				<FurnishingWell id={spoils.allWhoDug.id} gold={false} />
				<View style={styles.wellSecond}>
					<FurnishingWell id={spoils.first.id} gold />
				</View>
			</View>
			<View style={styles.ladderText}>
				<T role="kickerPill" tone="secondary">
					the bunting
				</T>
				<T role="body">{line}</T>
			</View>
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

// The Barn Draw row: one for-sale furnishing per herd every Monday, among the
// diggers. Before a crew has ever drawn it says the rule; after, the last
// result — mine as "you drew", a crewmate's by name. A purse (the winner owned
// every design) says so. The row opens the reveal sheet.
function HerdPrizeRow({
	state,
	uid,
	onPress,
	flat = false,
}: {
	state: HerdPrizeState;
	uid?: string | null;
	onPress?: () => void;
	/** Inside the spoils ladder: no outline of its own. */
	flat?: boolean;
}) {
	const last = state.last;
	const art = last?.itemId ? HABITAT_THUMBNAILS[last.itemId] : undefined;
	return (
		<ListRow
			tilt={false}
			flat={flat}
			fill="paper"
			leading={
				<Avatar size={AVATAR_SIZE[1]} fill="sage" label="The Barn Draw">
					{art ? (
						<Image source={art} style={styles.herdPrizeArt} resizeMode="contain" accessibilityIgnoresInvertColors />
					) : (
						<Glyph name="gift" size={ART_SIZE.glyphSm} />
					)}
				</Avatar>
			}
			title="The Barn Draw"
			sub={herdPrizeLine(state, uid)}
			trailing={<Icon name="chevronRight" size={ART_SIZE.glyphSm} color={UI_COLORS.textSecondary} />}
			onPress={onPress}
			accessibilityLabel="The Barn Draw"
			accessibilityHint="Opens the herd's Monday furnishing draw"
			testID="race-herd-prize-row"
		/>
	);
}

// The Monday tickle draw's door. Undrawn it sells the odds; drawn, it is the
// receipt (the amount is already in the snout's count).
function MondayDrawRow({
	state,
	onPress,
	flat = false,
}: {
	state: MondayDrawState;
	onPress?: () => void;
	flat?: boolean;
}) {
	return (
		<ListRow
			tilt={false}
			flat={flat}
			fill="paper"
			leading={
				<Avatar size={AVATAR_SIZE[1]} fill="rose" label="Monday tickle draw">
					<TickleIcon size={ART_SIZE.glyphSm} />
				</Avatar>
			}
			title={state.drawn ? "Your Monday purse, drawn" : "Your Monday tickle draw"}
			sub={drawLine(state)}
			trailing={<Icon name="chevronRight" size={ART_SIZE.glyphSm} color={UI_COLORS.textSecondary} />}
			onPress={onPress}
			accessibilityLabel="Your Monday tickle draw"
			accessibilityHint="Opens the Monday draw"
			testID="race-monday-draw-row"
		/>
	);
}

// Undrawn, the row sells the odds; drawn, it is the receipt — the amount is
// already in the snout's count, so the row must not read as a purse still
// waiting (the "it didn't clear" report, 2026-09-17).
function drawLine(
	d: Pick<MondayDrawState, "drawn" | "amount" | "mondaysSinceRare" | "nextRareOddsOneIn">,
): string {
	const oneIn = Math.max(1, Math.round(d.nextRareOddsOneIn));
	if (d.drawn && d.amount != null) {
		return `${d.amount} tickles pocketed · 1 in ${oneIn} for rare or better next Monday`;
	}
	const since =
		d.mondaysSinceRare <= 0
			? "a rare last Monday"
			: `${countWord(d.mondaysSinceRare)} ${d.mondaysSinceRare === 1 ? "Monday" : "Mondays"} since a rare`;
	return `${since} · 1 in ${oneIn} for rare or better`;
}

// "ends Monday" while far out, "ends in 22h" in the last day, "ends any moment" at the bell.
function raceCountdownChip(endsAtMs: number, nowMs: number = Date.now()): string {
	const left = endsAtMs - nowMs;
	if (left <= 0) return "ends any moment";
	if (left >= 24 * 3600_000) return `ends ${cycleEndWeekday(endsAtMs)}`;
	return `ends in ${formatRaceCountdown(endsAtMs, nowMs)}`;
}

const styles = StyleSheet.create({
	herdPrizeArt: { width: SPOILS_ART * 0.8, height: SPOILS_ART * 0.8 },
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
	// The two wells overlap a little, like two things pinned on one nail.
	wellPair: { flexDirection: "row", alignItems: "center" },
	wellSecond: { marginLeft: -SPACE.md },
	drawBlock: { gap: SPACE.xs },
});
