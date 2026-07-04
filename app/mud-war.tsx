// Sounder Mud Scuffle screen (dark-launched behind the `mud_wars` server flag;
// reached from the SounderCard CTA). One screen, four states:
//   • no war      → challenge the house or a friend's Sounder
//   • pending     → defender accepts/declines; challenger waits
//   • active      → tug-of-war bar + the sling-mud tap button
//   • resolved    → result summary (the celebratory reveal is the global
//                   MudWarResolvedModal; this is the quiet on-screen recap)
//
// The sling button reuses the Visit-screen tap feel (squish + flung
// particles) inline — kept self-contained so it doesn't couple to Barn.
// Use-or-lose empty state at 0 remaining (the "tired" idea).

import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
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
import { Stack, router, Redirect, type Href } from "expo-router";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFeatureFlagState } from "@/hooks/useFeatureFlags";
import { Button } from "../components/ui/Button";
import { Icon } from "../components/ui/Icon";
import { WarSpoilsSheet } from "../components/WarSpoilsSheet";
import { TruffleExchangeSheet } from "../components/mudwar/TruffleExchangeSheet";
import { useTruffles } from "@/hooks/useTruffles";
import { MudWarResolvedModal, WarResult } from "../components/MudWarResolvedModal";
import { SlopToss } from "../components/mudwar/SlopToss";
import { RhythmDefense } from "../components/mudwar/RhythmDefense";
import { FrontBoard } from "../components/mudwar/FrontBoard";
import { FeedingStrip } from "../components/mudwar/FeedingStrip";
import { WarLedgerStrip } from "../components/mudwar/WarLedgerStrip";
import { CrewEffort } from "../components/mudwar/CrewEffort";
import { RivalSide } from "../components/mudwar/RivalSide";
import { HungerStageChip } from "../components/mudwar/HungerStageChip";
import { useHungerMeter } from "@/hooks/useHungerMeter";
import { useMudWar } from "@/hooks/useMudWar";
import { useCrew } from "@/hooks/useCrew";
import {
	WarSide,
	ChallengeableCrew,
	fetchChallengeable,
	challengeHouse,
	challengeCrew,
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
import { DAILY_ALLOTMENT, THROWS_PER_DAY, WAR_LENGTH_DAYS, WAR_LENGTH_DAYS_FRONTS, RUNS_PER_DAY } from "@/constants/mudFights";
import { HAT_IMAGES } from "@/constants/hats";
import { FONTS, WHIMSY } from "@/constants/theme";
import { supabase } from "@/utils/supabase";

// The caller's auth id — used to gate the leader-only deploy sheet.
async function currentUserId(): Promise<string | null> {
	const {
		data: { user },
	} = await supabase.auth.getUser();
	return user?.id ?? null;
}

export default function MudWarScreen() {
	// Season 2 / Mud Wars visibility — the `mud_wars` server flag. `loaded`
	// tells "still fetching" apart from "off" so a Brian-only deep link on cold
	// start doesn't flash-redirect before the flag resolves.
	const { visible: mudWarsVisible, loaded: flagLoaded } =
		useFeatureFlagState("mud_wars");
	const { war, loading, refresh, throwBand, submitRun, setDeploy, setFront } = useMudWar();
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
	const [spoilsOpen, setSpoilsOpen] = useState(false);
	const [exchangeOpen, setExchangeOpen] = useState(false);
	// Golden Truffle pouch + Exchange rotation (Season 2 P4; cozy-closed until
	// the 20260704300000 migration is live).
	const truffles = useTruffles();

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
		if (!war || war.status !== "resolved") return;
		const id = war.warId;
		if (revealedWarRef.current === id) return;
		revealedWarRef.current = id;
		const iWon = !!war.winnerCrew && war.winnerCrew === war.mine.crew?.id;
		const result: WarResult = !war.winnerCrew ? "draw" : iWon ? "win" : "loss";
		const isBotWar = war.isBotWar;
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
	}, [war]);

	// Defense-in-depth: there is no entry point to this route when the season is
	// dark (the Sounder card + its CTA are hidden behind the `mud_wars` flag), but
	// guard the screen itself so a deep link or stale nav state can never surface
	// Mud Wars before launch. Wait for the flag to resolve before bouncing.
	if (!flagLoaded) return null;
	if (!mudWarsVisible) return <Redirect href="/(tabs)" />;

	return (
		<>
			<Stack.Screen options={{ headerShown: false }} />
			<View style={styles.bg}>
				<SafeAreaView style={{ flex: 1 }}>
					<PageHeader
						kicker="mud scuffles"
						title="Mud Scuffle"
						onBack={() => router.back()}
						right={
							<View style={styles.headerRight}>
								<Pressable onPress={() => router.push("/clan-ladder" as Href)} hitSlop={12} style={styles.spoilsBtn}>
									<Icon name="trophy" size={15} color={WHIMSY.mute} />
									<Text style={[styles.spoils, { color: WHIMSY.mute }]}>Ladder</Text>
								</Pressable>
								<Pressable onPress={() => setSpoilsOpen(true)} hitSlop={12} style={styles.spoilsBtn}>
									<Icon name="trophy" size={15} color={WHIMSY.accent} />
									<Text style={styles.spoils}>Spoils</Text>
								</Pressable>
								<Pressable onPress={() => setExchangeOpen(true)} hitSlop={12} style={styles.spoilsBtn}>
									{HAT_IMAGES.golden_truffle ? (
										<Image source={HAT_IMAGES.golden_truffle} style={styles.pouchIcon} resizeMode="contain" />
									) : (
										<Icon name="gift" size={15} color={WHIMSY.accent} />
									)}
									<Text style={styles.spoils}>
										{truffles.available ? String(truffles.balance) : "Exchange"}
									</Text>
								</Pressable>
							</View>
						}
					/>
					<WarSpoilsSheet open={spoilsOpen} onClose={() => setSpoilsOpen(false)} />
					<TruffleExchangeSheet
						open={exchangeOpen}
						onClose={() => setExchangeOpen(false)}
						truffles={truffles}
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
						/>
					) : (
						<ResolvedWar war={war} onChanged={dismissResolved} />
					)}

					{/* DEV-only: skip a rhythm war's Tend phase so the HOLD core (rhythm
					    runs + deploy + mirror fold) is reachable without the 2-day wait. */}
					{__DEV__ && war?.status === "active" && war.rhythmEnabled === true && war.phase === "build" && (
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
					    is testable without the 5-day wait. */}
					{__DEV__ && war?.status === "active" && (
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

// ── No war: challenge options ────────────────────────────────────────────────
function NoWar({ onChanged }: { onChanged: () => void }) {
	const { crew } = useCrew();
	const [targets, setTargets] = useState<ChallengeableCrew[]>([]);
	const [note, setNote] = useState<string | null>(null);

	useEffect(() => {
		fetchChallengeable().then(setTargets);
	}, []);

	const noCrew = !crew.crew;

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

	if (noCrew) {
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

	return (
		<ScrollView contentContainerStyle={styles.content}>
			<Text style={styles.lead}>
				Start a Mud Scuffle. Everyone gets {DAILY_ALLOTMENT} mud-slings a day —
				no buffs, no advantages. Most mud per head wins.
			</Text>

			<Button
				variant="gold"
				full
				icon={<Icon name="trophy" size={16} color="#5A3F00" />}
				onPress={() => start(challengeHouse)}
			>
				Scuffle with the house (The Mudlarks)
			</Button>

			{targets.length > 0 && (
				<View style={{ marginTop: 18 }}>
					<Text style={styles.sectionTitle}>Challenge a Sounder</Text>
					{targets.map((t) => (
						<View key={t.id} style={styles.targetRow}>
							<Text style={styles.targetName}>
								{t.name}{" "}
								<Text style={styles.targetCount}>· {t.memberCount}</Text>
							</Text>
							<Button size="sm" variant="primary" onPress={() => start(() => challengeCrew(t.id))}>
								Challenge
							</Button>
						</View>
					))}
				</View>
			)}

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
	war: NonNullable<ReturnType<typeof useMudWar>["war"]>;
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

// Which day of the siege we're on, from the end time. War length varies by mode:
// fronts wars run WAR_LENGTH_DAYS_FRONTS (7), legacy per-capita wars WAR_LENGTH_DAYS (5).
function siegeDay(endsAt: string | null, totalDays: number = WAR_LENGTH_DAYS): number {
	if (!endsAt) return 1;
	const daysLeft = Math.ceil((new Date(endsAt).getTime() - Date.now()) / 86400000);
	return Math.min(totalDays, Math.max(1, totalDays - daysLeft + 1));
}

// ── Active: tug-of-war + the skill minigame (Toss in Tend, Rhythm in Hold) ────
function ActiveWar({
	war,
	onThrow,
	onRun,
	onDeploy,
	onSetFront,
	onChanged,
}: {
	war: NonNullable<ReturnType<typeof useMudWar>["war"]>;
	onThrow: (band: MudBand) => void;
	onRun: ReturnType<typeof useMudWar>["submitRun"];
	onDeploy: ReturnType<typeof useMudWar>["setDeploy"];
	onSetFront: ReturnType<typeof useMudWar>["setFront"];
	onChanged: () => void;
}) {
	// Am I my Sounder's leader? Gates the deploy sheet (set_deploy is leader-only).
	const { crew } = useCrew();
	const [uid, setUid] = useState<string | null>(null);
	useEffect(() => {
		currentUserId().then(setUid);
	}, []);
	const isLeader = !!uid && crew.crew?.leader_id === uid;

	// Season-2: the Hungerer's energy stage (hidden until the meter RPC is live).
	const hunger = useHungerMeter();

	// Phase (rhythm wars only) — drives which minigame renders. Non-rhythm wars
	// report 'war' throughout, so they keep the toss exactly as before.
	const isHold = war.rhythmEnabled === true && war.phase === "war";

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

	// Hold-run feedback (softened to the cozy voice).
	const [runNote, setRunNote] = useState<string | null>(null);
	const onRunComplete = useCallback(
		async (bands: MudBand[]) => {
			setRunNote(null);
			const r = await onRun(bands);
			if (r.ok) {
				// Reconcile to the server's authoritative remaining count.
				setRunsRemaining(r.runs_remaining);
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
		[onRun]
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

	const fillW = ropeAnim.interpolate({ inputRange: [0, 1], outputRange: [0, trackW] });
	const knotLeft = ropeAnim.interpolate({
		inputRange: [0, 1],
		outputRange: [0, Math.max(0, trackW - 14)],
	});

	return (
		<ScrollView contentContainerStyle={styles.content}>
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

			{/* Siege chapter + countdown */}
			<Text style={styles.siegeChapter}>
				Day {siegeDay(war.endsAt, totalDays)} of {totalDays} — the Siege{war.isBotWar ?" — vs The Mudlarks" : ""}
			</Text>
			<Text style={styles.countdown}>{formatCountdown(war.endsAt)} left</Text>
			{hunger.available && <HungerStageChip stage={hunger.stage} />}

			{/* Tug-of-war bar */}
			<View style={styles.scoreRow}>
				<Text style={[styles.sideName, { color: WHIMSY.accent }]} numberOfLines={1}>
					{war.mine.crew?.name ?? "You"}
				</Text>
				<View style={styles.themSide}>
					{war.isBotWar && (
						<Image source={HAT_IMAGES.goblin_warboss} style={styles.themGoblin} resizeMode="contain" />
					)}
					<Text style={styles.themName} numberOfLines={1}>
						{war.them.crew?.name ?? "Them"}
					</Text>
				</View>
			</View>
			<View
				style={styles.ropeTrack}
				onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
			>
				<Animated.View style={[styles.ropeMine, { width: fillW }]} />
				<Animated.View style={[styles.ropeKnot, { left: knotLeft }]} />
			</View>
			<View style={styles.scoreRow}>
				<Text style={styles.percap}>{war.mine.perCapita} / head</Text>
				<Text style={[styles.percap, { textAlign: "right" }]}>{war.them.perCapita} / head</Text>
			</View>

			{/* Day-by-day ledger + the shared drain on the Hungerer */}
			<WarLedgerStrip
				totalDays={totalDays}
				currentDay={siegeDay(war.endsAt, totalDays)}
				ropeNorm={war.ropeNorm}
			/>
			<Text style={styles.drainLine}>
				{`Together you've pried ${war.mine.total + war.them.total} tickles off him this war.`}
			</Text>

			<QuorumLine mine={war.mine} them={war.them} isBotWar={war.isBotWar} />

			{/* Crew effort — each pig's additive pile (replaces the anonymous pips) + the rival, at arm's length */}
			<CrewEffort
				members={war.mine.members}
				myUserId={uid}
				leaderId={crew.crew?.leader_id ?? null}
			/>
			<RivalSide
				crewName={war.them.crew?.name ?? null}
				perCapita={war.them.perCapita}
				active={war.them.active}
				isBot={war.isBotWar}
			/>

			{/* The Truffle Patch heartbeat (Season 2 P1) — one dig per 8h feeding,
			    any phase. Self-contained: owns its rooting session + modal; banked
			    mud reaches the rope via the screen's existing realtime refresh. */}
			<FeedingStrip warId={war.warId} />

			{/* Contested-areas board (Phase 1c/1d) — commit your throws/runs to an area.
			    Only present when fronts_enabled; otherwise the screen is the plain rope +
			    Slop Toss as before. Phase-aware: it shows the deploy sheet in Hold. */}
			{war.fronts && war.fronts.board.length > 0 && (
				<FrontBoard
					fronts={war.fronts}
					onPick={pickFront}
					rhythm={war.rhythmEnabled === true}
					onDeploy={onDeploy}
					isLeader={isLeader}
					note={frontNote}
				/>
			)}

			{/* The skill minigame. In a rhythm war's HOLD phase the defender plays a
			    short RhythmDefense run (banks via submit_run); in Tend (or any
			    non-rhythm war) it's the Slop Toss as before. */}
			{isHold ? (
				<>
					<RhythmDefense
						onRunComplete={onRunComplete}
						runsRemaining={runsRemaining}
						pBand={defendedPBand(war)}
						day={siegeDay(war.endsAt, totalDays)}
					/>
					{runNote && <Text style={styles.note}>{runNote}</Text>}
				</>
			) : (
				<SlopToss
					onThrow={onThrow}
					throwsRemaining={war.myThrowsRemaining ?? THROWS_PER_DAY}
					day={siegeDay(war.endsAt, totalDays)}
				/>
			)}

			{/* Yield — leader-only, two-tap. Concedes the scuffle: the rope
			    goes to them, elo applies as a loss. */}
			{isLeader && (
				<GiveUpLink warId={war.warId} onChanged={onChanged} />
			)}
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
function defendedPBand(war: NonNullable<ReturnType<typeof useMudWar>["war"]>): PBand {
	const board = war.fronts?.board ?? [];
	if (board.length === 0) return "medium";
	const myKey = war.fronts?.myPlan?.front_key ?? null;
	const cell = (myKey && board.find((b) => b.front_key === myKey)) || board[board.length - 1];
	return cell.p_band;
}

function QuorumLine({ mine, them, isBotWar }: { mine: WarSide; them: WarSide; isBotWar: boolean }) {
	if (mine.quorumMet) return null;
	return (
		<Text style={styles.quorum}>
			Need 2+ active members to count — rally your Sounder!
		</Text>
	);
}

// ── Resolved: quiet recap (modal does the celebration) ───────────────────────
function ResolvedWar({
	war,
	onChanged,
}: {
	war: NonNullable<ReturnType<typeof useMudWar>["war"]>;
	onChanged: () => void;
}) {
	const iWon = !!war.winnerCrew && war.winnerCrew === war.mine.crew?.id;
	const draw = !war.winnerCrew;
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
			<Text style={styles.emptyTitle}>
				{draw ? "A stalemate in the mire" : iWon ? "The horde is routed!" : "Driven into the mire"}
			</Text>
			<Text style={styles.emptyBody}>
				{draw
					? "The rope held dead even — neither side broke."
					: iWon
					? "The Mudlarks flee the bog — snouts paid and a 72h regen buff is on you."
					: "The Mudlarks hold the field. Rally and raid again."}
			</Text>
			<Button variant="primary" onPress={onChanged} style={{ marginTop: 16 }}>
				Start a new fight
			</Button>
		</View>
	);
}

const styles = StyleSheet.create({
	bg: { flex: 1, backgroundColor: WHIMSY.cream },
	headerRight: { flexDirection: "row", alignItems: "center", gap: 14 },
	spoilsBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
	spoils: { fontFamily: FONTS.hand, fontSize: 14, color: WHIMSY.accent },
	pouchIcon: { width: 16, height: 16 },
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
	center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30, gap: 8 },
	content: { padding: 20, paddingBottom: 80 },
	lead: { fontFamily: FONTS.body, fontSize: 14, color: WHIMSY.mute, marginBottom: 16, textAlign: "center" },
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
	targetRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		backgroundColor: WHIMSY.paper,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: 14,
		paddingHorizontal: 12,
		paddingVertical: 10,
		marginBottom: 8,
	},
	targetName: { fontFamily: FONTS.body, fontSize: 15, color: WHIMSY.ink, flex: 1 },
	targetCount: { color: WHIMSY.mute },
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
	siegeChapter: { fontFamily: FONTS.whimsy, fontSize: 18, color: WHIMSY.ink, textAlign: "center", marginBottom: 1 },
	countdown: { fontFamily: FONTS.bodyExtra, fontSize: 12, color: WHIMSY.mute, textAlign: "center", marginBottom: 14 },
	scoreRow: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
	sideName: { fontFamily: FONTS.whimsy, fontSize: 16, flex: 1 },
	themSide: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end" },
	themGoblin: { width: 28, height: 28, marginRight: 6 },
	themName: { fontFamily: FONTS.whimsy, fontSize: 16, color: WHIMSY.lilacDeep, textAlign: "right", flexShrink: 1 },
	ropeTrack: {
		height: 22,
		borderRadius: 11,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.lilac,
		marginVertical: 6,
		overflow: "hidden",
		justifyContent: "center",
	},
	ropeMine: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: WHIMSY.roseDeep },
	// The contested knot — absolutely positioned; its `left` is spring-driven so
	// it visibly yanks toward whoever just slung.
	ropeKnot: {
		position: "absolute",
		top: -2,
		bottom: -2,
		width: 14,
		borderRadius: 7,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.sun,
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
	splatIn: { position: "absolute", bottom: 178, width: 36, height: 36 },
	percap: { fontFamily: FONTS.bodyExtra, fontSize: 13, color: WHIMSY.ink, flex: 1 },
	quorum: { fontFamily: FONTS.hand, fontSize: 13, color: WHIMSY.accent, textAlign: "center", marginTop: 10 },
	drainLine: { fontFamily: FONTS.hand, fontSize: 12, color: WHIMSY.accent, textAlign: "center", marginTop: 4 },
	slingWrap: { alignItems: "center", justifyContent: "flex-end", marginTop: 28, height: 200 },
	splat: { position: "absolute", bottom: 120, width: 30, height: 30 },
	slingShadow: {
		borderRadius: 75,
		backgroundColor: WHIMSY.sun,
		shadowColor: WHIMSY.ink,
		shadowOffset: { width: 4, height: 4 },
		shadowOpacity: 1,
		shadowRadius: 0,
		elevation: 4,
	},
	slingBtn: {
		width: 150,
		height: 150,
		borderRadius: 75,
		borderWidth: 3,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.sun,
		alignItems: "center",
		justifyContent: "center",
		overflow: "hidden",
	},
	slingBtnEmpty: { backgroundColor: WHIMSY.cream2 },
	bucketFill: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "rgba(74,48,26,0.5)" },
	slingBurst: { position: "absolute", bottom: 0, alignSelf: "center", width: 230, height: 230 },
	comboRibbon: {
		position: "absolute",
		top: 0,
		alignSelf: "center",
		backgroundColor: WHIMSY.sun,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: 12,
		paddingHorizontal: 12,
		paddingVertical: 4,
	},
	comboText: { fontFamily: FONTS.whimsy, fontSize: 16, color: WHIMSY.ink },
	slingImg: { width: 52, height: 52 },
	slingImgEmpty: { opacity: 0.4 },
	slingLabel: { fontFamily: FONTS.whimsy, fontSize: 16, color: WHIMSY.ink, marginTop: 4 },
	remaining: { fontFamily: FONTS.bodyExtra, fontSize: 14, color: WHIMSY.ink, textAlign: "center", marginTop: 18 },
	spentNote: { fontFamily: FONTS.hand, fontSize: 13, color: WHIMSY.mute, textAlign: "center", marginTop: 2 },
	pendingBtns: { flexDirection: "row", gap: 12, marginTop: 16 },
});
