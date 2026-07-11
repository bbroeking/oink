// Sounder Mud Scuffle screen (dark-launched behind the `mud_wars` server flag;
// reached from the SounderCard CTA). One screen, four states:
//   • no war      → the lobby: why we scuffle + an auto-match CTA (the League
//                   drops you in vs the next Sounder up the table)
//   • pending     → defender accepts/declines; challenger waits
//   • active      → the score hero (rope + per-pig tallies + tap-to-expand
//                   breakdown), your move (the FeedingStrip dig heartbeat, plus
//                   a Hold rhythm run on siege days), a standings mini, and a
//                   below-the-fold details expander
//   • resolved    → quiet on-screen recap (the celebratory reveal is the global
//                   MudWarResolvedModal)

import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { Sticker } from "../components/ui/Sticker";
import { Glyph } from "../components/ui/Glyph";
import {
	View,
	Text,
	Image,
	StyleSheet,
	SafeAreaView,
	Pressable,
	ScrollView,
	Animated,
	ActivityIndicator,
} from "react-native";
import { Stack, router, Redirect, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFeatureFlagState } from "@/hooks/useFeatureFlags";
import { Button } from "../components/ui/Button";
import { Icon } from "../components/ui/Icon";
import { MudWarResolvedModal, WarResult } from "../components/MudWarResolvedModal";
import { RhythmDefense } from "../components/mudwar/RhythmDefense";
import { FrontBoard } from "../components/mudwar/FrontBoard";
import { FeedingStrip } from "../components/mudwar/FeedingStrip";
import { WarLedgerStrip } from "../components/mudwar/WarLedgerStrip";
import { ScoreboardBreakdown } from "../components/mudwar/ScoreboardBreakdown";
import { HungerStageChip } from "../components/mudwar/HungerStageChip";
import { ScuffleExplainerModal } from "../components/mudwar/ScuffleExplainerModal";
import { DevWarStateSheet } from "../components/mudwar/DevWarStateSheet";
import {
	useWarStateOverride,
	type DevUiOverride,
} from "../components/mudwar/devWarState";
import {
	opponentName,
	myName,
	lobbyCopy,
	rivalActivityLine,
	memberBreakdown,
	ropeState,
	siegeDay,
	termLine,
	warActions,
	resolvedCopy,
	scoreboardCopy,
	scoreboardTapHint,
	drainLine,
	isHoldPhase,
} from "../components/mudwar/warCopy";
import { useHungerMeter } from "@/hooks/useHungerMeter";
import { useMudWar } from "@/hooks/useMudWar";
import { useCrew } from "@/hooks/useCrew";
import {
	type WarState,
	challengeHouse,
	acceptChallenge,
	declineChallenge,
	ropePosition,
	formatCountdown,
	fetchWarSpoils,
	forfeitWar,
	fetchMatchHistory,
	MatchEntry,
	devEndWarNow,
	devSkipToHold,
	WonCosmetic,
	MudBand,
	PBand,
} from "@/utils/mudWars";
import { WAR_LENGTH_DAYS, WAR_LENGTH_DAYS_FRONTS, RUNS_PER_DAY, QUORUM } from "@/constants/mudFights";
import { HAT_IMAGES } from "@/constants/hats";
import { FONTS, RADII, SHADOW_SM, SPACE, STICKER_SHADOW, WHIMSY } from "@/constants/theme";
import { supabase } from "@/utils/supabase";

// The caller's auth id — used to gate the leader-only deploy sheet.
async function currentUserId(): Promise<string | null> {
	const {
		data: { user },
	} = await supabase.auth.getUser();
	return user?.id ?? null;
}

export default function MudWarScreen() {
	// Season 1 / Mud Wars visibility — the `mud_wars` server flag. `loaded`
	// tells "still fetching" apart from "off" so a Brian-only deep link on cold
	// start doesn't flash-redirect before the flag resolves.
	const { visible: mudWarsVisible, loaded: flagLoaded } =
		useFeatureFlagState("mud_wars");
	const {
		war: fetchedWar,
		loading,
		refresh,
		throwBand,
		submitRun,
		setDeploy,
		setFront,
	} = useMudWar();
	// __DEV__-only live-tweak harness. In production this is an inert
	// passthrough (war === fetchedWar, ui === {}); in dev it merges Brian's
	// overrides (or a synthesized mock) over the real war so the same
	// components render every state. See components/mudwar/devWarState.ts.
	const dev = useWarStateOverride(fetchedWar);
	const war = dev.war;
	const [devSheetOpen, setDevSheetOpen] = useState(false);
	// Deep-link section focus from the entry strip (?focus=dig|hold|bog).
	const params = useLocalSearchParams<{ focus?: string }>();
	// "Start a new scuffle" on the resolved recap: mark this war dismissed so the
	// screen drops to the NoWar challenge picker. my_war() keeps returning the
	// resolved war, so refresh() alone can never advance past the recap.
	const [dismissedWarId, setDismissedWarId] = useState<string | null>(null);
	const dismissResolved = useCallback(() => {
		if (war) setDismissedWarId(war.warId);
		refresh();
	}, [war, refresh]);
	const resolvedDismissed =
		!!war && war.status === "resolved" && war.warId === dismissedWarId;

	// Resolved-war celebration. Resolution happens lazily on this screen's
	// fetch, so the first time a player views a freshly-resolved war we fire the
	// MudWarResolvedModal over the quiet recap. AsyncStorage gates it to once
	// per war (re-opening the recap won't re-trigger); a win pulls in the
	// war-exclusive cosmetic the player earned so the reveal shows the item.
	const [reveal, setReveal] = useState<{
		result: WarResult;
		isBotWar: boolean;
		wonCosmetic: WonCosmetic | null;
	} | null>(null);
	const revealedWarRef = useRef<string | null>(null);

	useEffect(() => {
		// Key off the REAL fetched war, not the dev-overridden one, so a
		// mocked "resolved" state never fires a fake spoils reveal.
		const w = fetchedWar;
		if (!w || w.status !== "resolved") return;
		const id = w.warId;
		if (revealedWarRef.current === id) return;
		revealedWarRef.current = id;
		const iWon = !!w.winnerCrew && w.winnerCrew === w.mine.crew?.id;
		const result: WarResult = !w.winnerCrew ? "draw" : iWon ? "win" : "loss";
		const isBotWar = w.isBotWar;
		let cancelled = false;
		(async () => {
			const key = `mudwar_resolve_seen_${id}`;
			if (await AsyncStorage.getItem(key)) return;
			const wonCosmetic = iWon ? await fetchWarSpoils(id) : null;
			if (cancelled) return;
			await AsyncStorage.setItem(key, "1");
			setReveal({ result, isBotWar, wonCosmetic });
		})();
		return () => {
			cancelled = true;
		};
	}, [fetchedWar]);

	// Defense-in-depth: there is no entry point to this route when the season is
	// dark (the Sounder card + its CTA are hidden behind the `mud_wars` flag), but
	// guard the screen itself so a deep link or stale nav state can never surface
	// Mud Wars before launch. Wait for the flag to resolve before bouncing.
	if (!flagLoaded) return null;
	if (!mudWarsVisible) return <Redirect href="/(tabs)" />;

	// The page-header crown reflects the state: the lobby invites you to start;
	// a live war names the two Sounders (kicker "· live"); pending/resolved keep
	// the plain title. resolvedDismissed drops back to the lobby (NoWar).
	const inLobby = !war || resolvedDismissed;
	const headerCopy =
		!inLobby && war.status === "active"
			? { kicker: "the scuffle · live", title: `${myName(war)} vs ${opponentName(war)}` }
			: inLobby
			? { kicker: "the scuffle", title: "Start a Mud Scuffle" }
			: { kicker: "the scuffle", title: "Mud Scuffle" };

	return (
		<>
			<Stack.Screen options={{ headerShown: false }} />
			<View style={styles.bg}>
				<SafeAreaView style={{ flex: 1 }}>
					{/* No Ladder/Spoils/Exchange in the header — standings live in
					    the Friends hub's Board segment, and the spoils + Truffle
					    Exchange doors live on the Sounder card ("Your Sounder"). */}
					<PageHeader
						kicker={headerCopy.kicker}
						title={headerCopy.title}
						onBack={() => router.back()}
					/>
					<MudWarResolvedModal
						visible={!!reveal}
						result={reveal?.result ?? "draw"}
						isBotWar={reveal?.isBotWar ?? false}
						wonCosmetic={reveal?.wonCosmetic ?? null}
						onClose={() => setReveal(null)}
					/>

					{loading && !war ? (
						<View style={styles.center}>
							<ActivityIndicator color={WHIMSY.accent} />
						</View>
					) : !war || resolvedDismissed ? (
						<NoWar onChanged={refresh} />
					) : war.status === "pending" ? (
						<PendingWar war={war} onChanged={refresh} />
					) : war.status === "active" ? (
						<ActiveWar
							war={war}
							onThrow={throwBand}
							onRun={submitRun}
							onDeploy={setDeploy}
							onSetFront={setFront}
							onChanged={refresh}
							focus={params.focus}
							devUi={dev.ui}
							devActive={dev.active}
						/>
					) : (
						<ResolvedWar war={war} onChanged={dismissResolved} />
					)}

					{/* DEV-only: the war-state live-tweak harness — a small chip that
					    opens a sheet overriding every field the UI renders (opponent,
					    rope, day, scores, budgets, status). Never ships. */}
					{__DEV__ && (
						<Pressable
							onPress={() => setDevSheetOpen(true)}
							hitSlop={8}
							style={[styles.devBtn, styles.devChip]}
						>
							<Text style={styles.devBtnText}>
								{dev.active ? "dev war ✎" : "dev war"}
							</Text>
						</Pressable>
					)}
					{__DEV__ && (
						<DevWarStateSheet
							open={devSheetOpen}
							onClose={() => setDevSheetOpen(false)}
							ctrl={dev}
							// One-tap WIN/LOSS/DRAW previews fire the REAL celebration
							// modal from override data — no spoils/RPC. The real-war
							// reveal effect stays keyed off fetchedWar, so previews
							// can never mark a real war's celebration as seen.
							onPreview={(outcome) =>
								setReveal({ result: outcome, isBotWar: false, wonCosmetic: null })
							}
						/>
					)}

					{/* DEV-only: skip a rhythm war's Tend phase so the HOLD core (rhythm
					    runs + deploy + mirror fold) is reachable without the 2-day wait.
					    Only for a REAL war (a mock has no server row to skip). */}
					{__DEV__ && !dev.active && war?.status === "active" && war.rhythmEnabled === true && war.phase === "build" && (
						<Pressable
							onPress={async () => {
								await devSkipToHold(war.warId);
								refresh();
							}}
							hitSlop={8}
							style={styles.devBtn}
						>
							<Text style={styles.devBtnText}>skip to Hold (dev)</Text>
						</Pressable>
					)}

					{/* DEV-only: fast-forward an active war to resolution (admin-gated
					    server-side) so the sling -> resolve -> spoils -> win-modal arc
					    is testable without the 5-day wait. Real wars only. */}
					{__DEV__ && !dev.active && war?.status === "active" && (
						<Pressable
							onPress={async () => {
								await devEndWarNow(war.warId);
								refresh();
							}}
							hitSlop={8}
							style={styles.devBtn}
						>
							<Text style={styles.devBtnText}>resolve now (dev)</Text>
						</Pressable>
					)}
				</SafeAreaView>
			</View>
		</>
	);
}

// ── No war: the lobby — why we scuffle + the auto-match CTA ───────────────────
// The manual "Challenge a Sounder" picker is gone (2026-07-06): the League cron
// schedules fixtures, so the single CTA auto-matches vs the next Sounder up the
// table (challengeHouse). Standings moved to the Friends hub's Board segment.
function NoWar({ onChanged }: { onChanged: () => void }) {
	const { crew } = useCrew();
	const [note, setNote] = useState<string | null>(null);

	async function start(fn: () => Promise<{ ok: boolean; reason?: string }>) {
		const r = await fn();
		if (!r.ok) {
			setNote(
				r.reason === "not_leader"
					? "Only your Sounder's leader can start a Mud Scuffle."
					: r.reason === "already_in_war"
					? "Your Sounder is already in a scuffle."
					: "Couldn't start that scuffle."
			);
		} else {
			onChanged();
		}
	}

	if (!crew.crew) {
		return (
			<View style={styles.center}>
				<Image source={HAT_IMAGES.crew_pennant} style={styles.hero} resizeMode="contain" />
				<Text style={styles.emptyTitle}>No Sounder yet</Text>
				<Text style={styles.emptyBody}>
					Create or join a Sounder from the Friends tab to start a Mud Scuffle.
				</Text>
			</View>
		);
	}

	const copy = lobbyCopy();
	// The three bullet circles tint sky / sage / rose, in order.
	const bulletTints = [WHIMSY.sky, WHIMSY.sage, WHIMSY.rose];

	return (
		<ScrollView contentContainerStyle={styles.content}>
			<Sticker color="paper" rotate={0} border={3} radius={RADII.xxl} style={styles.card}>
				{/* "why we scuffle" — the dark storyteller callout */}
				<View style={styles.bark}>
					<Text style={styles.barkKicker}>{copy.whyKicker}</Text>
					<Text style={styles.barkBody}>{copy.whyBody}</Text>
				</View>
				<Text style={styles.lobbyBody}>{copy.body}</Text>
				<View style={styles.bulletList}>
					{copy.bullets.map((b, i) => (
						<View key={i} style={styles.bulletRow}>
							<View style={[styles.bulletBadge, { backgroundColor: bulletTints[i] }]}>
								{b.badgeGlyph ? (
									<Glyph name={b.badgeGlyph} size={16} />
								) : (
									<Text style={styles.bulletBadgeText}>{b.badge}</Text>
								)}
							</View>
							<Text style={styles.bulletLine}>{b.line}</Text>
						</View>
					))}
				</View>
			</Sticker>

			{/* Auto-match — the League drops you in vs the next Sounder (challengeHouse). */}
			<Pressable
				onPress={() => start(challengeHouse)}
				style={({ pressed }) => [styles.goldPill, pressed && styles.goldPillPressed]}
			>
				<Text style={styles.goldPillText}>{copy.cta}</Text>
			</Pressable>
			<Text style={styles.lobbyNote}>{copy.note}</Text>

			<MatchHistory />

			{note && <Text style={styles.note}>{note}</Text>}
		</ScrollView>
	);
}

// ── Past scuffles — the crew's match history (crew_match_history) ────────────
function MatchHistory() {
	const [rows, setRows] = useState<MatchEntry[] | null>(null);
	useEffect(() => {
		fetchMatchHistory(10).then(setRows);
	}, []);
	if (!rows || rows.length === 0) return null;
	return (
		<View style={{ marginTop: 18 }}>
			<Text style={styles.sectionTitle}>Past scuffles</Text>
			{rows.map((r) => (
				<View key={r.war_id} style={styles.historyRow}>
					<Text
						style={[
							styles.historyResult,
							r.result === "won" && styles.historyWon,
							r.result === "lost" && styles.historyLost,
						]}
					>
						{r.result}
					</Text>
					<Text style={styles.historyOpponent} numberOfLines={1}>
						vs {r.opponent}
						{r.forfeited ? (r.yieldedByUs ? " · we yielded" : " · they yielded") : ""}
					</Text>
					<Text style={styles.historyDate}>
						{new Date(r.resolvedAt).toLocaleDateString(undefined, {
							month: "short",
							day: "numeric",
						})}
					</Text>
				</View>
			))}
		</View>
	);
}

// ── Pending: defender decides; challenger waits ──────────────────────────────
function PendingWar({
	war,
	onChanged,
}: {
	war: WarState;
	onChanged: () => void;
}) {
	const [note, setNote] = useState<string | null>(null);
	// Every defender-crew MEMBER reaches this screen, but only the leader may
	// accept/decline — surface the rejection instead of a silent no-op.
	async function act(fn: () => Promise<{ ok: boolean; reason?: string }>) {
		const r = await fn();
		if (r.ok) {
			onChanged();
		} else {
			setNote(
				r.reason === "not_defender_leader"
					? "Only your Sounder's leader can accept or decline."
					: r.reason === "defender_busy"
					? "Your Sounder is already in another scuffle."
					: r.reason === "no_war"
					? "This challenge is no longer available."
					: "Couldn't do that — try again."
			);
		}
	}
	if (war.iAmChallenger) {
		return (
			<View style={styles.center}>
				<Image source={HAT_IMAGES.slop_bucket} style={styles.hero} resizeMode="contain" />
				<Text style={styles.emptyTitle}>Challenge sent</Text>
				<Text style={styles.emptyBody}>
					Waiting for {war.them.crew?.name ?? "them"} to accept.
				</Text>
			</View>
		);
	}
	return (
		<View style={styles.center}>
			<Image source={HAT_IMAGES.mud_shovel} style={styles.hero} resizeMode="contain" />
			<Text style={styles.emptyTitle}>
				{war.them.crew?.name ?? "A Sounder"} challenged you!
			</Text>
			<Text style={styles.emptyBody}>Accept to start a 5-day Mud Scuffle.</Text>
			<View style={styles.pendingBtns}>
				<Button variant="primary" onPress={() => act(() => acceptChallenge(war.warId))}>
					Accept
				</Button>
				<Button variant="ghost" onPress={() => act(() => declineChallenge(war.warId))}>
					Decline
				</Button>
			</View>
			{note && <Text style={styles.note}>{note}</Text>}
		</View>
	);
}

// ── Active: tug-of-war + the skill minigame (Toss in Tend, Rhythm in Hold) ────
function ActiveWar({
	war,
	onThrow,
	onRun,
	onDeploy,
	onSetFront,
	onChanged,
	focus,
	devUi,
	devActive,
}: {
	war: WarState;
	onThrow: (band: MudBand) => void;
	onRun: ReturnType<typeof useMudWar>["submitRun"];
	onDeploy: ReturnType<typeof useMudWar>["setDeploy"];
	onSetFront: ReturnType<typeof useMudWar>["setFront"];
	onChanged: () => void;
	// Deep-link section to scroll to (?focus=dig|hold|bog).
	focus?: string;
	// __DEV__ UI-local overrides (runs left / dug this feeding).
	devUi?: DevUiOverride;
	// __DEV__ override harness is driving the displayed war (fake numbers).
	devActive?: boolean;
}) {
	// Am I my Sounder's leader? Gates the deploy sheet (set_deploy is leader-only).
	const { crew } = useCrew();
	const [uid, setUid] = useState<string | null>(null);
	useEffect(() => {
		currentUserId().then(setUid);
	}, []);
	const isLeader = !!uid && crew.crew?.leader_id === uid;

	// Season-1: the Hungerer's energy stage (hidden until the meter RPC is live).
	const hunger = useHungerMeter();

	// The Hunger "tick": a quick flinch on his stage chip + the drain line each
	// time a herd's scoop reclaims joy — the payoff slam reaching the war page so
	// his meter visibly ticks down (the minigame owns the golden-mote burst).
	const hungerPulse = useRef(new Animated.Value(0)).current;
	const tickHunger = useCallback(() => {
		hungerPulse.setValue(0);
		Animated.sequence([
			Animated.spring(hungerPulse, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 14 }),
			Animated.timing(hungerPulse, { toValue: 0, duration: 260, useNativeDriver: true }),
		]).start();
	}, [hungerPulse]);

	// Phase (rhythm wars only) — drives which minigame renders. Non-rhythm wars
	// report 'war' throughout, so they keep the toss exactly as before.
	const isHold = isHoldPhase(war);

	// "How the scuffle works ›" explainer (below the fold). `explainerScoring`
	// opens it scrolled to the scoring section (from the scoreboard's own link).
	const [explainerOpen, setExplainerOpen] = useState(false);
	const [explainerScoring, setExplainerScoring] = useState(false);
	const openExplainer = useCallback((scoring: boolean) => {
		setExplainerScoring(scoring);
		setExplainerOpen(true);
	}, []);

	// Scoreboard transparency: tap a per-pig tally to expand who's behind it.
	// One side at a time; tapping the open side collapses it.
	const [openSide, setOpenSide] = useState<null | "mine" | "them">(null);
	const toggleSide = useCallback(
		(s: "mine" | "them") => setOpenSide((cur) => (cur === s ? null : s)),
		[]
	);

	// "How this scuffle works" — the below-the-fold details expander (drain line,
	// the week's ledger, the full explainer link). Collapsed by default so the
	// first screenful stays the score hero + your move.
	const [detailsOpen, setDetailsOpen] = useState(false);

	// Deep-link section scroll. The entry strip links ?focus=dig|hold|bog; we
	// capture each section's Y on layout and scroll to it (once it's measured).
	const scrollRef = useRef<ScrollView>(null);
	const sectionY = useRef<Record<string, number>>({});
	const onSectionLayout = useCallback(
		(key: string) => (e: { nativeEvent: { layout: { y: number } } }) => {
			sectionY.current[key] = e.nativeEvent.layout.y;
			if (focus === key) {
				scrollRef.current?.scrollTo({
					y: Math.max(0, e.nativeEvent.layout.y - 12),
					animated: true,
				});
			}
		},
		[focus]
	);

	// Front-commit feedback (e.g. "locked — ask your leader to redeploy you").
	const [frontNote, setFrontNote] = useState<string | null>(null);
	const pickFront = useCallback(
		async (frontKey: string) => {
			setFrontNote(null);
			const r = await onSetFront(frontKey);
			if (!r.ok) {
				setFrontNote(
					r.reason === "locked"
						? isHold
							? "You're already holding here — your area is locked for today."
							: "You've already thrown today — your area is locked."
						: "Couldn't switch areas — try again."
				);
			}
		},
		[onSetFront, isHold]
	);

	// Hold-run budget. war_state doesn't expose runs-spent, so we seed the local
	// remaining from the daily baseline + my access tokens and decrement on each
	// banked run. The server (submit_run) is the authority on what actually banks;
	// this only keeps the bucket's count honest between refreshes. submit_run
	// returns the authoritative runs_remaining, which we reconcile to on success.
	const accessTokens = war.fronts?.accessTokens ?? 0;
	// Reset at UTC day rollover (the server resets runs_today per day) — without the
	// utcDay key the local budget would stay at yesterday's 0 and strand the player at
	// "out of runs" on later Hold days. submit_run's runs_remaining is the authority
	// once a run lands; this only keeps the bucket startable at the top of each day.
	const utcDay = new Date().toISOString().slice(0, 10);
	const [runsRemaining, setRunsRemaining] = useState(RUNS_PER_DAY + accessTokens);
	useEffect(() => {
		setRunsRemaining(RUNS_PER_DAY + accessTokens);
	}, [accessTokens, war.warId, utcDay]);
	// Dev harness can force the displayed remaining-runs count for state preview.
	const effRunsRemaining = devUi?.runsRemaining ?? runsRemaining;

	// Hold-run feedback (softened to the cozy voice).
	const [runNote, setRunNote] = useState<string | null>(null);
	const onRunComplete = useCallback(
		async (bands: MudBand[]) => {
			setRunNote(null);
			const r = await onRun(bands);
			if (r.ok) {
				// Reconcile to the server's authoritative remaining count.
				setRunsRemaining(r.runs_remaining);
				// The run banked — tick the Hunger down on the war page too.
				tickHunger();
			} else {
				if (typeof r.runs_remaining === "number") setRunsRemaining(r.runs_remaining);
				setRunNote(
					r.reason === "daily_runs_spent"
						? "That's your runs for today — rest up and rally tomorrow."
						: r.reason === "tend_phase"
						? "Still tending the mire — the horde hasn't marched yet."
						: r.reason === "empty_run"
						? "No goblins caught that time — give it another go."
						: "Couldn't bank that run — try again."
				);
			}
		},
		[onRun, tickHunger]
	);
	// War length varies by mode (fronts wars run 7 days, legacy 5).
	const totalDays = war.frontsEnabled ? WAR_LENGTH_DAYS_FRONTS : WAR_LENGTH_DAYS;
	// Phase 1b: the rope reflects the DAILY-TUG standings (ropeNorm, caller-POV
	// -1..1 -> 0..1 fill). Falls back to the live per-capita ratio until the
	// daily-tug migration is live.
	const ropeTarget =
		war.ropeNorm != null
			? (war.ropeNorm + 1) / 2
			: ropePosition(war.mine.perCapita, war.them.perCapita);

	// ── Live tug-of-war rope ──────────────────────────────────────────────
	// One Animated.Value (0..1) springs toward the score on every change, so
	// it OVERSHOOTS and settles — a visible yank. My own slings move it
	// instantly (useMudWar bumps mine optimistically before the server replies);
	// the opponent's slings arrive via the throttled realtime refetch. Width +
	// knot-left are layout props, so this drives on the JS thread (two tiny
	// views — cheap).
	const [trackW, setTrackW] = useState(0);
	const ropeAnim = useRef(new Animated.Value(ropeTarget)).current;
	const prevRope = useRef(ropeTarget);

	// Lead-change punctuation.
	const [lead, setLead] = useState<null | "took" | "lost">(null);
	const bannerAnim = useRef(new Animated.Value(0)).current;
	const showLead = useCallback(
		(kind: "took" | "lost") => {
			setLead(kind);
			Haptics.notificationAsync(
				kind === "took"
					? Haptics.NotificationFeedbackType.Success
					: Haptics.NotificationFeedbackType.Warning
			).catch(() => {});
			bannerAnim.setValue(0);
			Animated.sequence([
				Animated.spring(bannerAnim, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 8 }),
				Animated.delay(1400),
				Animated.timing(bannerAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
			]).start(() => setLead(null));
		},
		[bannerAnim]
	);

	useEffect(() => {
		Animated.spring(ropeAnim, {
			toValue: ropeTarget,
			useNativeDriver: false,
			speed: 14,
			bounciness: 9,
		}).start();
		const prev = prevRope.current;
		if (prev < 0.5 && ropeTarget >= 0.5) showLead("took");
		else if (prev >= 0.5 && ropeTarget < 0.5) showLead("lost");
		prevRope.current = ropeTarget;
	}, [ropeTarget, ropeAnim, showLead]);

	// The rose fill's width springs with the rope; its ink right-edge (a 2.5px
	// border) is the divider between my side and theirs.
	const fillW = ropeAnim.interpolate({ inputRange: [0, 1], outputRange: [0, trackW] });

	const opp = opponentName(war);
	const rope = ropeState(war);
	const countdown = formatCountdown(war.endsAt);
	const actions = warActions(war, {
		isHold,
		runsRemaining: effRunsRemaining,
		dugThisWindow: devUi?.dugThisWindow,
	});
	// The standings-mini "your pile" top row — war_side ships members slings-desc,
	// so row 0 is the biggest digger. A crown marks the leader; "(you)" marks me.
	const myRows = memberBreakdown(war.mine.members, uid, crew.crew?.leader_id ?? null);
	const topDigger = myRows[0] ?? null;
	// Joy reclaimed from the Hunger = both herds' totals (the bark strip headline).
	const joyReclaimed = war.mine.total + war.them.total;

	return (
		<ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
			{/* Lead-change banner */}
			{lead && (
				<Animated.View
					pointerEvents="none"
					style={[
						styles.leadBanner,
						{
							opacity: bannerAnim,
							transform: [
								{ translateY: bannerAnim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) },
								{ scale: bannerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
							],
						},
					]}
				>
					<Image source={HAT_IMAGES.crew_pennant} style={styles.leadPennant} resizeMode="contain" />
					<Text style={[styles.leadText, lead === "lost" && { color: WHIMSY.mute }]}>
						{lead === "took" ? "You took the lead!" : "They pulled ahead"}
					</Text>
				</Animated.View>
			)}

			{/* ═══ SCORE HERO — names, the rope, the tallies, standing, Hunger ═══ */}
			<View onLayout={onSectionLayout("bog")}>
				<Sticker color="paper" rotate={0} border={3} radius={RADII.xxl} style={styles.card}>
					{/* Side names — mine (accent) left, theirs (lilac) right. */}
					<View style={styles.sideRow}>
						<Text style={styles.mineName} numberOfLines={1}>
							{myName(war)}
						</Text>
						<View style={styles.themSide}>
							{war.isBotWar && (
								<Image source={HAT_IMAGES.goblin_warboss} style={styles.themGoblin} resizeMode="contain" />
							)}
							<Text style={styles.theirName} numberOfLines={1}>
								{opp}
							</Text>
						</View>
					</View>

					{/* The rope — my rose fill (ink right-edge divider); remainder lilac. */}
					<View
						style={styles.ropeTrack}
						onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
					>
						<Animated.View style={[styles.ropeMine, { width: fillW }]} />
					</View>

					{/* Big tallies — tap either to expand who's behind the number. */}
					<View style={styles.scoreRow}>
						<Pressable
							onPress={() => toggleSide("mine")}
							hitSlop={8}
							style={styles.percapCol}
							accessibilityRole="button"
							accessibilityLabel={`Your herd — ${war.mine.perCapita} joy per pig. Tap for the breakdown.`}
						>
							<Text style={styles.tallyMine}>
								{war.mine.perCapita}
								<Text style={styles.tallyCaret}>{openSide === "mine" ? " ▾" : " ▸"}</Text>
							</Text>
							<Text style={styles.tallyLabel}>{scoreboardCopy().mine}</Text>
						</Pressable>
						<Pressable
							onPress={() => toggleSide("them")}
							hitSlop={8}
							style={[styles.percapCol, { alignItems: "flex-end" }]}
							accessibilityRole="button"
							accessibilityLabel={`Their herd — ${war.them.perCapita} joy per pig. Tap for the breakdown.`}
						>
							<Text style={styles.tallyThem}>
								<Text style={styles.tallyCaret}>{openSide === "them" ? "▾ " : "▸ "}</Text>
								{war.them.perCapita}
							</Text>
							<Text style={[styles.tallyLabel, styles.tallyLabelThem]}>
								{scoreboardCopy().theirs}
							</Text>
						</Pressable>
					</View>
					<Text style={styles.scoreCaption}>{scoreboardCopy().caption}</Text>
					{openSide ? (
						<ScoreboardBreakdown
							side={openSide}
							war={war}
							myUserId={uid}
							leaderId={crew.crew?.leader_id ?? null}
							devActive={devActive}
							onScoringPress={() => openExplainer(true)}
						/>
					) : (
						<Pressable
							onPress={() => toggleSide("mine")}
							hitSlop={6}
							style={styles.tapHintWrap}
						>
							<Text style={styles.tapHint}>{scoreboardTapHint()}</Text>
						</Pressable>
					)}

					{/* Plain-language standing + the day. */}
					<Text style={styles.ropeLine}>{rope.line}</Text>
					<Text style={styles.dayLine}>{termLine(war, countdown)}</Text>

					{/* Quorum — only while your herd is short of two active pigs. */}
					{!war.mine.quorumMet && (
						<View style={styles.quorumChip}>
							<Glyph name="friends" size={12} />
							<Text style={styles.quorumChipText}>
								needs {QUORUM}+ active teammates to count
							</Text>
						</View>
					)}

					{/* vs the Great Hunger — the bark strip, flinching on each reclaim. */}
					<Animated.View
						style={[
							styles.barkStrip,
							{
								transform: [
									{
										scale: hungerPulse.interpolate({
											inputRange: [0, 1],
											outputRange: [1, 0.97],
										}),
									},
								],
							},
						]}
					>
						<View style={styles.barkStripHead}>
							<Text style={styles.barkKickerSm}>vs the Great Hunger</Text>
							<Text style={styles.barkTally}>{joyReclaimed} joy clawed back</Text>
						</View>
						<Text style={styles.barkStripBody}>
							Every scoop from both herds lands on the Hunger — the scuffle is
							just the proxy.
						</Text>
						{hunger.available && (
							<View style={styles.barkHungerChip}>
								<HungerStageChip stage={hunger.stage} />
							</View>
						)}
					</Animated.View>
				</Sticker>
			</View>

			{/* ═══ YOUR MOVE — the feeding heartbeat (+ Hold on rhythm wars) ═══ */}
			<View
				style={styles.cardGap}
				onLayout={(e) => {
					onSectionLayout("dig")(e);
					if (isHold) onSectionLayout("hold")(e);
				}}
			>
				<Sticker color="paper" rotate={0} border={3} radius={RADII.xxl} style={styles.card}>
					<Text style={styles.moveKicker}>your move</Text>
					<FeedingStrip warId={war.warId} onReclaim={tickHunger} />
					{isHold && (
						<View>
							<RhythmDefense
								onRunComplete={onRunComplete}
								runsRemaining={effRunsRemaining}
								pBand={defendedPBand(war)}
								day={siegeDay(war.endsAt, totalDays)}
							/>
							{runNote && <Text style={styles.note}>{runNote}</Text>}
						</View>
					)}
					{/* Spent-action explanations in the cozy hand voice. */}
					{actions
						.filter((a) => !a.enabled && a.reason)
						.map((a) => (
							<Text key={a.key} style={styles.actionReason}>
								{a.reason}
							</Text>
						))}
				</Sticker>
			</View>

			{/* ═══ STANDINGS MINI — your pile vs theirs (double-blind on theirs) ═══ */}
			<View style={styles.duoRow}>
				<Sticker color="paper" rotate={0} border={3} radius={RADII.xl} style={styles.duoCard}>
					<Text style={styles.duoKicker}>your pile</Text>
					<Text style={styles.duoTotalMine}>{war.mine.total}</Text>
					{topDigger ? (
						<View style={styles.duoDiggerRow}>
							{topDigger.isLeader && <Glyph name="crown" size={13} />}
							<Text style={styles.duoDiggerName} numberOfLines={1}>
								{topDigger.name}
								{topDigger.isYou ? " (you)" : ""}
							</Text>
						</View>
					) : (
						<Text style={styles.duoQuiet}>no pigs in the mud yet</Text>
					)}
				</Sticker>
				<Sticker color="paper" rotate={0} border={3} radius={RADII.xl} style={styles.duoCard}>
					<Text style={styles.duoKicker} numberOfLines={1}>
						{opp.toLowerCase()}
					</Text>
					<Text style={styles.duoTotalThem}>{war.them.total}</Text>
					<Text style={styles.duoQuiet}>{rivalActivityLine(war.them.active)}</Text>
				</Sticker>
			</View>

			{/* ═══ AREAS — the contested-fronts board (legacy fronts wars only) ═══ */}
			{war.fronts && war.fronts.board.length > 0 && (
				<View style={styles.cardGap}>
					<FrontBoard
						fronts={war.fronts}
						onPick={pickFront}
						rhythm={war.rhythmEnabled === true}
						onDeploy={onDeploy}
						isLeader={isLeader}
						note={frontNote}
					/>
				</View>
			)}

			{/* ═══ DETAILS — how it works / the week / the full explainer ═══ */}
			<Pressable
				onPress={() => setDetailsOpen((v) => !v)}
				style={styles.detailsBtn}
				accessibilityRole="button"
				accessibilityLabel="How this scuffle works"
			>
				<Text style={styles.detailsBtnText}>How this scuffle works</Text>
				<Text style={styles.detailsChev}>{detailsOpen ? "▾" : "▸"}</Text>
			</Pressable>
			{detailsOpen && (
				<Sticker color="paper" rotate={0} border={3} radius={RADII.xl} style={styles.detailsCard}>
					<View>
						<Text style={styles.detailsKicker}>how it works</Text>
						<Animated.Text
							style={[
								styles.detailsDrain,
								{
									transform: [
										{
											scale: hungerPulse.interpolate({
												inputRange: [0, 1],
												outputRange: [1, 1.06],
											}),
										},
									],
								},
							]}
						>
							{drainLine(joyReclaimed)}
						</Animated.Text>
					</View>
					<View style={styles.detailsHair} />
					<View>
						<Text style={styles.detailsKicker}>the week so far</Text>
						<WarLedgerStrip
							totalDays={totalDays}
							currentDay={siegeDay(war.endsAt, totalDays)}
							ropeNorm={war.ropeNorm}
						/>
					</View>
					<View style={styles.detailsHair} />
					<Pressable
						onPress={() => openExplainer(false)}
						hitSlop={8}
						style={styles.explainLinkWrap}
					>
						<Text style={styles.explainLink}>how the scuffle works ›</Text>
					</Pressable>
				</Sticker>
			)}

			{/* Yield — leader-only, two-tap. Concedes the scuffle: the rope
			    goes to them, elo applies as a loss. */}
			{isLeader && (
				<GiveUpLink warId={war.warId} onChanged={onChanged} />
			)}

			<ScuffleExplainerModal
				visible={explainerOpen}
				focusScoring={explainerScoring}
				frontsEnabled={war.frontsEnabled === true}
				onClose={() => setExplainerOpen(false)}
			/>
		</ScrollView>
	);
}

// ── Yield the scuffle — quiet link, armed on first tap ───────────────────────
function GiveUpLink({ warId, onChanged }: { warId: string; onChanged: () => void }) {
	const [armed, setArmed] = useState(false);
	const [busy, setBusy] = useState(false);
	const yieldWar = async () => {
		if (!armed) {
			setArmed(true);
			return;
		}
		if (busy) return;
		setBusy(true);
		const r = await forfeitWar(warId);
		setBusy(false);
		setArmed(false);
		if (r.ok) onChanged();
	};
	return (
		<Pressable onPress={yieldWar} hitSlop={8} style={styles.giveUpWrap}>
			<Text style={[styles.giveUpText, armed && styles.giveUpArmed]}>
				{busy
					? "yielding…"
					: armed
						? "yield the scuffle? the rope goes to them ›"
						: "yield the scuffle ›"}
			</Text>
		</Pressable>
	);
}

// The area the caller is defending this Hold day → its public p_band drives the
// playable song's difficulty (decision B). Defaults to the cheapest area (the
// server's own default for an unset plan) so the song reflects what they'll hold.
function defendedPBand(war: WarState): PBand {
	const board = war.fronts?.board ?? [];
	if (board.length === 0) return "medium";
	const myKey = war.fronts?.myPlan?.front_key ?? null;
	const cell = (myKey && board.find((b) => b.front_key === myKey)) || board[board.length - 1];
	return cell.p_band;
}

// ── Resolved: quiet recap (modal does the celebration) ───────────────────────
function ResolvedWar({
	war,
	onChanged,
}: {
	war: WarState;
	onChanged: () => void;
}) {
	const iWon = !!war.winnerCrew && war.winnerCrew === war.mine.crew?.id;
	const draw = !war.winnerCrew;
	const copy = resolvedCopy(war);
	return (
		<View style={styles.center}>
			{draw ? (
				<Icon name="handshake" size={52} color={WHIMSY.mute} style={styles.heroIcon} />
			) : (
				<Image
					source={iWon ? HAT_IMAGES.goblin_grunt_hit : HAT_IMAGES.goblin_warboss}
					style={styles.hero}
					resizeMode="contain"
				/>
			)}
			<Text style={styles.emptyTitle}>{copy.title}</Text>
			<Text style={styles.emptyBody}>{copy.body}</Text>
			<Button variant="primary" onPress={onChanged} style={{ marginTop: 16 }}>
				Start a new scuffle
			</Button>
		</View>
	);
}

// Hand-drawn tracked-uppercase kicker — the recurring section label across the
// war surfaces (bark strips, the standings duo, the details expander). One base;
// each site overrides color / margin (and `moveKicker` bumps the size). Kept a
// local const, not a theme token: PatrickHand uppercase kickers only live here
// (the shared TYPE.kicker is Nunito, TYPE.kickerPill is bodyExtra).
const HAND_KICKER = {
	fontFamily: FONTS.hand,
	fontSize: 11,
	letterSpacing: 1.5,
	textTransform: "uppercase",
} as const;

// The dark "storyteller" callout box (WHIMSY.bark) — the lobby's "why we
// scuffle" panel and the hero's "vs the Great Hunger" strip are the same box;
// only the outer margin differs per placement.
const BARK_PANEL = {
	backgroundColor: WHIMSY.bark,
	borderWidth: 2.5,
	borderColor: WHIMSY.ink,
	borderRadius: RADII.lg,
	paddingVertical: SPACE.md,
	paddingHorizontal: SPACE.md,
} as const;

const styles = StyleSheet.create({
	bg: { flex: 1, backgroundColor: WHIMSY.cream },
	devBtn: {
		position: "absolute",
		bottom: 10,
		right: 12,
		backgroundColor: "rgba(20,16,28,0.7)",
		borderRadius: 8,
		paddingHorizontal: 8,
		paddingVertical: 4,
	},
	devBtnText: { fontFamily: FONTS.hand, fontSize: 11, color: "#fff" },
	// Dev war-state chip — bottom-LEFT so it clears the resolve/skip buttons
	// (which sit bottom-right).
	devChip: { left: 12, right: undefined },
	center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30, gap: 8 },
	content: { padding: 20, paddingBottom: 80 },
	hero: { width: 92, height: 92, marginBottom: 8 },
	heroIcon: { marginBottom: 12 },
	emptyTitle: { fontFamily: FONTS.whimsy, fontSize: 22, color: WHIMSY.ink, textAlign: "center" },
	emptyBody: { fontFamily: FONTS.body, fontSize: 14, color: WHIMSY.mute, textAlign: "center", marginTop: 4 },
	sectionTitle: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		letterSpacing: 1.4,
		textTransform: "uppercase",
		color: WHIMSY.mute,
		marginBottom: 8,
	},
	note: { fontFamily: FONTS.body, fontSize: 13, color: WHIMSY.accent, textAlign: "center", marginTop: 12 },
	giveUpWrap: { marginTop: 20, alignSelf: "center" },
	giveUpText: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.mute,
		textDecorationLine: "underline",
	},
	giveUpArmed: { color: WHIMSY.accent },
	historyRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		paddingVertical: 5,
		borderBottomWidth: 1.5,
		borderBottomColor: WHIMSY.cream2,
	},
	historyResult: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		letterSpacing: 1,
		textTransform: "uppercase",
		color: WHIMSY.mute,
		width: 44,
	},
	historyWon: { color: WHIMSY.accent },
	historyLost: { color: WHIMSY.muteSoft },
	historyOpponent: { flex: 1, fontFamily: FONTS.body, fontSize: 13, color: WHIMSY.ink },
	historyDate: { fontFamily: FONTS.hand, fontSize: 12, color: WHIMSY.mute },
	scoreRow: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
	// ── Card stack (Your Sounder redesign) — paper Sticker padding + gaps. ──
	card: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.lg },
	cardGap: { marginTop: SPACE.lg },
	// SCORE HERO — the two Sounder names above the rope.
	sideRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: SPACE.sm,
	},
	mineName: { fontFamily: FONTS.display, fontSize: 17, color: WHIMSY.accent, flex: 1 },
	themSide: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end" },
	themGoblin: { width: 28, height: 28, marginRight: 6 },
	theirName: {
		fontFamily: FONTS.display,
		fontSize: 17,
		color: WHIMSY.lilacDeep,
		textAlign: "right",
		flexShrink: 1,
	},
	// The rope — lilac track (their remainder), my rose fill with an ink
	// right-edge divider marking the boundary.
	ropeTrack: {
		height: 22,
		borderRadius: 999,
		borderWidth: 2.5,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.lilac,
		marginVertical: SPACE.sm,
		overflow: "hidden",
		justifyContent: "center",
	},
	ropeMine: {
		position: "absolute",
		left: 0,
		top: 0,
		bottom: 0,
		backgroundColor: WHIMSY.rose,
		borderRightWidth: 2.5,
		borderColor: WHIMSY.ink,
	},
	leadBanner: {
		position: "absolute",
		top: -2,
		left: 0,
		right: 0,
		zIndex: 10,
		flexDirection: "row",
		alignSelf: "center",
		alignItems: "center",
		justifyContent: "center",
		gap: 6,
	},
	leadPennant: { width: 22, height: 22 },
	leadText: { fontFamily: FONTS.whimsy, fontSize: 16, color: WHIMSY.accent },
	// Big per-pig tallies — accent (mine) vs lilac (theirs), with a caret.
	percapCol: { flex: 1 },
	tallyMine: { fontFamily: FONTS.whimsy, fontSize: 30, color: WHIMSY.accent },
	tallyThem: { fontFamily: FONTS.whimsy, fontSize: 30, color: WHIMSY.lilacDeep, textAlign: "right" },
	tallyCaret: { fontFamily: FONTS.whimsy, fontSize: 16, color: WHIMSY.mute },
	tallyLabel: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		letterSpacing: 1,
		textTransform: "uppercase",
		color: WHIMSY.mute,
		marginTop: 2,
	},
	tallyLabelThem: { textAlign: "right" },
	// "tap a herd to see who's digging ›" — the collapsed-state affordance.
	tapHintWrap: { alignSelf: "center", marginTop: SPACE.xs },
	tapHint: { fontFamily: FONTS.hand, fontSize: 12, color: WHIMSY.mute },
	scoreCaption: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.accent,
		textAlign: "center",
		marginTop: SPACE.xs,
	},
	// Plain standing + the day, under the tallies.
	ropeLine: { fontFamily: FONTS.whimsy, fontSize: 19, color: WHIMSY.ink, marginTop: SPACE.md },
	dayLine: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 13,
		letterSpacing: 0.3,
		color: WHIMSY.mute,
		marginTop: 2,
	},
	// Quorum — a small peach warning pill (only while under two active pigs).
	quorumChip: {
		flexDirection: "row",
		alignItems: "center",
		alignSelf: "flex-start",
		gap: 6,
		backgroundColor: WHIMSY.peach,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: 999,
		paddingVertical: 5,
		paddingHorizontal: SPACE.md,
		marginTop: SPACE.md,
	},
	quorumChipText: { fontFamily: FONTS.bodyExtra, fontSize: 12, color: WHIMSY.accent },
	// vs the Great Hunger — the dark bark strip inside the hero.
	barkStrip: { ...BARK_PANEL, marginTop: SPACE.lg },
	barkStripHead: {
		flexDirection: "row",
		alignItems: "baseline",
		justifyContent: "space-between",
		gap: SPACE.sm,
	},
	barkKickerSm: { ...HAND_KICKER, color: WHIMSY.sun, flexShrink: 1 },
	barkTally: { fontFamily: FONTS.display, fontSize: 13, color: WHIMSY.barkText },
	barkStripBody: {
		fontFamily: FONTS.body,
		fontSize: 12,
		lineHeight: 18,
		color: WHIMSY.barkMute,
		marginTop: 6,
	},
	barkHungerChip: { marginTop: SPACE.sm, alignItems: "flex-start" },
	// YOUR MOVE — the accent hand-kicker over the FeedingStrip.
	moveKicker: { ...HAND_KICKER, fontSize: 12, letterSpacing: 2, color: WHIMSY.accent },
	// Spent-action explanation in the hand voice.
	actionReason: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.mute,
		textAlign: "center",
		marginTop: SPACE.sm,
	},
	// STANDINGS MINI DUO — two flex-1 paper cards.
	duoRow: { flexDirection: "row", gap: SPACE.md, marginTop: SPACE.lg },
	duoCard: { flex: 1, paddingHorizontal: SPACE.md, paddingVertical: SPACE.md },
	duoKicker: { ...HAND_KICKER, color: WHIMSY.mute, marginBottom: 6 },
	duoTotalMine: { fontFamily: FONTS.whimsy, fontSize: 28, color: WHIMSY.ink },
	duoTotalThem: { fontFamily: FONTS.whimsy, fontSize: 28, color: WHIMSY.lilacDeep },
	duoDiggerRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
	duoDiggerName: { fontFamily: FONTS.bodyExtra, fontSize: 13, color: WHIMSY.ink, flexShrink: 1 },
	duoQuiet: { fontFamily: FONTS.bodyExtra, fontSize: 13, color: WHIMSY.mute, marginTop: 6 },
	// DETAILS EXPANDER — a cream sticker button + the expanded paper card.
	detailsBtn: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		backgroundColor: WHIMSY.cream,
		borderWidth: 2.5,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.lg,
		paddingHorizontal: SPACE.lg,
		paddingVertical: SPACE.md,
		marginTop: SPACE.lg,
		...SHADOW_SM,
	},
	detailsBtnText: { fontFamily: FONTS.display, fontSize: 15, color: WHIMSY.ink },
	detailsChev: { fontFamily: FONTS.display, fontSize: 14, color: WHIMSY.ink },
	detailsCard: {
		paddingHorizontal: SPACE.lg,
		paddingVertical: SPACE.lg,
		marginTop: SPACE.md,
		gap: SPACE.lg,
	},
	detailsKicker: { ...HAND_KICKER, color: WHIMSY.mute, marginBottom: 5 },
	detailsDrain: { fontFamily: FONTS.body, fontSize: 14, lineHeight: 21, color: WHIMSY.ink },
	detailsHair: { height: 2, backgroundColor: WHIMSY.ink, opacity: 0.1, borderRadius: 1 },
	explainLinkWrap: { alignSelf: "center" },
	explainLink: {
		fontFamily: FONTS.hand,
		fontSize: 14,
		color: WHIMSY.accent,
		textDecorationLine: "underline",
	},
	// ── The lobby (NoWar) — the Start-a-Mud-Scuffle card + gold CTA. Card
	// surfaces share the `card` padding above.
	bark: { ...BARK_PANEL, marginBottom: SPACE.md },
	barkKicker: { ...HAND_KICKER, color: WHIMSY.sun, marginBottom: 4 },
	barkBody: { fontFamily: FONTS.body, fontSize: 14, lineHeight: 21, color: WHIMSY.barkText },
	lobbyBody: {
		fontFamily: FONTS.body,
		fontSize: 16,
		lineHeight: 24,
		color: WHIMSY.ink,
		marginBottom: SPACE.md,
	},
	bulletList: { gap: SPACE.sm + 2 },
	bulletRow: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
	bulletBadge: {
		width: 30,
		height: 30,
		borderRadius: 15,
		borderWidth: 2.5,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
	},
	bulletBadgeText: { fontFamily: FONTS.display, fontSize: 14, color: WHIMSY.ink },
	bulletLine: { fontFamily: FONTS.bodyExtra, fontSize: 14, color: WHIMSY.ink, flex: 1 },
	goldPill: {
		backgroundColor: WHIMSY.sun,
		borderWidth: 3,
		borderColor: WHIMSY.ink,
		borderRadius: 999,
		paddingVertical: SPACE.lg,
		alignItems: "center",
		justifyContent: "center",
		marginTop: SPACE.lg,
		...STICKER_SHADOW,
	},
	goldPillPressed: { opacity: 0.9 },
	goldPillText: { fontFamily: FONTS.display, fontSize: 18, color: WHIMSY.ink },
	lobbyNote: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.mute,
		textAlign: "center",
		marginTop: SPACE.md,
	},
	pendingBtns: { flexDirection: "row", gap: 12, marginTop: 16 },
});
