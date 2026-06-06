// Visit & Tickle — visiting a friend's Barn to tickle their pig. Redesigned from
// the claude.ai/design "Visit & Tickle.html" handoff, wired to the real server:
//
//   • Tap EITHER pig (no button) → tickle_at_barn: spends one of YOUR tickles,
//     gives it to the host, and makes BOTH pigs happier.
//   • Two heart tallies (YOU | host) tick up together on every tap with a shared
//     heartbeat pulse — the "you both get a heart" payoff. Hearts are the mutual
//     love (happiness), distinct from the tickle you spend.
//   • "YOUR TICKLES" bar = the resource you spend (−1/tap, refills over time).
//   • The host's pig has an energy bar; it tires over the tap-session and, once
//     spent (or the 7/hr ceiling), both pigs nap — and you can only visit one
//     friend every 3 hours, so the nap screen shows when you're rested next.
//   • "How visiting works" sheet + first-tap nudge; barn truffle to dig.
//
// Full-screen overlay (NOT a nested Modal — iOS won't stack one over UserSheet's
// Modal); it sits on top within the sheet's modal layer. Branch: social-barn-visiting.
import { useEffect, useRef, useState } from "react";
import {
	View,
	Text,
	Pressable,
	ActivityIndicator,
	StyleSheet,
	Animated,
	Easing,
} from "react-native";
import * as Haptics from "expo-haptics";
import { supabase } from "@/utils/supabase";
import { rpc } from "@/utils/rpc";
import { PigStage } from "./ui/PigStage";
import { PageBackground } from "./ui/PageBackground";
import { FONTS, WHIMSY } from "@/constants/theme";

interface Props {
	targetUserId: string;
	targetName: string;
	onClose: () => void;
}

interface Barn {
	username: string | null;
	tickles_earned: number | null;
	active_background_id: string | null;
	active_hat_id: string | null;
	active_flag_id: string | null;
	hat_category: string | null;
	hat_emoji: string | null;
}

// "2h 15m" / "12m" until you can visit a different barn.
function lockLabel(nextAtIso: string | null): string {
	if (!nextAtIso) return "3h";
	const ms = new Date(nextAtIso).getTime() - Date.now();
	if (ms <= 0) return "now";
	const mins = Math.ceil(ms / 60000);
	const h = Math.floor(mins / 60);
	const m = mins % 60;
	return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

const PIG_CANVAS = 300;

export function BarnVisitModal({ targetUserId, targetName, onClose }: Props) {
	const [barn, setBarn] = useState<Barn | null>(null);
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);

	// Your spendable tickles (the resource you spend visiting).
	const [avail, setAvail] = useState<number | null>(null);
	const [cap, setCap] = useState(25);
	const [secsToNext, setSecsToNext] = useState<number | null>(null);

	// Hearts shared this visit — both tick up together, one per tap.
	const [youHearts, setYouHearts] = useState(0);
	const [friendHearts, setFriendHearts] = useState(0);

	// Tap-session: friend's pig tires over a random 3–7 taps (bounded by the
	// server's 7/hr ceiling). Energy is the visible readout of that.
	const [tapCount, setTapCount] = useState(0);
	const [tapCap] = useState(() => 3 + Math.floor(Math.random() * 5)); // 3–7
	const [tired, setTired] = useState(false);
	const [noTickles, setNoTickles] = useState(false);
	const [lockedUntil, setLockedUntil] = useState<string | null>(null);
	// Locked/rested-out on arrival (came back inside the 3h window, or the pigs
	// already napped this hour) → open straight into the nap screen.
	const [restingOnArrival, setRestingOnArrival] = useState(false);
	const [showHelp, setShowHelp] = useState(false);

	// Barn truffle (a reward the host buried for visitors).
	const [truffleAvail, setTruffleAvail] = useState(false);
	const [dug, setDug] = useState<number | null>(null);
	const [digging, setDigging] = useState(false);

	// Your own pig (hat + flag) so both pigs share the scene.
	const [mine, setMine] = useState<{
		hat: { id: string; category: string | null; emoji: string | null } | null;
		flag: { id: string; category: string; emoji: null } | null;
	}>({ hat: null, flag: null });

	// Flying hearts + the shared-heartbeat pulse + pig squish, all on each tap.
	const [floats, setFloats] = useState<{ id: number; anim: Animated.Value; rx: number; star: boolean }[]>([]);
	const nextFloat = useRef(0);
	const squish = useRef(new Animated.Value(0)).current;
	const beat = useRef(new Animated.Value(0)).current;
	const tick = useRef(new Animated.Value(0)).current; // "+1 ♥" rise over tallies

	const playTap = () => {
		Animated.sequence([
			Animated.timing(squish, { toValue: 1, duration: 90, useNativeDriver: true }),
			Animated.spring(squish, { toValue: 0, friction: 4, tension: 120, useNativeDriver: true }),
		]).start();
		beat.setValue(0);
		Animated.timing(beat, { toValue: 1, duration: 440, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
		tick.setValue(0);
		Animated.timing(tick, { toValue: 1, duration: 760, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
		for (let i = 0; i < 5; i++) {
			setTimeout(() => {
				const id = nextFloat.current++;
				const anim = new Animated.Value(0);
				const rx = Math.random() * 70 - 35;
				const star = Math.random() < 0.14;
				setFloats((f) => [...f, { id, anim, rx, star }]);
				Animated.timing(anim, { toValue: 1, duration: 1050, useNativeDriver: true }).start(() =>
					setFloats((f) => f.filter((x) => x.id !== id))
				);
			}, i * 60);
		}
	};

	useEffect(() => {
		let cancelled = false;
		(async () => {
			const { data } = await supabase
				.from("profiles")
				.select(
					"username, tickles_earned, active_background_id, active_hat_id, active_flag_id, active_hat:hats!profiles_active_hat_id_fkey(category, emoji)"
				)
				.eq("id", targetUserId)
				.maybeSingle();
			if (cancelled || !data) {
				setLoading(false);
				return;
			}
			const d = data as Record<string, unknown>;
			const hat = (d.active_hat ?? null) as { category?: string; emoji?: string } | null;
			setBarn({
				username: (d.username as string) ?? null,
				tickles_earned: (d.tickles_earned as number) ?? 0,
				active_background_id: (d.active_background_id as string) ?? null,
				active_hat_id: (d.active_hat_id as string) ?? null,
				active_flag_id: (d.active_flag_id as string) ?? null,
				hat_category: hat?.category ?? null,
				hat_emoji: hat?.emoji ?? null,
			});

			const { data: tr } = await supabase
				.from("truffles")
				.select("id")
				.eq("host_id", targetUserId)
				.is("dug_at", null)
				.maybeSingle();
			if (!cancelled) setTruffleAvail(!!tr);

			const { data: ures } = await supabase.auth.getUser();
			if (ures.user) {
				const { data: me } = await supabase
					.from("profiles")
					.select(
						"active_hat_id, active_flag_id, active_hat:hats!profiles_active_hat_id_fkey(category, emoji)"
					)
					.eq("id", ures.user.id)
					.maybeSingle();
				if (!cancelled && me) {
					const m = me as Record<string, unknown>;
					const mh = (m.active_hat ?? null) as { category?: string; emoji?: string } | null;
					setMine({
						hat: m.active_hat_id
							? { id: m.active_hat_id as string, category: mh?.category ?? null, emoji: mh?.emoji ?? null }
							: null,
						flag: m.active_flag_id
							? { id: m.active_flag_id as string, category: "flag", emoji: null }
							: null,
					});
				}
			}

			// Your tickle bank + cap + refill timer, plus whether you're locked to
			// a different barn (one friend / 3h) or the pigs already napped.
			const st = await rpc<{
				ok?: boolean;
				resting?: boolean;
				locked?: boolean;
				next_at?: string | null;
				balance?: number;
				cap?: number;
				next_regen_seconds?: number | null;
			}>("barn_visit_status", { p_target: targetUserId });
			if (!cancelled && st?.ok) {
				setAvail(st.balance ?? 0);
				setCap(st.cap ?? 25);
				setSecsToNext(st.next_regen_seconds ?? null);
				if (st.locked) {
					setLockedUntil(st.next_at ?? null);
					setRestingOnArrival(true);
				}
				if (st.resting) setRestingOnArrival(true);
				if ((st.balance ?? 0) < 1) setNoTickles(true);
			}
			setLoading(false);
		})();
		return () => {
			cancelled = true;
		};
	}, [targetUserId]);

	// Live refill countdown for the YOUR TICKLES bar.
	useEffect(() => {
		if (secsToNext == null || avail == null || avail >= cap) return;
		const id = setInterval(() => {
			setSecsToNext((s) => {
				if (s == null) return s;
				if (s <= 1) {
					setAvail((a) => (a == null ? a : Math.min(cap, a + 1)));
					const regen = 75; // display-only cadence; server is source of truth
					return regen;
				}
				return s - 1;
			});
		}, 1000);
		return () => clearInterval(id);
	}, [secsToNext, avail, cap]);

	const hatSlot = barn?.active_hat_id
		? { id: barn.active_hat_id, category: barn.hat_category, emoji: barn.hat_emoji }
		: null;
	const flagSlot = barn?.active_flag_id
		? { id: barn.active_flag_id, category: "flag", emoji: null }
		: null;

	const tireOut = () => {
		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
		setTired(true);
	};

	const tickle = async () => {
		if (tired || restingOnArrival || noTickles || lockedUntil || busy) return;
		if (avail != null && avail <= 0) {
			setNoTickles(true);
			return;
		}
		setBusy(true);
		const r = await rpc<{
			ok?: boolean;
			error?: string;
			taps_left?: number;
			visitor_balance?: number;
			next_at?: string | null;
		}>("tickle_at_barn", { p_target: targetUserId });
		setBusy(false);
		if (r?.ok) {
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
			playTap();
			if (typeof r.visitor_balance === "number") setAvail(r.visitor_balance);
			setYouHearts((n) => n + 1);
			setFriendHearts((n) => n + 1);
			const next = tapCount + 1;
			setTapCount(next);
			// Nap on the sleepy roll OR the shared hourly ceiling, whichever first.
			if (next >= tapCap || (r.taps_left ?? 99) <= 0) setTimeout(tireOut, 520);
		} else if (r?.error === "tired") {
			tireOut();
		} else if (r?.error === "no_tickles") {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
			setNoTickles(true);
		} else if (r?.error === "cooldown") {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
			setLockedUntil(r.next_at ?? null);
			setRestingOnArrival(true);
		}
	};

	const dig = async () => {
		if (digging || dug != null) return;
		setDigging(true);
		const r = await rpc<{ ok?: boolean; reward?: number; error?: string }>("dig_truffle", {
			p_host: targetUserId,
		});
		setDigging(false);
		setTruffleAvail(false);
		if (r?.ok) {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
			setDug(r.reward ?? 0);
		}
	};

	// Friend pig energy: how far through the sleepy roll we are (display only).
	const energy = Math.max(0, Math.round(100 * (1 - tapCount / tapCap)));
	const energyColor = energy > 50 ? "#62b048" : energy > 25 ? "#e8a82e" : "#ef7a5a";
	const energyLabel =
		energy > 66 ? "wide awake" : energy > 33 ? "having fun" : energy > 0 ? "getting sleepy" : "sleepy";

	const mm = secsToNext != null ? Math.floor(secsToNext / 60) : 0;
	const ss = secsToNext != null ? String(secsToNext % 60).padStart(2, "0") : "00";
	const atCap = avail != null && avail >= cap;

	// Shared squish transform for both pigs.
	const squishStyle = {
		transform: [
			{ scaleX: squish.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] }) },
			{ scaleY: squish.interpolate({ inputRange: [0, 1], outputRange: [1, 0.93] }) },
		],
	};
	const tickStyle = {
		opacity: tick.interpolate({ inputRange: [0, 0.2, 0.9, 1], outputRange: [0, 1, 1, 0] }),
		transform: [{ translateY: tick.interpolate({ inputRange: [0, 1], outputRange: [4, -16] }) }],
	};

	const napUntil = lockedUntil ? lockLabel(lockedUntil) : "3h";

	return (
		<View style={styles.root}>
			<PageBackground bgId={barn?.active_background_id ?? null}>
				{/* legibility veil behind the top chrome */}
				<View pointerEvents="none" style={styles.topVeil} />

				{loading ? (
					<ActivityIndicator color={WHIMSY.paper} style={{ marginTop: 120 }} />
				) : (
					<>
						{/* ===== top chrome ===== */}
						<View style={styles.chrome}>
							<View style={styles.headerRow}>
								<View style={{ flexShrink: 1 }}>
									<Text style={styles.kicker}>★ VISITING</Text>
									<Text style={styles.title} numberOfLines={1}>
										{targetName}'s Barn
									</Text>
								</View>
								<Pressable onPress={onClose} style={styles.leavePill} hitSlop={8}>
									<Text style={styles.leaveText}>Leave ✕</Text>
								</Pressable>
							</View>

							{/* hearts shared — both tick up together */}
							<View style={styles.heartCard}>
								<HeartTally label="YOU" total={youHearts} tickStyle={tickStyle} />
								<View style={styles.heartDivider} />
								<HeartTally
									label={(barn?.username ?? targetName).toUpperCase()}
									total={friendHearts}
									tickStyle={tickStyle}
								/>
								<Animated.View
									style={[
										styles.beatEmblem,
										{
											transform: [
												{
													scale: beat.interpolate({
														inputRange: [0, 0.3, 0.6, 1],
														outputRange: [1, 1.32, 0.94, 1],
													}),
												},
											],
										},
									]}
								>
									<Text style={styles.beatHeart}>♥</Text>
								</Animated.View>
							</View>

							{/* YOUR TICKLES — the resource you spend */}
							<View style={styles.ticklesBar}>
								<View style={styles.ticklesTop}>
									<Text style={styles.ticklesLabel}>✦ YOUR TICKLES</Text>
									<Text style={styles.ticklesCount}>
										{avail ?? "–"}
										<Text style={styles.ticklesCap}> / {cap}</Text>
									</Text>
								</View>
								<View style={styles.ticklesTrack}>
									<View
										style={[
											styles.ticklesFill,
											{ width: `${Math.max(0, Math.min(1, (avail ?? 0) / cap)) * 100}%` },
										]}
									/>
								</View>
								<View style={styles.ticklesFoot}>
									<Text style={styles.ticklesFootText}>−1 each tap</Text>
									<Text style={styles.ticklesFootText}>
										{atCap ? "full ✓" : secsToNext != null ? `+1 in ${mm}:${ss}` : "refills over time"}
									</Text>
								</View>
							</View>
						</View>

						{/* ===== stage: the two pigs are the hero ===== */}
						<View style={styles.stage}>
							<View style={styles.pigsRow}>
								<TapPig
									me
									squishStyle={squishStyle}
									onPress={tickle}
									label="you"
									hat={mine.hat}
									flag={mine.flag}
									tired={tired}
									floats={floats}
								/>
								<TapPig
									squishStyle={squishStyle}
									onPress={tickle}
									label={barn?.username ?? targetName}
									hat={hatSlot}
									flag={flagSlot}
									tired={tired}
									floats={floats}
									energy={energy}
									energyColor={energyColor}
									energyLabel={energyLabel}
								/>
							</View>

							<View style={styles.stageFoot}>
								{youHearts === 0 && !tired && (
									<View style={styles.nudge}>
										<Text style={styles.nudgeText}>✦ tap a pig to start tickling</Text>
									</View>
								)}
								<Pressable onPress={() => setShowHelp(true)} style={styles.helpPill} hitSlop={6}>
									<Text style={styles.helpDot}>ⓘ</Text>
									<Text style={styles.helpText}>How visiting works</Text>
								</Pressable>
							</View>

							{/* barn truffle (a reward the host buried) */}
							{dug != null ? (
								<Text style={styles.truffleFound}>🐽✨ You dug up a truffle — +{dug} snouts!</Text>
							) : truffleAvail && !tired ? (
								<Pressable
									onPress={dig}
									disabled={digging}
									style={({ pressed }) => [styles.truffleBtn, pressed && { opacity: 0.85 }]}
								>
									<Text style={styles.truffleText}>{digging ? "digging…" : "🐽 Dig for a truffle!"}</Text>
								</Pressable>
							) : null}
						</View>

						{/* out of tickles toast */}
						{noTickles && !tired && (
							<View style={styles.toastWrap} pointerEvents="none">
								<View style={styles.toast}>
									<Text style={styles.toastTitle}>Out of tickles!</Text>
									<Text style={styles.toastSub}>
										{atCap ? "come back soon" : `next +1 in ${mm}:${ss} · let your bank fill back up`}
									</Text>
								</View>
							</View>
						)}

						{/* "how visiting works" sheet */}
						{showHelp && (
							<Pressable style={styles.sheetScrim} onPress={() => setShowHelp(false)}>
								<Pressable style={styles.sheet} onPress={() => {}}>
									<View style={styles.sheetGrip} />
									<Text style={styles.sheetTitle}>How visiting works</Text>
									{[
										["💞", "You tickle together", `Tap either pig and you AND ${targetName} both get a ♥ — every single tap.`],
										["✦", "Tickles are limited", "Each tap spends one of your tickles. They slowly refill over time."],
										["😴", "Pigs get sleepy", `${targetName}'s pig tires as you play — once it naps, come back later.`],
										["🐽", "Barn rewards", "Some friends bury a truffle for the first visitor to dig up."],
									].map(([ic, h, b]) => (
										<View key={h} style={styles.sheetRow}>
											<View style={styles.sheetIcon}>
												<Text style={{ fontSize: 19 }}>{ic}</Text>
											</View>
											<View style={{ flex: 1 }}>
												<Text style={styles.sheetRowTitle}>{h}</Text>
												<Text style={styles.sheetRowBody}>{b}</Text>
											</View>
										</View>
									))}
									<Pressable onPress={() => setShowHelp(false)} style={styles.sheetBtn}>
										<Text style={styles.sheetBtnText}>Got it!</Text>
									</Pressable>
								</Pressable>
							</Pressable>
						)}

						{/* nap screen — tired out, or rested-out / locked on arrival */}
						{(tired || restingOnArrival) && (
							<View style={styles.napScrim}>
								<View style={styles.napCard}>
									<Text style={styles.napEmoji}>😴💤</Text>
									<Text style={styles.napKicker}>nap time</Text>
									<Text style={styles.napTitle}>All tickled out!</Text>
									<Text style={styles.napBody}>
										{restingOnArrival && youHearts === 0
											? `These pigs are worn out from a recent visit — and you can only visit one friend every 3 hours. Come back soon!`
											: `The pigs are worn out from all the play and need a nap. You can visit another friend's Barn in a little while.`}
									</Text>
									<View style={styles.napStats}>
										<View style={styles.napStat}>
											<Text style={styles.napStatNum}>+{youHearts} ♥</Text>
											<Text style={styles.napStatLabel}>shared this visit</Text>
										</View>
										<View style={styles.napStatDivider} />
										<View style={styles.napStat}>
											<Text style={styles.napStatNum}>{napUntil}</Text>
											<Text style={styles.napStatLabel}>until you can visit again</Text>
										</View>
									</View>
									<Pressable onPress={onClose} style={styles.napBtn}>
										<Text style={styles.napBtnText}>Head home →</Text>
									</Pressable>
								</View>
							</View>
						)}
					</>
				)}
			</PageBackground>
		</View>
	);
}

// One heart tally cell — pops + floats a "+1 ♥" on each tap.
function HeartTally({
	label,
	total,
	tickStyle,
}: {
	label: string;
	total: number;
	tickStyle: { opacity: Animated.AnimatedInterpolation<number>; transform: { translateY: Animated.AnimatedInterpolation<number> }[] };
}) {
	return (
		<View style={styles.tally}>
			<Animated.Text style={[styles.tallyTick, tickStyle]}>+1 ♥</Animated.Text>
			<View style={styles.tallyRow}>
				<Text style={styles.tallyHeart}>♥</Text>
				<Text style={styles.tallyNum}>{total.toLocaleString()}</Text>
			</View>
			<Text style={styles.tallyLabel} numberOfLines={1}>
				{label}
			</Text>
		</View>
	);
}

// A tappable pig (you or the friend), with floating hearts + optional energy bar.
function TapPig({
	me = false,
	squishStyle,
	onPress,
	label,
	hat,
	flag,
	tired,
	floats,
	energy,
	energyColor,
	energyLabel,
}: {
	me?: boolean;
	// Animated transform style shared by both pigs (squish on tap).
	squishStyle: Record<string, unknown>;
	onPress: () => void;
	label: string;
	hat: { id: string; category: string | null; emoji: string | null } | null;
	flag: { id: string; category: string; emoji: null } | null;
	tired: boolean;
	floats: { id: number; anim: Animated.Value; rx: number; star: boolean }[];
	energy?: number;
	energyColor?: string;
	energyLabel?: string;
}) {
	const scale = me ? 0.38 : 0.52;
	const box = me ? 132 : 168;
	return (
		<Pressable onPress={onPress} style={styles.pigCol}>
			{/* flying hearts */}
			<View pointerEvents="none" style={styles.floatLayer}>
				{floats.map((f) => (
					<Animated.Text
						key={f.id}
						style={[
							styles.float,
							{
								color: f.star ? WHIMSY.sun : WHIMSY.roseDeep,
								fontSize: me ? 20 : 26,
								opacity: f.anim.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 1, 0] }),
								transform: [
									{ translateX: f.rx * (me ? 0.6 : 1) },
									{ translateY: f.anim.interpolate({ inputRange: [0, 1], outputRange: [10, -96] }) },
									{ scale: f.anim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.5, 1.1, 0.9] }) },
								],
							},
						]}
					>
						{f.star ? "✦" : "♥"}
					</Animated.Text>
				))}
			</View>
			<View style={[styles.pigBox, { width: box, height: box }]}>
				<Animated.View style={[{ transform: [{ scale }] }, squishStyle]}>
					<PigStage equipped={hat} equippedFlag={flag} pigAnimation={tired ? "tired" : "idle"} />
				</Animated.View>
			</View>
			<View style={[styles.nameTag, me ? styles.nameTagYou : styles.nameTagFriend]}>
				<Text style={[styles.nameTagText, !me && { fontSize: 14 }]} numberOfLines={1}>
					{label}
				</Text>
			</View>
			{!me && energy != null && (
				<View style={styles.energyWrap}>
					<View style={styles.energyTrack}>
						<View style={[styles.energyFill, { width: `${energy}%`, backgroundColor: energyColor }]} />
					</View>
					<Text style={styles.energyLabel}>{energyLabel} · energy</Text>
				</View>
			)}
		</Pressable>
	);
}

const INK = WHIMSY.ink;
const sticker = { shadowColor: INK, shadowOffset: { width: 2, height: 2 }, shadowOpacity: 1, shadowRadius: 0, elevation: 2 };

const styles = StyleSheet.create({
	root: { ...StyleSheet.absoluteFillObject, zIndex: 100, backgroundColor: WHIMSY.cream },
	topVeil: { position: "absolute", top: 0, left: 0, right: 0, height: 250, backgroundColor: "rgba(36,24,14,0.42)" },

	chrome: { paddingHorizontal: 16, paddingTop: 56 },
	headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
	kicker: { fontFamily: FONTS.hand, fontSize: 13, letterSpacing: 1.2, color: "#ffe9a8" },
	title: {
		fontFamily: FONTS.whimsy,
		fontSize: 23,
		color: WHIMSY.paper,
		marginTop: 1,
		textShadowColor: "rgba(0,0,0,0.55)",
		textShadowOffset: { width: 0, height: 2 },
		textShadowRadius: 3,
	},
	leavePill: {
		flexShrink: 0,
		paddingHorizontal: 13,
		paddingVertical: 8,
		borderRadius: 999,
		borderWidth: 2,
		borderColor: INK,
		backgroundColor: WHIMSY.paper,
		...sticker,
	},
	leaveText: { fontFamily: FONTS.bodyExtra, fontSize: 12, color: INK },

	heartCard: {
		flexDirection: "row",
		alignItems: "stretch",
		marginTop: 14,
		borderWidth: 2,
		borderColor: INK,
		borderRadius: 18,
		backgroundColor: WHIMSY.paper,
		overflow: "hidden",
		...sticker,
	},
	heartDivider: { width: 2, backgroundColor: INK, opacity: 0.45 },
	tally: { flex: 1, paddingVertical: 10, alignItems: "center", overflow: "hidden" },
	tallyTick: {
		position: "absolute",
		top: 2,
		fontFamily: FONTS.whimsy,
		fontSize: 13,
		color: WHIMSY.roseDeep,
		zIndex: 3,
	},
	tallyRow: { flexDirection: "row", alignItems: "center", gap: 5 },
	tallyHeart: { color: WHIMSY.roseDeep, fontSize: 14 },
	tallyNum: { fontFamily: FONTS.whimsy, fontSize: 23, color: INK },
	tallyLabel: { fontFamily: FONTS.bodyExtra, fontSize: 9.5, letterSpacing: 1, color: WHIMSY.mute, marginTop: 4 },
	beatEmblem: {
		position: "absolute",
		left: "50%",
		top: "50%",
		marginLeft: -15,
		marginTop: -15,
		width: 30,
		height: 30,
		borderRadius: 15,
		backgroundColor: WHIMSY.rose,
		borderWidth: 2,
		borderColor: INK,
		alignItems: "center",
		justifyContent: "center",
		zIndex: 4,
		...sticker,
	},
	beatHeart: { color: WHIMSY.roseDeep, fontSize: 14 },

	ticklesBar: {
		marginTop: 9,
		borderWidth: 2,
		borderColor: INK,
		borderRadius: 14,
		backgroundColor: WHIMSY.cream,
		paddingHorizontal: 12,
		paddingTop: 8,
		paddingBottom: 9,
		...sticker,
	},
	ticklesTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
	ticklesLabel: { fontFamily: FONTS.bodyExtra, fontSize: 11, letterSpacing: 0.6, color: INK },
	ticklesCount: { fontFamily: FONTS.whimsy, fontSize: 16, color: INK },
	ticklesCap: { color: WHIMSY.mute, fontSize: 12 },
	ticklesTrack: {
		height: 11,
		borderRadius: 999,
		borderWidth: 1.5,
		borderColor: INK,
		backgroundColor: "rgba(42,31,21,0.1)",
		marginTop: 6,
		overflow: "hidden",
	},
	ticklesFill: { height: "100%", backgroundColor: "#e8a82e", borderRadius: 999 },
	ticklesFoot: { flexDirection: "row", justifyContent: "space-between", marginTop: 5 },
	ticklesFootText: { fontFamily: FONTS.bodyExtra, fontSize: 9, letterSpacing: 0.4, color: WHIMSY.mute },

	stage: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 18 },
	pigsRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 4 },
	pigCol: { alignItems: "center", position: "relative" },
	floatLayer: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center", zIndex: 5 },
	float: { position: "absolute", bottom: "60%", fontFamily: FONTS.whimsy },
	pigBox: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
	nameTag: { marginTop: -8, borderWidth: 2, borderColor: INK, borderRadius: 999, ...sticker },
	nameTagYou: { backgroundColor: WHIMSY.paper, paddingHorizontal: 11, paddingVertical: 2 },
	nameTagFriend: { backgroundColor: WHIMSY.sun, paddingHorizontal: 13, paddingVertical: 3 },
	nameTagText: { fontFamily: FONTS.whimsy, fontSize: 12, color: INK, maxWidth: 130, textAlign: "center" },
	energyWrap: { marginTop: 7, alignItems: "center", gap: 3 },
	energyTrack: {
		width: 104,
		height: 9,
		borderRadius: 999,
		borderWidth: 1.5,
		borderColor: INK,
		backgroundColor: "rgba(255,255,255,0.6)",
		overflow: "hidden",
		...sticker,
	},
	energyFill: { height: "100%" },
	energyLabel: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 9.5,
		color: "#fff",
		textShadowColor: "rgba(0,0,0,0.55)",
		textShadowOffset: { width: 0, height: 1 },
		textShadowRadius: 2,
	},

	stageFoot: { alignItems: "center", gap: 9, marginTop: 18 },
	nudge: { paddingHorizontal: 15, paddingVertical: 6, borderRadius: 999, backgroundColor: "rgba(42,31,21,0.55)" },
	nudgeText: { fontFamily: FONTS.hand, fontSize: 14, color: "#fff" },
	helpPill: {
		flexDirection: "row",
		alignItems: "center",
		gap: 7,
		paddingHorizontal: 14,
		paddingVertical: 6,
		borderRadius: 999,
		borderWidth: 1.5,
		borderColor: "rgba(255,255,255,0.55)",
		backgroundColor: "rgba(42,31,21,0.32)",
	},
	helpDot: { color: "#fff", fontSize: 13, fontWeight: "900" },
	helpText: { fontFamily: FONTS.body, fontSize: 12, color: "#fff" },

	truffleBtn: {
		marginTop: 14,
		backgroundColor: WHIMSY.peach,
		borderWidth: 2,
		borderColor: INK,
		borderRadius: 14,
		paddingVertical: 10,
		paddingHorizontal: 18,
		...sticker,
	},
	truffleText: { fontFamily: FONTS.whimsy, fontSize: 16, color: INK },
	truffleFound: { marginTop: 14, fontFamily: FONTS.whimsy, fontSize: 16, color: WHIMSY.paper, textAlign: "center" },

	toastWrap: { position: "absolute", top: "34%", left: 0, right: 0, alignItems: "center", zIndex: 30 },
	toast: {
		backgroundColor: WHIMSY.rose,
		borderWidth: 2,
		borderColor: INK,
		borderRadius: 14,
		paddingHorizontal: 16,
		paddingVertical: 10,
		maxWidth: 280,
		...sticker,
	},
	toastTitle: { fontFamily: FONTS.whimsy, fontSize: 15, color: INK },
	toastSub: { fontFamily: FONTS.hand, fontSize: 12, color: WHIMSY.mute, marginTop: 1 },

	sheetScrim: { ...StyleSheet.absoluteFillObject, zIndex: 45, backgroundColor: "rgba(20,16,28,0.46)", justifyContent: "flex-end" },
	sheet: { backgroundColor: WHIMSY.paper, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30 },
	sheetGrip: { width: 42, height: 5, borderRadius: 999, backgroundColor: WHIMSY.mute, opacity: 0.5, alignSelf: "center", marginBottom: 14 },
	sheetTitle: { fontFamily: FONTS.whimsy, fontSize: 23, color: INK, textAlign: "center" },
	sheetRow: { flexDirection: "row", gap: 13, alignItems: "flex-start", marginTop: 14 },
	sheetIcon: {
		width: 40,
		height: 40,
		borderRadius: 12,
		borderWidth: 2,
		borderColor: INK,
		backgroundColor: WHIMSY.cream,
		alignItems: "center",
		justifyContent: "center",
		...sticker,
	},
	sheetRowTitle: { fontFamily: FONTS.whimsy, fontSize: 16, color: INK },
	sheetRowBody: { fontFamily: FONTS.body, fontSize: 12.5, lineHeight: 18, color: WHIMSY.mute, marginTop: 2 },
	sheetBtn: {
		marginTop: 20,
		backgroundColor: WHIMSY.sun,
		borderWidth: 2,
		borderColor: INK,
		borderRadius: 14,
		paddingVertical: 12,
		alignItems: "center",
		...sticker,
	},
	sheetBtnText: { fontFamily: FONTS.whimsy, fontSize: 16, color: INK },

	napScrim: { ...StyleSheet.absoluteFillObject, zIndex: 50, backgroundColor: "rgba(20,16,28,0.55)", alignItems: "center", justifyContent: "center", padding: 20 },
	napCard: {
		width: "100%",
		maxWidth: 320,
		backgroundColor: WHIMSY.paper,
		borderWidth: 2,
		borderColor: INK,
		borderRadius: 20,
		padding: 22,
		alignItems: "center",
		...sticker,
	},
	napEmoji: { fontSize: 46 },
	napKicker: { fontFamily: FONTS.hand, fontSize: 13, letterSpacing: 1, color: WHIMSY.accent, marginTop: 6 },
	napTitle: { fontFamily: FONTS.whimsy, fontSize: 26, color: INK, marginTop: 2 },
	napBody: { fontFamily: FONTS.hand, fontSize: 15, lineHeight: 22, color: WHIMSY.mute, textAlign: "center", marginTop: 8, marginBottom: 16 },
	napStats: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-around",
		alignSelf: "stretch",
		backgroundColor: WHIMSY.cream,
		borderWidth: 2,
		borderColor: INK,
		borderRadius: 12,
		paddingVertical: 10,
		marginBottom: 16,
	},
	napStat: { flex: 1, alignItems: "center", paddingHorizontal: 6 },
	napStatNum: { fontFamily: FONTS.whimsy, fontSize: 18, color: INK },
	napStatLabel: { fontFamily: FONTS.bodyExtra, fontSize: 9, letterSpacing: 0.5, color: WHIMSY.mute, marginTop: 2, textAlign: "center" },
	napStatDivider: { width: 2, alignSelf: "stretch", backgroundColor: INK, opacity: 0.5 },
	napBtn: { alignSelf: "stretch", backgroundColor: WHIMSY.sun, borderWidth: 2, borderColor: INK, borderRadius: 14, paddingVertical: 12, alignItems: "center", ...sticker },
	napBtnText: { fontFamily: FONTS.whimsy, fontSize: 17, color: INK },
});
