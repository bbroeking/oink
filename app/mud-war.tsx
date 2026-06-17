// Sounder Mud Fight screen (dark-launched via MUD_FIGHTS_VISIBLE; reached
// from the SounderCard CTA). One screen, four states:
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
import { Stack, router, Redirect } from "expo-router";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MUD_FIGHTS_VISIBLE } from "@/constants/featureFlags";
import { Button } from "../components/ui/Button";
import { Icon } from "../components/ui/Icon";
import { WarSpoilsSheet } from "../components/WarSpoilsSheet";
import { MudWarResolvedModal, WarResult } from "../components/MudWarResolvedModal";
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
	devEndWarNow,
	WonCosmetic,
} from "@/utils/mudWars";
import { DAILY_ALLOTMENT } from "@/constants/mudFights";
import { HAT_IMAGES } from "@/constants/hats";
import { FONTS, WHIMSY } from "@/constants/theme";

export default function MudWarScreen() {
	const { war, loading, refresh, sling } = useMudWar();
	// "Start a new fight" on the resolved recap: mark this war dismissed so the
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

	// Defense-in-depth: there is no entry point to this route in production (the
	// Sounder card + its CTA are hidden behind MUD_FIGHTS_VISIBLE), but guard the
	// screen itself so a deep link or stale nav state can never surface Mud Wars
	// before launch. __DEV__ keeps it reachable locally.
	if (!MUD_FIGHTS_VISIBLE) return <Redirect href="/(tabs)" />;

	return (
		<>
			<Stack.Screen options={{ headerShown: false }} />
			<View style={styles.bg}>
				<SafeAreaView style={{ flex: 1 }}>
					<View style={styles.header}>
						<Pressable onPress={() => router.back()} hitSlop={12}>
							<Text style={styles.back}>‹ back</Text>
						</Pressable>
						<Text style={styles.title}>Mud Fight</Text>
						<Pressable onPress={() => setSpoilsOpen(true)} hitSlop={12} style={styles.spoilsBtn}>
							<Icon name="trophy" size={15} color={WHIMSY.accent} />
							<Text style={styles.spoils}>Spoils</Text>
						</Pressable>
					</View>
					<WarSpoilsSheet open={spoilsOpen} onClose={() => setSpoilsOpen(false)} />
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
						<ActiveWar war={war} onSling={sling} />
					) : (
						<ResolvedWar war={war} onChanged={dismissResolved} />
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
					? "Only your Sounder's leader can start a Mud Fight."
					: r.reason === "already_in_war"
					? "Your Sounder is already in a fight."
					: "Couldn't start that fight."
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
					Create or join a Sounder from the Friends tab to start a Mud Fight.
				</Text>
			</View>
		);
	}

	return (
		<ScrollView contentContainerStyle={styles.content}>
			<Text style={styles.lead}>
				Start a Mud Fight. Everyone gets {DAILY_ALLOTMENT} mud-slings a day —
				no buffs, no advantages. Most mud per head wins.
			</Text>

			<Button
				variant="gold"
				full
				icon={<Icon name="trophy" size={16} color="#5A3F00" />}
				onPress={() => start(challengeHouse)}
			>
				Fight the house (The Mudlarks)
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

			{note && <Text style={styles.note}>{note}</Text>}
		</ScrollView>
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
					? "Your Sounder is already in another fight."
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
			<Text style={styles.emptyBody}>Accept to start a 5-day Mud Fight.</Text>
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

// ── Active: tug-of-war + sling ───────────────────────────────────────────────
function ActiveWar({
	war,
	onSling,
}: {
	war: NonNullable<ReturnType<typeof useMudWar>["war"]>;
	onSling: () => Promise<{ ok: boolean; reason?: string }>;
}) {
	const ropeTarget = ropePosition(war.mine.perCapita, war.them.perCapita);
	const remaining = war.myRemainingToday;
	const spent = DAILY_ALLOTMENT - remaining;
	const empty = remaining <= 0;

	// Tap juice — squish + flung mud splats. Splats carry a direction: "out"
	// (my sling, flung up off the bucket) or "in" (an opponent sling raining
	// down at me, fired from the realtime them.total bump below).
	const scale = useRef(new Animated.Value(1)).current;
	const [splats, setSplats] = useState<
		{ id: number; x: number; a: Animated.Value; dir: "out" | "in"; fy: number }[]
	>([]);
	const idRef = useRef(0);

	// power 0/1/2 (combo tier) throws more, wider, and higher.
	const spawnSplats = useCallback((dir: "out" | "in", count: number, power = 0) => {
		const fresh = Array.from({ length: count }).map(() => ({
			id: idRef.current++,
			x: (Math.random() - 0.5) * (90 + power * 30),
			a: new Animated.Value(0),
			dir,
			fy: dir === "in" ? 90 : -(90 + power * 34),
		}));
		setSplats((s) => [...s, ...fresh]);
		fresh.forEach((sp) => {
			Animated.timing(sp.a, {
				toValue: 1,
				duration: dir === "in" ? 700 : 600,
				useNativeDriver: true,
			}).start(() => setSplats((s) => s.filter((x) => x.id !== sp.id)));
		});
	}, []);

	// ── Bucket mud level ──────────────────────────────────────────────────
	// The button fills with the day's allotment and drains a notch per sling
	// (springs down + a slow surface sway for a liquid feel). Height is a layout
	// prop, so JS-driven — one cheap clipped view inside the button.
	const fillFrac = useRef(new Animated.Value(remaining / DAILY_ALLOTMENT)).current;
	const sway = useRef(new Animated.Value(0)).current;
	useEffect(() => {
		Animated.spring(fillFrac, {
			toValue: remaining / DAILY_ALLOTMENT,
			useNativeDriver: false,
			speed: 12,
			bounciness: 12,
		}).start();
	}, [remaining, fillFrac]);
	useEffect(() => {
		const loop = Animated.loop(
			Animated.sequence([
				Animated.timing(sway, { toValue: 1, duration: 1600, useNativeDriver: false }),
				Animated.timing(sway, { toValue: 0, duration: 1600, useNativeDriver: false }),
			])
		);
		loop.start();
		return () => loop.stop();
	}, [sway]);

	// ── Combo (visual only — never touches the server-authoritative score) ──
	// Rapid slings (gaps < 800ms) build a streak: bigger splats, escalating
	// haptics, an "xN SLOPPED!" ribbon, and a mud burst at the top tier.
	const comboRef = useRef(0);
	const lastTapRef = useRef(0);
	const comboTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [combo, setCombo] = useState(0);
	const comboAnim = useRef(new Animated.Value(0)).current;
	const burstAnim = useRef(new Animated.Value(0)).current;
	useEffect(
		() => () => {
			if (comboTimer.current) clearTimeout(comboTimer.current);
		},
		[]
	);
	const showCombo = useCallback(
		(streak: number) => {
			setCombo(streak);
			comboAnim.setValue(0);
			Animated.spring(comboAnim, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 12 }).start();
		},
		[comboAnim]
	);
	const flashBurst = useCallback(() => {
		burstAnim.setValue(0);
		Animated.timing(burstAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
	}, [burstAnim]);

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
	const prevThem = useRef(war.them.total);

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

	// Opponent slung → their total rose on the realtime refetch → rain mud at me.
	useEffect(() => {
		if (war.them.total > prevThem.current) spawnSplats("in", 2);
		prevThem.current = war.them.total;
	}, [war.them.total, spawnSplats]);

	const onTap = useCallback(async () => {
		if (empty) return;
		const now = Date.now();
		const streak = now - lastTapRef.current < 800 ? comboRef.current + 1 : 1;
		comboRef.current = streak;
		lastTapRef.current = now;
		const tier = streak >= 6 ? 2 : streak >= 3 ? 1 : 0;

		Haptics.impactAsync(
			[
				Haptics.ImpactFeedbackStyle.Light,
				Haptics.ImpactFeedbackStyle.Medium,
				Haptics.ImpactFeedbackStyle.Heavy,
			][tier]
		).catch(() => {});
		Animated.sequence([
			Animated.spring(scale, { toValue: 0.86, useNativeDriver: true, speed: 50, bounciness: 0 }),
			Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }),
		]).start();
		spawnSplats("out", [3, 5, 6][tier], tier);
		if (streak >= 2) showCombo(streak);
		if (tier === 2) flashBurst();

		// Decay the streak after a gap so it reads as "rapid" only.
		if (comboTimer.current) clearTimeout(comboTimer.current);
		comboTimer.current = setTimeout(() => {
			comboRef.current = 0;
			setCombo(0);
			Animated.timing(comboAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
		}, 900);

		const r = await onSling();
		if (!r.ok && r.reason !== "daily_cap") {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
		}
	}, [empty, onSling, scale, spawnSplats, showCombo, flashBurst, comboAnim]);

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

			{/* Countdown */}
			<Text style={styles.countdown}>
				{war.isBotWar ? "vs The Mudlarks · " : ""}
				{formatCountdown(war.endsAt)} left
			</Text>

			{/* Tug-of-war bar */}
			<View style={styles.scoreRow}>
				<Text style={[styles.sideName, { color: WHIMSY.accent }]} numberOfLines={1}>
					{war.mine.crew?.name ?? "You"}
				</Text>
				<Text style={[styles.sideName, { color: WHIMSY.lilacDeep, textAlign: "right" }]} numberOfLines={1}>
					{war.them.crew?.name ?? "Them"}
				</Text>
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

			<QuorumLine mine={war.mine} them={war.them} isBotWar={war.isBotWar} />

			{/* Roster pips */}
			<View style={styles.pipsRow}>
				{war.mine.members.map((m) => (
					<View key={m.user_id} style={[styles.pip, m.slings > 0 && styles.pipLit]} />
				))}
			</View>

			{/* Sling button */}
			<View style={styles.slingWrap}>
				{/* Top-tier mud burst behind the bucket */}
				<Animated.Image
					source={HAT_IMAGES.mud_splatter_aura}
					resizeMode="contain"
					style={[
						styles.slingBurst,
						{
							opacity: burstAnim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.7, 0] }),
							transform: [{ scale: burstAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.4] }) }],
						},
					]}
				/>
				{splats.map((sp) => {
					const out = sp.dir === "out";
					return (
						<Animated.Image
							key={sp.id}
							source={out ? HAT_IMAGES.mud_pie : HAT_IMAGES.mud_splatter_aura}
							resizeMode="contain"
							style={[
								out ? styles.splat : styles.splatIn,
								{
									transform: [
										{ translateX: sp.x },
										{
											translateY: sp.a.interpolate({
												inputRange: [0, 1],
												outputRange: [0, sp.fy],
											}),
										},
										{
											scale: sp.a.interpolate({
												inputRange: [0, 1],
												outputRange: out ? [0.6, 1.2] : [1.1, 0.7],
											}),
										},
									],
									opacity: sp.a.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
								},
							]}
						/>
					);
				})}
				<Pressable onPress={onTap} disabled={empty}>
					{/* Shadow lives on the wrapper so the inner clip (overflow:hidden,
					    for the mud fill) doesn't eat the sticker shadow. */}
					<Animated.View style={[styles.slingShadow, { transform: [{ scale }] }]}>
						<View style={[styles.slingBtn, empty && styles.slingBtnEmpty]}>
							<Animated.View
								pointerEvents="none"
								style={[
									styles.bucketFill,
									{
										height: fillFrac.interpolate({ inputRange: [0, 1], outputRange: [0, 150] }),
										transform: [
											{ translateY: sway.interpolate({ inputRange: [0, 1], outputRange: [2, -2] }) },
										],
									},
								]}
							/>
							<Image
								source={HAT_IMAGES.slop_bucket}
								resizeMode="contain"
								style={[styles.slingImg, empty && styles.slingImgEmpty]}
							/>
							<Text style={styles.slingLabel}>{empty ? "Out of mud" : "Sling mud!"}</Text>
						</View>
					</Animated.View>
				</Pressable>

				{/* Combo ribbon — pure juice, decoupled from score */}
				{combo >= 2 && (
					<Animated.View
						pointerEvents="none"
						style={[
							styles.comboRibbon,
							{
								opacity: comboAnim,
								transform: [{ scale: comboAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
							},
						]}
					>
						<Text style={styles.comboText}>x{combo} SLOPPED!</Text>
					</Animated.View>
				)}
			</View>

			<Text style={styles.remaining}>
				{empty
					? "Come back tomorrow for more mud."
					: `${remaining} of ${DAILY_ALLOTMENT} slings left today`}
			</Text>
			{spent > 0 && <Text style={styles.spentNote}>You've slung {spent} today.</Text>}
		</ScrollView>
	);
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
					source={iWon ? HAT_IMAGES.swamp_crown : HAT_IMAGES.mud_splatter_aura}
					style={styles.hero}
					resizeMode="contain"
				/>
			)}
			<Text style={styles.emptyTitle}>
				{draw ? "A draw" : iWon ? "Your Sounder won!" : "Your Sounder lost"}
			</Text>
			<Text style={styles.emptyBody}>
				{draw
					? "Not enough mud was slung. Rally up and try again."
					: iWon
					? "Snouts paid out and a 72h regen buff is on you."
					: "Better luck next Mud Fight."}
			</Text>
			<Button variant="primary" onPress={onChanged} style={{ marginTop: 16 }}>
				Start a new fight
			</Button>
		</View>
	);
}

const styles = StyleSheet.create({
	bg: { flex: 1, backgroundColor: WHIMSY.cream },
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 18,
		paddingTop: 8,
		paddingBottom: 4,
	},
	back: { fontFamily: FONTS.hand, fontSize: 14, color: WHIMSY.mute },
	title: { fontFamily: FONTS.whimsy, fontSize: 26, color: WHIMSY.ink },
	spoilsBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
	spoils: { fontFamily: FONTS.hand, fontSize: 14, color: WHIMSY.accent },
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
	countdown: { fontFamily: FONTS.bodyExtra, fontSize: 13, color: WHIMSY.mute, textAlign: "center", marginBottom: 14 },
	scoreRow: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
	sideName: { fontFamily: FONTS.whimsy, fontSize: 16, flex: 1 },
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
	pipsRow: { flexDirection: "row", gap: 6, justifyContent: "center", marginTop: 16 },
	pip: {
		width: 14,
		height: 14,
		borderRadius: 7,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.cream,
	},
	pipLit: { backgroundColor: WHIMSY.sun },
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
