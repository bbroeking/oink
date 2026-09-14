import React, { useState, useCallback, useEffect, useRef } from "react";
import { router } from "expo-router";
import { useFocusEffect } from "expo-router/react-navigation";
import {
	View,
	StyleSheet,
	Dimensions,
	Platform,
	SafeAreaView,
	Pressable,
	Animated,
	AppState,
	Share,
} from "react-native";
import { useAudioPlayer, setAudioModeAsync } from "expo-audio";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../utils/supabase";
import { rpc } from "@/utils/rpc";
import { observeFieldGuide, observeSnouts } from "@/utils/fieldGuide";
import { claimEcho, fetchActiveEcho, type EchoState } from "@/utils/crews";
import { log } from "../utils/log";
import SwipeElement from "./SwipeElement";
import {
	BarnOverlay,
	Glyph,
	glyphSource,
	Hand,
	Icon,
	PageBackground,
	POPUP_TEARDOWN_MS,
	Sticker,
	T,
	usePopupActive,
	usePopupSlot,
} from "./ui";
import { POPUP_PRIORITIES } from "@/constants/popupPriorities";
import {
	AVATAR_SIZE,
	BORDER,
	MOTION,
	PAGE_PAD,
	RADII,
	SPACE,
	TILT,
	WHIMSY,
} from "@/constants/theme";
import { MOTION_DURATION, useMotionPolicy } from "@/hooks/useMotionPolicy";
import { HAT_IMAGES } from "@/constants/hats";
import { LuckyPigModal } from "./LuckyPigModal";
import {
	alignmentLabel,
	alignmentDisplay,
	type AlignmentLabel,
} from "@/utils/alignment";
import { useHomeStats } from "@/hooks/useHomeStats";
import { moodAnimation } from "@/utils/happiness";
import { formatClockMS } from "@/utils/duration";
import { wallowRegenPercent, wallowWaitReductionLabel } from "@/utils/wallow";
import { EarnedStamp } from "./EarnedStamp";
import { TickleCoin } from "./TickleCoin";
import { BarnButton, type BarnFanOption } from "./BarnButton";
import { BuriedMound, buriedSnoutsCopy } from "./BuriedMound";
import { HabitatDoorTransition } from "./habitat/HabitatDoorTransition";
import { useBarnThreshold } from "@/hooks/useBarnThreshold";
import { useHabitatAccount } from "@/hooks/useHabitatAccount";
import { useHabitatJournal } from "@/hooks/useHabitatJournal";
import { BuryTruffleSheet } from "./BuryTruffleSheet";
import { BuriedTruffleSheet } from "./BuriedTruffleSheet";
import { useBuriedTruffle } from "@/hooks/useBuriedTruffle";
import { useDigEntry } from "@/hooks/useDigEntry";
import { usePassEvents } from "@/hooks/usePassEvents";
import { useLuckyPig } from "@/hooks/useLuckyPig";
import { useActiveEffectsContext } from "@/hooks/ActiveEffectsProvider";
import { usePigRoster } from "@/hooks/usePigRoster";
import { useFeatureFlag } from "@/hooks/useFeatureFlags";
import { AdRefillOffer } from "@/features/rewarded-ads/AdRefillOffer";
import { createAdMobRewardedProvider } from "@/features/rewarded-ads/admobAdapter";
import { createSupabaseRewardedAdBackend } from "@/features/rewarded-ads/supabaseAdapter";
import { isSixSevenTickleMilestone } from "@/utils/sixSeven";
import { runOptimisticHomeTickle } from "@/utils/homeTickleConnection";
import { useHomeHabitatPigPublisher } from "@/hooks/useHabitatPigBridge";

// Lucky Pig tunables live in utils/luckyPig.ts (extracted to the
// useLuckyPig hook). Phantom-itch is the only ritual-effect tunable
// still in Barn — it gates the tickle handler's miss path.
const PHANTOM_ITCH_MISS_CHANCE = 0.33;

// Two pig-laugh variants; one is picked at random on each tickle
// so the sound feels alive instead of looping the same clip.
const laughSound1 = require("../assets/sounds/laugh_1.mp3");
const laughSound2 = require("../assets/sounds/laugh_2.mp3");
const deniedSound = require("../assets/sounds/denied.mp3");

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// Drawing geometry, not spacing. Each of these is the size of a PICTURE — an
// SVG's own frame, a particle sprite, the square the bridged pig is staged in —
// so it takes a name here rather than borrowing a step off the spacing scale.
// The tickle particle rides the portrait-mark frame so it reads at the same
// weight as the glyphs on the stat tickets.
const PARTICLE_SIZE = AVATAR_SIZE[1];
const PARTICLE_HALF = PARTICLE_SIZE / 2;
// The square the Habitat bridge stages the pig in.
const PIG_STAGE = 300;
// The yard's ground line above the bottom of `swipeContainer`: where a thing
// standing in the yard (the buried-truffle mound) plants its base so it shares
// Rosie's horizon. Measured off the frames, not eyeballed — the history is in
// git (the barn sprite's baseline, 2026-09-12); the sprite left the yard on
// 2026-09-13 and the line stayed.
const YARD_GROUND = 54;
// The Barn button's seat, off the page's own bottom edge — the scene's corner
// object, parked above the tab bar with the same breathing room the comp gives
// it (docs/design/claude-design/barn/barn-home.html). A drawing measurement.
const BARN_BUTTON_BOTTOM = 22;
// Above the pig: the button is a control sitting in front of the scene, and a
// tap in that corner must be an action, not a tickle. The mound draws over her
// too — it stands in the yard's front row.
const YARD_Z = 4;
// What going in does, spoken — the door's hint on the button and in the fan.
const BARN_HINT = "Opens the doors to your room and furnishings";
// Which action the Barn button wears — the player's pick from its fan, kept on
// this installation so the quick action sticks across launches. Absent until
// the player has ever picked; until then the button arms its own default.
const ARMED_ACTION_KEY = "barn_button_armed";
// Reduce Motion: one glyph, fading in place, for this long. [A-07]
const REST_FLOAT_MS = 600;
// Mark sizes on the toast. A glyph is art, so its size is a picture size, not
// a spacing step.
const TOAST_GLYPH = 18;
const RECOVERY_ICON = 20;
// How far above its resting place the toast starts (and returns to). A travel
// distance, not a margin.
const TOAST_OFFSET = -20;
// The toast card's scrapbook angle — the first step of the shared row tilt.
const TOAST_TILT = TILT.row[0];

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
		// The burst is decoration. Under Reduce Motion it collapses to ONE glyph
		// that fades in place: the tap keeps a visible payoff, it just stops
		// drifting, spinning and scaling. [A-07]
		const motion = useMotionPolicy();
		const decorative = motion.allowDecorativeMotion;

		// One tap spawns a HANDFUL — staggered emit so they trickle
		// out rather than appearing as a solid block. Spread, rise,
		// scale, tilt, and duration are all jittered per particle so
		// the burst doesn't read as a clone army.
		React.useImperativeHandle(ref, () => ({
			spawn: () => {
				// 7–9 per tap while decorative motion is allowed; exactly one,
				// still and centred, at rest.
				const burstSize = decorative ? 7 + Math.floor(Math.random() * 3) : 1;
				const burst = Array.from({ length: burstSize }, (_, index) => ({
					id: nextId.current++,
					dx: decorative ? Math.random() * 160 - 80 : 0,
					rise: decorative ? -(95 + Math.random() * 45) : 0,
					rot: decorative ? Math.random() * 50 - 25 : 0,
					scaleMax: decorative ? 0.85 + Math.random() * 0.45 : 1,
					duration: motion.duration(
						950 + Math.floor(Math.random() * 350),
						REST_FLOAT_MS,
					),
					char: Math.random() < 0.1 ? "✦" : "♥",
					anim: new Animated.Value(0),
					stagger:
						decorative && index > 0 ? Math.floor(Math.random() * 120) : 0,
				}));
				const burstIds = new Set(burst.map((particle) => particle.id));

				// Add and remove the whole burst in two React commits. Staggering
				// belongs to the native-driver animations, so it does not need one JS
				// timer + state update for every particle.
				setFloats((current) => [...current, ...burst]);
				Animated.parallel(
					burst.map((particle) =>
						Animated.timing(particle.anim, {
							toValue: 1,
							delay: particle.stagger,
							duration: particle.duration,
							useNativeDriver: true,
						}),
					),
				).start(() => {
					setFloats((current) =>
						current.filter((particle) => !burstIds.has(particle.id)),
					);
				});
			},
		}));

		return (
			<View pointerEvents="none" style={StyleSheet.absoluteFill}>
				{floats.map((f) => {
					const translateY = f.anim.interpolate({
						inputRange: [0, 0.15, 1],
						// At rest `rise` is 0 and the little lift goes with it, so the
						// glyph holds its spot and only the opacity moves.
						outputRange: [0, decorative ? -12 : 0, f.rise],
					});
					const opacity = f.anim.interpolate({
						inputRange: [0, 0.15, 0.85, 1],
						outputRange: [0, 1, 1, 0],
					});
					const scale = f.anim.interpolate({
						inputRange: [0, 0.15, 1],
						outputRange: decorative
							? [0.5, f.scaleMax, f.scaleMax * 0.9]
							: [1, 1, 1],
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
						<Animated.Image
							key={f.id}
							source={glyphSource(f.char === "✦" ? "sparkle" : "heart")}
							resizeMode="contain"
							style={[
								styles.floatImage,
								{
                  transform: [{ translateX: f.dx }, { translateY }, { scale }],
									opacity,
								},
							]}
						/>
					);
				})}
			</View>
		);
  },
);
HeartFloats.displayName = "HeartFloats";

export default function Barn({ interiorPigOnly = false, bridgeFallback = false }: { interiorPigOnly?: boolean; bridgeFallback?: boolean } = {}) {
	// Every duration on this screen is run past the policy, so a player with
	// Reduce Motion on gets the same information without the travel. [A-07]
	const motion = useMotionPolicy();
	const rewardedAdsEnabled = useFeatureFlag("rewarded_ads");
	const rewardedAdBackend = React.useMemo(createSupabaseRewardedAdBackend, []);
	const rewardedAdProvider = React.useMemo(createAdMobRewardedProvider, []);
	const [sixSevenTick, setSixSevenTick] = useState(0);
	// Last tickle total celebrated in this session. The egg fires only when the
	// player lands exactly on 67 + (1,000 × n); jumping across one misses it.
	const sixSevenPromptedRef = useRef<number | null>(null);
	// Tracks the previous-seen alignment_score for the in-app toast on
	// every shift. The server-side `shift_alignment` push covers the
	// milestone moments (±10/±25/±50/±100); this is the every-shift
	// in-app companion.
	const prevAlignmentRef = useRef<number | null>(null);

	// Season 0: current alignment, drives BarnOverlay theming. Hydrated
	// in checkAlignment() below (on every focus).
	const [alignment, setAlignment] = useState<AlignmentLabel>("neutral");

	const [wallowCount, setWallowCount] = useState(0);
  const pigRoster = usePigRoster();
  const popupActive = usePopupActive();

	// Active daily-ritual effects — drive the overlay + the tap loop.
	// Shared via ActiveEffectsProvider (one instance for the whole tab
	// subtree), so a cleanse from the Hoofprints sheet or Inbox clears the
	// overlay + chips here in lockstep. We derive {blessed, cursed, sunBeam,
	// phantomItch} predicates from the typed effects list for the checks below.
	const activeEffects = useActiveEffectsContext();
	const effects = React.useMemo(
		() => ({
			blessed:     activeEffects.blessings.length > 0,
			cursed:      activeEffects.curses.length > 0,
			// Lucky-pig boost — sun_beam (S0) or glimmer_truffle (S1), same
			// consume-on-first-lucky mechanic. luckyKind targets the clear.
			sunBeam:     activeEffects.effects.some(
        (e) => e.kind === "sun_beam" || e.kind === "glimmer_truffle",
			),
      luckyKind:
        activeEffects.effects.find(
          (e) => e.kind === "sun_beam" || e.kind === "glimmer_truffle",
			)?.kind ?? null,
			phantomItch: activeEffects.effects.some((e) => e.kind === "phantom_itch"),
		}),
    [activeEffects.blessings, activeEffects.curses, activeEffects.effects],
	);

	// Echo — a crewmate's Lucky Pig rings for 10 minutes; the first tap
	// while it rings catches +1 tickle (claim_echo, once per pig per echo).
	// Focus-fetched so re-opening the Barn inside the window still catches.
	const [echo, setEcho] = useState<EchoState | null>(null);
	useFocusEffect(
		useCallback(() => {
			fetchActiveEcho().then(setEcho);
    }, []),
	);

	// Home stats (counter, balance, equipped cosmetics, season tier).
	// Owned by useHomeStats. Effects are no longer routed through here —
	// useActiveEffects above owns them.
	const {
		stats,
		statsLoaded,
		statsError,
		refresh: fetchStats,
		scheduleRefresh: scheduleStatsRefresh,
		applyOptimistic,
	} = useHomeStats();
	// React state updates on the tap, but a ref is the synchronous admission
	// gate for a high-latency burst. Without it, several presses can all read the
	// same pre-render balance and start mutations that the server must reject.
	const ticklesAvailableRef = useRef(stats.itemCount);
	useEffect(() => {
		ticklesAvailableRef.current = stats.itemCount;
	}, [stats.itemCount]);

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
	const toastY = useRef(new Animated.Value(TOAST_OFFSET)).current;
	// Heart-particle ref — imperative spawn on successful tickle.
	const heartFloatsRef = useRef<HeartFloatsHandle>(null);
	// The Exterior's doorway. `useBarnThreshold` owns the sequencing (sprite
	// doors → threshold panels → push, and the reopen on the way back); Barn owns
	// the two things it can't: where the route goes and what the tap feels like.
	const { id: habitatAccountId } = useHabitatAccount();
	// Beckon source: the acquisition journal's unacknowledged New items — the
	// same hook the interior reads, so both surfaces agree on what "new" means.
	// It fetches once per focus of this tab (its own useFocusEffect), which is the
	// cost of the barn knowing there is something waiting inside.
	// `interiorPigOnly` is the bridge's pig-only fallback render: no barn on
	// screen, so it must not pay for the journal (the interior already has one).
	const journal = useHabitatJournal(
		!interiorPigOnly ? habitatAccountId : null,
	);
	const threshold = useBarnThreshold({
		push: useCallback(
			() => router.push({ pathname: "/barn-interior", params: { entry: "structure" } }),
			[],
		),
		beckon: journal.newItemIds.size > 0,
	});
	const enterBarn = useCallback(() => {
		// Haptics only for a tap the threshold actually took — a swallowed second
		// tap mid-swing must feel like nothing, not like a second entry.
		if (threshold.enter()) Haptics.selectionAsync().catch(() => {});
	}, [threshold]);
	// The dig. The retired Updates tray carried the Truffle Patch nudge; this
	// control is the whole of what replaced it — and it does what the tray's chip
	// did, not what its "try a dig ›" line did: `useDigEntry` opens the patch IN
	// PLACE for a crewed player and only falls back to the Season tab door for
	// someone who still needs a herd. One decision, one place.
	const dig = useDigEntry(fetchStats, statsLoaded ? stats.ticklesEarned : null);
	// Coming back out of the room: the panels are still shut over the Exterior, so
	// focus is what opens them again.
	const reopenThreshold = threshold.onFocusRegained;
	useFocusEffect(
		useCallback(() => {
			reopenThreshold();
		}, [reopenThreshold]),
	);

	// Buried truffle: shared status + the bury/check sheets. The single
	// TruffleButton (upper-left) is the control for both states.
	const truffle = useBuriedTruffle();
	const [truffleSheetOpen, setTruffleSheetOpen] = useState(false);
	const [buryOpen, setBuryOpen] = useState(false);
	const truffleBuried = !!truffle.status?.buried;

	const showToast = useCallback(
		(title: string, body: string, onPress?: () => void) => {
			setToast({ title, body, onPress });
			toastOpacity.setValue(0);
			toastY.setValue(TOAST_OFFSET);
			Animated.sequence([
				Animated.parallel([
					Animated.timing(toastOpacity, {
						toValue: 1,
						duration: motion.duration(MOTION_DURATION.state),
						useNativeDriver: true,
					}),
					Animated.timing(toastY, {
						toValue: 0,
						duration: motion.duration(MOTION_DURATION.state),
						useNativeDriver: true,
					}),
				]),
				Animated.delay(MOTION.toast),
				Animated.parallel([
					Animated.timing(toastOpacity, {
						toValue: 0,
						duration: motion.duration(MOTION_DURATION.modal),
						useNativeDriver: true,
					}),
					Animated.timing(toastY, {
						toValue: TOAST_OFFSET,
						duration: motion.duration(MOTION_DURATION.modal),
						useNativeDriver: true,
					}),
				]),
			]).start(() => setToast(null));
		},
		[motion, toastOpacity, toastY],
	);

	// A refused dig is never a dead tap. `useDigEntry` hands back the honest
	// reason (already dug this feeding, the patch is shut, the patch is being
	// stubborn); the Barn already owns a toast, so that is where it lands.
	const digNote = dig.note;
	useEffect(() => {
		if (digNote) showToast("Truffle Patch", digNote);
	}, [digNote, showToast]);

	// Pass events — "X just trotted past you" toasts when another
	// player overtakes us on the leaderboard. Hook owns the dedup set
	// + the RPC; we just pass our showToast for emission.
	const passEvents = usePassEvents({ showToast });

	// Lucky Pig — the surprise +X tickle window mechanic. Hook owns
	// the trigger/double rolls, the AsyncStorage persistence, the
	// combined reward-modal lifecycle, including an optional title grant.
	const luckyPig = useLuckyPig({ showToast });

	// Home-screen popups route through the global PopupQueue so they show one at
	// a time — in concert with the root launch modals, never overlapping. Lower
	// priority shows first; truffle sheet is user-tapped so it jumps the line.
	const truffleSlot = usePopupSlot(
		interiorPigOnly ? "habitatTruffleSheet" : "truffleSheet",
		truffleSheetOpen,
    POPUP_PRIORITIES.truffleSheet,
	);
	const luckyPigSlot = usePopupSlot(
		interiorPigOnly ? "habitatLuckyPig" : "luckyPig",
		luckyPig.luckyModalOpen,
    POPUP_PRIORITIES.luckyPig,
	);

	useEffect(() => {
		const tickles = stats.ticklesEarned;
		if (!isSixSevenTickleMilestone(tickles)) return;
		if (sixSevenPromptedRef.current === tickles) return;
		sixSevenPromptedRef.current = tickles;
		(async () => {
			// Remember the exact milestone on this installation so reopening while
			// still sitting on it does not replay. Future +1,000 milestones remain armed.
			const storageKey = "seen_67_tickle_milestone";
			const seen = await AsyncStorage.getItem(storageKey);
			if (seen != null && Number(seen) === tickles) return;
			await AsyncStorage.setItem(storageKey, String(tickles));
			setSixSevenTick((t) => t + 1);
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
		})();
	}, [stats.ticklesEarned]);

	useFocusEffect(
		useCallback(() => {
			fetchStats();
			passEvents.check();
			checkAlignment();
			setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    }, []),
	);

	// Foreground refresh — re-fetch stats every time the app returns to the
	// foreground. useFocusEffect only fires on screen navigation, so a stats
	// fetch that failed at boot (or went stale in the background) would never
	// recover on resume without this; that gap read as a dead canTickle until
	// force-quit (spec 03 / issue #5). Mirrors the bounty-badge listener in
	// (tabs)/_layout.
	useEffect(() => {
		const sub = AppState.addEventListener("change", (state) => {
			if (state === "active") fetchStats();
		});
		return () => sub.remove();
	}, [fetchStats]);

	// Toast every alignment shift while the app is open. Server-side
	// `shift_alignment` already fires push notifications at milestone
	// crossings (±10/±25/±50/±100) — those land when the app is
	// closed. This handles the in-session "+2 toward Generous" beats.
	const checkAlignment = async () => {
		const { data: ures } = await supabase.auth.getUser();
		const uid = ures?.user?.id;
		if (!uid) return;
		const { data, error } = await supabase
			.from("profiles")
			.select("alignment_score, wallow_count")
			.eq("id", uid)
			.single();
		// A failed read is not a neutral alignment — leave the last known state
		// alone rather than snapping the placard (and toasting a phantom shift)
		// off a transport blip. The next focus/foreground pass retries.
		if (error) return;
		const prof = data;
		setWallowCount(prof?.wallow_count ?? 0);
		const score = prof?.alignment_score ?? 0;
		// Hydrate the alignment state — drives BarnOverlay theming. The
		// home_stats RPC primary path doesn't surface alignment_score, so
		// this fetch is the only place the label gets updated in prod;
		// without it BarnOverlay would stay stuck at "neutral" forever.
		setAlignment(alignmentLabel(score));
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

	// fetchStats is homeStats.refresh from useHomeStats (hooks/useHomeStats.ts).

	const handleIncrement = async () => {
		if (ticklesAvailableRef.current <= 0) {
			const next = stats.nextRegenSeconds;
			// "Nuh-uh" SFX + error haptic so the empty-balance tap feels
			// rejected, not silent. Matches the denied feedback in shop
			// purchase-fail and gives the player consistent UI vocabulary.
			try {
				deniedPlayer.seekTo(0);
				deniedPlayer.play();
			} catch {}
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => {},
			);
			showToast(
				"Out of tickles!",
				next != null
					? `Next in ${formatClockMS(next)} · +1 every ${formatClockMS(stats.regenSeconds ?? 3600)} · max ${stats.cap}`
          : `Wait for regen or buy more soon.`,
			);
			return;
		}

		// Phantom itch — a curse: while active, a tap sometimes slips
		// right off. No bank spent, no score; just a missed beat.
		if (effects.phantomItch && Math.random() < PHANTOM_ITCH_MISS_CHANCE) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
        () => {},
      );
			showToast("Phantom itch", "Your tap slipped right off.");
			return;
		}

		// Reserve and display the base tickle before the network request. The
		// helper rolls this patch back on transport failure and folds the
		// authoritative balance/lucky bonus into the response path.
		const tickleRequest = runOptimisticHomeTickle({
			readAvailable: () => ticklesAvailableRef.current,
			writeAvailable: (next) => {
				ticklesAvailableRef.current = next;
			},
			applyOptimistic,
			mutate: async () => {
				// getSession reads the already-validated local auth state. getUser makes
				// a network request; the tickle RPC remains the authorization boundary.
				const {
					data: { session },
				} = await supabase.auth.getSession();
				const user = session?.user;
				if (!user) throw new Error("User not logged in");

				return rpc(
					rewardedAdsEnabled
						? "update_home_tickle"
						: "update_profile_and_item_count",
					{ uid: user.id },
				);
			},
		});

		try {
			const oink = oinkPlayers[Math.floor(Math.random() * oinkPlayers.length)];
			oink.seekTo(0);
			oink.play();
		} catch {}

		// Spawn a floating ♥ (occasionally ✦) above the pig — visible
		// reward for the tap, before we even round-trip the RPC.
		heartFloatsRef.current?.spawn();

		// Lucky Pig roll — hook owns the trigger / window / double
		// math + the burst-modal lifecycle. Barn handles the side
		// effects: sun_beam clear on a fresh trigger, and the +1
		// bonus payout on doubles.
    const { triggered, doubleEarned } = luckyPig.rollOnTickle(effects.sunBeam);
		const bonusEarned = doubleEarned;

		// A Lucky Pig fired (the 5% client roll users actually see). Record it
		// server-side so the "Lucky Pig" quests count it — the lucky_hog bounty
		// ("Hit a Lucky Pig this week") and the lucky_lover achievement read
		// lucky_pig_hits. Best-effort fire-and-forget (rpc() swallows errors).
		if (triggered) {
			void rpc("record_lucky_pig_hit");
		}

		// Catch a ringing Echo — a crewmate's lucky moment pays this tap
		// +1 tickle. Optimistically consume so a tap-storm claims once;
		// server dedups per (echo, pig) regardless.
		if (echo) {
			setEcho(null);
			void (async () => {
				const r = await claimEcho();
				if (r.ok) {
					heartFloatsRef.current?.spawn();
          Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          ).catch(() => {});
				}
			})();
		}

		if (triggered && effects.sunBeam && effects.luckyKind) {
			// The lucky boost (sun_beam S0 / glimmer_truffle S1) is
			// consume-on-first-lucky — clear it as soon as a lucky pig
			// actually fires so subsequent rolls drop back to the base
			// chance instead of keeping the boost for the rest of the
			// timed window. Best-effort: a network failure leaves the
			// buff in place but the blessing's own 4h expiry caps the
			// worst case. The hook's realtime channel doesn't watch
			// UPDATE on blessings, so a manual refresh syncs the
			// derived predicate.
			// Best-effort; the 4h expiry caps the worst case.
			void (async () => {
				await rpc("clear_blessing", {
					target_kind: effects.luckyKind,
				});
				await activeEffects.refresh();
			})();
		}

		try {
			const tickleOutcome = await tickleRequest;
			if (tickleOutcome.status === "empty") return;
			if (tickleOutcome.status === "failed") {
				if (tickleOutcome.error) {
					log.error("Error incrementing count:", tickleOutcome.error);
				}
				// A response can be lost after the server commits. Roll back the
				// uncertain local reservation, then reconcile when the signal permits.
				scheduleStatsRefresh();
				showToast("That tickle didn't take", "Try again in a moment.");
				return;
			}
			const res = tickleOutcome.result;

			// Field Guide: a successful tickle is the tap that mints a snout —
			// meet the Snouts page (fail-soft, idempotent after the first).
      // This is onboarding knowledge: reveal it only to a genuinely new
      // pig. Lifetime tickles are monotonic (snout balance is spendable),
      // and this successful tap has not reached the local stats snapshot
      // yet, hence +1.
      void observeSnouts(statsLoaded ? stats.ticklesEarned + 1 : null);

			// Daily lucky number: the server rolls a shared counter and, when
			// this tickle lands on today's lucky number, pays +5 tickles
			// (counter + 5, RPC-side). Distinct from the client-rolled Lucky
			// Pig burst — this is the once-a-day herd-wide jackpot. Celebrate it.
			if (res.lucky_won != null) {
				// Field Guide: first daily-lucky hit meets the Lucky Number page.
				observeFieldGuide("lucky_number");
				showToast(
					"You hit today's lucky number!",
          `Lucky #${res.lucky_won} — +5 tickles land in your bank.`,
				);
			}

			// If this tickle landed inside the lucky window AND rolled
			// a double, grant the +1 bonus via the dedicated RPC so we
			// don't burn a second tickle from the bank.
			if (bonusEarned) {
				const bonus = await rpc<{ ok?: boolean }>("lucky_bonus_tickle");
				if (bonus?.ok) {
					applyOptimistic((current) => ({
						counter: current.counter + 1,
						ticklesEarned: current.ticklesEarned + 1,
					}));
					showToast("Lucky double! +2", "Bonus from your lucky pig.");
				}
			}
			scheduleStatsRefresh();
			// Also re-check pass events so a friend who just got passed
			// hears about it on their next tap (and so any incoming pass
			// against us surfaces quickly between focus events).
			passEvents.check();
		} catch (error) {
			log.error("Error incrementing count:", error);
		}
	};

	const handleAvailableTap = () => {
		if (stats.itemCount >= stats.cap) {
			// Over-cap balances (trough/event grants) show e.g. 28/25 — saying
			// "you're at the 25 max" while displaying 28 read as a bug.
			showToast(
				"Tickle bank full",
				stats.itemCount > stats.cap
					? `${stats.itemCount} banked — regen resumes under ${stats.cap}.`
          : `You're at the ${stats.cap} max.`,
			);
			return;
		}
		if (stats.nextRegenSeconds == null) {
			showToast("Tickle bank", `${stats.itemCount} / ${stats.cap}`);
			return;
		}
		// LIVE countdown: nextRegenSeconds is a snapshot from the last
		// stats fetch — repeat taps were re-showing the same frozen time.
		// Subtract the elapsed wall clock; if a tickle has landed since,
		// roll into the next cycle and refresh the bank in the background.
		const elapsed = Math.floor((Date.now() - stats.fetchedAtMs) / 1000);
		let remaining = stats.nextRegenSeconds - elapsed;
		const period = stats.regenSeconds ?? 3600;
		if (remaining <= 0) {
			remaining = ((remaining % period) + period) % period || period;
			fetchStats(); // bank grew while we stared — resync quietly
		}
		// The TRUE rate, not "every hour": regen_secs_for folds in VIP,
		// blessings (warm_tea), curses (sluggish_snout), alignment,
		// happiness. Pre-20260643 servers omit it — fall back to the hour.
		const rate = stats.regenSeconds
			? `+1 every ${formatClockMS(stats.regenSeconds)}`
			: "+1 every hour";
		const prestige = wallowRegenPercent(wallowCount);
		showToast(
      prestige > 0
        ? `Aura power · ${wallowWaitReductionLabel(prestige)}`
        : "Next tickle",
      `In ${formatClockMS(Math.max(1, remaining))} · ${rate}, max ${stats.cap}`,
		);
	};

	const shareStreak = useCallback(() => {
		if (stats.currentStreak < 1) return;
		void Share.share({
			message: `I’m on a ${stats.currentStreak}-day tickle streak in Tickle the Pig 🔥`,
		}).catch((error) => log.error("Error sharing Streak:", error));
	}, [stats.currentStreak]);

	// THE FAN, in its fixed order: Dig · Barn · the truffle. Burying rides along
	// whenever the truffle status has loaded — as the act (nothing down) or as
	// the check-in (one buried).
	const fanOptions: BarnFanOption[] = [];
	if (dig.visible) {
		fanOptions.push({
			key: "dig",
			title: "Dig",
			sub: dig.open
				? dig.detail
				: dig.title.startsWith("Dig ")
					? dig.title.slice("Dig ".length)
					: dig.title,
			label: "dig",
			mark: "shovel",
			onPress: dig.openDig,
			accessibilityLabel: "Truffle Patch",
			accessibilityHint: dig.hint,
			// Shut patch or a dug Feeding: the row stays, greyed, with the reason;
			// the face can't be armed on it (see `armedKey`). The uncrewed door
			// to the Season tab is a real press, so it is never disabled.
			disabled: dig.blocked === "shut" || dig.blocked === "dug",
			disabledLine: dig.blockedLine ?? undefined,
		});
	}
	fanOptions.push({
		key: "barn",
		title: "Barn",
		label: "barn",
		mark: "door",
		onPress: enterBarn,
		accessibilityLabel: "Your Barn",
		accessibilityHint: BARN_HINT,
	});
	if (truffle.status) {
		fanOptions.push(
			truffleBuried
				? {
						key: "truffle",
						title: "Your truffle",
						sub: buriedSnoutsCopy(truffle.status.remaining),
						label: "truffle",
						mark: "truffle",
						onPress: () => setTruffleSheetOpen(true),
						accessibilityLabel: "Your truffle",
						accessibilityHint: "Opens the buried-truffle sheet, where you can add snouts or dig it back up",
					}
				: {
						key: "truffle",
						title: "Bury a truffle",
						sub: "for a visiting friend",
						label: "bury",
						mark: "truffle",
						onPress: () => setBuryOpen(true),
						accessibilityLabel: "Bury a truffle",
						accessibilityHint: "Opens the bury sheet, where you choose how many snouts to stake",
					},
		);
	}

	// WHICH ONE THE FACE WEARS. The player's pick sticks — across taps, tabs
	// and launches — and once they have picked, the patch opening no longer
	// steals the seat (the ring still breathes to announce it). Before any
	// pick the button arms its own default: Dig while the patch is open, Barn
	// otherwise. A pick whose action is off the fan right now (Dig retires for
	// the rest of a dug feeding) is kept, not overwritten: the face falls back
	// to the default until the action returns.
	const [pickedKey, setPickedKey] = useState<string | null>(null);
	useEffect(() => {
		let cancelled = false;
		AsyncStorage.getItem(ARMED_ACTION_KEY)
			.then((key) => {
				if (!cancelled && key) setPickedKey(key);
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	}, []);
	const armAction = useCallback((key: string) => {
		setPickedKey(key);
		AsyncStorage.setItem(ARMED_ACTION_KEY, key).catch(() => {});
	}, []);
	const defaultKey = dig.open && dig.visible ? "dig" : "barn";
	// A sticky pick never arms a disabled action: the face falls back to the
	// default so it never wears a dead verb.
	const armedKey =
		pickedKey && fanOptions.some((option) => option.key === pickedKey && !option.disabled)
			? pickedKey
			: defaultKey;

	const renderPigContent = (forInterior: boolean) => (
		<>
			<SwipeElement
              active={!popupActive}
              pigId={pigRoster.roster.activePigId}
							onLuckySwipe={handleIncrement}
							canTickle={!statsLoaded || stats.itemCount > 0}
							playSixSeven={sixSevenTick}
							restingAnim={moodAnimation(stats.happiness)}
							equipped={stats.activeHat}
							equippedBow={stats.activeBow}
							equippedGlasses={stats.activeGlasses}
							equippedMask={stats.activeMask}
							equippedNeck={stats.activeNeck}
							equippedAura={stats.activeAura}
								equippedBackground={forInterior ? null : stats.activeBackground}
							equippedHeld={stats.activeHeld}
							prestigeLevel={wallowCount}
						/>
						{/* Floating ♥/✦ particles drift up from above the pig on
						    every successful tickle. Absolute-fills the swipe
						    container so the hearts sit *over* the pig sprite. */}
						<HeartFloats
							ref={heartFloatsRef}
							particleImage={
								stats.activeTickleParticle?.id
                  ? (HAT_IMAGES[stats.activeTickleParticle.id] ?? null)
									: null
							}
			/>
		</>
	);
	const pigContent = renderPigContent(interiorPigOnly);
	const interiorPigContent = renderPigContent(true);
	const toastContent = (toast && (
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
							accessibilityRole={toast.onPress ? "button" : "text"}
							accessibilityLabel={`${toast.title}. ${toast.body}`}
							accessibilityHint={
								toast.onPress ? "Opens the details behind this message" : undefined
							}
							accessibilityLiveRegion="polite"
						>
							<Sticker
								color="rose"
								rotate={TOAST_TILT}
								radius={RADII.lg}
								style={styles.toast}
							>
								<View style={styles.toastInner}>
									<View style={styles.toastIcon}>
										<Glyph name="heart" size={TOAST_GLYPH} />
									</View>
									<View style={{ flex: 1, minWidth: 0 }}>
										<T role="cardTitleSm">{toast.title}</T>
										<Hand tone="secondary" style={styles.toastBody}>
											{toast.body}
										</Hand>
									</View>
								</View>
							</Sticker>
						</Pressable>
					</Animated.View>
				));
	const luckyContent = (			<LuckyPigModal
				visible={luckyPigSlot.visible}
				windowSize={luckyPig.windowSize}
				doublePercent={luckyPig.doublePercent}
				unlockedTitle={luckyPig.unlockedTitle}
				onEquipTitle={async (id) => {
					// Branch on the RESULT (the shape TitlesSection already reads):
					// rpc() resolves null on a transport error and equip_title answers
					// { ok:false, reason } for a title the player doesn't own, so
					// anything but ok:true is a miss.
					const r = await rpc<{ ok?: boolean }>("equip_title", {
						target_title_id: id,
					});
					const ok = r?.ok === true;
					showToast(
						ok ? "Title equipped" : "Couldn't equip title",
						ok
							? "Visible on your account + leaderboard."
							: "It is still saved in Me.",
					);
				}}
				onDismiss={() => {
					// Two-phase (PopupQueue TIMING CONTRACT): release() hides the
					// native modal this frame, then clear the backing want
					// (luckyModalOpen, via onBurstDismiss) a POPUP_TEARDOWN_MS beat
					// later so the slot stays wanting through the native teardown.
					luckyPigSlot.release();
					setTimeout(() => luckyPig.onBurstDismiss(), POPUP_TEARDOWN_MS);
				}}
				/>);
	const pigPresentation = (
		<View style={styles.pigStage}>
			{interiorPigContent}
			{toastContent}
			{luckyContent}
		</View>
	);
	const pigPresentedInHabitat = useHomeHabitatPigPublisher(
		pigPresentation,
		!interiorPigOnly && !bridgeFallback,
	);
	if (interiorPigOnly) {
		return pigPresentation;
	}

	return (
		// The Exterior's own doorway, at the brisker `threshold` tempo: the same
		// barn doors the room wears, closing OVER the home tab so the cut to the
		// interior route happens behind them and is never seen. `mountedOpen`
		// because you already stand outside — a cold start must not swing.
		<HabitatDoorTransition
			tempo="threshold"
			mountedOpen
			direction={threshold.direction}
			onClosed={threshold.onClosed}
			onOpened={threshold.onOpened}
		>
    <PageBackground bgId={stats.activeBackground?.id ?? null}>
			<BarnOverlay
				alignment={alignment}
				cursed={effects.cursed}
			/>

			{/* The ghost barn silhouette that used to sit here is gone: the barn is
			    the player's home, not scenery, so it is a real structure standing on
			    Rosie's ground plane inside `swipeContainer` — on every background,
			    not only the unequipped one. */}

			{/* If the boot fetch exhausts its backoff, keep a visible recovery
			    affordance in the old corner slot. */}
			{statsError && !statsLoaded ? (
				// Boot fetch failed through its whole backoff — give the player a
				// visible way out of the "can't tickle" soft-lock instead of a dead
				// screen.
				<Sticker
					color="paper"
					rotate={TILT.card}
					radius={RADII.md}
					shadow="sm"
					onPress={() => {
						Haptics.selectionAsync().catch(() => {});
						fetchStats();
					}}
					accessibilityRole="button"
					accessibilityLabel="Reload the Barn"
					accessibilityHint="Fetches your tickle bank again after a failed load"
					style={styles.barnRecovery}
				>
					<Icon name="refresh" size={RECOVERY_ICON} color={WHIMSY.ink} />
					<Hand align="center">lost the barn?{"\n"}tap to reload</Hand>
				</Sticker>
			) : null}

			<SafeAreaView style={styles.contentContainer}>
				{/* TWO CORNERS. Earned on the left — the permanent number, a rose
				    heart stamp — and to-spend on the right — the coin, which carries
				    everything live: the streak on its shoulder, the regen clock as
				    one hand line, a lucky / wallow ribbon under that. The corners
				    answer each other across the sky and the middle stays empty for
				    Rosie. (decided 2026-09-13; docs/design/claude-design/barn) */}
				<View style={styles.corners}>
					<EarnedStamp total={stats.ticklesEarned} />
					<TickleCoin
						count={stats.itemCount}
						cap={stats.cap}
						streak={stats.currentStreak}
						nextRegenSeconds={stats.nextRegenSeconds}
						regenSeconds={stats.regenSeconds ?? 3600}
						fetchedAtMs={stats.fetchedAtMs}
						onRegenElapsed={fetchStats}
						loaded={statsLoaded}
						onPress={handleAvailableTap}
						onShareStreak={shareStreak}
						ribbon={
							luckyPig.luckyTicklesLeft > 0
								? `Lucky pig · ${luckyPig.luckyTicklesLeft} left`
								: wallowCount > 0
									? `Wallow Rank ${wallowCount}`
									: undefined
						}
					/>
				</View>

				{/* The one card the home ever shows: the rewarded-ad refill, only at
				    bank = 0, under the coin's corner. */}
				{rewardedAdsEnabled && statsLoaded && stats.itemCount === 0 ? (
					<View style={styles.adRefillOffer}>
						<AdRefillOffer
							homeBalance={stats.itemCount}
							onBalanceChanged={fetchStats}
							backend={rewardedAdBackend}
							provider={rewardedAdProvider}
						/>
					</View>
				) : null}

				{/* The in-flow notice column that lived here — the shovel pill, the
				    weekly-bounty chip, before them the Updates tray and the guestbook
				    placard — is retired (2026-09-13). Burying is in the Barn button's
				    fan; a ready bounty is the Season tab's to announce. The home is
				    Rosie's stage. */}

				<View style={styles.mainSection}>
					<View style={styles.swipeContainer}>
{pigPresentedInHabitat ? null : pigContent}
						{/* A buried truffle is a thing in the yard, so it shows as one:
						    a mound bottom-left on Rosie's ground plane, folded until
						    tapped (then it says how many snouts are down). ABSOLUTE ON THE
						    MOUND, never on a wrapper: a full-width absolute layer over
						    the scene swallows every tap meant for Rosie (the Fabric
						    overlay footgun, build 99). */}
						{truffleBuried && truffle.status ? (
							<View style={styles.mound}>
								<BuriedMound
									remaining={truffle.status.remaining}
									onPress={() => setTruffleSheetOpen(true)}
								/>
							</View>
						) : null}
					</View>
				</View>

{pigPresentedInHabitat ? null : toastContent}
			</SafeAreaView>

{pigPresentedInHabitat ? null : luckyContent}

			{/* THE BARN BUTTON. Bottom-right, its face the armed quick action —
			    the shovel, the door or the truffle — and its "+" fans Dig / Barn /
			    Bury a truffle, where a tap arms rather than fires. It sits at page
			    level rather than in the scene so the fan's scrim can cover the
			    whole screen; only the 72pt button is ever there when the fan is shut. */}
			<BarnButton
				options={fanOptions}
				armedKey={armedKey}
				onArm={armAction}
				live={dig.open}
				testID="barn-button"
				style={styles.barnButton}
			/>

			{/* Tickle trades moved to the Friends-tab Inbox in the
			    Season-0 social redesign — no Barn pill or modal. */}

			{/* Bury dialogue — direct-tap modal, so
			    it stays out of the launch popup queue and owns the screen on tap. */}
			{/* The dig itself. Mounted ONCE, beside the control that opens it —
			    `useDigEntry` owns the session, so this is the whole of the
			    in-place Truffle Patch on the Exterior. */}
			{dig.modal}

			<BuryTruffleSheet
				open={buryOpen}
				balance={stats.counter}
				onClose={() => setBuryOpen(false)}
				onBuried={() => truffle.refresh()}
				onResynced={() => truffle.refresh()}
			/>

			<BuriedTruffleSheet
				open={truffleSheetOpen}
				balance={stats.counter}
				visible={truffleSlot.visible}
				onClose={() => {
					// Two-phase: release() hides the native modal this frame,
					// `open` (the mount gate) clears a teardown beat later so the
					// modal stays mounted while it dismisses (PopupQueue contract).
					truffleSlot.release();
					setTimeout(() => setTruffleSheetOpen(false), POPUP_TEARDOWN_MS);
				}}
				status={truffle.status}
				onChanged={() => truffle.refresh()}
			/>
		</PageBackground>
		</HabitatDoorTransition>
	);
}

const styles = StyleSheet.create({
	// Fullscreen page backdrop. Edges bleed all the way to the device
	// frame (behind the status bar and the tab bar) — the SafeAreaView
	contentContainer: {
		flex: 1,
		height: SCREEN_HEIGHT,
	},
	// The two corners: a row with the sky between them. Each object hugs its
	// own copy; nothing stretches to match.
	corners: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-start",
		paddingHorizontal: PAGE_PAD,
		// TODO(ui-audit): SafeAreaView inset + 8 (deferred — device QA)
		paddingTop: Platform.OS === "ios" ? SPACE.md : SPACE.xl,
		marginBottom: SPACE.lg,
		zIndex: 1,
	},
	adRefillOffer: {
		alignSelf: "center",
		maxWidth: 360,
		paddingHorizontal: PAGE_PAD,
		marginBottom: SPACE.sm,
		zIndex: 2,
	},
	// The square the Habitat bridge stages the pig in — a picture frame, so it
	// carries its own name rather than a spacing step.
	pigStage: {
		width: PIG_STAGE,
		height: PIG_STAGE,
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
	// Equipped tickle particle — drifts up from the same anchor the
	// typographic glyph used. Rides the portrait-mark frame so it reads
	// against the pig at any device size.
	floatImage: {
		position: "absolute",
		left: "50%",
		bottom: "55%",
		width: PARTICLE_SIZE,
		height: PARTICLE_SIZE,
		marginLeft: -PARTICLE_HALF,
	},
	// The buried-truffle mound's stance: bottom-left of the pig stage, its base on
	// Rosie's foot line. Only the mound is absolute — nothing full-width sits over
	// her — and it draws above `pigContent` so a tap on it is a check-in, not a
	// tickle.
	mound: {
		position: "absolute",
		left: PAGE_PAD,
		bottom: YARD_GROUND,
		zIndex: YARD_Z,
	},
	// The Barn button's seat: the page's bottom-right corner, above the tab bar.
	barnButton: {
		position: "absolute",
		right: PAGE_PAD,
		bottom: BARN_BUTTON_BOTTOM,
		zIndex: YARD_Z,
	},
	// Boot-fetch recovery chip, bottom-left corner of the Barn page. Sized by
	// its own copy now — the old fixed 76×60 box clipped at larger type.
	barnRecovery: {
		position: "absolute",
		bottom: 40,
		left: PAGE_PAD,
		zIndex: 6,
		alignItems: "center",
		justifyContent: "center",
		gap: SPACE.xs,
		paddingHorizontal: SPACE.sm,
		paddingVertical: SPACE.sm,
	},
	toastWrap: {
		position: "absolute",
		top: Platform.OS === "ios" ? 180 : 160,
		left: PAGE_PAD,
		right: PAGE_PAD,
		zIndex: 30,
	},
	toast: {
		paddingHorizontal: SPACE.card,
		paddingVertical: SPACE.md,
	},
	toastInner: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.md,
	},
	toastIcon: {
		width: AVATAR_SIZE[0],
		height: AVATAR_SIZE[0],
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.roseDeep,
		borderWidth: BORDER.thin,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
	},
	toastBody: {
		marginTop: SPACE.xxs,
	},
});
