// The Dig-Off RACE section — lives on the season tab, tucked inside the crew-
// only block. This one card reads the global standings and renders, top to
// bottom:
//   • the WEEKLY RACE HERO — this week's spoils ladder (tickles to the podium +
//     the "every digging snout wins" floor, from the server's `prizes`), the
//     weekly board (overall finds, my row pinned), the countdown, and
//     the participation beat. This is the race anyone can win — promoted to the
//     hero so the winnable-every-Monday race reads first.
//   • the SEASON board (secondary, collapsible) — cumulative finds all season,
//     every crew with a find ranked. The long game, kept always-visible but
//     quiet under the weekly hero.
//   • a last-race line, and — once per cycle — the resolve ceremony when my last
//     weekly placement is fresh + unseen.
// The season explainer lives in SeasonGuideModal, reached via the full-field page.
//
// Tapping any weekly board row expands an inline MEMBER LEDGER underneath it —
// each digger's finds this week + cumulative season finds, from race_crew_detail.
// One row open at a time; a crew whose detail RPC is still dark (unpushed) auto-
// collapses so there's never a dead panel.
//
// Spoils numbers are SERVER-AUTHORITATIVE (state.prizes), with a compiled
// fallback in utils/race.ts — so a rebalance is one server change, never a binary.
// Feature-dark until the migration is pushed (useRace reports it) — then this
// renders nothing at all.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Image, StyleSheet } from "react-native";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import {
	Button,
	CardTitle,
	Glyph,
	Hand,
	Kicker,
	ListRow,
	LoadingBeat,
	Numeral,
	SectionTitle,
	Sticker,
	T,
	Tag,
	TickleIcon,
} from "../ui";
import { ReclaimSlam, ReclaimSlamHandle } from "../mudwar/ReclaimSlam";
import { useCrewLedger, useRace } from "@/hooks/useRace";
import {
	LastRace,
	RaceCrewDetail,
	RacePrizes,
	RaceStandings,
	StandingsRow,
	cycleEndWeekday,
	formatRaceCountdown,
	raceSpoilsForRank,
	raceCycle,
	standingsRows,
} from "@/utils/race";
import { cosmeticImage, cosmeticName } from "@/utils/rewardArt";
import {
	BORDER,
	FONTS,
	PODIUM,
	RADII,
	SPACE,
	TILT,
	UI_COLORS,
} from "@/constants/theme";
import {
	devCeremonyFixture,
	type DevCeremony,
} from "@/utils/devSeasonOverrides";

// The season-tab card is a glanceable race preview: podium first, then my
// Sounder pinned beneath it when I'm outside the top three. The full field owns
// the longer table.
const VISIBLE_ROWS = 3;

// Drawing geometry, not spacing: the podium's rank medallion, the little prize
// marks that ride a number, the cosmetic thumbnail on the last-race line and on
// the ceremony card, the rank column's width, and the inset that lines the
// board's column captions up with the rows beneath them. Named here because
// they are the drawing of this card. (2026-09-11)
const PODIUM_BADGE = 22;
const PRIZE_MARK = 16;
const LINE_ART = 18;
const CEREMONY_ART = 22;
const RANK_COL = 34;
const BOARD_HEAD_INSET = 42;
// The sleepy glyph on the cold-board beat.
const EMPTY_GLYPH = 28;

// cosmeticName (id → "Mud Derby Bg") + cosmeticImage (id → sprite) now live in
// utils/rewardArt, the single owner of cosmetic art/name resolution.

// "3rd of 12" — ordinal placement.
function ordinal(n: number): string {
	const v = Math.max(1, Math.floor(n));
	const rem100 = v % 100;
	if (rem100 >= 11 && rem100 <= 13) return `${v}th`;
	switch (v % 10) {
		case 1:
			return `${v}st`;
		case 2:
			return `${v}nd`;
		case 3:
			return `${v}rd`;
		default:
			return `${v}th`;
	}
}

export function RaceSection({
	myCrewId,
	crewSize,
	refreshKey,
	devCeremony,
	onDismissDevCeremony,
}: {
	myCrewId: string | null;
	crewSize: number;
	/** Bumped by the tab after a banked dig — the board refetches so my fresh
	 *  finds move the standings immediately (focus never changes under the
	 *  dig modal, so useRace's focus-refresh alone leaves this card stale). */
	refreshKey?: number;
	devCeremony?: DevCeremony;
	onDismissDevCeremony?: () => void;
}) {
	const race = useRace(true);
	const { state } = race;
	const refresh = race.refresh;
	useEffect(() => {
		if (refreshKey) refresh();
	}, [refreshKey, refresh]);

	// Which just-ended races the player has already watched settle. Persisted so
	// the ceremony plays once (keyed by cycle_key), then folds into the line.
	const [seen, setSeen] = useState<Set<string>>(new Set());
	useEffect(() => {
		AsyncStorage.getItem("race_seen").then((v) => {
			if (!v) return;
			try {
				setSeen(new Set(JSON.parse(v) as string[]));
			} catch {}
		});
	}, []);
	const markSeen = useCallback((cycleKey: string) => {
		setSeen((prev) => {
			const next = new Set(prev);
			next.add(cycleKey);
			AsyncStorage.setItem("race_seen", JSON.stringify([...next])).catch(
				() => {},
			);
			return next;
		});
	}, []);

	if (__DEV__ && devCeremony) {
		return (
			<Ceremony
				key={`dev-${devCeremony}`}
				last={devCeremonyFixture(devCeremony)}
				onDismiss={onDismissDevCeremony ?? (() => {})}
			/>
		);
	}

	// Feature dark (RPC not pushed) — render nothing, exactly like the meter's
	// fallback. Also covers the first-load null before the fetch resolves.
	if (state === null) return null;
	if (state === undefined) {
		return (
			<View style={styles.loadingWrap}>
				<LoadingBeat label="reading the race" />
			</View>
		);
	}

	// The resolve ceremony takes over the whole section while the just-ended
	// race is fresh + unseen — `last` is for a cycle that already closed.
	const last = state.last;
	const cycleClosed = last != null && last.cycle_key !== state.cycle.key;
	if (last && cycleClosed && !seen.has(last.cycle_key)) {
		return (
			<Ceremony
				key={last.cycle_key}
				last={last}
				onDismiss={() => {
					markSeen(last.cycle_key);
					race.refresh();
				}}
			/>
		);
	}

	return (
		<View style={styles.wrap}>
			<Kicker>the dig-off</Kicker>
			<WeeklyHero state={state} myCrewId={myCrewId} />
			{last && <LastRaceLine last={last} />}
		</View>
	);
}

// ── THE WEEKLY HERO — this week's spoils + board + countdown ───────────────────
// The promoted board: the race anyone can win by simply digging strong this week.
function WeeklyHero({
	state,
	myCrewId,
}: {
	state: RaceStandings;
	myCrewId: string | null;
}) {
	const endsAtMs = useMemo(() => {
		const t = new Date(state.cycle.ends_at).getTime();
		return Number.isFinite(t) ? t : raceCycle().endsAtMs;
	}, [state.cycle.ends_at]);

	const [countdown, setCountdown] = useState(() => raceCountdownChip(endsAtMs));
	useEffect(() => {
		setCountdown(raceCountdownChip(endsAtMs));
		const t = setInterval(
			() => setCountdown(raceCountdownChip(endsAtMs)),
			60000,
		);
		return () => clearInterval(t);
	}, [endsAtMs]);

	// The weekly pinned-row view: top ranked rows + my pinned row (overall finds).
	const view = standingsRows(state, myCrewId, VISIBLE_ROWS);
	const rows = view.rows;
	const empty = rows.length === 0;
	const projectedSpoils = weeklyProjectedSpoils(state);

	// The expandable member ledger — shared with the full-field standings page.
	const { expandedCrew, detailCache, toggleCrew } = useCrewLedger();

	return (
		<Sticker
			color="sun"
			rotate={TILT.card}
			radius={RADII.lg}
			shadow="sm"
			title="This week's race"
			right={<Tag label={countdown} />}
			style={styles.heroCard}
		>
			<T role="bodySm" style={styles.raceRule}>
				most finds wins · every Sounder that digs takes a share
			</T>

			{empty ? (
				<View style={styles.emptyBeat}>
					<Glyph name="zzz" size={EMPTY_GLYPH} style={styles.emptyGlyph} />
					<Hand tone="secondary" align="center">
						the patch is quiet — first finds take this week's lead
					</Hand>
				</View>
			) : (
				<View style={styles.board}>
					<View style={styles.boardHead}>
						<Kicker star={false}>standings</Kicker>
						<T role="kickerPill" tone="secondary">
							finds
						</T>
					</View>
					<View style={styles.rows}>
						{rows.map((r, i) => {
							const crewId = r.kind === "separator" ? null : r.crew_id;
							const expanded = !!crewId && crewId === expandedCrew;
							return (
								<View key={weeklyRowKey(r, i)}>
									<WeeklyRow
										row={r}
										index={i}
										note={
											r.kind !== "separator" && r.highlighted
												? projectedSpoils
												: null
										}
										onPress={crewId ? () => toggleCrew(crewId) : undefined}
									/>
									{expanded && crewId && (
										<CrewLedger entry={detailCache[crewId]} />
									)}
								</View>
							);
						})}
					</View>
				</View>
			)}

			{/* Keep the pot obvious without letting it outrank the live board. */}
			<SpoilsStrip prizes={state.prizes} />

			{rows.length > 0 && (
				<Button
					variant="handLink"
					size="sm"
					full
					onPress={() =>
						router.push({
							pathname: "/race-standings",
							params: myCrewId ? { crew: myCrewId } : {},
						})
					}
					accessibilityLabel="See the full Dig-Off field"
					accessibilityHint="Opens every Sounder in rank order"
				>
					see the full field ›
				</Button>
			)}
		</Sticker>
	);
}

// ── This week's spoils ladder — the pot, visible before Monday ─────────────────
// Server-authoritative (state.prizes): the podium tickle prizes headline (the
// new reward the founder wants obvious), with truffles + the prize hat + the
// participation floor spelled out beneath. Renders even on a cold board so a
// first player sees exactly what's on the line.
export function SpoilsStrip({
	prizes,
	compact = false,
}: {
	prizes: RacePrizes;
	compact?: boolean;
}) {
	const podium: {
		place: string;
		badge: string;
		tint: string;
		tickles: number;
		truffles: number;
	}[] = [
		{
			place: "1st",
			badge: "1",
			tint: PODIUM.gold,
			tickles: prizes.tickles.first,
			truffles: prizes.truffles.first,
		},
		{
			place: "2nd",
			badge: "2",
			tint: PODIUM.silver,
			tickles: prizes.tickles.second,
			truffles: prizes.truffles.second,
		},
		{
			place: "3rd",
			badge: "3",
			tint: PODIUM.bronze,
			tickles: prizes.tickles.third,
			truffles: prizes.truffles.third,
		},
	];
	const body = (
		<>
			<Kicker>Monday's spoils</Kicker>
			<View style={styles.podiumRow}>
				{podium.map((p) => (
					<View
						key={p.place}
						style={styles.podiumCell}
						accessible
						accessibilityLabel={`${p.place}: ${p.tickles} tickles and ${p.truffles} Golden Truffles`}
					>
						<View style={[styles.podiumBadge, { backgroundColor: p.tint }]}>
							<T role="label" style={styles.podiumBadgeText}>
								{p.badge}
							</T>
						</View>
						<View style={styles.podiumRewards}>
							<View style={styles.podiumPrize}>
								<TickleIcon size={PRIZE_MARK} />
								<Numeral>{p.tickles}</Numeral>
							</View>
							<View style={styles.podiumPrize}>
								<Image
									source={cosmeticImage("golden_truffle")}
									style={styles.podiumTruffle}
									resizeMode="contain"
								/>
								<T role="label" style={styles.podiumTruffleNum}>
									{p.truffles}
								</T>
							</View>
						</View>
					</View>
				))}
			</View>
			<Hand tone="secondary" align="center">
				every snout that digs banks {prizes.tickles.participation}+ tickles ·
				truffles to the top half too
			</Hand>
		</>
	);
	// Inside the hero the strip is a ruled-off footer on the sun card; standing
	// alone (the full-field page) it is its own paper sticker.
	if (compact) {
		return (
			<Sticker
				color="paper"
				rotate={TILT.card}
				radius={RADII.md}
				shadow="sm"
				style={styles.spoilsCompact}
			>
				{body}
			</Sticker>
		);
	}
	return <View style={styles.spoils}>{body}</View>;
}

// ── A weekly board row — scored by total finds (the rank metric) ───────────────
function WeeklyRow({
	row,
	note,
	onPress,
	index = 0,
}: {
	row: StandingsRow;
	note?: string | null;
	onPress?: () => void;
	index?: number;
}) {
	if (row.kind === "separator") {
		return (
			<View style={styles.separatorRow}>
				<T role="kicker" tone="secondary">
					· · ·
				</T>
			</View>
		);
	}
	const ranked = row.kind === "ranked";
	const rankLabel = ranked ? `#${row.rank}` : "—";
	return (
		<ListRow
			index={index}
			selected={row.highlighted}
			onPress={onPress}
			leading={<Numeral style={styles.rowRank}>{rankLabel}</Numeral>}
			title={
				<CardTitle numberOfLines={1}>
					{row.name}
				</CardTitle>
			}
			sub={
				<>
					{row.diggers > 0 && (
						<T
							role="kicker"
							tone={row.highlighted ? "accent" : "secondary"}
						>
							{row.diggers} digging
							{row.highlighted ? " · your Sounder" : ""}
						</T>
					)}
					{note ? <T role="kicker">{note}</T> : null}
				</>
			}
			trailing={<T role="sectionTitle">{row.total_finds}</T>}
			accessibilityLabel={`${rankLabel} ${row.name}, ${row.total_finds} finds`}
			accessibilityHint={
				onPress ? "Opens this Sounder's member ledger" : undefined
			}
		/>
	);
}

function weeklyRowKey(r: StandingsRow, i: number): string {
	if (r.kind === "separator") return `sep-${i}`;
	return `${r.crew_id || r.name}-${i}`;
}

// The inline member breakdown under an expanded board row. `undefined` while the
// fetch is in flight (→ a loading beat); "dark" never renders (the row auto-
// collapses first). Otherwise one line per digger, finds DESC as the server sent.
export function CrewLedger({
	entry,
}: {
	entry: RaceCrewDetail | "dark" | undefined;
}) {
	if (entry === undefined) {
		return (
			<View style={styles.ledger}>
				<LoadingBeat label="reading the ledger" />
			</View>
		);
	}
	if (entry === "dark") return null;
	return (
		<View style={styles.ledger}>
			{entry.members.map((mem) => (
				// A departed digger's finds stayed with the crew (no clawback —
				// the charter's no-shame rule) but the row reads historical:
				// dimmed, server-sorted last, "trotted on" in the caption.
				<View key={mem.user_id} style={styles.ledgerRow}>
					<T
						role="hand"
						tone={mem.departed ? "disabled" : "secondary"}
						numberOfLines={1}
						style={styles.ledgerName}
					>
						{mem.username}
					</T>
					<T
						role="hand"
						tone={mem.departed ? "disabled" : "secondary"}
						align="right"
					>
						{mem.departed
							? `${mem.finds} this week · trotted on`
							: `${mem.finds} this week · ${mem.season_finds} season`}
					</T>
				</View>
			))}
		</View>
	);
}

// The payout forecast belongs to my highlighted row rather than a detached
// footer, so placement and consequence read as one thought.
function weeklyProjectedSpoils(state: RaceStandings): string | null {
	const mine = state.mine;
	if (mine && mine.rank != null) {
		const ofN = Math.max(state.ranked.length, mine.rank);
		const projected = raceSpoilsForRank(state.prizes, mine.rank, ofN);
		return `on track: ${projected.tickles} tickles + ${projected.truffles} truffles`;
	}
	return null;
}

// The countdown chip text: "ends Monday" while far out, "ends in 22h" in the last
// day, "ends any moment" at the bell.
function raceCountdownChip(
	endsAtMs: number,
	nowMs: number = Date.now(),
): string {
	const left = endsAtMs - nowMs;
	if (left <= 0) return "ends any moment";
	if (left >= 24 * 3600_000) return `ends ${cycleEndWeekday(endsAtMs)}`;
	return `ends in ${formatRaceCountdown(endsAtMs, nowMs)}`;
}

// ── Last-race line (settled state) ────────────────────────────────────────────
// What the payout banked — truffles + tickles, whichever were paid. Shared by
// the settled line and the ceremony card so the two never word it differently.
function spoilsLines(last: LastRace): string[] {
	const spoils: string[] = [];
	if (last.truffles_paid > 0) {
		spoils.push(`+${last.truffles_paid} Golden Truffles`);
	}
	if (last.tickles_paid > 0) {
		spoils.push(
			`+${last.tickles_paid} ${last.tickles_paid === 1 ? "tickle" : "tickles"}`,
		);
	}
	return spoils;
}

function LastRaceLine({ last }: { last: LastRace }) {
	const cosmetic = last.cosmetic_hat_id;
	const cosmeticImg = cosmetic ? cosmeticImage(cosmetic) : undefined;
	const spoils = spoilsLines(last);
	// rank < 1 → a sub-quorum PARTICIPATION result (the server sent rank null); it
	// has no placement, only the tickle floor. Never render a bogus "1st of N".
	const placed = last.rank >= 1;
	return (
		<View style={styles.lastRow}>
			{cosmeticImg && (
				<Image
					source={cosmeticImg}
					style={styles.lastCosmetic}
					resizeMode="contain"
				/>
			)}
			<Hand tone="secondary" align="center">
				{placed
					? `Last race: ${ordinal(last.rank)} of ${last.of}`
					: "Last race: you dug"}
				{spoils.length > 0 ? ` — you banked ${spoils.join(" · ")}` : ""}
				{cosmetic ? ` · ${cosmeticName(cosmetic)}` : ""}
			</Hand>
		</View>
	);
}

// ── The resolve ceremony ──────────────────────────────────────────────────────
// Plays once per cycle when a fresh placement lands — a celebration card with
// the reclaim burst + a haptic, then it settles into the last-race line.
function Ceremony({
	last,
	onDismiss,
}: {
	last: LastRace;
	onDismiss: () => void;
}) {
	const slamRef = useRef<ReclaimSlamHandle>(null);
	useEffect(() => {
		const t = setTimeout(() => {
			slamRef.current?.slam({ intensity: "burst", haptic: true });
		}, 260);
		return () => clearTimeout(t);
	}, []);

	const podium = last.rank >= 1 && last.rank <= 3;
	// rank < 1 → a sub-quorum participation result: no placement, a warm thank-you.
	const headline = !(last.rank >= 1)
		? "You dug this week — the herd thanks you"
		: podium
			? `You took ${ordinal(last.rank)} — the day is yours`
			: `Last week's race ended — you took ${ordinal(last.rank)} of ${last.of}`;

	const cosmetic = last.cosmetic_hat_id;
	const cosmeticImg = cosmetic ? cosmeticImage(cosmetic) : undefined;

	const dismiss = useCallback(() => {
		Haptics.selectionAsync().catch(() => {});
		onDismiss();
	}, [onDismiss]);

	const spoils = spoilsLines(last);

	return (
		<View style={styles.wrap}>
			<Kicker>the dig-off</Kicker>
			<Sticker
				color="sun"
				rotate={TILT.card}
				radius={RADII.lg}
				shadow="sm"
				style={styles.ceremonyCard}
			>
				<SectionTitle align="center" accessibilityRole="header">
					{headline}
				</SectionTitle>
				{spoils.length > 0 && (
					<T role="bodySm" align="center">
						you banked {spoils.join(" · ")}
					</T>
				)}
				{cosmetic && (
					<View style={styles.ceremonyCosmeticRow}>
						{cosmeticImg && (
							<Image
								source={cosmeticImg}
								style={styles.ceremonyCosmeticImg}
								resizeMode="contain"
							/>
						)}
						<Hand tone="accent">{cosmeticName(cosmetic)}</Hand>
					</View>
				)}
				<Button
					variant="ghost"
					size="sm"
					onPress={dismiss}
					accessibilityLabel="Trot home"
					accessibilityHint="Closes the race result and returns to the board"
					style={styles.ceremonyBtn}
				>
					trot home
				</Button>
				<ReclaimSlam ref={slamRef} />
			</Sticker>
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: { marginTop: SPACE.md, gap: SPACE.sm },
	loadingWrap: { marginTop: SPACE.md, alignItems: "center" },
	// ── The weekly hero card ──────────────────────────────────────────────────
	heroCard: {
		paddingHorizontal: SPACE.lg,
		paddingVertical: SPACE.md,
		gap: SPACE.md,
	},
	raceRule: { marginTop: -SPACE.xs },
	// ── This week's spoils strip ──────────────────────────────────────────────
	spoils: {
		alignItems: "center",
		gap: SPACE.xs,
		paddingTop: SPACE.md,
		borderTopWidth: BORDER.thin,
		borderTopColor: UI_COLORS.uiMuted,
		borderStyle: "dashed",
	},
	spoilsCompact: {
		alignItems: "center",
		gap: SPACE.xs,
		marginHorizontal: SPACE.md,
		marginBottom: SPACE.md,
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.md,
	},
	podiumRow: {
		flexDirection: "row",
		alignSelf: "stretch",
		gap: SPACE.sm,
	},
	podiumCell: {
		flex: 1,
		minWidth: 0,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: SPACE.xs,
	},
	podiumBadge: {
		width: PODIUM_BADGE,
		height: PODIUM_BADGE,
		borderRadius: RADII.pill,
		borderWidth: BORDER.thin,
		borderColor: UI_COLORS.border,
		alignItems: "center",
		justifyContent: "center",
	},
	// The medal's numeral is a display figure at label size — the one place the
	// `label` role wears Caprasimo, because it is a number on a medal.
	podiumBadgeText: { fontFamily: FONTS.whimsy },
	podiumRewards: { gap: SPACE.xs },
	podiumPrize: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
	podiumTruffle: { width: PRIZE_MARK, height: PRIZE_MARK },
	podiumTruffleNum: { fontFamily: FONTS.whimsy },
	// ── Shared standings rows ─────────────────────────────────────────────────
	board: { gap: SPACE.xs },
	boardHead: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingLeft: BOARD_HEAD_INSET,
		paddingRight: SPACE.sm,
	},
	rows: { gap: SPACE.xs },
	rowRank: { width: RANK_COL },
	// The expanded member ledger — indented under its row.
	ledger: {
		paddingLeft: SPACE.lg,
		paddingRight: SPACE.sm,
		paddingTop: SPACE.xs,
		paddingBottom: SPACE.xs,
		gap: SPACE.xs,
	},
	ledgerRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: SPACE.sm,
	},
	ledgerName: { flex: 1 },
	separatorRow: { alignItems: "center", paddingVertical: SPACE.xs },
	emptyBeat: {
		alignItems: "center",
		paddingVertical: SPACE.sm,
	},
	emptyGlyph: { marginBottom: SPACE.xs },
	// Last-race line.
	lastRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: SPACE.sm,
		paddingHorizontal: SPACE.xs,
	},
	lastCosmetic: { width: LINE_ART, height: LINE_ART },
	// Ceremony.
	ceremonyCard: {
		paddingHorizontal: SPACE.lg,
		paddingVertical: SPACE.lg,
		alignItems: "center",
		gap: SPACE.sm,
		overflow: "hidden",
	},
	ceremonyCosmeticRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
	},
	ceremonyCosmeticImg: { width: CEREMONY_ART, height: CEREMONY_ART },
	ceremonyBtn: { marginTop: SPACE.xs },
});
