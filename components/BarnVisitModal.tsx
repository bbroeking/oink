// Visit & Tickle — visiting a friend's Barn to tickle their pig.
//
// Full-screen scenery with three floating control bands:
//
//   1. HEADER (≈140pt to the scene) — `VisitHeader`: the bark plaque carrying
//      the host's name, which is the ONE place it is written on this screen,
//      beside a ghost Leave pill that always exits. Under it `VisitStatusRow`:
//      your heart tally, the host's, and "N of N visits left", as three wrapping
//      capsules. Each pig wears its own avatar, so no tally needs a name kicker.
//   2. FULL-SCREEN SCENE — either the Outside diorama over the host's
//      background cosmetic, plus the buried-truffle shovel, or the Inside room
//      (`HabitatFriendRoom`), never both: the one you are not in is UNMOUNTED,
//      not hidden, so it stops animating. A `SegmentedControl` floats at the top
//      centre to switch, and only exists while the habitat flag is on.
//   3. ACTION BAR — `VisitActionBar`: one gold pill that is "Head home" once
//      you are tickled out, and nothing before that.
//
// Tapping EITHER pig calls `tickle_at_barn`: it gives the host a heart, gives
// you one, and makes both pigs happier. When the visit is spent the pigs nap —
// that is a toast, not a screen; the nap CARD is only for arriving at a barn
// that is already asleep. The nap card and the Slop Club parting note are the
// two dialogs, both inline `AdaptiveModalScaffold`s.
//
// Full-screen overlay (NOT a nested Modal — iOS won't stack one over UserSheet's
// Modal); it sits on top within the sheet's modal layer.
import { useEffect, useRef, useState } from "react";
import {
	View,
	Pressable,
	Image,
	StyleSheet,
	Animated,
	Easing,
	useWindowDimensions,
	type StyleProp,
	type ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { supabase } from "@/utils/supabase";
import { rpcAction } from "@/utils/rpc";
import { remainingMs } from "@/utils/duration";
import {
	AdaptiveModalScaffold,
	Avatar,
	Button,
	DialogCloseRow,
	Glyph,
	IconText,
	LoadingBeat,
	PigPortrait,
	PigStage,
	SegmentedControl,
	SnoutCoin,
	Sticker,
	T,
	glyphSource,
	showToast,
	type EquippedItem,
	type PigReaction,
} from "./ui";
import { VISIT_TYPE_CAP } from "./visit/chrome";
import { VisitActionBar } from "./visit/VisitActionBar";
import { VisitHeader } from "./visit/VisitHeader";
import { VisitStatusRow } from "./visit/VisitStatusRow";
import { TruffleButton } from "./TruffleButton";
import { HAT_IMAGES } from "@/constants/hats";
import {
	AVATAR_SIZE,
	BORDER,
	OPACITY,
	PAGE_PAD,
	RADII,
	SHADOW_SM,
	SPACE,
	TILT,
	TINT,
	UI_COLORS,
	WHIMSY,
	inkAlpha,
	STATUS_SAFE,
} from "@/constants/theme";
import {
	refreshVisitEmotes,
	visitEmoteIds,
	VISIT_EMOTE_IMAGES,
	VISIT_EMOTE_META,
	type VisitEmoteId,
} from "@/utils/visitEmotes";
import { HabitatFriendRoom } from "./habitat/HabitatFriendRoom";
import { openOwnHabitatCollection } from "@/utils/habitatNavigation";
import { useFeatureFlag } from "@/hooks/useFeatureFlags";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";
import { trackInteraction } from "@/utils/interactionAnalytics";
import { recordPorchStop } from "@/utils/porchRound";
import { isPigId, type PigId } from "@/utils/pigs";

// ── drawing constants ──────────────────────────────────────────────────────
// Values the scene is DRAWN from rather than spaced by: art sizes, the two
// overlay offsets this screen owns because it has no SafeAreaView, and the
// spotlight ellipse. Each is a named constant so a grep for a stray number in
// this file comes back empty.
//
// The legibility fade over the host's background art.
const TOP_FADE_H = 190;
// Where the loading beat sits while the barn door is still shut.
const LOADING_DROP = 120;
// The warm floor wash under the two pigs, and the contact shadow each casts.
const SPOTLIGHT_W = 300;
const SPOTLIGHT_H = 220;
const SPOTLIGHT_R = 150;
const GROUND_SHADOW_H = 13;
// Marks: the kicker star, the truffle pills' art, the nap zzz.
const KICKER_MARK = 12;
const PILL_MARK = 14;
const NAP_GLYPH = 50;
// Art in the dialogs: a parting emote, a forage truffle.
const EMOTE_ART = 58;
const FORAGE_ART = 38;
const EMOTE_CHOICE_MIN_W = 82;
// The widest the "you" tag under the visitor's pig may grow before it truncates.
const NAMETAG_MAX_W = 130;
// The square the Inside room hands each pig to stand in — the sprite canvas.
const ROOM_PIG_BOX = 300;
// The stage toggle's resting width, and how far the forage banner drops to clear
// it. Both are geometry against a floating control, not spacing steps.
const TOGGLE_MIN_W = 200;
const FORAGE_DROP = 76;
// Dialog widths.
const NAP_MAX_W = 320;
const CARD_MAX_W = 390;

interface Props {
	targetUserId: string;
	targetName: string;
	onClose: () => void;
	/** Dismisses an enclosing profile sheet too when navigating away. */
	onLeaveForCollection?: () => void;
	/** Development-lab fixture. The player-facing callers never set this. */
	previewState?: "tickled-out";
}

interface Barn {
	username: string | null;
	tickles_earned: number | null;
	active_background_id: string | null;
}

// One equipped cosmetic slot — same {id, category, emoji} row PigStage
// renders; reuse its EquippedItem contract rather than re-declaring it.
type Slot = EquippedItem | null;
// A pig's full worn outfit (everything PigStage can render except background).
interface EquipSet {
	hat: Slot;
	bow: Slot;
	glasses: Slot;
	mask: Slot;
	neck: Slot;
	aura: Slot;
	held: Slot;
}
const EMPTY_EQUIP: EquipSet = {
  hat: null,
  bow: null,
  glasses: null,
  mask: null,
  neck: null,
  aura: null,
  held: null,
};

// Shape of a joined `hats` row (to-one FK). Supabase may surface a to-one embed
// as a single object or a single-element array depending on the relation hint.
type HatRow = {
  id?: string;
  category?: string | null;
  emoji?: string | null;
} | null;
const one = (v: HatRow | HatRow[]): HatRow =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
const toSlot = (v: HatRow | HatRow[]): Slot => {
	const row = one(v);
  return row && row.id
    ? { id: row.id, category: row.category ?? null, emoji: row.emoji ?? null }
    : null;
};

// Every active_* slot joined to `hats` (id + category + emoji). The active_*_id
// is redundant once we embed the row, so we read the slot straight off the join.
const EQUIP_SELECT =
	"active_hat:hats!profiles_active_hat_id_fkey(id,category,emoji)," +
	"active_bow:hats!profiles_active_bow_id_fkey(id,category,emoji)," +
	"active_glasses:hats!profiles_active_glasses_id_fkey(id,category,emoji)," +
	"active_mask:hats!profiles_active_mask_id_fkey(id,category,emoji)," +
	"active_neck:hats!profiles_active_neck_id_fkey(id,category,emoji)," +
	"active_aura:hats!profiles_active_aura_id_fkey(id,category,emoji)," +
	"active_held:hats!profiles_active_held_id_fkey(id,category,emoji)";

interface ProfileEquipRow {
	active_hat: HatRow | HatRow[];
	active_bow: HatRow | HatRow[];
	active_glasses: HatRow | HatRow[];
	active_mask: HatRow | HatRow[];
	active_neck: HatRow | HatRow[];
	active_aura: HatRow | HatRow[];
	active_held: HatRow | HatRow[];
}
const rowToEquip = (r: ProfileEquipRow): EquipSet => ({
	hat: toSlot(r.active_hat),
	bow: toSlot(r.active_bow),
	glasses: toSlot(r.active_glasses),
	mask: toSlot(r.active_mask),
	neck: toSlot(r.active_neck),
	aura: toSlot(r.active_aura),
	held: toSlot(r.active_held),
});

interface BarnProfileRow extends ProfileEquipRow {
	username: string | null;
	tickles_earned: number | null;
	active_background_id: string | null;
	active_pig_id: string | null;
	is_vip: boolean | null;
}

interface MyProfileRow extends ProfileEquipRow {
	tickles_earned: number | null;
	active_pig_id: string | null;
  is_vip: boolean | null;
}

// "2h 15m" / "12m" until you can visit a different barn.
function lockLabel(nextAtIso: string | null): string {
	if (!nextAtIso) return "3h";
	const ms = remainingMs(nextAtIso);
	if (ms <= 0) return "now";
	const mins = Math.ceil(ms / 60000);
	const h = Math.floor(mins / 60);
	const m = mins % 60;
	return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

export function BarnVisitModal(props: Props) {
  // A visit is an owner-scoped session. Remounting the session on an owner
  // change clears every action closure, tally, outfit and in-flight request so
  // none of the previous host's state can cross into the next Barn.
  return <BarnVisitSession key={props.targetUserId} {...props} />;
}

function BarnVisitSession({
	targetUserId,
	targetName,
	onClose,
	onLeaveForCollection,
	previewState,
}: Props) {
  const mounted = useRef(true);
  const closeRef = useRef(onClose);
  const sessionGeneration = useRef(0);
  const authUserId = useRef<string | null | undefined>(undefined);
  const delayed = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const sessionToken = () => sessionGeneration.current;
  const sessionIsCurrent = (token: number) =>
    mounted.current && token === sessionGeneration.current;
  const schedule = (callback: () => void, delay: number, token = sessionToken()) => {
    const timer = setTimeout(() => {
      delayed.current.delete(timer);
      if (sessionIsCurrent(token)) callback();
    }, delay);
    delayed.current.add(timer);
    return timer;
  };
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    mounted.current = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (mounted.current && authUserId.current === undefined)
        authUserId.current = data.user?.id ?? null;
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      const nextId = nextSession?.user.id ?? null;
      if (authUserId.current === undefined) {
        authUserId.current = nextId;
        return;
      }
      if (authUserId.current === nextId) return;
      authUserId.current = nextId;
      sessionGeneration.current++;
      for (const timer of delayed.current) clearTimeout(timer);
      delayed.current.clear();
      closeRef.current();
    });
    return () => {
      mounted.current = false;
      sessionGeneration.current++;
      for (const timer of delayed.current) clearTimeout(timer);
      delayed.current.clear();
      data.subscription.unsubscribe();
    };
  }, []);
  const habitatEnabled = useFeatureFlag("habitat");
  const [interiorState, setInteriorState] = useState(() => ({
    targetUserId,
    habitatEnabled,
    inside: habitatEnabled,
    leaving: false,
  }));
  const interiorStateIsCurrent =
    interiorState.targetUserId === targetUserId &&
    interiorState.habitatEnabled === habitatEnabled;
  if (!interiorStateIsCurrent) {
    setInteriorState({
      targetUserId,
      habitatEnabled,
      inside: habitatEnabled,
      leaving: false,
    });
  }
  const inside = interiorStateIsCurrent
    ? interiorState.inside
    : habitatEnabled;
  const leavingInterior = interiorStateIsCurrent
    ? interiorState.leaving
    : false;
  const updateInteriorState = (
    update: Partial<Pick<typeof interiorState, "inside" | "leaving">>,
  ) => {
    setInteriorState({
      targetUserId,
      habitatEnabled,
      inside,
      leaving: leavingInterior,
      ...update,
    });
  };
  const previewingTickledOut = __DEV__ && previewState === "tickled-out";
  const {
    width: screenWidth,
    height: screenHeight,
    fontScale,
  } = useWindowDimensions();
  const motionPolicy = useMotionPolicy();
	const [barn, setBarn] = useState<Barn | null>(() =>
		previewingTickledOut
			? {
					username: targetName,
					tickles_earned: 1268,
					active_background_id: null,
				}
			: null,
	);
	const [loading, setLoading] = useState(!previewingTickledOut);
	const [busy, setBusy] = useState(false);
	const [hostPigId, setHostPigId] = useState<PigId>(
		previewingTickledOut ? "biscuit" : "rosie",
	);
	const [myPigId, setMyPigId] = useState<PigId>(
		previewingTickledOut ? "pickles" : "rosie",
	);
  const [isVip, setIsVip] = useState(false);
  const [emoteIds, setEmoteIds] = useState<VisitEmoteId[]>(() =>
    visitEmoteIds(),
  );
  const [partingOpen, setPartingOpen] = useState(false);
  const [partingSending, setPartingSending] = useState<VisitEmoteId | null>(
    null,
  );
  const [partingSent, setPartingSent] = useState<VisitEmoteId | null>(null);
  const [partingError, setPartingError] = useState<string | null>(null);
	const porchRecorded = useRef(false);

	// Live season tickle totals (seeded from each profile's tickles_earned),
	// then both tick up together by one on every tap. The Barn race is a
	// this-season surface, so we seed the tallies from the live-season count
	// alone — never lifetime, which would drag in stale archived seasons.
	const [youHearts, setYouHearts] = useState(previewingTickledOut ? 1284 : 0);
	const [friendHearts, setFriendHearts] = useState(
		previewingTickledOut ? 1268 : 0,
	);
	// Hearts shared THIS visit only — for the nap summary.
	const [gained, setGained] = useState(previewingTickledOut ? 7 : 0);

  // Tap-session tired state is driven by the server's remaining-taps result.
	const [tired, setTired] = useState(previewingTickledOut);
	// The same fact, readable from inside a callback that ran before the state
	// settled — `tireOut` can be reached twice (the cap-hitting tap schedules it,
	// and a refused tap says the same thing), and the visit is spent ONCE, so
	// the toast is said once.
	const tiredOnce = useRef(previewingTickledOut);
	// Whether THIS session has landed a tickle. It is the only thing that tells
	// the server's two `cooldown` refusals apart — see the tickle() branch.
	const tickledThisVisit = useRef(previewingTickledOut);
  // Your shared visit budget: 3 different friends per prestige-scaled window.
  // Server-authoritative (barn_visit_status).
	const [visitsLeft, setVisitsLeft] = useState<number | null>(
		previewingTickledOut ? 0 : null,
	);
	const [visitBudget, setVisitBudget] = useState(3);
	const [lockedUntil, setLockedUntil] = useState<string | null>(null);
	// Locked/rested-out on arrival (came back inside the 3h window, or the pigs
	// already napped this hour) → open straight into the nap screen.
	const [restingOnArrival, setRestingOnArrival] = useState(false);

	// Barn truffle (a reward the host buried for visitors).
	const [truffleAvail, setTruffleAvail] = useState(false);
	const [dug, setDug] = useState<number | null>(null);
	const [digging, setDigging] = useState(false);
	const [digNote, setDigNote] = useState<string | null>(null);

	// Great Hunger barn forage: the arrival tap can turn up a lone Golden
	// Truffle the Hungerer missed (server tickle_at_barn, gated on world_boss,
	// once per UTC day). Cozy one-time reveal for the rest of the visit.
	const [foragedTruffle, setForagedTruffle] = useState(false);

	// Both pigs' full worn outfits so the diorama shows what each is wearing.
	// (Flags are intentionally not shown in the visit diorama for now.)
	const [hostEquip, setHostEquip] = useState<EquipSet>(EMPTY_EQUIP);
	const [myEquip, setMyEquip] = useState<EquipSet>(EMPTY_EQUIP);

	// Flying hearts, a pig squish, and the "+1 ♥" that rises off both tallies —
	// all on each tap.
  const [floats, setFloats] = useState<
    { id: number; anim: Animated.Value; rx: number; star: boolean }[]
  >([]);
	const nextFloat = useRef(0);
	const squish = useRef(new Animated.Value(0)).current;
	const tick = useRef(new Animated.Value(0)).current; // "+1 ♥" rise over tallies

	const playTap = () => {
		const token = sessionToken();
		if (motionPolicy.reduceMotion) {
			squish.setValue(0);
			tick.setValue(0);
			return;
		}
		Animated.sequence([
      Animated.timing(squish, {
        toValue: 1,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.spring(squish, {
        toValue: 0,
        friction: 4,
        tension: 120,
        useNativeDriver: true,
      }),
		]).start();
		tick.setValue(0);
    Animated.timing(tick, {
      toValue: 1,
      duration: 760,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
		for (let i = 0; i < 5; i++) {
			schedule(() => {
				const id = nextFloat.current++;
				const anim = new Animated.Value(0);
				const rx = Math.random() * 70 - 35;
				const star = Math.random() < 0.14;
				setFloats((f) => [...f, { id, anim, rx, star }]);
        Animated.timing(anim, {
          toValue: 1,
          duration: 1050,
          useNativeDriver: true,
        }).start(() => {
          if (sessionIsCurrent(token))
            setFloats((f) => f.filter((x) => x.id !== id));
        });
			}, i * 60);
		}
	};

	useEffect(() => {
		if (previewingTickledOut) return;
		let cancelled = false;
		(async () => {
			const { data } = await supabase
				.from("profiles")
        .select(
          `username, tickles_earned, active_background_id, active_pig_id, is_vip, ${EQUIP_SELECT}`,
        )
				.eq("id", targetUserId)
				// Dynamic select string → declare the row type through the
				// builder so .data lands as BarnProfileRow | null, no cast.
				.returns<BarnProfileRow[]>()
				.maybeSingle();
			if (cancelled) return;
			if (!data) {
				setLoading(false);
				return;
			}
			const d = data;
			setBarn({
				username: d.username ?? null,
				tickles_earned: d.tickles_earned ?? 0,
				active_background_id: d.active_background_id ?? null,
			});
			setHostEquip(rowToEquip(d));
			setHostPigId(
				d.is_vip && isPigId(d.active_pig_id) ? d.active_pig_id : "rosie",
			);
			// This-season tally: the Barn race counts THIS season's tickles only.
			setFriendHearts(d.tickles_earned ?? 0); // HOST tally base

			const { data: ures } = await supabase.auth.getUser();
			if (ures.user) {
				const { data: me } = await supabase
					.from("profiles")
          .select(`tickles_earned, active_pig_id, is_vip, ${EQUIP_SELECT}`)
					.eq("id", ures.user.id)
					// Dynamic select string → declare the row type through the
					// builder so .data lands as MyProfileRow | null, no cast.
					.returns<MyProfileRow[]>()
					.maybeSingle();
				if (!cancelled && me) {
					const m = me;
					setMyEquip(rowToEquip(m));
					setMyPigId(
						m.is_vip && isPigId(m.active_pig_id)
							? m.active_pig_id
							: "rosie",
					);
					setYouHearts(m.tickles_earned ?? 0); // YOU tally base
          setIsVip(!!m.is_vip);
				}
			}

			// The host's truffle is a shared, depleting pot: show the shovel only
			// if it still has snouts left AND your latest bite is past the 3h
			// re-dig cooldown (server 20260629; it stays authoritative — a stale
			// shovel just gets the dig_cooldown / already_dug note from dig()).
			const { data: tr } = await supabase
				.from("truffles")
				.select("id, remaining")
				.eq("host_id", targetUserId)
				.is("dug_at", null)
				.maybeSingle();
			let canDig = !!tr && (tr.remaining ?? 0) > 0;
			if (tr && ures.user) {
				const { data: lastDig } = await supabase
					.from("truffle_digs")
					.select("dug_at")
					.eq("truffle_id", tr.id)
					.eq("digger_id", ures.user.id)
					.order("dug_at", { ascending: false })
					.limit(1)
					.maybeSingle();
				if (
					lastDig &&
					Date.now() - new Date(lastDig.dug_at).getTime() < 3 * 60 * 60 * 1000
				) {
					canDig = false;
				}
			}
			if (!cancelled) setTruffleAvail(canDig);

			// Whether you're locked to a different barn (one friend / 3h) or
			// the pigs already napped. Visiting no longer spends YOUR tickle
			// bank (server 20260646) — the bank fields in the response are
			// ignored; the visit budget is the random 3–7 sleepy roll.
			const st = await rpcAction<{
				resting?: boolean;
				locked?: boolean;
				next_at?: string | null;
				taps_left?: number | null;
				tap_cap?: number | null;
				visits_left?: number | null;
				visit_budget?: number | null;
				visits_refresh_at?: string | null;
        visit_window_hours?: number | null;
			}>("barn_visit_status", { p_target: targetUserId });
			if (!cancelled && st.ok) {
				if (st.locked) {
					setLockedUntil(st.next_at ?? null);
					setRestingOnArrival(true);
				}
				if (st.resting) setRestingOnArrival(true);
				// Your 3-visits-per-window budget, for the "visits left" bar.
				if (st.visits_left != null) setVisitsLeft(st.visits_left);
				if (st.visit_budget != null) setVisitBudget(st.visit_budget);
			}
			if (!cancelled && mounted.current) setLoading(false);
		})();
		return () => {
			cancelled = true;
		};
	}, [previewingTickledOut, targetUserId]);

  useEffect(() => {
    const token = sessionToken();
    void refreshVisitEmotes().then(() => {
      if (sessionIsCurrent(token)) setEmoteIds([...visitEmoteIds()]);
    });
  }, []);

	// Live countdown: while a per-friend lock is set, re-render once a second so
	// the "comes back in Xh Ym" label (napUntil → lockLabel) ticks down instead
	// of freezing at the value it had the moment the lock was set.
	const [, setNowTick] = useState(0);
	useEffect(() => {
		if (!lockedUntil) return;
		const id = setInterval(() => setNowTick((n) => n + 1), 1000);
		return () => clearInterval(id);
	}, [lockedUntil]);

	// Tired is a TOAST, not a screen. The visit is spent; nothing about the barn
	// changes, so nothing on the barn should move. The bottom bar quietly becomes
	// "Head home" behind it.
	const tireOut = () => {
		if (tiredOnce.current) return;
		tiredOnce.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
      () => {},
    );
		setTired(true);
		showToast({
			tone: "info",
			title: "All tickled out — head home when you're ready.",
		});
	};

	const tickle = async () => {
		if (tired || restingOnArrival || lockedUntil || busy) return;
		const token = sessionToken();
		setBusy(true);
		const r = await rpcAction<{
			taps_left?: number;
			tap_cap?: number;
			next_at?: string | null;
			visits_left?: number | null;
			visits_refresh_at?: string | null;
      visit_window_hours?: number | null;
			golden_truffle_found?: boolean;
		}>("tickle_at_barn", { p_target: targetUserId });
		if (!sessionIsCurrent(token)) return;
		setBusy(false);
		if (r.ok) {
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
			playTap();
			// A Golden Truffle surfaced while rooting around the Barn — a warmer
			// success beat than the tickle itself, so pop the reveal + a heavier
			// haptic. Server has already minted it (once/day); this is display-only.
			if (r.golden_truffle_found) {
				setForagedTruffle(true);
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
			}
			tickledThisVisit.current = true;
			setYouHearts((n) => n + 1);
			setFriendHearts((n) => n + 1);
			setGained((g) => g + 1);
			if (!porchRecorded.current) {
				porchRecorded.current = true;
				void recordPorchStop(targetUserId).then((porch) => {
					if (!sessionIsCurrent(token)) return;
					if (!porch.ok || !porch.created) return;
					void trackInteraction({
						eventName: "porch_stop_completed",
						surface: "porch_round",
						targetKind: "pig",
						targetUserId,
						result: "completed",
						properties: { count: porch.stop_number ?? 1, source: "organic" },
					});
					if (porch.stop_number === 3) {
						void trackInteraction({
							eventName: "porch_round_completed",
							surface: "porch_round",
							result: "completed",
							properties: { count: 3, source: "organic" },
						});
					}
				});
			}
				if (r.visits_left != null) setVisitsLeft(r.visits_left);
				// Server is authoritative on when the visit is spent: taps_left is the
			// remaining tickles of this visit's 3–7 cap and hits 0 exactly on the
			// cap-hitting tap. Gate on THAT, not local tapCap state — the cap is
			// rolled server-side on the first tap, so the freshly-returned value is
      // the only reliable signal. The
			// cap-hitting tap also returns next_at, so we start the 24h countdown
			// immediately (re-entry would only show the same lock anyway).
			if ((r.taps_left ?? 99) <= 0) {
				if (r.next_at) setLockedUntil(r.next_at);
				schedule(tireOut, 520, token);
			}
		} else if (r.reason === "tired" || r.reason === "no_tickles") {
			// Neither reason is spoken by today's server (tickle_at_barn has no
			// 'tired' branch at all); they are kept for a pre-20260646 build,
			// where they meant the same thing the cap does now.
			tireOut();
		} else if (r.reason === "cooldown") {
			// `cooldown` is the server's ONE word for two different refusals —
			// tickle_at_barn returns `{ok:false, error:'cooldown', next_at}` both
			// when this visit's 3–7 tap cap is spent (taps_this_visit >= v_cap)
			// and when you are locked out of the barn on arrival. Nothing in the
			// payload separates them, so we ask the only question that does: has
			// this session already landed a tickle? If it has, we just used the
			// visit up — and the plan is explicit that tiring out mid-visit is a
			// TOAST, never the nap screen ("the nap card is for arriving at a
			// sleeping barn only"). If it hasn't, the barn really was shut when we
			// knocked, and the nap card owns the exit. (2026-09-12)
			setLockedUntil(r.next_at ?? null);
			if (tickledThisVisit.current) {
				tireOut();
			} else {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Warning,
        ).catch(() => {});
				setRestingOnArrival(true);
			}
		}
	};

	const dig = async () => {
		if (digging || dug != null) return;
		const token = sessionToken();
		setDigging(true);
    const r = await rpcAction<{
      reward?: number;
      remaining?: number;
      next_at?: string | null;
    }>("dig_truffle", { p_host: targetUserId });
		if (!sessionIsCurrent(token)) return;
		setDigging(false);
		if (r.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
			setTruffleAvail(false);
			setDug(r.reward ?? 0);
		} else if (r.reason === "dig_cooldown") {
			// Re-dig cooldown (server 20260629): the pot allows another bite per
			// visitor every 3h, so this shovel isn't spent forever — retire it for
			// now with the wait time so coming back later reads as worthwhile.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
        () => {},
      );
			setTruffleAvail(false);
      setDigNote(
        `You've dug here recently — come back in ${lockLabel(r.next_at ?? null)}.`,
      );
		} else if (r.reason === "none" || r.reason === "already_dug") {
			// Terminal: someone else emptied the shared pot first — or, on a server
			// older than 20260629 (one dig EVER, no re-dig cooldown), we already
			// took our share. The shovel is genuinely spent — retire it with a note
			// instead of vanishing silently.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
        () => {},
      );
			setTruffleAvail(false);
			setDigNote("Already dug up!");
		} else {
			// Transient (network / SQL) failure — keep the shovel tappable so the
			// dig can be retried rather than disappearing with no reward.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
        () => {},
      );
		}
	};

  // Leave NEVER detours. The only thing allowed to come between the exit and
  // the door is the Slop Club parting card — a perk the member opted into, not
  // a summary of what just happened.
  const requestExit = () => {
    if (isVip && gained > 0 && !partingSent) {
      setPartingOpen(true);
      return;
    }
    onClose();
  };

  const leavePartingEmote = async (emoteId: VisitEmoteId) => {
    if (partingSending || partingSent) return;
    const token = sessionToken();
    setPartingSending(emoteId);
    setPartingError(null);
    const result = await rpcAction<{ emote_id?: string }>("leave_visit_emote", {
      p_host: targetUserId,
      p_emote_id: emoteId,
    });
    if (!sessionIsCurrent(token)) return;
    setPartingSending(null);
    if (!result.ok) {
      setPartingError(
        result.reason === "already_left"
          ? "You already left a note this visit."
          : "That note didn't stick. Try another?",
      );
      return;
    }
    setPartingSent(emoteId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
    schedule(() => closeRef.current(), 650, token);
  };

	// Your visit budget (display only): how many visits remain this
	// prestige-scaled window.
	const vLeft = visitsLeft ?? visitBudget;
	// The host's name, resolved once. It reaches the screen in exactly one
	// visible place (the header plaque); everything else that carries it is a
	// screen-reader label.
	const hostName = barn?.username ?? targetName;

	// Shared squish transform entries for both pigs. Passed as an ARRAY so each
	// pig can compose it WITH its own { scale } in one transform list — a second
	// `transform` style object would clobber the scale and render the pig at full
	// 300px (clipped to nothing in its box).
	const squishTransform = [
    {
      scaleX: squish.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1.07],
      }),
    },
    {
      scaleY: squish.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0.93],
      }),
    },
	];
	const tickStyle = {
    opacity: tick.interpolate({
      inputRange: [0, 0.2, 0.9, 1],
      outputRange: [0, 1, 1, 0],
    }),
    transform: [
      {
        translateY: tick.interpolate({
          inputRange: [0, 1],
          outputRange: [4, -16],
        }),
      },
    ],
	};

	// When this barn wakes. A barn can be rested without being cross-barn locked
	// (it hit its own hourly ceiling), and then the server has told us nothing to
	// count down — so the card says the honest vague thing rather than "3h".
	const wakesIn = lockedUntil ? lockLabel(lockedUntil) : "a little while";

	// Freddy's barn background, painted as an explicit absolute-fill Image (not
	// PageBackground — its flex nesting doesn't paint inside UserSheet's modal
	// overlay). Falls back to the default barn, then a bundled asset.
	const bgSrc =
		(barn?.active_background_id && HAT_IMAGES[barn.active_background_id]) ||
		HAT_IMAGES.homestead_barn ||
		require("../assets/images/homepage-bg.jpg");

	const showInterior = inside && habitatEnabled;
	const visitContent = (
		<View style={styles.overlay} pointerEvents="box-none">
			{/* soft top fade for title legibility — fades fully to the single
			    background below (no hard seam / "half and half" split) */}
			<LinearGradient
				pointerEvents="none"
				colors={[inkAlpha(OPACITY.ghost), TINT.well, "transparent"]}
				locations={[0, 0.55, 1]}
				style={styles.topFade}
			/>

			<View style={styles.content} pointerEvents="box-none">
				{loading ? (
          <LoadingBeat
            label="knocking on the barn door"
            style={styles.loadingBeat}
          />
				) : (
					<>
						{/* ===== header: one name, one row of numbers ===== */}
						<View style={styles.chrome}>
							<VisitHeader hostName={hostName} onLeave={requestExit} />
							<VisitStatusRow
								youHearts={youHearts}
								hostHearts={friendHearts}
								visitsLeft={vLeft}
								visitBudget={visitBudget}
								hostName={hostName}
								youAvatar={
									<Avatar
										size={AVATAR_SIZE[0]}
										label="Your pig"
										style={styles.tallyAvatar}
									>
										<PigPortrait pigId={myPigId} size={AVATAR_SIZE[0]} />
									</Avatar>
								}
								hostAvatar={
									<Avatar
										size={AVATAR_SIZE[0]}
										label={`${hostName}'s pig`}
										style={styles.tallyAvatar}
									>
										<PigPortrait pigId={hostPigId} size={AVATAR_SIZE[0]} />
									</Avatar>
								}
								tickStyle={tickStyle}
							/>
						</View>

						{/* Controls float over the full-screen scene. Empty space must
							  pass touches through to the room's pigs and furnishings. */}
						<View
							style={styles.stage}
							pointerEvents="box-none"
							accessibilityLabel={`Visiting ${hostName}'s Barn`}
						>
							{!showInterior && (
								/* The depth diorama: two pigs staggered over the host's
									 background art, with the buried-truffle shovel. */
								<View style={styles.diorama}>
								{/* soft spotlight to lift the pair off the warm background */}
								<View pointerEvents="none" style={styles.spotlight} />

								{/* Great Hunger barn forage — a cozy reveal when the arrival
									  tap uncovers a lone Golden Truffle. Sits above the pigs so
									  it reads as "look what you found," distinct from the host's
									  buried-shovel truffle below. */}
								{foragedTruffle && (
									<View pointerEvents="none" style={styles.forageReveal}>
                    <Image
                      source={HAT_IMAGES.golden_truffle}
                      style={styles.forageTruffle}
                      resizeMode="contain"
                    />
										<View style={styles.forageTextWrap}>
                      <IconText
                        left={<Glyph name="sparkle" size={KICKER_MARK} />}
                        gap={SPACE.xs}
                      >
                        <T role="kickerPill" tone="accent">
                          A GLINT IN THE HAY
                        </T>
											</IconText>
                      <T role="cardTitleSm">
                        You uncovered a Golden Truffle!
                      </T>
                      <T role="kicker" tone="secondary">
                        One the Great Hungerer missed.
                      </T>
										</View>
									</View>
								)}
								{/* you — set back: smaller, higher, shifted left. The only
									  nametag left on the screen: a newcomer cannot otherwise tell
									  which pig is theirs. The host's pig wears none — the header
									  already says whose barn this is. */}
								<TapPig
									me
									slotStyle={[styles.pigSlot, styles.pigSlotBack]}
									squishTransform={squishTransform}
									onPress={tickle}
									label="you"
									tag="you"
									pigId={myPigId}
									equip={myEquip}
									tired={tired}
                  disabled={tired || restingOnArrival || !!lockedUntil || busy}
									floats={floats}
								/>
								{/* host — up front: bigger, lower, shifted right (the pig you tickle) */}
								<TapPig
									slotStyle={[styles.pigSlot, styles.pigSlotFront]}
									squishTransform={squishTransform}
									onPress={tickle}
									label={hostName}
									tag={null}
									pigId={hostPigId}
									equip={hostEquip}
									tired={tired}
                  disabled={tired || restingOnArrival || !!lockedUntil || busy}
									floats={floats}
								/>

								{/* Barn truffle — reuse Home's compact upper-left shovel
									  control so burying and digging share one visual language. */}
								{dug != null ? (
                  <View
                    pointerEvents="none"
                    style={[styles.truffleFoundWrap, styles.truffleFoundRow]}
                  >
										<SnoutCoin size={PILL_MARK} />
										<Glyph name="sparkles" size={PILL_MARK} />
										<T role="cardTitleSm" style={styles.truffleFound}>
											+{dug} snouts!
										</T>
									</View>
								) : digNote != null ? (
                  <View
                    pointerEvents="none"
                    style={[styles.truffleFoundWrap, styles.truffleFoundRow]}
                  >
										<Glyph name="pigface" size={PILL_MARK} />
										<T role="cardTitleSm" style={styles.truffleFound}>
											{digNote}
										</T>
									</View>
								) : truffleAvail && !tired ? (
									<View style={styles.visitTruffleControl}>
										<TruffleButton
											buried={false}
											disabled={digging}
											accessibilityLabel={
												digging
													? "Digging for a truffle"
													: "Dig for a truffle"
											}
											onPress={dig}
										/>
									</View>
								) : null}
								</View>
							)}
							{/* One toggle, and it is the CONTROL that is positioned — never a
								  full-width wrapper, which on the new architecture would sit
								  over the whole stage and swallow every tap on the pigs. */}
							{habitatEnabled && (
								<SegmentedControl
									label="Where in the barn"
									maxFontSizeMultiplier={VISIT_TYPE_CAP}
									value={inside && !leavingInterior ? "inside" : "outside"}
									onChange={(next) => {
										if (leavingInterior) return;
										updateInteriorState(
											next === "inside"
												? { inside: true }
												: { leaving: true },
										);
									}}
									options={[
										{
											value: "outside",
											label: "Outside",
											accessibilityHint:
												"Returns to the same Visit outside",
										},
										{
											value: "inside",
											label: "Inside",
											accessibilityHint:
												"Looks at the saved room without using a Visit",
										},
									]}
									style={styles.stageToggle}
								/>
							)}
						</View>

						{/* One secondary action, at the bottom. */}
						<VisitActionBar
							tired={tired}
							hidden={restingOnArrival}
							onHeadHome={requestExit}
						/>

						{/* The nap card is for ARRIVING at a sleeping barn only. Tiring out
							  mid-visit is a toast; it never takes the screen. */}
						{restingOnArrival && (
							/* A-08: the nap summary is a centred dialog, so it is an
								 AdaptiveModalScaffold — presented INLINE because this whole
								 overlay already sits inside another modal layer on iOS and a
								 nested native Modal would attach invisibly (#50152). Inline
								 gives it the backdrop-tap dismiss the hand-rolled scrim never
								 had; the close row names where that dismiss goes. */
							<AdaptiveModalScaffold
								visible
								presentation="inline"
								onRequestClose={requestExit}
								maxWidth={NAP_MAX_W}
								bare
								contentContainerStyle={styles.dialogFrame}
							>
								<Sticker
									color="paper"
									radius={RADII.xl}
									rotate={TILT.dialog}
									style={styles.napCard}
								>
									<DialogCloseRow
										onPress={requestExit}
										label="Head home"
										style={styles.dialogClose}
									/>
									<Glyph name="zzz" size={NAP_GLYPH} />
									<T role="pageTitle" style={styles.napTitle}>
										This barn is napping
									</T>
									{/* Both numbers the old stat block carried are already in
										  the header row; the card just says when and how many. */}
									<T
										role="body"
										tone="secondary"
										align="center"
										style={styles.napBody}
									>
										{`Wakes in ${wakesIn}. You have ${vLeft} of ${visitBudget} visits left.`}
									</T>
									<Button
										variant="gold"
										full
										onPress={requestExit}
										accessibilityLabel="Head home"
										accessibilityHint="Ends this visit and returns to your Barn"
									>
										Head home
									</Button>
								</Sticker>
							</AdaptiveModalScaffold>
						)}
					</>
				)}
			</View>
      {partingOpen && (
        /* A-08: the members' parting note, on the shared dialog scaffold. Its
           only exit used to vanish the moment the note was sent, leaving the
           player on a card with nothing to press until a 650 ms timer fired. */
        <AdaptiveModalScaffold
          visible
          presentation="inline"
          onRequestClose={onClose}
          maxWidth={CARD_MAX_W}
          bare
          contentContainerStyle={styles.dialogFrame}
        >
          <Sticker
            color="cream"
            radius={RADII.xxl}
            rotate={TILT.dialog}
            style={styles.dialogCard}
          >
            <DialogCloseRow
              onPress={onClose}
              label="Just head home"
              style={styles.dialogClose}
            />
            {/* The Slop Club gold is a BAND tint, not an ink — the kicker
                rides it rather than being written in it. */}
            <Sticker
              color={WHIMSY.slopBand}
              radius={RADII.pill}
              shadow="none"
              rotate={0}
              style={styles.partingBand}
            >
              <T role="kickerPill">SLOP CLUB PARTING NOTE</T>
            </Sticker>
            <T role="sectionTitle" align="center" style={styles.cardTitle}>
              {partingSent ? "Your note is on its way!" : "Leave a goodbye?"}
            </T>
            {/* The only body left is the one the CHOSEN emote writes — the
                static "they'll find it in Notes" line said what the card
                already looks like. */}
            {partingSent && (
              <T
                role="body"
                tone="secondary"
                align="center"
                style={styles.cardBody}
              >
                {VISIT_EMOTE_META[partingSent].sendLine}
              </T>
            )}
            <View style={styles.partingGrid}>
              {emoteIds.map((id) => {
                const selected = partingSent === id || partingSending === id;
                const settled = !!partingSending || !!partingSent;
                return (
                  <Sticker
                    key={id}
                    color={selected ? "sun" : "paper"}
                    radius={RADII.lg}
                    border={selected ? BORDER.heavy : BORDER.thin}
                    shadow="none"
                    rotate={0}
                    disabled={settled && !selected}
                    onPress={() => {
                      if (settled) return;
                      void leavePartingEmote(id);
                    }}
                    accessibilityLabel={`Send ${VISIT_EMOTE_META[id].label}`}
                    accessibilityHint="Leaves this note in their barn and heads home"
                    style={styles.partingChoice}
                  >
                    <Image
                      source={VISIT_EMOTE_IMAGES[id]}
                      style={styles.partingImage}
                      resizeMode="contain"
                    />
                    <T role="kickerPill" align="center" style={styles.choiceLabel}>
                      {VISIT_EMOTE_META[id].label}
                    </T>
                  </Sticker>
                );
              })}
            </View>
            {!!partingError && (
              <T
                role="bodySm"
                tone="danger"
                align="center"
                accessibilityRole="alert"
                style={styles.cardError}
              >
                {partingError}
              </T>
            )}
            {!partingSent && (
              <Button
                variant="link"
                full
                onPress={onClose}
                accessibilityLabel="Just head home"
                accessibilityHint="Ends the visit without leaving a parting note"
              >
                Just head home
              </Button>
            )}
          </Sticker>
        </AdaptiveModalScaffold>
      )}
		</View>
	);
	return (
		<View style={styles.root}>
			<StatusBar style="dark" />
			{showInterior && !loading ? (
				<HabitatFriendRoom
					ownerId={targetUserId}
					overlay={visitContent}
					onOpenCollection={(itemId) => {
						const viewerId = authUserId.current;
						if (viewerId)
							openOwnHabitatCollection(
								itemId,
								viewerId,
								onLeaveForCollection ?? onClose,
							);
					}}
					leaving={leavingInterior}
					onLeft={() =>
						updateInteriorState({ inside: false, leaving: false })
					}
					onUnavailable={() => {
						updateInteriorState({ inside: false, leaving: false });
						showToast({
							tone: "info",
							title: "Their room isn't open right now.",
						});
					}}
					visitorPig={
						<TapPig
							me
							slotStyle={styles.roomPigSlot}
							squishTransform={squishTransform}
							onPress={tickle}
							label="you"
							tag="you"
							pigId={myPigId}
							equip={myEquip}
							tired={tired}
							disabled={
								loading || tired || restingOnArrival || !!lockedUntil || busy
							}
							floats={floats}
						/>
					}
					hostPig={
						<TapPig
							slotStyle={styles.roomPigSlot}
							squishTransform={squishTransform}
							onPress={tickle}
							label={hostName}
							tag={null}
							pigId={hostPigId}
							equip={hostEquip}
							tired={tired}
							disabled={
								loading || tired || restingOnArrival || !!lockedUntil || busy
							}
							floats={floats}
						/>
					}
				/>
			) : (
				<>
					{/* Explicit numeric size, NOT absoluteFill insets — inset-sized
					    Images hit the Yoga definite-size quirk (fifth sighting) and
					    fall back to intrinsic px (864×1821), which rendered as a
					    2×-zoomed top-left quadrant of the art ("broken background"). */}
					{!showInterior && (
						<Image
							testID="visit-exterior-background"
							source={bgSrc}
							// Overscan 2px each side (matches PageBackground) so no edge sliver shows.
							style={{
								position: "absolute",
								top: 0,
								left: -2,
								width: screenWidth + 4,
								height: screenHeight,
							}}
							resizeMode="cover"
						/>
					)}
					{visitContent}
				</>
			)}
		</View>
	);
}

// A tappable pig, placed by its parent `slotStyle`. The host (`!me`) sits up
// front — bigger; "you" sits back — smaller, for a sense of depth. Floating
// hearts + an optional energy bar (host only).
function TapPig({
	me = false,
	slotStyle,
	squishTransform,
	onPress,
	label,
	tag,
	pigId,
	equip,
	tired,
  disabled,
	floats,
}: {
	me?: boolean;
	slotStyle?: StyleProp<ViewStyle>;
	// Shared squish transform entries — composed WITH this pig's own scale.
	squishTransform: (
			| { scaleX: Animated.AnimatedInterpolation<number> }
			| { scaleY: Animated.AnimatedInterpolation<number> }
  )[];
	onPress: () => void;
	/** Who this pig is, for the screen reader. Never drawn for the host. */
	label: string;
	/** The visible nametag, or `null` for none. Only "you" is ever worn: the
	 *  host's name is written once, on the header plaque. */
	tag: "you" | null;
	pigId: PigId;
	equip: EquipSet;
	tired: boolean;
  disabled: boolean;
	floats: { id: number; anim: Animated.Value; rx: number; star: boolean }[];
}) {
	const [reaction, setReaction] = useState<PigReaction | null>(null);
	const reactionId = useRef(0);
	const [riveActive, setRiveActive] = useState(false);
	const front = !me; // the host pig you're visiting reads as nearer/larger
	const scale = front ? 0.66 : 0.44;
	const box = front ? 212 : 146;
	const shadowW = box * 0.5;
	// Living mood surface: track the live sprite frame so equipped items ride
	// along with the breathing pig (same wiring as SwipeElement).
	const [pigFrameIdx, setPigFrameIdx] = useState(0);
	return (
    <Pressable
      onPress={() => {
        if (!me && !disabled) setReaction({ id: ++reactionId.current, kind: "happy" });
        onPress();
      }}
      disabled={disabled}
      style={slotStyle}
      accessible={!me}
      accessibilityElementsHidden={me}
      importantForAccessibility={me ? "no-hide-descendants" : "auto"}
      accessibilityRole={!me ? "button" : undefined}
      accessibilityLabel={!me ? `Tickle ${label}'s pig` : undefined}
      accessibilityHint={
        !me && !disabled ? "Shares a heart with your friend." : undefined
      }
      accessibilityState={!me ? { disabled } : undefined}
    >
			{/* flying hearts */}
			<View pointerEvents="none" style={styles.floatLayer}>
				{floats.map((f) => {
					const fs = front ? 26 : 20;
					return (
						<Animated.Image
							key={f.id}
							source={glyphSource(f.star ? "sparkle" : "heart")}
							resizeMode="contain"
							style={[
								styles.float,
								{
									width: fs,
									height: fs,
                  opacity: f.anim.interpolate({
                    inputRange: [0, 0.15, 0.8, 1],
                    outputRange: [0, 1, 1, 0],
                  }),
									transform: [
										{ translateX: f.rx * (front ? 1 : 0.6) },
                    {
                      translateY: f.anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [10, -96],
                      }),
                    },
                    {
                      scale: f.anim.interpolate({
                        inputRange: [0, 0.2, 1],
                        outputRange: [0.5, 1.1, 0.9],
                      }),
                    },
									],
								},
							]}
						/>
					);
				})}
			</View>
			<View style={[styles.pigBox, { width: box, height: box }]}>
        <View
          pointerEvents="none"
          style={[
            styles.groundShadow,
            { width: shadowW, left: (box - shadowW) / 2 },
          ]}
        />
				<Animated.View style={{ transform: [{ scale }, ...(riveActive ? [] : squishTransform)] }}>
					<PigStage
						active={!me}
						pigReaction={reaction}
						onPigComplete={() => setReaction(null)}
						onRendererChange={(kind) => setRiveActive(kind === "rive")}
						pigId={pigId}
						pigFrameIdx={pigFrameIdx}
						onPigFrame={setPigFrameIdx}
						equipped={equip.hat}
						equippedBow={equip.bow}
						equippedGlasses={equip.glasses}
						equippedMask={equip.mask}
						equippedNeck={equip.neck}
						equippedAura={equip.aura}
						equippedHeld={equip.held}
						// A just-tickled pig is HAPPY, not tired — the visit is "spent"
						// after one tickle (1-tickle model, 20260682), but that's a
						// success, so it should beam, not slump. (The old 3–7 tap model
						// tired the pig out after many taps; a cap of 1 made that fire
						// instantly and read as "tired after one tickle".)
						pigAnimation="idle"
						pigMood={tired ? "happy" : "content"}
					/>
				</Animated.View>
			</View>
      {tag ? (
        <View style={styles.nameTag}>
          <T
            role="cardTitleSm"
            align="center"
            numberOfLines={1}
            style={styles.nameTagText}
          >
            {tag}
          </T>
        </View>
      ) : null}
		</Pressable>
	);
}

const styles = StyleSheet.create({
	root: {
		...StyleSheet.absoluteFill,
		zIndex: 100,
		backgroundColor: WHIMSY.cream,
	},
	overlay: { ...StyleSheet.absoluteFill },
	content: { flex: 1 },
	// The tally capsule supplies the outline; the portrait keeps its round clip.
	tallyAvatar: { borderWidth: 0 },
	topFade: { position: "absolute", top: 0, left: 0, right: 0, height: TOP_FADE_H },
	loadingBeat: { marginTop: LOADING_DROP },

	// paddingTop is a status-bar safe offset (this overlay has no SafeAreaView),
	// not an on-scale gap. The whole chrome above the scene is
	// STATUS_SAFE + TAP_MIN + SPACE.sm + STATUS_TAG_H — and nothing else may
	// join it.
	// `alignSelf: "stretch"` is stated rather than inherited: the status row
	// below wraps, and a wrapping row needs a definite width from every ancestor
	// between it and the screen. (2026-09-12)
	chrome: {
		alignSelf: "stretch",
		paddingHorizontal: PAGE_PAD,
		paddingTop: STATUS_SAFE,
	},

	stage: { flex: 1 },
	// The toggle floats over whichever scene is live. The CONTROL is positioned,
	// not a wrapper: a full-width absolute layer here would cover the pigs and
	// eat every tap on the new architecture.
	stageToggle: {
		position: "absolute",
		top: SPACE.md,
		alignSelf: "center",
		minWidth: TOGGLE_MIN_W,
		zIndex: 8,
	},
	// The square the room hands each pig. Its size is the sprite canvas, not a
	// spacing step.
	roomPigSlot: {
		width: ROOM_PIG_BOX,
		height: ROOM_PIG_BOX,
		alignItems: "center",
		justifyContent: "center",
	},
	// The depth diorama: two pigs absolutely placed, staggered for a sense of depth.
	diorama: { flex: 1, position: "relative" },
	spotlight: {
		position: "absolute",
		alignSelf: "center",
		bottom: "6%",
		width: SPOTLIGHT_W,
		height: SPOTLIGHT_H,
		borderRadius: SPOTLIGHT_R,
		backgroundColor: TINT.paperWash,
		opacity: OPACITY.rule,
	},
	// Each slot fills the diorama width and centers its pig; translateX staggers
	// the pair off-center. Both slots are BOTTOM-anchored so the pigs share
	// one ground row (was a stacked top-4%/38% diorama); the host keeps a
	// slight size + depth edge but they read side-by-side now.
	pigSlot: { position: "absolute", left: 0, right: 0, alignItems: "center" },
	pigSlotBack: { bottom: "14%", transform: [{ translateX: -78 }] },
	pigSlotFront: { bottom: "9%", transform: [{ translateX: 72 }] },
	floatLayer: {
		position: "absolute",
		left: 0,
		right: 0,
		top: 0,
		bottom: 0,
		alignItems: "center",
		justifyContent: "center",
		zIndex: 5,
	},
	float: { position: "absolute", bottom: "60%" },
	pigBox: { alignItems: "center", justifyContent: "center" },
	groundShadow: {
		position: "absolute",
		bottom: "11%",
		height: GROUND_SHADOW_H,
		borderRadius: RADII.pill,
		backgroundColor: inkAlpha(OPACITY.rule),
	},
	nameTag: {
		marginTop: -SPACE.sm,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		borderRadius: RADII.pill,
		backgroundColor: UI_COLORS.surface,
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.xxs,
		...SHADOW_SM,
	},
	nameTagText: { maxWidth: NAMETAG_MAX_W },

	// The main Barn's compact bury control, digging instead — in the stage's
	// bottom-left corner, because the top of the stage now belongs to the
	// Outside / Inside toggle.
	visitTruffleControl: {
		position: "absolute",
		left: PAGE_PAD,
		bottom: SPACE.lg,
		zIndex: 6,
	},
	truffleFoundWrap: {
		position: "absolute",
		left: PAGE_PAD,
		bottom: SPACE.lg,
		zIndex: 6,
		maxWidth: "84%", // cooldown note is a full sentence — wrap, don't overflow
		backgroundColor: WHIMSY.sun,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		borderRadius: RADII.pill,
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.xs,
		...SHADOW_SM,
	},
	truffleFoundRow: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
	truffleFound: { flexShrink: 1 },

	// Barn-forage Golden Truffle reveal — a cozy sticker banner above the pigs.
	forageReveal: {
		position: "absolute",
		top: FORAGE_DROP,
		alignSelf: "center",
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
		maxWidth: "88%",
		backgroundColor: UI_COLORS.surface,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		borderRadius: RADII.lg,
		paddingHorizontal: SPACE.card,
		paddingVertical: SPACE.sm,
		zIndex: 7,
		...SHADOW_SM,
	},
	forageTruffle: { width: FORAGE_ART, height: FORAGE_ART },
	forageTextWrap: { flexShrink: 1 },

	// ── the three dialogs ────────────────────────────────────────────────────
	// One frame, one card inset, one pulled-up close rail — the three cards that
	// used to carry a scrim + card + skip apiece. [A-08]
	dialogFrame: { padding: SPACE.xs },
	dialogCard: { padding: SPACE.lg },
	dialogClose: {
		marginTop: -SPACE.sm,
		marginRight: -SPACE.sm,
		marginBottom: -SPACE.sm,
	},
	cardTitle: { marginTop: SPACE.xs },
	cardBody: { marginTop: SPACE.xs },
	cardAction: { marginTop: SPACE.md },
	cardError: { marginTop: SPACE.sm },

	napCard: { padding: SPACE.xl, alignItems: "center" },
	napTitle: { marginTop: SPACE.sm },
	napBody: { marginTop: SPACE.sm, marginBottom: SPACE.lg },

	choiceLabel: { marginTop: SPACE.xs },

	// The Slop Club band the parting kicker rides.
	partingBand: {
		alignSelf: "center",
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.xxs,
	},
	partingGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		alignSelf: "stretch",
		justifyContent: "center",
		gap: SPACE.sm,
		marginTop: SPACE.lg,
	},
	partingChoice: {
		width: "30%",
		minWidth: EMOTE_CHOICE_MIN_W,
		alignItems: "center",
		paddingVertical: SPACE.sm,
	},
	partingImage: { width: EMOTE_ART, height: EMOTE_ART },
});
