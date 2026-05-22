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
	Alert,
	Text,
	Animated,
	DevSettings,
} from "react-native";
import { useAudioPlayer, setAudioModeAsync } from "expo-audio";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../utils/supabase";
import { log } from "../utils/log";
import SwipeElement from "./SwipeElement";
import { Icon } from "./ui/Icon";
import { Sticker, Tape } from "./ui/Sticker";
import { WHIMSY, FONTS } from "@/constants/theme";
import { HAT_IMAGES } from "@/constants/hats";
import { PageBackground } from "./ui/PageBackground";
import { LuckyPigModal } from "./LuckyPigModal";
import { LuckyTitleUnlockModal } from "./LuckyTitleUnlockModal";
import { ensurePushPermission } from "../utils/pushNotifications";
import { ReleaseNotesModal, shouldShowReleaseNotes } from "./ReleaseNotesModal";
import { BarnOverlay } from "./ui/BarnOverlay";
import { alignmentLabel, type AlignmentLabel } from "@/utils/alignment";

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

type GrantedLuckyTitle = {
	id: string;
	name: string;
	placement: "pre" | "post";
	description: string | null;
};

// Four pig-voice oink variants; one is picked at random on each tickle
// so the sound feels alive instead of looping the same clip.
const oinkSound1 = require("../assets/sounds/oink_1.mp3");
const oinkSound2 = require("../assets/sounds/oink_2.mp3");
const oinkSound3 = require("../assets/sounds/oink_3.mp3");
const oinkSound4 = require("../assets/sounds/oink_4.mp3");
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

interface EquipSlot {
	id: string;
	category: string | null;
	emoji: string | null;
}

interface Stats {
	counter: number;
	ticklesEarned: number;
	itemCount: number;
	cap: number;
	nextRegenSeconds: number | null;
	// Four independently-equipped slots: main (hat/scarf/mask/etc.),
	// aura, background, and held. See migrations 20260514000000 +
	// 20260519000000 (held).
	activeHat: EquipSlot | null;
	activeAura: EquipSlot | null;
	activeBackground: EquipSlot | null;
	activeHeld: EquipSlot | null;
	currentTier: number;
	totalTiers: number;
}

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
	const [stats, setStats] = useState<Stats>({
		counter: 0,
		ticklesEarned: 0,
		itemCount: 0,
		cap: 25,
		nextRegenSeconds: null,
		activeHat: null,
		activeAura: null,
		activeBackground: null,
		activeHeld: null,
		currentTier: 1,
		totalTiers: 30,
	});
	const [statsLoaded, setStatsLoaded] = useState(false);
	const [sixSevenTick, setSixSevenTick] = useState(0);
	const sixSevenPromptedRef = useRef(false);

	// Lucky Pig state — number of tickles remaining in the active
	// lucky window (0 means not lucky). Hydrated from AsyncStorage on
	// mount so the window survives app reload + cold start.
	const [luckyTicklesLeft, setLuckyTicklesLeft] = useState(0);
	const [luckyModalOpen, setLuckyModalOpen] = useState(false);
	// Title-unlock modal: shown after the burst dismisses if the
	// 20% title sub-roll succeeded. Persists across the burst modal
	// closing so the user gets two beats instead of one cluttered modal.
	const [unlockedTitle, setUnlockedTitle] =
		useState<GrantedLuckyTitle | null>(null);
	// Whether the current lucky trigger ALSO rolled a title — captured
	// at trigger time, consumed when the burst dismisses.
	const pendingTitleRoll = useRef(false);

	// Season 1: current alignment, drives BarnOverlay theming.
	const [alignment, setAlignment] = useState<AlignmentLabel>("neutral");
	// Active daily-ritual effects → BarnOverlay glow / miasma wash.
	const [effects, setEffects] = useState<{ blessed: boolean; cursed: boolean }>(
		{ blessed: false, cursed: false }
	);

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
	const oinkPlayer1 = useAudioPlayer(oinkSound1);
	const oinkPlayer2 = useAudioPlayer(oinkSound2);
	const oinkPlayer3 = useAudioPlayer(oinkSound3);
	const oinkPlayer4 = useAudioPlayer(oinkSound4);
	const oinkPlayers = [oinkPlayer1, oinkPlayer2, oinkPlayer3, oinkPlayer4];
	const deniedPlayer = useAudioPlayer(deniedSound);
	const [toast, setToast] = useState<{
		title: string;
		body: string;
		onPress?: () => void;
	} | null>(null);
	const toastOpacity = useRef(new Animated.Value(0)).current;
	const toastY = useRef(new Animated.Value(-20)).current;
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
			const { data, error } = await supabase.rpc("unseen_pass_events");
			if (error) return; // RPC may not exist yet pre-migration — fail quiet.
			const rows = (data ?? []) as {
				id: number;
				passer_id: string;
				passer_username: string | null;
				passer_tickles: number;
				passed_tickles: number;
			}[];
			// Most recent first from the RPC — show the freshest pass we
			// haven't already surfaced this session.
			const fresh = rows.find((r) => !shownPassEventIds.current.has(r.id));
			if (!fresh) return;
			shownPassEventIds.current.add(fresh.id);
			const name = fresh.passer_username?.trim() || "Someone";
			const line =
				PASS_LINES[Math.floor(Math.random() * PASS_LINES.length)](name);
			showToast(line, "Tap to see the leaderboard.", () => {
				supabase
					.rpc("mark_pass_event_seen", { event_id: fresh.id })
					.then(() => {});
				router.push("/friends" as any);
			});
			// Fire-and-forget: mark seen so the next poll doesn't return it.
			supabase
				.rpc("mark_pass_event_seen", { event_id: fresh.id })
				.then(() => {});
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
			Alert.alert(
				"6 7! 🐷",
				"You've crossed 67 tickles. Wanna celebrate with a six-seven?",
				[
					{
						text: "Skip",
						style: "cancel",
						onPress: () => AsyncStorage.setItem("seen_67", "1"),
					},
					{
						text: "Six seven!",
						onPress: () => {
							AsyncStorage.setItem("seen_67", "1");
							setSixSevenTick((t) => t + 1);
						},
					},
				]
			);
		})();
	}, [stats.counter]);

	useFocusEffect(
		useCallback(() => {
			fetchStats();
			checkPassEvents();
			setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
		}, [checkPassEvents])
	);

	const fetchStats = async () => {
		try {
			// Single round trip via home_stats() RPC — was 3-4 sequential
			// queries (profiles + tickle_info + season_state + hats join).
			// Falls back to the multi-query path if the RPC isn't deployed
			// yet so dev sims work between code merge and `supabase db push`.
			const { data: rpcRaw, error: rpcErr } = await supabase.rpc("home_stats");
			if (!rpcErr && rpcRaw && (rpcRaw as { ok?: boolean }).ok) {
				type SlotBlob = {
					category?: string | null;
					emoji?: string | null;
				} | null;
				const r = rpcRaw as {
					counter: number;
					tickles_earned: number;
					active_hat_id: string | null;
					active_hat: SlotBlob;
					active_aura_id: string | null;
					active_aura: SlotBlob;
					active_background_id: string | null;
					active_background: SlotBlob;
					active_held_id?: string | null;
					active_held?: SlotBlob;
					balance: number;
					cap: number;
					next_regen_seconds: number | null;
					current_tier: number;
					total_tiers: number;
				};
				const toSlot = (id: string | null, meta: SlotBlob): EquipSlot | null =>
					id
						? {
								id,
								category: meta?.category ?? null,
								emoji: meta?.emoji ?? null,
							}
						: null;
				setStats({
					counter: r.counter,
					ticklesEarned: r.tickles_earned,
					itemCount: r.balance,
					cap: r.cap,
					nextRegenSeconds: r.next_regen_seconds,
					activeHat: toSlot(r.active_hat_id, r.active_hat),
					activeAura: toSlot(r.active_aura_id, r.active_aura),
					activeBackground: toSlot(r.active_background_id, r.active_background),
					activeHeld: toSlot(r.active_held_id ?? null, r.active_held ?? null),
					currentTier: r.current_tier,
					totalTiers: r.total_tiers,
				});
				setStatsLoaded(true);
				return;
			}

			// Fallback: original multi-query path.
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) throw new Error("User not logged in");

			const [profileResult, infoResult, seasonResult] = await Promise.all([
				supabase
					.from("profiles")
					.select(
						"counter, tickles_earned, active_hat_id, active_aura_id, active_background_id, active_held_id, alignment_score"
					)
					.eq("id", user.id)
					.single(),
				supabase.rpc("tickle_info", { uid: user.id }),
				supabase.rpc("season_state"),
			]);

			if (profileResult.error) throw profileResult.error;

			const info = infoResult.data as {
				balance?: number;
				cap?: number;
				next_regen_seconds?: number | null;
			} | null;
			const season = seasonResult.data as {
				current_tier?: number;
				season?: { total_tiers?: number };
			} | null;
			const prof = profileResult.data as {
				counter?: number;
				tickles_earned?: number;
				active_hat_id?: string | null;
				active_aura_id?: string | null;
				active_background_id?: string | null;
				active_held_id?: string | null;
				alignment_score?: number | null;
			} | null;

			// Season 1: drives the BarnOverlay theming. Tolerates a
			// missing column (pre-alignment-migration) → defaults neutral.
			setAlignment(alignmentLabel(prof?.alignment_score ?? 0));

			// Active blessing/curse effects → BarnOverlay glow / miasma.
			supabase.rpc("my_active_effects").then(({ data }) => {
				const rows = (data as { source: string }[] | null) ?? [];
				setEffects({
					blessed: rows.some((r) => r.source === "blessing"),
					cursed: rows.some((r) => r.source === "curse"),
				});
			});

			const slotIds: (string | null)[] = [
				prof?.active_hat_id ?? null,
				prof?.active_aura_id ?? null,
				prof?.active_background_id ?? null,
				prof?.active_held_id ?? null,
			];
			const idsToLookUp = slotIds.filter((x): x is string => !!x);
			const hatMetaById = new Map<
				string,
				{ category: string | null; emoji: string | null }
			>();
			if (idsToLookUp.length > 0) {
				const { data: rows } = await supabase
					.from("hats")
					.select("id, category, emoji")
					.in("id", idsToLookUp);
				(rows ?? []).forEach((h) =>
					hatMetaById.set(h.id, {
						category: h.category ?? null,
						emoji: h.emoji ?? null,
					})
				);
			}
			const toSlot = (id: string | null): EquipSlot | null => {
				if (!id) return null;
				const m = hatMetaById.get(id);
				return { id, category: m?.category ?? null, emoji: m?.emoji ?? null };
			};

			setStats({
				counter: prof?.counter || 0,
				ticklesEarned: prof?.tickles_earned ?? 0,
				itemCount: info?.balance ?? 0,
				cap: info?.cap ?? 25,
				nextRegenSeconds: info?.next_regen_seconds ?? null,
				activeHat: toSlot(prof?.active_hat_id ?? null),
				activeAura: toSlot(prof?.active_aura_id ?? null),
				activeBackground: toSlot(prof?.active_background_id ?? null),
				activeHeld: toSlot(prof?.active_held_id ?? null),
				currentTier: season?.current_tier ?? 1,
				totalTiers: season?.season?.total_tiers ?? 30,
			});
			setStatsLoaded(true);
		} catch (error) {
			log.error("Error fetching stats:", error);
		}
	};

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

		try {
			const oink = oinkPlayers[Math.floor(Math.random() * oinkPlayers.length)];
			oink.seekTo(0);
			oink.play();
		} catch {}

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
				const chance = withinBoost
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

			const { error } = await supabase.rpc("update_profile_and_item_count", {
				uid: user.id,
			});

			if (error) throw error;

			// If this tickle landed inside the lucky window AND rolled
			// a double, grant the +1 bonus via the dedicated RPC so we
			// don't burn a second tickle from the bank.
			if (bonusEarned) {
				await supabase.rpc("lucky_bonus_tickle");
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
					</View>
				</View>

				{/* Hidden — the "Tier X of 30" wooden sign isn't meaningful
				    on the home screen now that the season pass surfaces
				    progress in its own tab. Keeping the WoodenSign
				    component around so it can be re-enabled later or
				    re-purposed for a different stat. */}

				{__DEV__ && (
					<Pressable
						onPress={() => router.push("/align")}
						style={styles.devAlign}
					>
						<Text style={styles.devAlignText}>⊕ align</Text>
					</Pressable>
				)}

				{/* Dev-only force-trigger for the Lucky Pig moment.
				    Forces the title sub-roll so the LuckyTitleUnlockModal
				    fires after the burst dismisses — useful for testing
				    animations, sounds, and the title-grant flow without
				    needing to tickle 20× hoping for a 5% hit. */}
				{__DEV__ && (
					<Pressable
						onPress={() => {
							persistLucky(LUCKY_WINDOW_SIZE);
							pendingTitleRoll.current = true;
							setLuckyModalOpen(true);
						}}
						style={styles.devLucky}
					>
						<Text style={styles.devLuckyText}>⊕ lucky</Text>
					</Pressable>
				)}

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
						const { data, error } = await supabase.rpc(
							"unlock_random_lucky_title"
						);
						const r = data as {
							ok?: boolean;
							granted?: GrantedLuckyTitle | null;
						} | null;
						if (error) {
							showToast(
								"Couldn't unlock",
								"Title grant failed — try again next time.",
							);
							return;
						}
						if (!r?.granted) {
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

			<LuckyTitleUnlockModal
				title={unlockedTitle}
				onDismiss={() => setUnlockedTitle(null)}
				onEquip={async (id) => {
					try {
						await supabase.rpc("equip_title", { target_title_id: id });
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
		// Slight downward push so the feet just kiss the bottom — keeps
		// the framing consistent across iPhone SE → Pro Max, with the
		// pig sitting noticeably higher than the original 11%/7% clip
		// values so all 4 corners + the tickle CTAs above breathe.
		marginBottom: -Math.round(SCREEN_HEIGHT * 0.03),
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
	tradePill: {
		position: "absolute",
		right: 16,
		bottom: Platform.OS === "ios" ? 96 : 80,
		width: 56,
		height: 56,
		borderRadius: 28,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: WHIMSY.paper,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		zIndex: 60,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 3 },
		shadowOpacity: 0.18,
		shadowRadius: 6,
		elevation: 5,
	},
	tradePillEmoji: { fontSize: 26 },
	tradePillBadge: {
		position: "absolute",
		top: -4,
		right: -4,
		minWidth: 22,
		height: 22,
		paddingHorizontal: 5,
		borderRadius: 11,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: WHIMSY.lilacDeep ?? WHIMSY.lilac,
		borderWidth: 2,
		borderColor: WHIMSY.paper,
	},
	tradePillBadgeText: {
		fontFamily: FONTS.whimsy,
		fontSize: 12,
		color: WHIMSY.ink,
	},
});
