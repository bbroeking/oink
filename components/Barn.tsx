import React, { useState, useCallback, useEffect, useRef } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import {
	View,
	StyleSheet,
	Dimensions,
	Platform,
	SafeAreaView,
	Pressable,
	Text,
	Animated,
	DevSettings,
} from "react-native";
import Svg, { Polygon, Rect, Line } from "react-native-svg";
import { useAudioPlayer, setAudioModeAsync } from "expo-audio";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../utils/supabase";
import { rpc } from "@/utils/rpc";
import { log } from "../utils/log";
import SwipeElement from "./SwipeElement";
import { Icon } from "./ui/Icon";
import { Sticker, Tape } from "./ui/Sticker";
import { WHIMSY, FONTS } from "@/constants/theme";
import { HAT_IMAGES } from "@/constants/hats";
import { PageBackground } from "./ui/PageBackground";
import { LuckyPigModal } from "./LuckyPigModal";
import { LuckyTitleUnlockModal } from "./LuckyTitleUnlockModal";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import type { TitleRow } from "@/constants/title_types";
import { ensurePushPermission } from "../utils/pushNotifications";
import { ReleaseNotesModal, shouldShowReleaseNotes } from "./ReleaseNotesModal";
import { BarnOverlay } from "./ui/BarnOverlay";
import { BarnActiveEffectsStrip } from "./BarnActiveEffectsStrip";
import {
	alignmentLabel,
	alignmentDisplay,
	type AlignmentLabel,
} from "@/utils/alignment";
import { useHomeStats } from "@/hooks/useHomeStats";

// Lucky Pig tunables — client-rolled (D in the design grill). Trade-off
// is documented in migrations/20260519020000_lucky_pig.sql.
const LUCKY_TRIGGER_CHANCE      = 0.05;  // 5% steady-state on any non-lucky tickle
const LUCKY_TRIGGER_CHANCE_BOOST = 0.12; // ~2.4× boost during the launch window
const LUCKY_WINDOW_SIZE         = 10;    // tickles affected after a trigger
const LUCKY_DOUBLE_CHANCE       = 0.30;  // 30% of window tickles double
const LUCKY_TITLE_UNLOCK_CHANCE = 0.20;  // 20% of lucky triggers also drop a title
const LUCKY_STORAGE_KEY         = "lucky_pig_state_v1";
const LUCKY_EVER_KEY            = "lucky_pig_ever_v1";  // "1" once the user has ever triggered
const LUCKY_PRE_FIRST_KEY       = "lucky_pig_pre_first_v1"; // tickle count BEFORE first lucky

// Time-bounded launch boost: while now() < this ISO, every tickle uses
// the boosted 12% chance instead of 5%. Set ~3 days out from this code
// landing so users see the feature multiple times in the first week,
// then it normalizes. Update if you ship another lucky-pig promotion.
const LUCKY_BOOST_UNTIL_ISO     = "2026-05-22T00:00:00Z";

// Per-user first-time guarantee: any user who has NEVER triggered a
// lucky pig will be force-fired on their Nth tickle. Caps the worst
// case of "I never see this feature." Constant should be small enough
// that a new user hits it in one session.
const LUCKY_GUARANTEED_BY_TICKLE_N = 8;

// Ritual effects. sun_beam blessing → a strong lucky-trigger boost;
// phantom_itch curse → a tap sometimes slips.
const LUCKY_TRIGGER_CHANCE_SUNBEAM = 0.4;
const PHANTOM_ITCH_MISS_CHANCE = 0.33;

// Two pig-laugh variants; one is picked at random on each tickle
// so the sound feels alive instead of looping the same clip. Old
// oink_1..4 set was replaced with cuter cartoon-pig laughs.
const laughSound1 = require("../assets/sounds/laugh_1.mp3");
const laughSound2 = require("../assets/sounds/laugh_2.mp3");
const deniedSound = require("../assets/sounds/denied.mp3");

// Friendly, slightly competitive pig-voice lines for pass events. Picked
// at random so it doesn't feel like the same robotic notification.
// Module-scoped — was re-created every Barn render at zero benefit.
const PASS_LINES: ((name: string) => string)[] = [
	(name) => `Oink! ${name} just trotted past you.`,
	(name) => `${name} snouted ahead. Don't look back.`,
	(name) => `${name} just hoofed past you on the board.`,
	(name) => `Squeal — ${name} edged ahead of you.`,
	(name) => `${name} muddied your lead.`,
];

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// ── HeartFloats ────────────────────────────────────────────────
// Tap-feedback particles that drift up + fade out above the pig.
// Imperative API: <HeartFloats ref={r} /> + r.current.spawn().
// ~90% hearts, ~10% sparkle stars. From the redesign — gives a tap
// visible payoff without requiring a server roundtrip.
interface HeartFloatsHandle {
	spawn: () => void;
}
interface HeartFloatsProps {
	// When set, the float renders this image instead of the
	// default ♥/✦ text glyph. Sourced from the player's equipped
	// tickle particle (HAT_IMAGES[active_tickle_particle_id]).
	particleImage?: number | null;
}
const HeartFloats = React.forwardRef<HeartFloatsHandle, HeartFloatsProps>(
	({ particleImage }, ref) => {
		type Float = {
			id: number;
			dx: number;          // horizontal drift target (px)
			rise: number;        // how high it climbs (px, negative)
			rot: number;         // tilt for the image variant (deg)
			scaleMax: number;    // peak scale, scattered per particle
			duration: number;    // total animation duration (ms)
			char: string;        // ♥ / ✦ when no image is equipped
			anim: Animated.Value;
		};
		const [floats, setFloats] = useState<Float[]>([]);
		const nextId = useRef(0);

		// One tap spawns a HANDFUL — staggered emit so they trickle
		// out rather than appearing as a solid block. Spread, rise,
		// scale, tilt, and duration are all jittered per particle so
		// the burst doesn't read as a clone army.
		React.useImperativeHandle(ref, () => ({
			spawn: () => {
				const burst = 7 + Math.floor(Math.random() * 3); // 7–9 per tap
				for (let i = 0; i < burst; i++) {
					const stagger = i === 0 ? 0 : Math.floor(Math.random() * 120);
					setTimeout(() => {
						const id = nextId.current++;
						const dx = Math.random() * 160 - 80;            // wider spread
						const rise = -(95 + Math.random() * 45);         // -95 → -140
						const rot = Math.random() * 50 - 25;             // ±25°
						const scaleMax = 0.85 + Math.random() * 0.45;    // 0.85 → 1.3
						const duration = 950 + Math.floor(Math.random() * 350); // 950–1300ms
						const char = Math.random() < 0.1 ? "✦" : "♥";
						const anim = new Animated.Value(0);
						setFloats((f) => [
							...f,
							{ id, dx, rise, rot, scaleMax, duration, char, anim },
						]);
						Animated.timing(anim, {
							toValue: 1,
							duration,
							useNativeDriver: true,
						}).start(() => {
							setFloats((f) => f.filter((x) => x.id !== id));
						});
					}, stagger);
				}
			},
		}));

		return (
			<View pointerEvents="none" style={StyleSheet.absoluteFill}>
				{floats.map((f) => {
					const translateY = f.anim.interpolate({
						inputRange: [0, 0.15, 1],
						outputRange: [0, -12, f.rise],
					});
					const opacity = f.anim.interpolate({
						inputRange: [0, 0.15, 0.85, 1],
						outputRange: [0, 1, 1, 0],
					});
					const scale = f.anim.interpolate({
						inputRange: [0, 0.15, 1],
						outputRange: [0.5, f.scaleMax, f.scaleMax * 0.9],
					});
					// Equipped tickle-particle path: render the image
					// instead of the typographic glyph. Fall back to
					// the original ♥/✦ when no particle is equipped
					// so the empty-slot experience still has motion.
					if (particleImage) {
						return (
							<Animated.Image
								key={f.id}
								source={particleImage}
								resizeMode="contain"
								style={[
									styles.floatImage,
									{
										transform: [
											{ translateX: f.dx },
											{ translateY },
											{ rotate: `${f.rot}deg` },
											{ scale },
										],
										opacity,
									},
								]}
							/>
						);
					}
					return (
						<Animated.Text
							key={f.id}
							style={[
								styles.floatChar,
								{
									color:
										f.char === "✦" ? WHIMSY.sun : WHIMSY.roseDeep,
									transform: [
										{ translateX: f.dx },
										{ translateY },
										{ scale },
									],
									opacity,
								},
							]}
						>
							{f.char}
						</Animated.Text>
					);
				})}
			</View>
		);
	}
);
HeartFloats.displayName = "HeartFloats";

function formatCountdown(totalSeconds: number): string {
	const m = Math.floor(totalSeconds / 60);
	const s = totalSeconds % 60;
	if (m === 0) return `${s}s`;
	return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function PaperTicket({
	label,
	value,
	tapeColor,
	rotate,
	chipColor = "roseDeep",
	chipSymbol = "♥",
	subValue,
	onPress,
}: {
	label: string;
	value: string;
	tapeColor: "sun" | "rose" | "sky" | "sage" | "lilac" | "peach";
	rotate: number;
	chipColor?: "roseDeep" | "lilacDeep" | "peach";
	chipSymbol?: string;
	subValue?: string;
	onPress?: () => void;
}) {
	const Wrap: React.ElementType = onPress ? Pressable : View;
	return (
		<Wrap onPress={onPress} style={styles.ticketWrap}>
			<Tape
				color={tapeColor}
				rotate={-6 + rotate}
				width={56}
				height={16}
				style={styles.tape}
			/>
			<Sticker color="paper" rotate={rotate} radius={10} style={styles.ticket}>
				<View style={styles.ticketInner}>
					<View
						style={[
							styles.coin,
							{ backgroundColor: WHIMSY[chipColor] },
						]}
					>
						<Text style={styles.coinSymbol}>{chipSymbol}</Text>
					</View>
					<View style={{ flex: 1, minWidth: 0 }}>
						<View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
							<Text style={styles.ticketValue}>{value}</Text>
							{subValue && (
								<Text style={styles.ticketSub}>{subValue}</Text>
							)}
						</View>
						<Text style={styles.ticketLabel}>{label}</Text>
					</View>
				</View>
			</Sticker>
		</Wrap>
	);
}

function WoodenSign({
	tier,
	totalTiers,
	onPress,
}: {
	tier: number;
	totalTiers: number;
	onPress: () => void;
}) {
	return (
		<Pressable onPress={onPress} style={styles.signWrap}>
			{/* Post (drawn first, behind sign) */}
			<View style={styles.signPost} />
			<Sticker color="peach" rotate={-2.5} radius={12} style={styles.sign}>
				<View style={styles.signInner}>
					<View style={{ flex: 1 }}>
						<Text style={styles.signLabel}>snout season 1 ★</Text>
						<Text style={styles.signTier}>
							Tier {tier} of {totalTiers}
						</Text>
					</View>
					<Icon name="arrowRight" size={20} color={WHIMSY.ink} strokeWidth={2.5} />
				</View>
			</Sticker>
		</Pressable>
	);
}

export default function Barn() {
	const [sixSevenTick, setSixSevenTick] = useState(0);
	const sixSevenPromptedRef = useRef(false);
	// Storybook dialog state for the 67-celebration prompt. Replaces the
	// bare iOS Alert.alert that used to fire here — same modal-style
	// switch we made for the bounty Swap dialog, applied here because
	// the iOS native alert may have been contributing to a freeze
	// reported on a TestFlight build (pigAnim stuck at "happy" after
	// the celebration animation, blocking all subsequent taps).
	const [sixSevenDialog, setSixSevenDialog] = useState(false);
	// Tracks the previous-seen alignment_score for the in-app toast on
	// every shift. The server-side `shift_alignment` push covers the
	// milestone moments (±10/±25/±50/±100); this is the every-shift
	// in-app companion.
	const prevAlignmentRef = useRef<number | null>(null);

	// Lucky Pig state — number of tickles remaining in the active
	// lucky window (0 means not lucky). Hydrated from AsyncStorage on
	// mount so the window survives app reload + cold start.
	const [luckyTicklesLeft, setLuckyTicklesLeft] = useState(0);
	const [luckyModalOpen, setLuckyModalOpen] = useState(false);
	// Title-unlock modal: shown after the burst dismisses if the
	// 20% title sub-roll succeeded. Persists across the burst modal
	// closing so the user gets two beats instead of one cluttered modal.
	const [unlockedTitle, setUnlockedTitle] =
		useState<TitleRow | null>(null);
	// Whether the current lucky trigger ALSO rolled a title — captured
	// at trigger time, consumed when the burst dismisses.
	const pendingTitleRoll = useRef(false);

	// Season 1: current alignment, drives BarnOverlay theming.
	const [alignment, setAlignment] = useState<AlignmentLabel>("neutral");
	// Active daily-ritual effects — drive the overlay + the tap loop.
	const [effects, setEffects] = useState<{
		blessed: boolean;
		cursed: boolean;
		sunBeam: boolean;
		phantomItch: boolean;
	}>({ blessed: false, cursed: false, sunBeam: false, phantomItch: false });

	// Home stats (counter, balance, equipped cosmetics, season tier).
	// Owned by useHomeStats; the hook also surfaces alignment + effects
	// via the fallback path (dev-sim parity pre-migration), routed back
	// into the local setters above.
	const {
		stats,
		statsLoaded,
		refresh: fetchStats,
	} = useHomeStats({
		onAlignmentLoaded: setAlignment,
		onEffectsLoaded: setEffects,
	});

	// Release-notes auto-show: fires once on Barn mount per app launch
	// when the user hasn't seen the latest version yet.
	const [releaseNotesOpen, setReleaseNotesOpen] = useState(false);
	useEffect(() => {
		shouldShowReleaseNotes().then((show) => {
			if (show) setReleaseNotesOpen(true);
		});
	}, []);

	// Lifetime onboarding state — has the user ever triggered a lucky
	// pig? If not, count their tickles so we can force-fire on the Nth
	// to guarantee they see the feature. Refs so reads inside
	// handleIncrement see the latest value without rerender churn.
	const everTriggeredRef = useRef(false);
	const preFirstTicklesRef = useRef(0);
	useEffect(() => {
		AsyncStorage.getItem(LUCKY_STORAGE_KEY).then((raw) => {
			const n = raw ? parseInt(raw, 10) : 0;
			if (!Number.isNaN(n) && n > 0) setLuckyTicklesLeft(n);
		});
		AsyncStorage.getItem(LUCKY_EVER_KEY).then((raw) => {
			everTriggeredRef.current = raw === "1";
		});
		AsyncStorage.getItem(LUCKY_PRE_FIRST_KEY).then((raw) => {
			const n = raw ? parseInt(raw, 10) : 0;
			if (!Number.isNaN(n) && n > 0) preFirstTicklesRef.current = n;
		});
	}, []);
	const persistLucky = (n: number) => {
		setLuckyTicklesLeft(n);
		AsyncStorage.setItem(LUCKY_STORAGE_KEY, String(n)).catch(() => {});
	};
	const markFirstLucky = () => {
		everTriggeredRef.current = true;
		AsyncStorage.setItem(LUCKY_EVER_KEY, "1").catch(() => {});
	};
	const bumpPreFirstTickles = () => {
		preFirstTicklesRef.current += 1;
		AsyncStorage.setItem(
			LUCKY_PRE_FIRST_KEY,
			String(preFirstTicklesRef.current),
		).catch(() => {});
	};
	// useAudioPlayer is a hook, so each variant gets its own top-level
	// call. Bundled into an array below for random-pick playback.
	const laughPlayer1 = useAudioPlayer(laughSound1);
	const laughPlayer2 = useAudioPlayer(laughSound2);
	const oinkPlayers = [laughPlayer1, laughPlayer2];
	const deniedPlayer = useAudioPlayer(deniedSound);
	const [toast, setToast] = useState<{
		title: string;
		body: string;
		onPress?: () => void;
	} | null>(null);
	const toastOpacity = useRef(new Animated.Value(0)).current;
	const toastY = useRef(new Animated.Value(-20)).current;
	// Heart-particle ref — imperative spawn on successful tickle.
	const heartFloatsRef = useRef<HeartFloatsHandle>(null);
	// Track which pass-event IDs we've already surfaced this session so a
	// focus-bounce (or a delayed seen-write) doesn't replay the same toast.
	const shownPassEventIds = useRef<Set<number>>(new Set());

	const showToast = useCallback(
		(title: string, body: string, onPress?: () => void) => {
			setToast({ title, body, onPress });
			toastOpacity.setValue(0);
			toastY.setValue(-20);
			Animated.sequence([
				Animated.parallel([
					Animated.timing(toastOpacity, {
						toValue: 1,
						duration: 220,
						useNativeDriver: true,
					}),
					Animated.timing(toastY, {
						toValue: 0,
						duration: 220,
						useNativeDriver: true,
					}),
				]),
				Animated.delay(2400),
				Animated.parallel([
					Animated.timing(toastOpacity, {
						toValue: 0,
						duration: 300,
						useNativeDriver: true,
					}),
					Animated.timing(toastY, {
						toValue: -20,
						duration: 300,
						useNativeDriver: true,
					}),
				]),
			]).start(() => setToast(null));
		},
		[toastOpacity, toastY]
	);

	const checkPassEvents = useCallback(async () => {
		try {
			const data = await rpc<
				{
					id: number;
					passer_id: string;
					passer_username: string | null;
					passer_tickles: number;
					passed_tickles: number;
				}[]
			>("unseen_pass_events");
			if (!data) return; // RPC may not exist yet pre-migration — fail quiet.
			const rows = data;
			// Most recent first from the RPC — show the freshest pass we
			// haven't already surfaced this session.
			const fresh = rows.find((r) => !shownPassEventIds.current.has(r.id));
			if (!fresh) return;
			shownPassEventIds.current.add(fresh.id);
			const name = fresh.passer_username?.trim() || "Someone";
			const line =
				PASS_LINES[Math.floor(Math.random() * PASS_LINES.length)](name);
			showToast(line, "Tap to see the leaderboard.", () => {
				rpc("mark_pass_event_seen", { event_id: fresh.id }).then(() => {});
				router.push("/friends" as any);
			});
			// Fire-and-forget: mark seen so the next poll doesn't return it.
			rpc("mark_pass_event_seen", { event_id: fresh.id }).then(() => {});
		} catch {
			// Network blips silently — pass events are non-critical UX.
		}
	}, [showToast]);

	useEffect(() => {
		if (sixSevenPromptedRef.current) return;
		if (stats.counter < 67) return;
		sixSevenPromptedRef.current = true;
		(async () => {
			const seen = await AsyncStorage.getItem("seen_67");
			if (seen === "1") return;
			setSixSevenDialog(true);
		})();
	}, [stats.counter]);

	useFocusEffect(
		useCallback(() => {
			fetchStats();
			checkPassEvents();
			claimStipend();
			checkAlignment();
			setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
		}, [checkPassEvents])
	);

	// Slop Club: claim the monthly snout stipend. The RPC is idempotent
	// per UTC month + a no-op for non-members, so it's safe to call on
	// every focus; it only pays out once a month for subscribers.
	const claimStipend = async () => {
		const r = await rpc<{ ok?: boolean; granted?: number }>("claim_slop_stipend");
		if (r?.ok && r.granted) {
			showToast("Slop Club", `+${r.granted} snouts — your monthly stipend`);
			fetchStats();
		}
	};

	// Toast every alignment shift while the app is open. Server-side
	// `shift_alignment` already fires push notifications at milestone
	// crossings (±10/±25/±50/±100) — those land when the app is
	// closed. This handles the in-session "+2 toward Generous" beats.
	const checkAlignment = async () => {
		const { data: ures } = await supabase.auth.getUser();
		const uid = ures?.user?.id;
		if (!uid) return;
		const { data } = await supabase
			.from("profiles")
			.select("alignment_score")
			.eq("id", uid)
			.single();
		const score =
			(data as { alignment_score?: number } | null)?.alignment_score ?? 0;
		const prev = prevAlignmentRef.current;
		prevAlignmentRef.current = score;
		// First focus after launch — establish the baseline, no toast.
		if (prev === null || prev === score) return;
		const delta = score - prev;
		const dir = delta > 0 ? "Generous" : "Greedy";
		const sign = delta > 0 ? "+" : "";
		const label = alignmentDisplay(alignmentLabel(score));
		const scoreText = (score >= 0 ? "+" : "") + score;
		showToast(`${sign}${delta} toward ${dir}`, `Now ${scoreText} — ${label}`);
	};

	// fetchStats is now homeStats.refresh from useHomeStats; the
	// inline RPC + fallback path moved into hooks/useHomeStats.ts.

	const handleIncrement = async () => {
		if (stats.itemCount <= 0) {
			const next = stats.nextRegenSeconds;
			// "Nuh-uh" SFX + error haptic so the empty-balance tap feels
			// rejected, not silent. Matches the denied feedback in shop
			// purchase-fail and gives the player consistent UI vocabulary.
			try {
				deniedPlayer.seekTo(0);
				deniedPlayer.play();
			} catch {}
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
				() => {}
			);
			showToast(
				"Out of tickles!",
				next != null
					? `Next tickle in ${formatCountdown(next)} · max ${stats.cap}`
					: `Wait for regen or buy more soon.`
			);
			return;
		}

		// Phantom itch — a curse: while active, a tap sometimes slips
		// right off. No bank spent, no score; just a missed beat.
		if (effects.phantomItch && Math.random() < PHANTOM_ITCH_MISS_CHANCE) {
			Haptics.notificationAsync(
				Haptics.NotificationFeedbackType.Warning
			).catch(() => {});
			showToast("Phantom itch", "Your tap slipped right off.");
			return;
		}

		try {
			const oink = oinkPlayers[Math.floor(Math.random() * oinkPlayers.length)];
			oink.seekTo(0);
			oink.play();
		} catch {}

		// Spawn a floating ♥ (occasionally ✦) above the pig — visible
		// reward for the tap, before we even round-trip the RPC.
		heartFloatsRef.current?.spawn();

		// ── Lucky Pig roll ────────────────────────────────────────
		// Trigger probability:
		//   - First-time user (no lucky ever): GUARANTEE on the Nth tickle
		//     so they see the feature regardless of luck. Until then,
		//     normal probability.
		//   - Within launch boost window: 12% chance
		//   - After boost ends: 5% steady-state
		// Already in a lucky window: roll the double die instead.
		let bonusEarned = false;
		if (luckyTicklesLeft <= 0) {
			const isFirstTimeUser = !everTriggeredRef.current;
			const withinBoost =
				Date.now() < new Date(LUCKY_BOOST_UNTIL_ISO).getTime();
			let triggerNow = false;
			if (isFirstTimeUser) {
				bumpPreFirstTickles();
				if (preFirstTicklesRef.current >= LUCKY_GUARANTEED_BY_TICKLE_N) {
					triggerNow = true;
				}
			}
			if (!triggerNow) {
				// sun_beam blessing → a strong boost to the trigger roll.
				const chance = effects.sunBeam
					? LUCKY_TRIGGER_CHANCE_SUNBEAM
					: withinBoost
						? LUCKY_TRIGGER_CHANCE_BOOST
						: LUCKY_TRIGGER_CHANCE;
				if (Math.random() < chance) triggerNow = true;
			}
			if (triggerNow) {
				if (isFirstTimeUser) markFirstLucky();
				persistLucky(LUCKY_WINDOW_SIZE);
				setLuckyModalOpen(true);
				// Roll the title sub-die NOW so the result is deterministic
				// for this trigger; we just defer the RPC + modal display
				// until the burst dismisses to keep the beats separated.
				pendingTitleRoll.current =
					Math.random() < LUCKY_TITLE_UNLOCK_CHANCE;
				// sun_beam is consume-on-first-lucky — clear it as soon
				// as a lucky pig actually fires so subsequent rolls drop
				// back to the base chance instead of keeping the boost
				// for the rest of the timed window. Best-effort: a
				// network failure leaves the buff in place but the
				// blessing's own 4h expiry caps the worst case.
				if (effects.sunBeam) {
					void (async () => {
						try {
							await rpc("clear_blessing", {
								target_kind: "sun_beam",
							});
							setEffects((e) => ({ ...e, sunBeam: false }));
						} catch {
							// best-effort; the 4h expiry caps worst case
						}
					})();
				}
			}
		} else {
			if (Math.random() < LUCKY_DOUBLE_CHANCE) {
				bonusEarned = true;
			}
			persistLucky(Math.max(0, luckyTicklesLeft - 1));
		}

		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) throw new Error("User not logged in");

			await rpc("update_profile_and_item_count", {
				uid: user.id,
			});

			// If this tickle landed inside the lucky window AND rolled
			// a double, grant the +1 bonus via the dedicated RPC so we
			// don't burn a second tickle from the bank.
			if (bonusEarned) {
				await rpc("lucky_bonus_tickle");
				showToast("Lucky double! +2", "Bonus from your lucky pig.");
			}
			fetchStats();
			// Also re-check pass events so a friend who just got passed
			// hears about it on their next tap (and so any incoming pass
			// against us surfaces quickly between focus events).
			checkPassEvents();
		} catch (error) {
			log.error("Error incrementing count:", error);
		}
	};

	const handleAvailableTap = () => {
		if (stats.itemCount >= stats.cap) {
			showToast("Tickle bank full", `You're at the ${stats.cap} max.`);
			return;
		}
		if (stats.nextRegenSeconds == null) {
			showToast("Tickle bank", `${stats.itemCount} / ${stats.cap}`);
			return;
		}
		showToast(
			"Next tickle",
			`In ${formatCountdown(stats.nextRegenSeconds)} · +1 every hour, max ${stats.cap}`
		);
	};

	return (
		<PageBackground bgId={stats.activeBackground?.id ?? null}>
			<BarnOverlay
				alignment={alignment}
				blessed={effects.blessed}
				cursed={effects.cursed}
			/>

			{/* Tiny red barn silhouette tucked into the bottom-left of
			    the painted scene. Decorative — only visible when there's
			    no cosmetic background equipped (since PageBackground
			    paints over the area when it is). Behind everything else. */}
			{!stats.activeBackground && (
				<View pointerEvents="none" style={styles.barnSilhouette}>
					<Svg viewBox="0 0 64 56" width={64} height={56}>
						<Polygon
							points="32,4 4,22 4,52 60,52 60,22"
							fill="#c44848"
							stroke={WHIMSY.ink}
							strokeWidth={2}
						/>
						<Rect x={22} y={32} width={20} height={20} fill={WHIMSY.ink} />
						<Line x1={22} y1={22} x2={22} y2={52} stroke={WHIMSY.ink} strokeWidth={1.5} />
						<Line x1={42} y1={22} x2={42} y2={52} stroke={WHIMSY.ink} strokeWidth={1.5} />
					</Svg>
				</View>
			)}

			{/* Generous radial puffs — two soft white clouds that fade
			    in at the top-left/right when alignment crosses into
			    angel territory. "Angel-coded" overlay from the design. */}
			{alignment === "angel" && (
				<>
					<View pointerEvents="none" style={[styles.generousPuff, styles.generousPuffL]} />
					<View pointerEvents="none" style={[styles.generousPuff, styles.generousPuffR]} />
				</>
			)}

			<SafeAreaView style={styles.contentContainer}>
				<View style={styles.statsRow}>
					<PaperTicket
						label="TICKLES EARNED"
						value={stats.ticklesEarned.toLocaleString()}
						tapeColor="sun"
						rotate={-3}
						chipColor="roseDeep"
						chipSymbol="♥"
					/>
					<PaperTicket
						label="READY TO TICKLE"
						value={`${stats.itemCount}`}
						subValue={`/ ${stats.cap}`}
						tapeColor="rose"
						rotate={2.5}
						chipColor="lilacDeep"
						chipSymbol="✦"
						onPress={handleAvailableTap}
					/>
				</View>

				{/* Active-effect chips — horizontal strip showing hoofprints
				    on you. Compact preview; the full panel lives in Friends
				    → Inbox. Tapping a chip routes to the hub. */}
				<BarnActiveEffectsStrip />

				{/* Alignment placard removed — the hanging Pilgrim/
				    Generous/Greedy sign that used to live up here
				    was redundant with the Account alignment story
				    block and crowded the painted scene. */}

				{/* Active lucky-pig window indicator. Sits below the
				    stat cards + above the pig — never collides with the
				    dev buttons (top-right absolute) or the cards. */}
				{luckyTicklesLeft > 0 && (
					<View style={styles.luckyBadgeRow}>
						<View style={styles.luckyBadge}>
							<Text style={styles.luckyBadgeText}>
								✦ Lucky pig · {luckyTicklesLeft} left
							</Text>
						</View>
					</View>
				)}

				<View style={styles.mainSection}>
					<View style={styles.swipeContainer}>
						<SwipeElement
							onLuckySwipe={handleIncrement}
							canTickle={!statsLoaded || stats.itemCount > 0}
							playSixSeven={sixSevenTick}
							equipped={stats.activeHat}
							equippedAura={stats.activeAura}
							equippedBackground={stats.activeBackground}
							equippedHeld={stats.activeHeld}
						/>
						{/* Floating ♥/✦ particles drift up from above the pig on
						    every successful tickle. Absolute-fills the swipe
						    container so the hearts sit *over* the pig sprite. */}
						<HeartFloats
							ref={heartFloatsRef}
							particleImage={
								stats.activeTickleParticle?.id
									? HAT_IMAGES[stats.activeTickleParticle.id] ?? null
									: null
							}
						/>
						{/* Soft elliptical shadow under the pig — gives the
						    sprite a little grounding without a hard drop. */}
						<View pointerEvents="none" style={styles.pigShadow} />
					</View>
				</View>

				{/* Hidden — the "Tier X of 30" wooden sign isn't meaningful
				    on the home screen now that the season pass surfaces
				    progress in its own tab. Keeping the WoodenSign
				    component around so it can be re-enabled later or
				    re-purposed for a different stat. */}

				{toast && (
					<Animated.View
						pointerEvents={toast.onPress ? "box-none" : "none"}
						style={[
							styles.toastWrap,
							{
								opacity: toastOpacity,
								transform: [{ translateY: toastY }],
							},
						]}
					>
						<Pressable
							onPress={toast.onPress}
							disabled={!toast.onPress}
						>
							<Sticker color="rose" rotate={-1.2} radius={14} style={styles.toast}>
								<View style={styles.toastInner}>
									<View style={styles.toastIcon}>
										<Text style={styles.toastIconText}>♥</Text>
									</View>
									<View style={{ flex: 1, minWidth: 0 }}>
										<Text style={styles.toastTitle}>{toast.title}</Text>
										<Text style={styles.toastBody}>{toast.body}</Text>
									</View>
								</View>
							</Sticker>
						</Pressable>
					</Animated.View>
				)}

			</SafeAreaView>

			<LuckyPigModal
				visible={luckyModalOpen}
				windowSize={LUCKY_WINDOW_SIZE}
				doublePercent={Math.round(LUCKY_DOUBLE_CHANCE * 100)}
				onDismiss={async () => {
					setLuckyModalOpen(false);
					// Burst dismissed — if this trigger also rolled a
					// title unlock, hit the RPC and surface the second
					// modal once the burst is fully torn down.
					if (!pendingTitleRoll.current) return;
					pendingTitleRoll.current = false;
					try {
						const r = await rpc<{
							ok?: boolean;
							granted?: TitleRow | null;
						}>("unlock_random_lucky_title");
						if (!r) {
							showToast(
								"Couldn't unlock",
								"Title grant failed — try again next time.",
							);
							return;
						}
						if (!r.granted) {
							// All 10 lucky titles already owned.
							showToast(
								"Lucky title sweep!",
								"You already own every lucky-drop title.",
							);
							return;
						}
						// Brief beat so the burst dismiss animation finishes
						// before the title modal pops in.
						setTimeout(() => setUnlockedTitle(r.granted!), 280);
					} catch {
						showToast(
							"Couldn't unlock",
							"Title grant failed — try again next time.",
						);
					}
				}}
			/>

			<ConfirmDialog
				open={sixSevenDialog}
				title="6 7!"
				body="You've crossed 67 tickles. Wanna celebrate with a six-seven?"
				confirmLabel="Six seven!"
				cancelLabel="Skip"
				onCancel={() => {
					setSixSevenDialog(false);
					AsyncStorage.setItem("seen_67", "1");
				}}
				onConfirm={() => {
					setSixSevenDialog(false);
					AsyncStorage.setItem("seen_67", "1");
					setSixSevenTick((t) => t + 1);
				}}
			/>

			<LuckyTitleUnlockModal
				title={unlockedTitle}
				onDismiss={() => setUnlockedTitle(null)}
				onEquip={async (id) => {
					try {
						await rpc("equip_title", { target_title_id: id });
						showToast("Title equipped", "Visible on your account + leaderboard.");
					} catch {}
					setUnlockedTitle(null);
				}}
			/>

			{/* Tickle trades moved to the Friends-tab Inbox in the
			    Season-1 social redesign — no Barn pill or modal. */}

			<ReleaseNotesModal
				visible={releaseNotesOpen}
				onClose={() => setReleaseNotesOpen(false)}
			/>
		</PageBackground>
	);
}

const styles = StyleSheet.create({
	// Fullscreen page backdrop. Edges bleed all the way to the device
	// frame (behind the status bar and the tab bar) — the SafeAreaView
	contentContainer: {
		flex: 1,
		height: SCREEN_HEIGHT,
	},
	statsRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		paddingHorizontal: 14,
		paddingTop: Platform.OS === "ios" ? 12 : 24,
		gap: 10,
		zIndex: 1,
	},
	// Placard styles dropped with the JSX above.
	// tickleHint dropped — the "tap rosie to tickle" prompt was
	// noise once the pig was the only thing on screen.
	ticketWrap: {
		position: "relative",
		paddingTop: 12,
		flex: 1,
	},
	tape: {
		position: "absolute",
		top: 0,
		alignSelf: "center",
		zIndex: 2,
	},
	ticket: {
		paddingHorizontal: 14,
		paddingVertical: 12,
		minWidth: 168,
	},
	ticketInner: {
		flexDirection: "row",
		alignItems: "center",
		gap: 11,
	},
	coin: {
		width: 32,
		height: 32,
		borderRadius: 16,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
	},
	coinSymbol: {
		color: WHIMSY.paper,
		fontFamily: FONTS.bodyExtra,
		fontSize: 16,
		lineHeight: 17,
	},
	ticketLabel: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 10,
		color: WHIMSY.ink,
		lineHeight: 12,
		marginTop: 4,
		letterSpacing: 1.4,
	},
	ticketValue: {
		fontFamily: FONTS.whimsy,
		fontSize: 30,
		color: WHIMSY.ink,
		lineHeight: 30,
	},
	ticketSub: {
		fontFamily: FONTS.hand,
		fontSize: 17,
		color: WHIMSY.mute,
	},
	mainSection: {
		flex: 1,
		justifyContent: "flex-end",
	},
	swipeContainer: {
		width: "100%",
		alignItems: "center",
		position: "relative",
		// Slight downward push so the feet just kiss the bottom — keeps
		// the framing consistent across iPhone SE → Pro Max, with the
		// pig sitting noticeably higher than the original 11%/7% clip
		// values so all 4 corners + the tickle CTAs above breathe.
		marginBottom: -Math.round(SCREEN_HEIGHT * 0.03),
	},
	// Equipped tickle particle — same screen-anchor as floatChar so
	// the image drifts up from the same point. ~40px reads cleanly
	// against the pig at any device size.
	floatImage: {
		position: "absolute",
		left: "50%",
		bottom: "55%",
		width: 40,
		height: 40,
		marginLeft: -20,
	},
	floatChar: {
		position: "absolute",
		left: "50%",
		bottom: "55%",
		fontFamily: FONTS.whimsy,
		fontSize: 26,
		// Ink halo via four 1px offset text-shadows isn't possible in
		// RN <Text>; the ink color stands out enough on its own against
		// the painted barn backdrop.
		marginLeft: -13, // visually center the glyph on left:50%
	},
	pigShadow: {
		position: "absolute",
		bottom: 4,
		alignSelf: "center",
		width: 180,
		height: 14,
		borderRadius: 90,
		backgroundColor: "rgba(42,31,21,0.22)",
		// Use opacity gradient via stacked transparent layers? RN doesn't
		// do radial — flat ellipse with low alpha gets us close enough.
	},
	// Tiny red barn silhouette painted into the bottom-left horizon.
	// Sits behind the SafeAreaView content so the pig + stickers always
	// read above it. Opacity-reduced so it never competes for attention.
	barnSilhouette: {
		position: "absolute",
		bottom: 160,
		left: 22,
		width: 64,
		height: 56,
		opacity: 0.45,
		zIndex: 0,
	},
	// Generous (angel-coded) radial puffs — soft white clouds that
	// fade in at top-left + top-right when alignment >= angel
	// threshold. The radial-gradient via View isn't possible in RN;
	// a translucent white circle with low-opacity edges via a single
	// background gets us close.
	generousPuff: {
		position: "absolute",
		backgroundColor: "rgba(255,255,255,0.45)",
		borderRadius: 999,
		zIndex: 1,
	},
	generousPuffL: {
		top: 130,
		left: -10,
		width: 90,
		height: 50,
	},
	generousPuffR: {
		top: 240,
		right: -20,
		width: 110,
		height: 60,
	},
	signWrap: {
		alignItems: "center",
		marginBottom: Platform.OS === "ios" ? 16 : 36,
	},
	signPost: {
		width: 14,
		height: 28,
		backgroundColor: WHIMSY.peach,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		marginBottom: -10,
		zIndex: 0,
		transform: [{ rotate: "-1.5deg" }],
	},
	sign: {
		paddingHorizontal: 18,
		paddingVertical: 12,
		minWidth: "78%",
		zIndex: 1,
	},
	signInner: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
	},
	signLabel: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.mute,
		marginBottom: 2,
	},
	signTier: {
		fontFamily: FONTS.whimsy,
		fontSize: 18,
		color: WHIMSY.ink,
	},
	dev67: {
		position: "absolute",
		bottom: 100,
		left: 14,
		width: 48,
		height: 48,
		borderRadius: 24,
		backgroundColor: "rgba(0,0,0,0.7)",
		borderWidth: 2,
		borderColor: WHIMSY.sun,
		alignItems: "center",
		justifyContent: "center",
		zIndex: 20,
	},
	devOnboarding: {
		position: "absolute",
		bottom: 100,
		left: 70,
		width: 48,
		height: 48,
		borderRadius: 24,
		backgroundColor: "rgba(0,0,0,0.7)",
		borderWidth: 2,
		borderColor: WHIMSY.sun,
		alignItems: "center",
		justifyContent: "center",
		zIndex: 20,
	},
	dev67Text: {
		color: WHIMSY.sun,
		fontFamily: FONTS.whimsy,
		fontSize: 18,
	},
devAlign: {
		position: "absolute",
		top: Platform.OS === "ios" ? 60 : 24,
		right: 12,
		paddingHorizontal: 10,
		paddingVertical: 6,
		borderRadius: 14,
		backgroundColor: "rgba(0,0,0,0.7)",
		borderWidth: 1.5,
		borderColor: WHIMSY.sun,
		zIndex: 50,
	},
	devAnchor: {
		position: "absolute",
		top: Platform.OS === "ios" ? 94 : 58,
		right: 12,
		paddingHorizontal: 10,
		paddingVertical: 6,
		borderRadius: 14,
		backgroundColor: "rgba(0,0,0,0.7)",
		borderWidth: 1.5,
		borderColor: "#00E5FF",
		zIndex: 50,
	},
	devLucky: {
		position: "absolute",
		top: Platform.OS === "ios" ? 60 : 24,
		right: 78,
		paddingHorizontal: 10,
		paddingVertical: 6,
		borderRadius: 14,
		backgroundColor: "rgba(0,0,0,0.7)",
		borderWidth: 1.5,
		borderColor: "#FFB000",
		zIndex: 50,
	},
	devLuckyText: {
		color: "#FFB000",
		fontFamily: FONTS.whimsy,
		fontSize: 12,
		letterSpacing: 0.5,
	},
	devAlignText: {
		color: WHIMSY.sun,
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		letterSpacing: 0.5,
	},
	toastWrap: {
		position: "absolute",
		top: Platform.OS === "ios" ? 180 : 160,
		left: 16,
		right: 16,
		zIndex: 30,
	},
	toast: {
		paddingHorizontal: 14,
		paddingVertical: 10,
	},
	toastInner: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
	},
	toastIcon: {
		width: 32,
		height: 32,
		borderRadius: 16,
		backgroundColor: WHIMSY.roseDeep,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
	},
	toastIconText: {
		color: WHIMSY.paper,
		fontFamily: FONTS.bodyExtra,
		fontSize: 15,
	},
	toastTitle: {
		fontFamily: FONTS.whimsy,
		fontSize: 16,
		color: WHIMSY.ink,
		lineHeight: 18,
	},
	toastBody: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.mute,
		marginTop: 1,
	},
	luckyBadgeRow: {
		alignItems: "center",
		marginTop: 8,
		marginBottom: 4,
	},
	luckyBadge: {
		backgroundColor: WHIMSY.sun,
		borderRadius: 999,
		paddingHorizontal: 14,
		paddingVertical: 6,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
	},
	luckyBadgeText: {
		fontFamily: FONTS.whimsy,
		fontSize: 13,
		color: WHIMSY.ink,
		letterSpacing: 0.4,
	},
});
