// The Dig-Off RACE section — lives on the season tab, tucked inside the crew-
// only block. This one card reads the global standings and renders, top to
// bottom: the SEASON-CUMULATIVE board (rank + crew + total finds — the headline
// ranking, every crew with a find ranks), my pinned row, one merged weekly line
// with the countdown folded in ("this week: 2nd of 7 · ends Monday"), a last-race
// line, and — once per cycle — the resolve ceremony when my last weekly placement
// is fresh + unseen. The season explainer lives in SeasonGuideModal now, reached
// via the "how the season works ›" link, so this card carries no inline sentence.
//
// Tapping any board row expands an inline MEMBER LEDGER underneath it — each
// digger's finds this week + cumulative season finds, from race_crew_detail. One
// row open at a time; a crew whose detail RPC is still dark (unpushed) auto-
// collapses so there's never a dead panel.
//
// No challenges, no rival, no pot — draining is instant, the race just ranks it.
// Feature-dark until the migration is pushed (useRace reports it) — then this
// renders nothing at all.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, Image, StyleSheet } from "react-native";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { Sticker } from "../ui/Sticker";
import { LoadingBeat } from "../ui/EmptyState";
import { ReclaimSlam, ReclaimSlamHandle } from "../mudwar/ReclaimSlam";
import { useRace } from "@/hooks/useRace";
import {
	LastRace,
	RaceCrewDetail,
	RaceStandings,
	SeasonStandingsRow,
	cycleEndWeekday,
	fetchRaceCrewDetail,
	formatRaceCountdown,
	raceCycle,
	standingsRowsSeason,
} from "@/utils/dig";
import { HAT_IMAGES } from "@/constants/hats";
import { RACE_TRUFFLE_TABLE } from "@/constants/dig";
import { FONTS, RADII, SHADOW_SM, SPACE, TYPE, WHIMSY } from "@/constants/theme";

const VISIBLE_ROWS = 5;

// Humanize a cosmetic id ("mud_derby_bg" → "Mud Derby Bg") for the spoils line.
// The dig's rewards resolve their art through HAT_IMAGES; the id is the only
// name we carry, so title-case it rather than ship a raw slug.
function cosmeticName(hatId: string): string {
	return hatId
		.split("_")
		.filter(Boolean)
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(" ");
}

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
			<StandingsCard state={state} myCrewId={myCrewId} crewSize={crewSize} />
			{last && <LastRaceLine last={last} />}
		</View>
	);
}

// ── The standings — season board (headline) + the weekly beat line ────────────
function StandingsCard({
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

	const rows = standingsRowsSeason(
		state.season,
		state.mineSeason,
		myCrewId,
		VISIBLE_ROWS
	);
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
			// First expand → fetch the ledger. A null result means the RPC is dark
			// (unpushed) — cache that + auto-collapse so no empty panel shows.
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
		<Sticker color="paper" rotate={-0.4} radius={RADII.lg} style={styles.card}>
			{empty ? (
				<Text style={styles.emptyLine}>
					the patch is quiet — first finds take the lead
				</Text>
			) : (
				<View style={styles.rows}>
					{rows.map((r, i) => {
						const crewId = r.kind === "separator" ? null : r.crew_id;
						const expanded = !!crewId && crewId === expandedCrew;
						return (
							<View key={seasonRowKey(r, i)}>
								<SeasonRow
									row={r}
									onPress={crewId ? () => toggleCrew(crewId) : undefined}
								/>
								{expanded && crewId && <CrewLedger entry={detailCache[crewId]} />}
							</View>
						);
					})}
				</View>
			)}

			{/* The board shows only the top rows — this opens the full field. */}
			{rows.length > 0 && (
				<Pressable
					onPress={() =>
						// Carry my crew id along — the full-field page pins/highlights my
						// row from it (its own payload has no authoritative crew id).
						router.push({
							pathname: "/race-standings",
							params: myCrewId ? { crew: myCrewId } : {},
						})
					}
					hitSlop={8}
					style={styles.fullFieldLink}
				>
					<Text style={styles.fullFieldText}>see the full field ›</Text>
				</Pressable>
			)}

			<View style={styles.weeklyBlock}>
				<SpoilsStrip />
				<WeeklyBeat state={state} countdown={countdown} crewSize={crewSize} />
			</View>
		</Sticker>
	);
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
				<View key={mem.user_id} style={styles.ledgerRow}>
					<Text style={styles.ledgerName} numberOfLines={1}>
						{mem.username}
					</Text>
					<Text style={styles.ledgerCount}>
						{mem.finds} this week · {mem.season_finds} season
					</Text>
				</View>
			))}
		</View>
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

// ── This week's spoils — the pot, visible before Monday ───────────────────────
// Static from RACE_TRUFFLE_TABLE (the client mirror of the payout migration).
// Surfaces the reward the race already pays every Monday while it's still
// winnable, so digging today carries a visible stake. No server data — renders
// even on a cold board so a first player sees what's on the line.
function SpoilsStrip() {
	return (
		<View style={styles.spoils}>
			<Text style={styles.spoilsKicker}>★ this week's spoils</Text>
			<View style={styles.spoilsRow}>
				<Image
					source={HAT_IMAGES.golden_truffle}
					style={styles.truffleIcon}
					resizeMode="contain"
				/>
				<Text style={styles.spoilsText}>
					{RACE_TRUFFLE_TABLE[1]} · {RACE_TRUFFLE_TABLE[2]} · {RACE_TRUFFLE_TABLE[3]} to the
					podium + a prize hat · {RACE_TRUFFLE_TABLE.ranked}–{RACE_TRUFFLE_TABLE.topHalf} for
					the field
				</Text>
			</View>
		</View>
	);
}

// ── The weekly beat — one merged line off the weekly `mine`/`ranked` data ─────
// Status half (placement / sub-quorum nudge / cold-start prompt) + the countdown,
// folded together as "{line} · {countdown}". Sits under the spoils strip inside
// the shared weekly block (dashed rule owned by the parent now).
function WeeklyBeat({
	state,
	countdown,
	crewSize,
}: {
	state: RaceStandings;
	countdown: string;
	crewSize: number;
}) {
	const mine = state.mine;
	let line: string;
	if (mine && mine.rank != null) {
		const ofN = Math.max(state.ranked.length, mine.rank);
		line = `this week: ${ordinal(mine.rank)} of ${ofN}`;
	} else if (mine) {
		// Sub-quorum — the weekly ranking needs two distinct diggers. Nudge for a
		// second crewmate when the crew is solo, or for a second snout to dig when
		// the crew already has members who haven't dug this week.
		line =
			crewSize < 2
				? "spoils need two diggers — invite a second snout"
				: "spoils need two diggers — one more snout must dig";
	} else {
		line = "dig this week for Monday's spoils";
	}
	return (
		<Text style={styles.weeklyLine}>
			{line} · {countdown}
		</Text>
	);
}

// The countdown chip text: "ends Monday" while far out, "race ends in 22h" in
// the last day, "race ends any moment" at the bell.
function raceCountdownChip(endsAtMs: number, nowMs: number = Date.now()): string {
	const left = endsAtMs - nowMs;
	if (left <= 0) return "race ends any moment";
	if (left >= 24 * 3600_000) return `ends ${cycleEndWeekday(endsAtMs)}`;
	return `race ends in ${formatRaceCountdown(endsAtMs, nowMs)}`;
}

// ── Last-race line (settled state) ────────────────────────────────────────────
function LastRaceLine({ last }: { last: LastRace }) {
	const cosmetic = last.cosmetic_hat_id;
	const cosmeticImg = cosmetic ? HAT_IMAGES[cosmetic] : undefined;
	return (
		<View style={styles.lastRow}>
			{cosmeticImg && (
				<Image source={cosmeticImg} style={styles.lastCosmetic} resizeMode="contain" />
			)}
			<Text style={styles.lastText}>
				Last race: {ordinal(last.rank)} of {last.of}
				{last.truffles_paid > 0
					? ` — +${last.truffles_paid} ${
							last.truffles_paid === 1 ? "truffle" : "truffles"
						} each`
					: ""}
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
	const headline = podium
		? `You took ${ordinal(last.rank)} — the day is yours`
		: `${ordinal(last.rank)} of ${last.of} — every find starved him`;

	const cosmetic = last.cosmetic_hat_id;
	const cosmeticImg = cosmetic ? HAT_IMAGES[cosmetic] : undefined;

	const dismiss = useCallback(() => {
		Haptics.selectionAsync().catch(() => {});
		onDismiss();
	}, [onDismiss]);

	return (
		<View style={styles.wrap}>
			<Text style={styles.kicker}>★ the dig-off</Text>
			<Sticker color="sun" rotate={-0.6} radius={RADII.lg} style={styles.ceremonyCard}>
				<Text style={styles.ceremonyHead}>{headline}</Text>
				{last.truffles_paid > 0 && (
					<Text style={styles.ceremonySpoils}>
						+{last.truffles_paid}{" "}
						{last.truffles_paid === 1 ? "truffle" : "truffles"} for every snout
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
				<Pressable onPress={dismiss} hitSlop={8} style={styles.ceremonyBtn}>
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
	card: {
		paddingHorizontal: SPACE.lg,
		paddingVertical: SPACE.md,
		gap: SPACE.sm,
	},
	// The full-field link — centered hand-font mute link under the board rows.
	fullFieldLink: { alignSelf: "center", paddingVertical: SPACE.xs },
	fullFieldText: {
		...TYPE.kicker,
		fontFamily: FONTS.hand,
		color: WHIMSY.accent,
		textDecorationLine: "underline",
	},
	// The weekly beat — one merged placement + countdown line under the board.
	weeklyBlock: {
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
	// This week's spoils strip.
	spoils: { alignItems: "center", gap: 2 },
	spoilsKicker: { ...TYPE.kicker, fontFamily: FONTS.hand, color: WHIMSY.accent },
	spoilsRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: SPACE.xs,
		flexWrap: "wrap",
	},
	truffleIcon: { width: 16, height: 16 },
	spoilsText: {
		...TYPE.kicker,
		fontFamily: FONTS.hand,
		color: WHIMSY.mute,
		textAlign: "center",
		flexShrink: 1,
	},
	// Standings rows.
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
		fontFamily: FONTS.whimsy,
		fontSize: 16,
		color: WHIMSY.ink,
		width: 34,
	},
	rowMid: { flex: 1, minWidth: 0 },
	rowName: { ...TYPE.cardTitle, fontFamily: FONTS.whimsy, color: WHIMSY.ink },
	rowSub: { ...TYPE.kicker, fontFamily: FONTS.hand, color: WHIMSY.mute },
	// Cumulative-finds column — big whimsy number over a tiny "finds" caption.
	rowFindsCol: { alignItems: "flex-end", minWidth: 44 },
	rowFindsNum: { fontFamily: FONTS.whimsy, fontSize: 22, color: WHIMSY.ink },
	rowFindsCap: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 9,
		letterSpacing: 0.8,
		textTransform: "uppercase",
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
	emptyLine: {
		...TYPE.hand,
		fontFamily: FONTS.hand,
		color: WHIMSY.mute,
		textAlign: "center",
		paddingVertical: SPACE.sm,
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
		borderRadius: 999,
		paddingHorizontal: SPACE.lg,
		paddingVertical: SPACE.xs + 2,
		...SHADOW_SM,
	},
	ceremonyBtnText: { fontFamily: FONTS.whimsy, fontSize: 15, color: WHIMSY.ink },
});
