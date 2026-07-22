// The Dig-Off RACE section — lives on the season tab, tucked inside the crew-
// only block. This one card reads the global standings and renders, top to
// bottom:
//   • the WEEKLY RACE HERO — this week's spoils ladder (tickles to the podium +
//     the "every digging snout wins" floor, from the server's `prizes`), the
//     weekly board (finds per digging snout, my row pinned), the countdown, and
//     the sub-quorum nudge. This is the beat anyone can win — promoted to the
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
import { View, Text, Pressable, Image, StyleSheet } from "react-native";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { Sticker } from "../ui/Sticker";
import { Glyph } from "../ui/Glyph";
import { TickleIcon } from "../ui/SnoutCoin";
import { LoadingBeat } from "../ui/EmptyState";
import { ReclaimSlam, ReclaimSlamHandle } from "../mudwar/ReclaimSlam";
import { useRace } from "@/hooks/useRace";
import {
	LastRace,
	RaceCrewDetail,
	RacePrizes,
	RaceStandings,
	SeasonStandingsRow,
	StandingsRow,
	cycleEndWeekday,
	fetchRaceCrewDetail,
	formatRaceCountdown,
	perSnoutLabel,
	raceCycle,
	standingsRows,
	standingsRowsSeason,
} from "@/utils/race";
import { cosmeticImage, cosmeticName } from "@/utils/rewardArt";
import { COLORS, FONTS, RADII, SHADOW_SM, SPACE, TYPE, WHIMSY } from "@/constants/theme";

const VISIBLE_ROWS = 5;
// The season board shows this many rows before "see the full field" — kept short
// so the WEEKLY hero above it stays the focus.
const SEASON_PEEK_ROWS = 3;

// cosmeticName (id → "Mud Derby Bg") + cosmeticImage (id → sprite) now live in
// utils/rewardArt, the single owner of cosmetic art/name resolution.

// "3rd of 12" — ordinal placement. Exported so the full-field page reuses it.
export function ordinal(n: number): string {
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
}: {
	myCrewId: string | null;
	crewSize: number;
	/** Bumped by the tab after a banked dig — the board refetches so my fresh
	 *  finds move the standings immediately (focus never changes under the
	 *  dig modal, so useRace's focus-refresh alone leaves this card stale). */
	refreshKey?: number;
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
			AsyncStorage.setItem("race_seen", JSON.stringify([...next])).catch(() => {});
			return next;
		});
	}, []);

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
			<Text style={styles.kicker}>★ the dig-off</Text>
			{/* The promise, up front — every Monday the whole barnyard splits the
			    spoils, and every digging Sounder takes a share. */}
			<Text style={styles.promise}>
				every Monday the whole barnyard splits the spoils — dig this week to
				take your share
			</Text>
			<WeeklyHero state={state} myCrewId={myCrewId} crewSize={crewSize} />
			<SeasonBoard state={state} myCrewId={myCrewId} />
			{last && <LastRaceLine last={last} />}
		</View>
	);
}

// ── THE WEEKLY HERO — this week's spoils + board + countdown ───────────────────
// The promoted board: the race anyone can win by simply digging strong this week.
function WeeklyHero({
	state,
	myCrewId,
	crewSize,
}: {
	state: RaceStandings;
	myCrewId: string | null;
	crewSize: number;
}) {
	const endsAtMs = useMemo(() => {
		const t = new Date(state.cycle.ends_at).getTime();
		return Number.isFinite(t) ? t : raceCycle().endsAtMs;
	}, [state.cycle.ends_at]);

	const [countdown, setCountdown] = useState(() => raceCountdownChip(endsAtMs));
	useEffect(() => {
		setCountdown(raceCountdownChip(endsAtMs));
		const t = setInterval(() => setCountdown(raceCountdownChip(endsAtMs)), 60000);
		return () => clearInterval(t);
	}, [endsAtMs]);

	// The weekly pinned-row view: top ranked rows + my pinned row (per-snout score).
	const view = standingsRows(state, myCrewId, VISIBLE_ROWS);
	const rows = view.rows;
	const empty = rows.length === 0;

	// The expandable member ledger. One crew open at a time; each crew's detail
	// is fetched once and cached ("dark" if the RPC resolves null pre-push).
	const [expandedCrew, setExpandedCrew] = useState<string | null>(null);
	const [detailCache, setDetailCache] = useState<
		Record<string, RaceCrewDetail | "dark">
	>({});
	const toggleCrew = useCallback(
		(crewId: string) => {
			const willExpand = expandedCrew !== crewId;
			setExpandedCrew(willExpand ? crewId : null);
			if (willExpand && detailCache[crewId] === undefined) {
				fetchRaceCrewDetail(crewId).then((d) => {
					if (d) {
						setDetailCache((c) => ({ ...c, [crewId]: d }));
					} else {
						setDetailCache((c) => ({ ...c, [crewId]: "dark" }));
						setExpandedCrew((cur) => (cur === crewId ? null : cur));
					}
				});
			}
		},
		[expandedCrew, detailCache]
	);

	return (
		<Sticker color="sun" rotate={-0.4} radius={RADII.lg} style={styles.heroCard}>
			<View style={styles.heroHead}>
				<Text style={styles.heroKicker}>★ this week's race</Text>
				<View style={styles.countdownPill}>
					<Text style={styles.countdownText}>{countdown}</Text>
				</View>
			</View>

			{/* The spoils ladder — stated before the board, from the server prizes. */}
			<SpoilsStrip prizes={state.prizes} />

			{empty ? (
				<View style={styles.emptyBeat}>
					<Glyph name="zzz" size={28} style={{ opacity: 0.85, marginBottom: SPACE.xs }} />
					<Text style={styles.emptyLine}>
						the patch is quiet — first finds take this week's lead
					</Text>
				</View>
			) : (
				<View style={styles.rows}>
					{rows.map((r, i) => {
						const crewId = r.kind === "separator" ? null : r.crew_id;
						const expanded = !!crewId && crewId === expandedCrew;
						return (
							<View key={weeklyRowKey(r, i)}>
								<WeeklyRow
									row={r}
									onPress={crewId ? () => toggleCrew(crewId) : undefined}
								/>
								{expanded && crewId && <CrewLedger entry={detailCache[crewId]} />}
							</View>
						);
					})}
				</View>
			)}

			<WeeklyBeat state={state} crewSize={crewSize} />

			{rows.length > 0 && (
				<Pressable
					onPress={() =>
						router.push({
							pathname: "/race-standings",
							params: myCrewId ? { crew: myCrewId } : {},
						})
					}
					hitSlop={8}
					style={({ pressed }) => [styles.fullFieldLink, pressed && { opacity: 0.6 }]}
				>
					<Text style={styles.fullFieldText}>see the full field ›</Text>
				</Pressable>
			)}
		</Sticker>
	);
}

// ── This week's spoils ladder — the pot, visible before Monday ─────────────────
// Server-authoritative (state.prizes): the podium tickle prizes headline (the
// new reward the founder wants obvious), with truffles + the prize hat + the
// participation floor spelled out beneath. Renders even on a cold board so a
// first player sees exactly what's on the line.
function SpoilsStrip({ prizes }: { prizes: RacePrizes }) {
	const podium: { place: string; badge: string; tint: string; tickles: number }[] = [
		{ place: "1st", badge: "1", tint: COLORS.gold, tickles: prizes.tickles.first },
		{ place: "2nd", badge: "2", tint: COLORS.silver, tickles: prizes.tickles.second },
		{ place: "3rd", badge: "3", tint: COLORS.bronze, tickles: prizes.tickles.third },
	];
	return (
		<View style={styles.spoils}>
			<Text style={styles.spoilsKicker}>★ this week's spoils</Text>
			<View style={styles.podiumRow}>
				{podium.map((p) => (
					<View key={p.place} style={styles.podiumCell}>
						<View style={[styles.podiumBadge, { backgroundColor: p.tint }]}>
							<Text style={styles.podiumBadgeText}>{p.badge}</Text>
						</View>
						<View style={styles.podiumPrize}>
							<TickleIcon size={18} />
							<Text style={styles.podiumNum}>{p.tickles}</Text>
						</View>
					</View>
				))}
			</View>
			<View style={styles.spoilsFootRow}>
				<Image
					source={cosmeticImage("golden_truffle")}
					style={styles.truffleIcon}
					resizeMode="contain"
				/>
				<Text style={styles.spoilsFoot}>
					+ {prizes.truffles.first}·{prizes.truffles.second}·{prizes.truffles.third}{" "}
					Golden Truffles & a prize hat to the podium
				</Text>
			</View>
			<Text style={styles.spoilsFloor}>
				every digging snout banks {prizes.tickles.participation}+ tickles
			</Text>
		</View>
	);
}

// ── A weekly board row — scored by finds per digging snout (the rank metric) ───
function WeeklyRow({
	row,
	onPress,
}: {
	row: StandingsRow;
	onPress?: () => void;
}) {
	if (row.kind === "separator") {
		return (
			<View style={styles.separatorRow}>
				<Text style={styles.separatorDots}>· · ·</Text>
			</View>
		);
	}
	const ranked = row.kind === "ranked";
	return (
		<Pressable
			onPress={onPress}
			disabled={!onPress}
			style={({ pressed }) => [
				styles.row,
				row.highlighted && styles.rowMine,
				pressed && onPress && styles.rowPressed,
			]}
		>
			<Text style={styles.rowRank}>{ranked ? `#${row.rank}` : "—"}</Text>
			<View style={styles.rowMid}>
				<Text style={styles.rowName} numberOfLines={1}>
					{row.name}
				</Text>
				{row.diggers > 0 && (
					<Text style={styles.rowSub}>
						{row.diggers} digging{ranked ? "" : " · needs a second snout"}
					</Text>
				)}
			</View>
			<View style={styles.rowFindsCol}>
				<Text style={styles.rowFindsNum}>{perSnoutLabel(row.avg)}</Text>
				<Text style={styles.rowFindsCap}>per snout</Text>
			</View>
		</Pressable>
	);
}

export function weeklyRowKey(r: StandingsRow, i: number): string {
	if (r.kind === "separator") return `sep-${i}`;
	return `${r.crew_id || r.name}-${i}`;
}

// The inline member breakdown under an expanded board row. `undefined` while the
// fetch is in flight (→ a loading beat); "dark" never renders (the row auto-
// collapses first). Otherwise one line per digger, finds DESC as the server sent.
export function CrewLedger({ entry }: { entry: RaceCrewDetail | "dark" | undefined }) {
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
				<View
					key={mem.user_id}
					style={[styles.ledgerRow, mem.departed && { opacity: 0.55 }]}
				>
					<Text style={styles.ledgerName} numberOfLines={1}>
						{mem.username}
					</Text>
					<Text style={styles.ledgerCount}>
						{mem.departed
							? `${mem.finds} this week · trotted on`
							: `${mem.finds} this week · ${mem.season_finds} season`}
					</Text>
				</View>
			))}
		</View>
	);
}

// ── THE SEASON BOARD — cumulative finds, all season (secondary, collapsible) ───
function SeasonBoard({
	state,
	myCrewId,
}: {
	state: RaceStandings;
	myCrewId: string | null;
}) {
	const [open, setOpen] = useState(false);
	const rows = standingsRowsSeason(
		state.season,
		state.mineSeason,
		myCrewId,
		open ? VISIBLE_ROWS : SEASON_PEEK_ROWS
	);
	if (rows.length === 0) return null;

	return (
		<Sticker color="paper" rotate={0.3} radius={RADII.lg} style={styles.seasonCard}>
			<Pressable
				onPress={() => setOpen((o) => !o)}
				hitSlop={6}
				style={({ pressed }) => [styles.seasonHead, pressed && { opacity: 0.6 }]}
				accessibilityRole="button"
				accessibilityLabel={open ? "Collapse the season board" : "Expand the season board"}
			>
				<View style={{ flex: 1 }}>
					<Text style={styles.seasonKicker}>★ season standings</Text>
					<Text style={styles.seasonSub}>cumulative finds, all season long</Text>
				</View>
				<Text style={styles.seasonToggle}>{open ? "less ›" : "more ›"}</Text>
			</Pressable>

			<View style={styles.rows}>
				{rows.map((r, i) => (
					<SeasonRow key={seasonRowKey(r, i)} row={r} />
				))}
			</View>

			<Pressable
				onPress={() =>
					router.push({
						pathname: "/race-standings",
						params: myCrewId ? { crew: myCrewId, board: "season" } : { board: "season" },
					})
				}
				hitSlop={8}
				style={({ pressed }) => [styles.fullFieldLink, pressed && { opacity: 0.6 }]}
			>
				<Text style={styles.fullFieldText}>see the full season ›</Text>
			</Pressable>
		</Sticker>
	);
}

export function seasonRowKey(r: SeasonStandingsRow, i: number): string {
	if (r.kind === "separator") return `sep-${i}`;
	return `${r.crew_id || r.name}-${i}`;
}

export function SeasonRow({
	row,
	onPress,
}: {
	row: SeasonStandingsRow;
	onPress?: () => void;
}) {
	if (row.kind === "separator") {
		return (
			<View style={styles.separatorRow}>
				<Text style={styles.separatorDots}>· · ·</Text>
			</View>
		);
	}
	return (
		<Pressable
			onPress={onPress}
			disabled={!onPress}
			style={({ pressed }) => [
				styles.row,
				row.highlighted && styles.rowMine,
				pressed && onPress && styles.rowPressed,
			]}
		>
			<Text style={styles.rowRank}>#{row.rank}</Text>
			<View style={styles.rowMid}>
				<Text style={styles.rowName} numberOfLines={1}>
					{row.name}
				</Text>
				{row.diggers > 0 && (
					<Text style={styles.rowSub}>{row.diggers} digging</Text>
				)}
			</View>
			<View style={styles.rowFindsCol}>
				<Text style={styles.rowFindsNum}>{row.total_finds}</Text>
				<Text style={styles.rowFindsCap}>
					{row.total_finds === 1 ? "find" : "finds"}
				</Text>
			</View>
		</Pressable>
	);
}

// ── The weekly beat — one line off the weekly `mine` data ──────────────────────
// Status (placement / sub-quorum nudge / cold-start prompt). Sits under the board
// inside the hero.
function WeeklyBeat({
	state,
	crewSize,
}: {
	state: RaceStandings;
	crewSize: number;
}) {
	const mine = state.mine;
	let line: string;
	// Sub-quorum — the weekly ranking needs two distinct diggers. When the crew is
	// solo there's a dead end unless we route them to invite a second snout; the
	// "invite ›" affordance below appears only in that case.
	const subQuorumSolo = !!mine && mine.rank == null && crewSize < 2;
	if (mine && mine.rank != null) {
		const ofN = Math.max(state.ranked.length, mine.rank);
		line = `your Sounder: ${ordinal(mine.rank)} of ${ofN} this week`;
	} else if (mine) {
		// A solo crew needs a second SNOUT (routed to the invite surface); a crew
		// that already has members just needs one of them to dig.
		line =
			crewSize < 2
				? "the podium needs two diggers"
				: "the podium needs two diggers — one more snout must dig";
	} else {
		line = "dig this week to take a share";
	}
	return (
		<View style={styles.weeklyBeatRow}>
			<Text style={styles.weeklyLine}>{line}</Text>
			{subQuorumSolo && (
				<Pressable
					onPress={() => router.push("/(tabs)/friends?seg=sounder")}
					hitSlop={8}
					accessibilityRole="button"
					accessibilityLabel="Invite a second snout to your Sounder"
					style={({ pressed }) => [styles.inviteRow, pressed && { opacity: 0.6 }]}
				>
					<Glyph name="friends" size={14} />
					<Text style={styles.inviteLink}>invite a second snout ›</Text>
				</Pressable>
			)}
		</View>
	);
}

// The countdown chip text: "ends Monday" while far out, "ends in 22h" in the last
// day, "ends any moment" at the bell.
function raceCountdownChip(endsAtMs: number, nowMs: number = Date.now()): string {
	const left = endsAtMs - nowMs;
	if (left <= 0) return "ends any moment";
	if (left >= 24 * 3600_000) return `ends ${cycleEndWeekday(endsAtMs)}`;
	return `ends in ${formatRaceCountdown(endsAtMs, nowMs)}`;
}

// ── Last-race line (settled state) ────────────────────────────────────────────
function LastRaceLine({ last }: { last: LastRace }) {
	const cosmetic = last.cosmetic_hat_id;
	const cosmeticImg = cosmetic ? cosmeticImage(cosmetic) : undefined;
	const spoils: string[] = [];
	if (last.truffles_paid > 0) {
		spoils.push(`+${last.truffles_paid} ${last.truffles_paid === 1 ? "truffle" : "truffles"}`);
	}
	if (last.tickles_paid > 0) {
		spoils.push(`+${last.tickles_paid} ${last.tickles_paid === 1 ? "tickle" : "tickles"}`);
	}
	// rank < 1 → a sub-quorum PARTICIPATION result (the server sent rank null); it
	// has no placement, only the tickle floor. Never render a bogus "1st of N".
	const placed = last.rank >= 1;
	return (
		<View style={styles.lastRow}>
			{cosmeticImg && (
				<Image source={cosmeticImg} style={styles.lastCosmetic} resizeMode="contain" />
			)}
			<Text style={styles.lastText}>
				{placed ? `Last race: ${ordinal(last.rank)} of ${last.of}` : "Last race: you dug"}
				{spoils.length > 0 ? ` — ${spoils.join(" · ")}${placed ? " each" : ""}` : ""}
				{cosmetic ? ` · ${cosmeticName(cosmetic)}` : ""}
			</Text>
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
			: `${ordinal(last.rank)} of ${last.of} — every find starved him`;

	const cosmetic = last.cosmetic_hat_id;
	const cosmeticImg = cosmetic ? cosmeticImage(cosmetic) : undefined;

	const dismiss = useCallback(() => {
		Haptics.selectionAsync().catch(() => {});
		onDismiss();
	}, [onDismiss]);

	// The spoils line — truffles + tickles, whichever the payout banked.
	const spoils: string[] = [];
	if (last.truffles_paid > 0) {
		spoils.push(`+${last.truffles_paid} ${last.truffles_paid === 1 ? "truffle" : "truffles"}`);
	}
	if (last.tickles_paid > 0) {
		spoils.push(`+${last.tickles_paid} ${last.tickles_paid === 1 ? "tickle" : "tickles"}`);
	}

	return (
		<View style={styles.wrap}>
			<Text style={styles.kicker}>★ the dig-off</Text>
			<Sticker color="sun" rotate={-0.6} radius={RADII.lg} style={styles.ceremonyCard}>
				<Text style={styles.ceremonyHead}>{headline}</Text>
				{spoils.length > 0 && (
					<Text style={styles.ceremonySpoils}>
						{spoils.join(" · ")} for every snout
					</Text>
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
						<Text style={styles.ceremonyCosmeticName}>{cosmeticName(cosmetic)}</Text>
					</View>
				)}
				<Pressable onPress={dismiss} hitSlop={8} style={({ pressed }) => [styles.ceremonyBtn, pressed && { opacity: 0.7 }]}>
					<Text style={styles.ceremonyBtnText}>trot home</Text>
				</Pressable>
				<ReclaimSlam ref={slamRef} />
			</Sticker>
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: { marginTop: SPACE.md, gap: SPACE.sm },
	loadingWrap: { marginTop: SPACE.md, alignItems: "center" },
	kicker: {
		...TYPE.kicker,
		color: WHIMSY.accent,
	},
	// The payout-promise line under the dig-off kicker — stated before the board.
	promise: {
		...TYPE.bodySm,
		fontFamily: FONTS.bodyExtra,
		color: WHIMSY.ink,
	},
	// ── The weekly hero card ──────────────────────────────────────────────────
	heroCard: {
		paddingHorizontal: SPACE.lg,
		paddingVertical: SPACE.md,
		gap: SPACE.sm,
		...SHADOW_SM,
	},
	heroHead: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	heroKicker: { ...TYPE.kicker, color: WHIMSY.accent },
	countdownPill: {
		backgroundColor: WHIMSY.paper,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.pill,
		paddingHorizontal: SPACE.sm,
		paddingVertical: 2,
	},
	countdownText: { ...TYPE.kicker, fontFamily: FONTS.hand, color: WHIMSY.ink },
	// The full-field link — centered hand-font mute link under the board rows.
	fullFieldLink: { alignSelf: "center", paddingVertical: SPACE.xs },
	fullFieldText: {
		...TYPE.kicker,
		fontFamily: FONTS.hand,
		color: WHIMSY.accent,
		textDecorationLine: "underline",
	},
	// The weekly beat — one placement line under the board.
	weeklyBeatRow: {
		alignItems: "center",
		gap: SPACE.xs,
		marginTop: SPACE.xs,
		paddingTop: SPACE.sm,
		borderTopWidth: 1.5,
		borderTopColor: WHIMSY.muteSoft,
		borderStyle: "dashed",
	},
	weeklyLine: {
		...TYPE.bodySm,
		fontFamily: FONTS.bodyExtra,
		color: WHIMSY.ink,
		textAlign: "center",
	},
	// The sub-quorum "invite a second snout ›" affordance — a gem-less friends-
	// glyph row routing to the Sounder surface, so a solo digger isn't dead-ended.
	inviteRow: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
	inviteLink: {
		...TYPE.kicker,
		fontFamily: FONTS.hand,
		color: WHIMSY.accent,
		textDecorationLine: "underline",
	},
	// ── This week's spoils strip ──────────────────────────────────────────────
	spoils: {
		alignItems: "center",
		gap: SPACE.xs,
		paddingVertical: SPACE.sm,
		paddingHorizontal: SPACE.sm,
		backgroundColor: WHIMSY.paper,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.md,
	},
	spoilsKicker: { ...TYPE.kicker, fontFamily: FONTS.hand, color: WHIMSY.accent },
	podiumRow: {
		flexDirection: "row",
		justifyContent: "center",
		gap: SPACE.lg,
	},
	podiumCell: { alignItems: "center", gap: 3 },
	podiumBadge: {
		width: 22,
		height: 22,
		borderRadius: RADII.pill,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
	},
	podiumBadgeText: { fontFamily: FONTS.whimsy, fontSize: 12, color: WHIMSY.ink },
	podiumPrize: { flexDirection: "row", alignItems: "center", gap: 3 },
	podiumNum: { fontFamily: FONTS.whimsy, fontSize: 18, color: WHIMSY.ink },
	spoilsFootRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: SPACE.xs,
		flexWrap: "wrap",
	},
	truffleIcon: { width: 16, height: 16 },
	spoilsFoot: {
		...TYPE.kicker,
		fontFamily: FONTS.hand,
		color: WHIMSY.mute,
		textAlign: "center",
		flexShrink: 1,
	},
	spoilsFloor: {
		...TYPE.bodySm,
		fontFamily: FONTS.bodyExtra,
		color: WHIMSY.ink,
		textAlign: "center",
	},
	// ── The season board (secondary) ──────────────────────────────────────────
	seasonCard: {
		paddingHorizontal: SPACE.lg,
		paddingVertical: SPACE.md,
		gap: SPACE.sm,
	},
	seasonHead: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
	seasonKicker: { ...TYPE.kicker, color: WHIMSY.accent },
	seasonSub: { ...TYPE.kicker, fontFamily: FONTS.hand, color: WHIMSY.mute },
	seasonToggle: {
		...TYPE.kicker,
		fontFamily: FONTS.hand,
		color: WHIMSY.accent,
		textDecorationLine: "underline",
	},
	// ── Shared standings rows ─────────────────────────────────────────────────
	rows: { gap: SPACE.xs },
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
		paddingHorizontal: SPACE.sm,
		paddingVertical: SPACE.xs + 1,
		borderRadius: RADII.sm,
	},
	rowMine: {
		backgroundColor: WHIMSY.sun,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
	},
	rowPressed: { opacity: 0.6 },
	// The expanded member ledger — indented under its row.
	ledger: {
		paddingLeft: SPACE.lg,
		paddingRight: SPACE.sm,
		paddingTop: SPACE.xs,
		paddingBottom: SPACE.xs,
		gap: 2,
	},
	ledgerRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: SPACE.sm,
	},
	ledgerName: {
		flex: 1,
		...TYPE.hand,
		fontFamily: FONTS.hand,
		color: WHIMSY.mute,
	},
	ledgerCount: {
		...TYPE.hand,
		fontFamily: FONTS.hand,
		color: WHIMSY.mute,
		textAlign: "right",
	},
	rowRank: {
		...TYPE.numeral,
		color: WHIMSY.ink,
		width: 34,
	},
	rowMid: { flex: 1, minWidth: 0 },
	rowName: { ...TYPE.cardTitle, fontFamily: FONTS.whimsy, color: WHIMSY.ink },
	rowSub: { ...TYPE.kicker, fontFamily: FONTS.hand, color: WHIMSY.mute },
	// The score column — big whimsy number over a tiny caption.
	rowFindsCol: { alignItems: "flex-end", minWidth: 52 },
	rowFindsNum: { ...TYPE.sectionTitle, color: WHIMSY.ink },
	rowFindsCap: {
		...TYPE.kickerPill,
		fontSize: 10,
		letterSpacing: 0.8,
		color: WHIMSY.mute,
		marginTop: -2,
	},
	separatorRow: { alignItems: "center", paddingVertical: 2 },
	separatorDots: {
		...TYPE.kicker,
		fontFamily: FONTS.hand,
		color: WHIMSY.muteSoft,
		letterSpacing: 2,
	},
	emptyBeat: {
		alignItems: "center",
		paddingVertical: SPACE.sm,
	},
	emptyLine: {
		...TYPE.hand,
		fontFamily: FONTS.hand,
		color: WHIMSY.mute,
		textAlign: "center",
	},
	// Last-race line.
	lastRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: SPACE.xs + 2,
		paddingHorizontal: SPACE.xs,
	},
	lastCosmetic: { width: 18, height: 18 },
	lastText: {
		...TYPE.hand,
		fontFamily: FONTS.hand,
		color: WHIMSY.mute,
		textAlign: "center",
	},
	// Ceremony.
	ceremonyCard: {
		paddingHorizontal: SPACE.lg,
		paddingVertical: SPACE.lg,
		alignItems: "center",
		gap: SPACE.sm,
		overflow: "hidden",
		...SHADOW_SM,
	},
	ceremonyHead: {
		fontFamily: FONTS.whimsy,
		fontSize: 20,
		color: WHIMSY.ink,
		textAlign: "center",
		lineHeight: 24,
	},
	ceremonySpoils: {
		...TYPE.bodySm,
		fontFamily: FONTS.bodyExtra,
		color: WHIMSY.ink,
		textAlign: "center",
	},
	ceremonyCosmeticRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.xs + 2,
	},
	ceremonyCosmeticImg: { width: 22, height: 22 },
	ceremonyCosmeticName: {
		...TYPE.hand,
		fontFamily: FONTS.hand,
		color: WHIMSY.accent,
	},
	ceremonyBtn: {
		marginTop: SPACE.xs,
		backgroundColor: WHIMSY.paper,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.pill,
		paddingHorizontal: SPACE.lg,
		paddingVertical: SPACE.xs + 2,
		...SHADOW_SM,
	},
	ceremonyBtnText: { fontFamily: FONTS.whimsy, fontSize: 15, color: WHIMSY.ink },
});
