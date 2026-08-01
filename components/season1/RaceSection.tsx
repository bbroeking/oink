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
	StandingsRow,
	cycleEndWeekday,
	fetchRaceCrewDetail,
	formatRaceCountdown,
	raceSpoilsForRank,
	raceCycle,
	standingsRows,
} from "@/utils/race";
import { cosmeticImage, cosmeticName } from "@/utils/rewardArt";
import {
	COLORS,
	FONTS,
	RADII,
	SHADOW_SM,
	SPACE,
	TYPE,
	WHIMSY,
} from "@/constants/theme";
import {
	devCeremonyFixture,
	type DevCeremony,
} from "@/utils/devSeasonOverrides";

// The season-tab card is a glanceable race preview: podium first, then my
// Sounder pinned beneath it when I'm outside the top three. The full field owns
// the longer table.
const VISIBLE_ROWS = 3;

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
			<Text style={styles.kicker}>★ the dig-off</Text>
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
		[expandedCrew, detailCache],
	);

	return (
		<Sticker
			color="sun"
			rotate={-0.4}
			radius={RADII.lg}
			style={styles.heroCard}
		>
			<View style={styles.heroHead}>
				<Text style={styles.heroTitle}>This week's race</Text>
				<View style={styles.countdownPill}>
					<Text style={styles.countdownText}>{countdown}</Text>
				</View>
			</View>

			<Text style={styles.raceRule}>
				most finds wins · every Sounder that digs takes a share
			</Text>

			{empty ? (
				<View style={styles.emptyBeat}>
					<Glyph
						name="zzz"
						size={28}
						style={{ opacity: 0.85, marginBottom: SPACE.xs }}
					/>
					<Text style={styles.emptyLine}>
						the patch is quiet — first finds take this week's lead
					</Text>
				</View>
			) : (
				<View style={styles.board}>
					<View style={styles.boardHead}>
						<Text style={styles.boardLabel}>standings</Text>
						<Text style={styles.boardFindsLabel}>finds</Text>
					</View>
					<View style={styles.rows}>
						{rows.map((r, i) => {
							const crewId = r.kind === "separator" ? null : r.crew_id;
							const expanded = !!crewId && crewId === expandedCrew;
							return (
								<View key={weeklyRowKey(r, i)}>
									<WeeklyRow
										row={r}
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
				<Pressable
					onPress={() =>
						router.push({
							pathname: "/race-standings",
							params: myCrewId ? { crew: myCrewId } : {},
						})
					}
					hitSlop={8}
					style={({ pressed }) => [
						styles.fullFieldLink,
						pressed && { opacity: 0.6 },
					]}
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
			tint: COLORS.gold,
			tickles: prizes.tickles.first,
			truffles: prizes.truffles.first,
		},
		{
			place: "2nd",
			badge: "2",
			tint: COLORS.silver,
			tickles: prizes.tickles.second,
			truffles: prizes.truffles.second,
		},
		{
			place: "3rd",
			badge: "3",
			tint: COLORS.bronze,
			tickles: prizes.tickles.third,
			truffles: prizes.truffles.third,
		},
	];
	return (
		<View style={[styles.spoils, compact && styles.spoilsCompact]}>
			<Text style={styles.spoilsKicker}>★ Monday's spoils</Text>
			<View style={styles.podiumRow}>
				{podium.map((p) => (
					<View
						key={p.place}
						style={styles.podiumCell}
						accessible
						accessibilityLabel={`${p.place}: ${p.tickles} tickles and ${p.truffles} Golden Truffles`}
					>
						<View style={[styles.podiumBadge, { backgroundColor: p.tint }]}>
							<Text style={styles.podiumBadgeText}>{p.badge}</Text>
						</View>
						<View style={styles.podiumRewards}>
							<View style={styles.podiumPrize}>
								<TickleIcon size={16} />
								<Text style={styles.podiumNum}>{p.tickles}</Text>
							</View>
							<View style={styles.podiumPrize}>
								<Image
									source={cosmeticImage("golden_truffle")}
									style={styles.podiumTruffle}
									resizeMode="contain"
								/>
								<Text style={styles.podiumTruffleNum}>{p.truffles}</Text>
							</View>
						</View>
					</View>
				))}
			</View>
			<Text style={styles.spoilsFloor}>
				every snout that digs banks {prizes.tickles.participation}+ tickles ·
				truffles to the top half too
			</Text>
		</View>
	);
}

// ── A weekly board row — scored by total finds (the rank metric) ───────────────
function WeeklyRow({
	row,
	note,
	onPress,
}: {
	row: StandingsRow;
	note?: string | null;
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
					<Text style={[styles.rowSub, row.highlighted && styles.rowSubMine]}>
						{row.diggers} digging{row.highlighted ? " · your Sounder" : ""}
					</Text>
				)}
				{note && <Text style={styles.rowReward}>{note}</Text>}
			</View>
			<View style={styles.rowFindsCol}>
				<Text style={styles.rowFindsNum}>{row.total_finds}</Text>
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
function LastRaceLine({ last }: { last: LastRace }) {
	const cosmetic = last.cosmetic_hat_id;
	const cosmeticImg = cosmetic ? cosmeticImage(cosmetic) : undefined;
	const spoils: string[] = [];
	if (last.truffles_paid > 0) {
		spoils.push(`+${last.truffles_paid} Golden Truffles`);
	}
	if (last.tickles_paid > 0) {
		spoils.push(
			`+${last.tickles_paid} ${last.tickles_paid === 1 ? "tickle" : "tickles"}`,
		);
	}
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
			<Text style={styles.lastText}>
				{placed
					? `Last race: ${ordinal(last.rank)} of ${last.of}`
					: "Last race: you dug"}
				{spoils.length > 0 ? ` — you banked ${spoils.join(" · ")}` : ""}
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
			: `Last week's race ended — you took ${ordinal(last.rank)} of ${last.of}`;

	const cosmetic = last.cosmetic_hat_id;
	const cosmeticImg = cosmetic ? cosmeticImage(cosmetic) : undefined;

	const dismiss = useCallback(() => {
		Haptics.selectionAsync().catch(() => {});
		onDismiss();
	}, [onDismiss]);

	// The spoils line — truffles + tickles, whichever the payout banked.
	const spoils: string[] = [];
	if (last.truffles_paid > 0) {
		spoils.push(`+${last.truffles_paid} Golden Truffles`);
	}
	if (last.tickles_paid > 0) {
		spoils.push(
			`+${last.tickles_paid} ${last.tickles_paid === 1 ? "tickle" : "tickles"}`,
		);
	}

	return (
		<View style={styles.wrap}>
			<Text style={styles.kicker}>★ the dig-off</Text>
			<Sticker
				color="sun"
				rotate={-0.6}
				radius={RADII.lg}
				style={styles.ceremonyCard}
			>
				<Text style={styles.ceremonyHead}>{headline}</Text>
				{spoils.length > 0 && (
					<Text style={styles.ceremonySpoils}>
						you banked {spoils.join(" · ")}
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
						<Text style={styles.ceremonyCosmeticName}>
							{cosmeticName(cosmetic)}
						</Text>
					</View>
				)}
				<Pressable
					onPress={dismiss}
					hitSlop={8}
					style={({ pressed }) => [
						styles.ceremonyBtn,
						pressed && { opacity: 0.7 },
					]}
				>
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
	// ── The weekly hero card ──────────────────────────────────────────────────
	heroCard: {
		paddingHorizontal: SPACE.lg,
		paddingVertical: SPACE.md,
		gap: SPACE.md,
		...SHADOW_SM,
	},
	heroHead: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	heroTitle: { ...TYPE.cardTitle, color: WHIMSY.ink, flexShrink: 1 },
	countdownPill: {
		backgroundColor: WHIMSY.paper,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.pill,
		paddingHorizontal: SPACE.sm,
		paddingVertical: SPACE.xs,
	},
	countdownText: { ...TYPE.kicker, fontFamily: FONTS.hand, color: WHIMSY.ink },
	raceRule: {
		...TYPE.bodySm,
		fontFamily: FONTS.bodyExtra,
		color: WHIMSY.ink,
		marginTop: -SPACE.xs,
	},
	// The full-field link — centered hand-font mute link under the board rows.
	fullFieldLink: {
		alignSelf: "stretch",
		minHeight: 44,
		alignItems: "center",
		justifyContent: "center",
		marginTop: -SPACE.xs,
	},
	fullFieldText: {
		...TYPE.kicker,
		fontFamily: FONTS.hand,
		color: WHIMSY.accent,
		textDecorationLine: "underline",
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
		paddingTop: SPACE.md,
		borderTopWidth: 1.5,
		borderTopColor: WHIMSY.muteSoft,
		borderStyle: "dashed",
	},
	spoilsCompact: {
		marginHorizontal: SPACE.md,
		marginBottom: SPACE.md,
		paddingHorizontal: SPACE.md,
		paddingBottom: SPACE.md,
		backgroundColor: WHIMSY.paper,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.md,
		borderStyle: "solid",
	},
	spoilsKicker: {
		...TYPE.kicker,
		fontFamily: FONTS.hand,
		color: WHIMSY.accent,
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
		width: 22,
		height: 22,
		borderRadius: RADII.pill,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
	},
	podiumBadgeText: {
		...TYPE.label,
		fontFamily: FONTS.whimsy,
		color: WHIMSY.ink,
	},
	podiumRewards: { gap: SPACE.xs },
	podiumPrize: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
	podiumTruffle: { width: 16, height: 16 },
	podiumTruffleNum: {
		...TYPE.label,
		fontFamily: FONTS.whimsy,
		color: WHIMSY.ink,
	},
	podiumNum: { ...TYPE.numeral, color: WHIMSY.ink },
	spoilsFloor: {
		...TYPE.kicker,
		fontFamily: FONTS.hand,
		color: WHIMSY.mute,
		textAlign: "center",
	},
	// ── Shared standings rows ─────────────────────────────────────────────────
	board: { gap: SPACE.xs },
	boardHead: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingLeft: 34 + SPACE.sm,
		paddingRight: SPACE.sm,
	},
	boardLabel: { ...TYPE.kicker, color: WHIMSY.accent },
	boardFindsLabel: { ...TYPE.kickerPill, color: WHIMSY.mute },
	rows: { gap: SPACE.xs },
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
		paddingHorizontal: SPACE.sm,
		paddingVertical: SPACE.xs,
		minHeight: 52,
		borderRadius: RADII.sm,
	},
	rowMine: {
		backgroundColor: WHIMSY.paper,
		...SHADOW_SM,
	},
	rowPressed: { opacity: 0.6 },
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
	rowSubMine: { color: WHIMSY.accent },
	rowReward: {
		...TYPE.kicker,
		fontFamily: FONTS.hand,
		color: WHIMSY.ink,
	},
	// The score column shares the one "finds" label above the table.
	rowFindsCol: { alignItems: "flex-end", minWidth: 52 },
	rowFindsNum: { ...TYPE.sectionTitle, color: WHIMSY.ink },
	separatorRow: { alignItems: "center", paddingVertical: SPACE.xs },
	separatorDots: {
		...TYPE.kicker,
		fontFamily: FONTS.hand,
		color: WHIMSY.mute,
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
		gap: SPACE.sm,
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
		gap: SPACE.sm,
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
		paddingVertical: SPACE.sm,
		...SHADOW_SM,
	},
	ceremonyBtnText: {
		fontFamily: FONTS.whimsy,
		fontSize: 15,
		color: WHIMSY.ink,
	},
});
