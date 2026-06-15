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
	StyleSheet,
	SafeAreaView,
	Pressable,
	ScrollView,
	Animated,
	ActivityIndicator,
} from "react-native";
import { Stack, router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Button } from "../components/ui/Button";
import { Icon } from "../components/ui/Icon";
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
} from "@/utils/mudWars";
import { DAILY_ALLOTMENT } from "@/constants/mudFights";
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
						<View style={{ width: 50 }} />
					</View>

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
				<Text style={styles.bigEmoji}>🐗</Text>
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
				<Text style={styles.bigEmoji}>⏳</Text>
				<Text style={styles.emptyTitle}>Challenge sent</Text>
				<Text style={styles.emptyBody}>
					Waiting for {war.them.crew?.name ?? "them"} to accept.
				</Text>
			</View>
		);
	}
	return (
		<View style={styles.center}>
			<Text style={styles.bigEmoji}>⚔️</Text>
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
	const rope = ropePosition(war.mine.perCapita, war.them.perCapita);
	const remaining = war.myRemainingToday;
	const spent = DAILY_ALLOTMENT - remaining;
	const empty = remaining <= 0;

	// Tap juice — squish + flung mud splats.
	const scale = useRef(new Animated.Value(1)).current;
	const [splats, setSplats] = useState<{ id: number; x: number; a: Animated.Value }[]>([]);
	const idRef = useRef(0);

	const onTap = useCallback(async () => {
		if (empty) return;
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
		Animated.sequence([
			Animated.spring(scale, { toValue: 0.86, useNativeDriver: true, speed: 50, bounciness: 0 }),
			Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }),
		]).start();
		// 3 flung splats
		const fresh = Array.from({ length: 3 }).map(() => {
			const id = idRef.current++;
			return { id, x: (Math.random() - 0.5) * 80, a: new Animated.Value(0) };
		});
		setSplats((s) => [...s, ...fresh]);
		fresh.forEach((sp) => {
			Animated.timing(sp.a, { toValue: 1, duration: 600, useNativeDriver: true }).start(() => {
				setSplats((s) => s.filter((x) => x.id !== sp.id));
			});
		});
		const r = await onSling();
		if (!r.ok && r.reason !== "daily_cap") {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
		}
	}, [empty, onSling, scale]);

	return (
		<ScrollView contentContainerStyle={styles.content}>
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
			<View style={styles.ropeTrack}>
				<View style={[styles.ropeMine, { width: `${Math.round(rope * 100)}%` }]} />
				<View style={styles.ropeKnot} />
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
				{splats.map((sp) => (
					<Animated.Text
						key={sp.id}
						style={[
							styles.splat,
							{
								transform: [
									{ translateX: sp.x },
									{ translateY: sp.a.interpolate({ inputRange: [0, 1], outputRange: [0, -90] }) },
									{ scale: sp.a.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.2] }) },
								],
								opacity: sp.a.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
							},
						]}
					>
						💩
					</Animated.Text>
				))}
				<Pressable onPress={onTap} disabled={empty}>
					<Animated.View style={[styles.slingBtn, empty && styles.slingBtnEmpty, { transform: [{ scale }] }]}>
						<Text style={styles.slingEmoji}>{empty ? "😴" : "🪣"}</Text>
						<Text style={styles.slingLabel}>{empty ? "Out of mud" : "Sling mud!"}</Text>
					</Animated.View>
				</Pressable>
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
			<Text style={styles.bigEmoji}>{draw ? "🤝" : iWon ? "🏆" : "💧"}</Text>
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
	center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30, gap: 8 },
	content: { padding: 20, paddingBottom: 80 },
	lead: { fontFamily: FONTS.body, fontSize: 14, color: WHIMSY.mute, marginBottom: 16, textAlign: "center" },
	bigEmoji: { fontSize: 56, marginBottom: 8 },
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
	ropeKnot: { alignSelf: "center", width: 4, height: 22, backgroundColor: WHIMSY.ink, opacity: 0.4 },
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
	splat: { position: "absolute", bottom: 120, fontSize: 26 },
	slingBtn: {
		width: 150,
		height: 150,
		borderRadius: 75,
		borderWidth: 3,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.sun,
		alignItems: "center",
		justifyContent: "center",
		shadowColor: WHIMSY.ink,
		shadowOffset: { width: 4, height: 4 },
		shadowOpacity: 1,
		shadowRadius: 0,
		elevation: 4,
	},
	slingBtnEmpty: { backgroundColor: WHIMSY.cream2 },
	slingEmoji: { fontSize: 48 },
	slingLabel: { fontFamily: FONTS.whimsy, fontSize: 16, color: WHIMSY.ink, marginTop: 4 },
	remaining: { fontFamily: FONTS.bodyExtra, fontSize: 14, color: WHIMSY.ink, textAlign: "center", marginTop: 18 },
	spentNote: { fontFamily: FONTS.hand, fontSize: 13, color: WHIMSY.mute, textAlign: "center", marginTop: 2 },
	pendingBtns: { flexDirection: "row", gap: 12, marginTop: 16 },
});
