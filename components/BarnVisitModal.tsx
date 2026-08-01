// Visit & Tickle — visiting a friend's Barn to tickle their pig. Redesigned from
// the claude.ai/design "Visit & Tickle.html" handoff, wired to the real server:
//
//   • Tap EITHER pig (no button) → tickle_at_barn: spends one of YOUR tickles,
//     gives it to the host, and makes BOTH pigs happier.
//   • Two heart tallies (YOU | host) tick up together on every tap with a shared
//     heartbeat pulse — the "you both get a heart" payoff. Hearts are the mutual
//     love (happiness), distinct from the tickle you spend.
//   • "PIG ENERGY" bar = the shared visit budget (random 3–7 taps a visit);
//     visiting no longer spends your own tickle bank (server 20260646).
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
import { supabase } from "@/utils/supabase";
import { rpcAction } from "@/utils/rpc";
import { remainingMs } from "@/utils/duration";
import { PigStage, type EquippedItem } from "./ui/PigStage";
import { Glyph, IconText, glyphSource } from "./ui/Glyph";
import { SnoutCoin } from "./ui/SnoutCoin";
import { LoadingBeat } from "./ui/EmptyState";
import { TruffleButton } from "./TruffleButton";
import { HAT_IMAGES } from "@/constants/hats";
import {
  FONTS,
  WHIMSY,
  COLORS,
  SHADOW_SM,
  SPACE,
  RADII,
  TYPE,
  MODAL_BACKDROP_BG,
} from "@/constants/theme";
import {
  refreshVisitEmotes,
  visitEmoteIds,
  VISIT_EMOTE_IMAGES,
  VISIT_EMOTE_META,
  type VisitEmoteId,
} from "@/utils/visitEmotes";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";
import {
	GUESTBOOK_STAMP_IDS,
	GUESTBOOK_STAMP_META,
	type GuestbookStampId,
} from "@/utils/guestbookStamps";
import { trackInteraction } from "@/utils/interactionAnalytics";
import {
  kindnessCardFailureCopy,
  parseKindnessCardOffer,
  type KindnessCardOffer,
} from "@/utils/kindnessCards";
import { BLESSING_META } from "@/utils/rituals";
import { recordPorchStop } from "@/utils/porchRound";
import { isPigId, type PigId } from "@/utils/pigs";

interface Props {
	targetUserId: string;
	targetName: string;
	onClose: () => void;
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
	glasses: Slot;
	mask: Slot;
	neck: Slot;
	aura: Slot;
	held: Slot;
}
const EMPTY_EQUIP: EquipSet = {
  hat: null,
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
	"active_glasses:hats!profiles_active_glasses_id_fkey(id,category,emoji)," +
	"active_mask:hats!profiles_active_mask_id_fkey(id,category,emoji)," +
	"active_neck:hats!profiles_active_neck_id_fkey(id,category,emoji)," +
	"active_aura:hats!profiles_active_aura_id_fkey(id,category,emoji)," +
	"active_held:hats!profiles_active_held_id_fkey(id,category,emoji)";

interface ProfileEquipRow {
	active_hat: HatRow | HatRow[];
	active_glasses: HatRow | HatRow[];
	active_mask: HatRow | HatRow[];
	active_neck: HatRow | HatRow[];
	active_aura: HatRow | HatRow[];
	active_held: HatRow | HatRow[];
}
const rowToEquip = (r: ProfileEquipRow): EquipSet => ({
	hat: toSlot(r.active_hat),
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

export function BarnVisitModal({ targetUserId, targetName, onClose }: Props) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const motionPolicy = useMotionPolicy();
	const [barn, setBarn] = useState<Barn | null>(null);
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);
	const [hostPigId, setHostPigId] = useState<PigId>("rosie");
	const [myPigId, setMyPigId] = useState<PigId>("rosie");
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
  const [stampOfferOpen, setStampOfferOpen] = useState(false);
  const [stampOffered, setStampOffered] = useState(false);
  const [stampSending, setStampSending] = useState<GuestbookStampId | null>(
    null,
  );
  const [stampSent, setStampSent] = useState<GuestbookStampId | null>(null);
  const [stampError, setStampError] = useState<string | null>(null);
  const [kindnessOffer, setKindnessOffer] =
    useState<KindnessCardOffer | null>(null);
  const [kindnessSending, setKindnessSending] = useState(false);
  const [kindnessSent, setKindnessSent] = useState(false);
  const [kindnessError, setKindnessError] = useState<string | null>(null);
	const porchRecorded = useRef(false);

	// Live season tickle totals (seeded from each profile's tickles_earned),
	// then both tick up together by one on every tap. The Barn race is a
	// this-season surface, so we seed the tallies from the live-season count
	// alone — never lifetime, which would drag in stale archived seasons.
	const [youHearts, setYouHearts] = useState(0);
	const [friendHearts, setFriendHearts] = useState(0);
	// Hearts shared THIS visit only — for the nap summary.
	const [gained, setGained] = useState(0);

  // Tap-session tired state is driven by the server's remaining-taps result.
	const [tired, setTired] = useState(false);
  // Your shared visit budget: 3 different friends per prestige-scaled window.
  // Server-authoritative (barn_visit_status).
	const [visitsLeft, setVisitsLeft] = useState<number | null>(null);
	const [visitBudget, setVisitBudget] = useState(3);
  const [visitWindowHours, setVisitWindowHours] = useState(8);
	// Nap summary visibility. Mid-visit tire-out no longer slams the scrim
	// over the barn — a small "All tickled out!" bubble pops instead, and
	// the summary dialog shows when the player taps Leave. Rested-on-arrival
	// still scrims immediately (there's nothing to do in that barn).
	const [napOpen, setNapOpen] = useState(false);
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

	// Flying hearts + the shared-heartbeat pulse + pig squish, all on each tap.
  const [floats, setFloats] = useState<
    { id: number; anim: Animated.Value; rx: number; star: boolean }[]
  >([]);
	const nextFloat = useRef(0);
	const squish = useRef(new Animated.Value(0)).current;
	const beat = useRef(new Animated.Value(0)).current;
	const tick = useRef(new Animated.Value(0)).current; // "+1 ♥" rise over tallies

	const playTap = () => {
		if (motionPolicy.reduceMotion) {
			squish.setValue(0);
			beat.setValue(0);
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
		beat.setValue(0);
    Animated.timing(beat, {
      toValue: 1,
      duration: 440,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
		tick.setValue(0);
    Animated.timing(tick, {
      toValue: 1,
      duration: 760,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
		for (let i = 0; i < 5; i++) {
			setTimeout(() => {
				const id = nextFloat.current++;
				const anim = new Animated.Value(0);
				const rx = Math.random() * 70 - 35;
				const star = Math.random() < 0.14;
				setFloats((f) => [...f, { id, anim, rx, star }]);
        Animated.timing(anim, {
          toValue: 1,
          duration: 1050,
          useNativeDriver: true,
        }).start(() => setFloats((f) => f.filter((x) => x.id !== id)));
			}, i * 60);
		}
	};

	useEffect(() => {
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
			if (cancelled || !data) {
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
        if (st.visit_window_hours != null)
          setVisitWindowHours(st.visit_window_hours);
			}
			setLoading(false);
		})();
		return () => {
			cancelled = true;
		};
	}, [targetUserId]);

  useEffect(() => {
    void refreshVisitEmotes().then(() => setEmoteIds([...visitEmoteIds()]));
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

	const tireOut = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
      () => {},
    );
		setTired(true);
	};

	const tickle = async () => {
		if (tired || restingOnArrival || lockedUntil || busy) return;
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
			setYouHearts((n) => n + 1);
			setFriendHearts((n) => n + 1);
			setGained((g) => g + 1);
			if (!porchRecorded.current) {
				porchRecorded.current = true;
				void recordPorchStop(targetUserId).then((porch) => {
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
      // Unlock the optional guestbook action after this modal's first confirmed
      // tickle. Never interrupt the visit with it: the player can choose the
      // in-scene "Sign the guestbook" action whenever they're ready.
      if (!stampOffered) {
        setStampOffered(true);
      }
			if (r.visits_left != null) setVisitsLeft(r.visits_left);
      if (r.visit_window_hours != null)
        setVisitWindowHours(r.visit_window_hours);
			// Server is authoritative on when the visit is spent: taps_left is the
			// remaining tickles of this visit's 3–7 cap and hits 0 exactly on the
			// cap-hitting tap. Gate on THAT, not local tapCap state — the cap is
			// rolled server-side on the first tap, so the freshly-returned value is
      // the only reliable signal. The
			// cap-hitting tap also returns next_at, so we start the 24h countdown
			// immediately (re-entry would only show the same lock anyway).
			if ((r.taps_left ?? 99) <= 0) {
				if (r.next_at) setLockedUntil(r.next_at);
				setTimeout(tireOut, 520);
			}
		} else if (r.reason === "tired" || r.reason === "no_tickles") {
			// no_tickles only comes from a pre-20260646 server (visits used
			// to spend your bank); treat it as the nap so there's a clean exit.
			tireOut();
		} else if (r.reason === "cooldown") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
        () => {},
      );
			setLockedUntil(r.next_at ?? null);
			setRestingOnArrival(true);
		}
	};

  const leaveGuestbookStamp = async (stampId: GuestbookStampId) => {
    if (stampSending || stampSent) return;
    setStampSending(stampId);
    setStampError(null);
    const result = await rpcAction<{ stamp_id?: string }>(
      "leave_barn_guestbook_stamp",
      {
        p_host: targetUserId,
        p_stamp_id: stampId,
      },
    );
    setStampSending(null);
    if (!result.ok) {
      if (result.reason === "already_stamped") {
        setStampOffered(false);
        setStampOfferOpen(false);
        return;
      }
      setStampError("That stamp didn't stick. Try once more?");
      return;
    }
		setStampSent(stampId);
		void trackInteraction({
			eventName: "visit_stamp_left",
			surface: "visit",
			targetKind: "barn",
			targetUserId,
			result: "succeeded",
			properties: { source: "cta", variant: stampId },
		});
		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
			() => {},
		);
    const status = await rpcAction<{
      eligible?: boolean;
      blessing_kind?: string;
      bless_remaining?: number;
    }>("barn_kindness_card_status", { p_host: targetUserId });
    const offer = parseKindnessCardOffer(status);
    if (offer) {
      void trackInteraction({
        eventName: "kindness_card_offered",
        surface: "visit",
        targetKind: "barn",
        targetUserId,
        result: "completed",
        properties: { source: "cta", variant: offer.blessingKind },
      });
    }
    setTimeout(() => {
      if (offer) {
        // Keep the existing post-visit sheet mounted and reveal the optional
        // warmth action inside it. No second scrim or chained popup.
        setKindnessOffer(offer);
      } else {
        setStampOfferOpen(false);
      }
    }, 600);
  };

  const leaveKindnessCard = async () => {
    if (!kindnessOffer || kindnessSending || kindnessSent) return;
    setKindnessSending(true);
    setKindnessError(null);
    const result = await rpcAction<{ kind?: string; blessing_id?: string }>(
      "leave_barn_kindness_card",
      { p_host: targetUserId },
    );
    setKindnessSending(false);
    if (!result.ok) {
      setKindnessError(kindnessCardFailureCopy(result.reason));
      if (
        result.reason === "daily_cap" ||
        result.reason === "already_blessed_today" ||
        result.reason === "no_eligible_visit"
      ) {
        setTimeout(() => {
          setKindnessOffer(null);
          setStampOfferOpen(false);
        }, 900);
      }
      return;
    }
    setKindnessSent(true);
    void trackInteraction({
      eventName: "blessing_cast",
      surface: "visit",
      targetKind: "pig",
      targetUserId,
      result: "succeeded",
      ...(result.blessing_id ? { contentId: result.blessing_id } : {}),
      properties: {
        source: "cta",
        variant: result.kind ?? kindnessOffer.blessingKind,
      },
    });
    void trackInteraction({
      eventName: "kindness_card_left",
      surface: "visit",
      targetKind: "barn",
      targetUserId,
      result: "succeeded",
      ...(result.blessing_id ? { contentId: result.blessing_id } : {}),
      properties: {
        source: "cta",
        variant: result.kind ?? kindnessOffer.blessingKind,
      },
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
    setTimeout(() => {
      setKindnessOffer(null);
      setStampOfferOpen(false);
    }, 900);
  };

	const dig = async () => {
		if (digging || dug != null) return;
		setDigging(true);
    const r = await rpcAction<{
      reward?: number;
      remaining?: number;
      next_at?: string | null;
    }>("dig_truffle", { p_host: targetUserId });
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

  const requestExit = () => {
    if (isVip && gained > 0 && !partingSent) {
      setNapOpen(false);
      setPartingOpen(true);
      return;
    }
    onClose();
  };

  const leavePartingEmote = async (emoteId: VisitEmoteId) => {
    if (partingSending || partingSent) return;
    setPartingSending(emoteId);
    setPartingError(null);
    const result = await rpcAction<{ emote_id?: string }>("leave_visit_emote", {
      p_host: targetUserId,
      p_emote_id: emoteId,
    });
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
    setTimeout(onClose, 650);
  };

  // Your visit budget (display only): how many visits remain this
  // prestige-scaled window.
	const vLeft = visitsLeft ?? visitBudget;
  const visitsColor =
    vLeft > 1
      ? COLORS.successText
      : vLeft === 1
        ? WHIMSY.goblin
        : WHIMSY.accent;

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

	const napUntil = lockedUntil ? lockLabel(lockedUntil) : "3h";
	// Arrived to find THIS barn at its hourly tap ceiling, but NOT cross-barn
	// locked — so you can still visit other friends now; don't claim "3h".
	const arrivedRested = restingOnArrival && !lockedUntil;

	// Freddy's barn background, painted as an explicit absolute-fill Image (not
	// PageBackground — its flex nesting doesn't paint inside UserSheet's modal
	// overlay). Falls back to the default barn, then a bundled asset.
	const bgSrc =
		(barn?.active_background_id && HAT_IMAGES[barn.active_background_id]) ||
		HAT_IMAGES.homestead_barn ||
		require("../assets/images/homepage-bg.jpg");

	return (
		<View style={styles.root}>
			{/* Explicit numeric size, NOT absoluteFill insets — inset-sized
			    Images hit the Yoga definite-size quirk (fifth sighting) and
			    fall back to intrinsic px (864×1821), which rendered as a
			    2×-zoomed top-left quadrant of the art ("broken background"). */}
			<Image
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
			{/* soft top fade for title legibility — fades fully to the single
			    background below (no hard seam / "half and half" split) */}
			<LinearGradient
				pointerEvents="none"
				colors={["rgba(36,24,14,0.45)", "rgba(36,24,14,0.12)", "transparent"]}
				locations={[0, 0.55, 1]}
				style={styles.topFade}
			/>

			<View style={styles.content}>
				{loading ? (
          <LoadingBeat
            label="knocking on the barn door"
            glyph="pigface"
            style={{ marginTop: 120 }}
          />
				) : (
					<>
						{/* ===== top chrome ===== */}
						<View style={styles.chrome}>
							<View style={styles.headerRow}>
								<View style={styles.headerTitleCol}>
									<IconText left={<Glyph name="star" size={12} />} gap={4}>
										<Text style={styles.kicker}>VISITING</Text>
									</IconText>
									<Text style={styles.title} numberOfLines={1}>
										{targetName}'s Barn
									</Text>
									{/* Visits-left chip — gold-accent sticker under the title.
									    Sits IN the header so the visit's headline stat reads
									    up-front; wraps below a long title and stays balanced
									    beside the Leave button on narrow screens. A COUNT is
									    not a countdown: we keep "X of Y visits left" while any
									    remain, but the zero state drops to day-rhythm language
									    (no "resets in Xh" — the charter never punishes the
									    hours between). */}
									<View style={styles.visitsChip}>
										<IconText left={<Glyph name="sparkle" size={12} />} gap={5}>
											<Text style={styles.visitsChipText}>
												{vLeft <= 0 ? (
                          <Text
                            style={[
                              styles.visitsChipNum,
                              { color: visitsColor },
                            ]}
                          >
														all tickled out — your snout needs a rest
													</Text>
												) : (
													<>
                            <Text
                              style={[
                                styles.visitsChipNum,
                                { color: visitsColor },
                              ]}
                            >
															{vLeft} of {visitBudget}
														</Text>
														<Text> visits left</Text>
													</>
												)}
											</Text>
										</IconText>
									</View>
								</View>
								<Pressable
									onPress={() => {
										// Tired out mid-visit: Leave surfaces the nap
										// summary (hearts shared + next-visit timer)
										// before actually heading home.
										if (tired && !restingOnArrival && !napOpen) {
											setNapOpen(true);
											return;
										}
                    requestExit();
									}}
									style={styles.leavePill}
									hitSlop={8}
								>
									<IconText right={<Glyph name="close" size={11} />} gap={5}>
										<Text style={styles.leaveText}>Leave</Text>
									</IconText>
								</Pressable>
							</View>

							{/* hearts shared — both tick up together */}
							<View style={styles.heartCard}>
                <HeartTally
                  label="YOU"
                  total={youHearts}
                  tickStyle={tickStyle}
                />
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
									<Glyph name="heart" size={15} />
								</Animated.View>
							</View>
							{stampOffered && !stampSent && !restingOnArrival && (
								<Pressable
									testID="visit-guestbook-open"
									accessibilityRole="button"
									accessibilityLabel="Sign the Barn guestbook"
									onPress={() => setStampOfferOpen(true)}
									style={({ pressed }) => [
										styles.guestbookAction,
										pressed && styles.guestbookActionPressed,
									]}
								>
									<Glyph name="pigface" size={16} />
									<Text style={styles.guestbookActionText}>
										Sign the guestbook
									</Text>
								</Pressable>
							)}

							{/* post-tickle nudge — its own little sticker BELOW the
							    tally band (never over it), tail pointing up at the hearts
							    it's celebrating. Go spread the love to another friend. */}
							{tired && !restingOnArrival && !napOpen && (
								<View style={styles.ticklesPopWrap} pointerEvents="none">
									<View style={styles.ticklesPop}>
										<View style={styles.ticklesPopTail} />
										<Text style={styles.ticklesPopTitle}>Tickled!</Text>
										<Text style={styles.ticklesPopSub}>
											{vLeft > 0
												? "go tickle another friend"
												: "tap Leave when you're ready"}
										</Text>
									</View>
								</View>
							)}
						</View>

						{/* ===== stage: two pigs stacked with depth — host up front
						     (bigger, lower, shifted right), you set back (smaller, higher,
						     shifted left). Staggered off-center for a little diorama depth,
						     grounded over the host's barn background like the Build view. ===== */}
						<View style={styles.stage}>
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
                        left={<Glyph name="sparkle" size={12} />}
                        gap={4}
                      >
                        <Text style={styles.forageKicker}>
                          A GLINT IN THE HAY
                        </Text>
											</IconText>
                      <Text style={styles.forageTitle}>
                        You uncovered a Golden Truffle!
                      </Text>
                      <Text style={styles.forageSub}>
                        One the Great Hungerer missed.
                      </Text>
										</View>
									</View>
								)}
								{/* you — set back: smaller, higher, shifted left */}
								<TapPig
									me
									slotStyle={[styles.pigSlot, styles.pigSlotBack]}
									squishTransform={squishTransform}
									onPress={tickle}
									label="you"
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
									label={barn?.username ?? targetName}
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
										<SnoutCoin size={16} />
										<Glyph name="sparkles" size={14} />
										<Text style={styles.truffleFound}>+{dug} snouts!</Text>
									</View>
								) : digNote != null ? (
                  <View
                    pointerEvents="none"
                    style={[styles.truffleFoundWrap, styles.truffleFoundRow]}
                  >
										<Glyph name="pigface" size={14} />
										<Text style={styles.truffleFound}>{digNote}</Text>
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
						</View>

						{/* nap screen — Leave-triggered after tiring out, or
						    rested-out / locked on arrival */}
						{(napOpen || restingOnArrival) && (
							<View style={styles.napScrim}>
								<View style={styles.napCard}>
									<Glyph name="zzz" size={50} style={styles.napGlyph} />
									<Text style={styles.napKicker}>nap time</Text>
									<Text style={styles.napTitle}>All tickled out!</Text>
									<Text style={styles.napBody}>
										{arrivedRested
											? `${targetName}'s pig is worn out from a recent visit — give it a little while. You can still go tickle another friend's pig!`
                      : `The pigs need a rest! You can visit ${visitBudget} different Barns every ${visitWindowHours} hours — and each friend just once a day. Come back soon to tickle more.`}
									</Text>
									<View style={styles.napStats}>
										<View style={styles.napStat}>
											<View style={styles.napStatNumRow}>
												<Text style={styles.napStatNum}>+{gained}</Text>
												<Glyph name="heart" size={15} />
											</View>
											<Text style={styles.napStatLabel}>shared this visit</Text>
										</View>
										{!arrivedRested && (
											<>
												<View style={styles.napStatDivider} />
												<View style={styles.napStat}>
													<Text style={styles.napStatNum}>{napUntil}</Text>
                          <Text style={styles.napStatLabel}>
                            until you can visit again
                          </Text>
												</View>
											</>
										)}
									</View>
                  <Pressable onPress={requestExit} style={styles.napBtn}>
                    <IconText
                      right={<Glyph name="arrowRight" size={14} />}
                      gap={6}
                    >
										<Text style={styles.napBtnText}>Head home</Text>
									</IconText>
									</Pressable>
								</View>
							</View>
						)}
					</>
				)}
			</View>
      {stampOfferOpen && (
        <View style={styles.stampScrim}>
          <View style={styles.stampCard}>
            {kindnessOffer ? (
              <>
                <Text style={styles.stampKicker}>BARN GUESTBOOK</Text>
                <Image
                  source={BLESSING_META[kindnessOffer.blessingKind].icon}
                  style={styles.kindnessIcon}
                />
                <Text style={styles.stampTitle}>
                  {kindnessSent
                    ? "Your note is ready!"
                    : "Add a little warmth?"}
                </Text>
                <Text style={styles.stampBody}>
                  {kindnessSent
                    ? `${targetName} will find the hoofprint and blessing together.`
                    : `Your hoofprint is saved. Add today’s ${BLESSING_META[kindnessOffer.blessingKind].name}, if you like.`}
                </Text>
                {!kindnessSent && (
                  <Pressable
                    testID="kindness-card-send"
                    disabled={kindnessSending}
                    onPress={leaveKindnessCard}
                    style={({ pressed }) => [
                      styles.kindnessSend,
                      (pressed || kindnessSending) && { opacity: 0.72 },
                    ]}
                  >
                    <Text style={styles.kindnessSendText}>
                      {kindnessSending
                        ? "Tucking it in…"
                        : `Add ${BLESSING_META[kindnessOffer.blessingKind].name}`}
                    </Text>
                  </Pressable>
                )}
                {!!kindnessError && (
                  <Text style={styles.stampError}>{kindnessError}</Text>
                )}
                {!kindnessSent && (
                  <Pressable
                    testID="kindness-card-skip"
                    onPress={() => {
                      setKindnessOffer(null);
                      setStampOfferOpen(false);
                    }}
                    style={styles.stampSkip}
                  >
                    <Text style={styles.stampSkipText}>The hoofprint says plenty</Text>
                  </Pressable>
                )}
              </>
            ) : (
              <>
                <Text style={styles.stampKicker}>BARN GUESTBOOK</Text>
                <Text style={styles.stampTitle}>
                  {stampSent
                    ? "Your hoofprint is saved!"
                    : "Leave a little hoofprint?"}
                </Text>
                <Text style={styles.stampBody}>
                  {stampSent
                    ? `${targetName} can find it whenever they come home.`
                    : "One tap leaves a warm, permanent note. It never expires."}
                </Text>
                <View style={styles.stampChoices}>
                  {GUESTBOOK_STAMP_IDS.map((id) => {
                    const meta = GUESTBOOK_STAMP_META[id];
                    const selected = stampSending === id || stampSent === id;
                    return (
                      <Pressable
                        key={id}
                        testID={`guestbook-stamp-${id}`}
                        disabled={!!stampSending || !!stampSent}
                        onPress={() => leaveGuestbookStamp(id)}
                        accessibilityLabel={`Leave ${meta.label.toLowerCase()} stamp`}
                        style={({ pressed }) => [
                          styles.stampChoice,
                          selected && styles.stampChoiceSelected,
                          pressed && { transform: [{ scale: 0.95 }] },
                        ]}
                      >
                        <Glyph name={meta.glyph} size={28} />
                        <Text style={styles.stampLabel}>{meta.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                {!!stampError && (
                  <Text style={styles.stampError}>{stampError}</Text>
                )}
								{!stampSent && (
									<Pressable
										testID="guestbook-stamp-skip"
										onPress={() => setStampOfferOpen(false)}
										style={styles.stampSkip}
									>
										<Text style={styles.stampSkipText}>Back to the Barn</Text>
									</Pressable>
								)}
              </>
            )}
          </View>
        </View>
      )}
      {partingOpen && (
        <View style={styles.partingScrim}>
          <View style={styles.partingCard}>
            <Text style={styles.partingKicker}>SLOP CLUB PARTING NOTE</Text>
            <Text style={styles.partingTitle}>
              {partingSent
                ? "Your note is on its way!"
                : `Leave ${targetName} a little goodbye`}
            </Text>
            <Text style={styles.partingBody}>
              {partingSent
                ? VISIT_EMOTE_META[partingSent].sendLine
                : "They'll find it in Notes from the barn."}
            </Text>
            <View style={styles.partingGrid}>
              {emoteIds.map((id) => {
                const selected = partingSent === id || partingSending === id;
                return (
                  <Pressable
                    key={id}
                    disabled={!!partingSending || !!partingSent}
                    onPress={() => leavePartingEmote(id)}
                    style={({ pressed }) => [
                      styles.partingChoice,
                      selected && styles.partingChoiceSelected,
                      pressed && { transform: [{ scale: 0.96 }] },
                    ]}
                  >
                    <Image
                      source={VISIT_EMOTE_IMAGES[id]}
                      style={styles.partingImage}
                      resizeMode="contain"
                    />
                    <Text style={styles.partingLabel}>
                      {VISIT_EMOTE_META[id].label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {!!partingError && (
              <Text style={styles.partingError}>{partingError}</Text>
            )}
            {!partingSent && (
              <Pressable onPress={onClose} style={styles.partingSkip}>
                <Text style={styles.partingSkipText}>
                  Head home without a note
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      )}
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
  tickStyle: {
    opacity: Animated.AnimatedInterpolation<number>;
    transform: { translateY: Animated.AnimatedInterpolation<number> }[];
  };
}) {
	return (
		<View style={styles.tally}>
			<Animated.View style={[styles.tallyTick, tickStyle]}>
				<Text style={styles.tallyTickText}>+1</Text>
				<Glyph name="heart" size={12} />
			</Animated.View>
			<View style={styles.tallyRow}>
				<Glyph name="heart" size={14} />
				<Text style={styles.tallyNum}>{total.toLocaleString()}</Text>
			</View>
			<Text style={styles.tallyLabel} numberOfLines={1}>
				{label}
			</Text>
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
	label: string;
	pigId: PigId;
	equip: EquipSet;
	tired: boolean;
  disabled: boolean;
	floats: { id: number; anim: Animated.Value; rx: number; star: boolean }[];
}) {
	const front = !me; // the host pig you're visiting reads as nearer/larger
	const scale = front ? 0.66 : 0.44;
	const box = front ? 212 : 146;
	const shadowW = box * 0.5;
	// Living mood surface: track the live sprite frame so equipped items ride
	// along with the breathing pig (same wiring as SwipeElement).
	const [pigFrameIdx, setPigFrameIdx] = useState(0);
	return (
    <Pressable
      onPress={onPress}
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
				<Animated.View style={{ transform: [{ scale }, ...squishTransform] }}>
					<PigStage
						pigId={pigId}
						pigFrameIdx={pigFrameIdx}
						onPigFrame={setPigFrameIdx}
						equipped={equip.hat}
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
						pigAnimation={tired ? "happy" : "idle"}
					/>
				</Animated.View>
			</View>
      <View
        style={[styles.nameTag, me ? styles.nameTagYou : styles.nameTagFriend]}
      >
        <Text
          style={[styles.nameTagText, front && { fontSize: 14 }]}
          numberOfLines={1}
        >
					{label}
				</Text>
			</View>
		</Pressable>
	);
}

const INK = WHIMSY.ink;
const sticker = SHADOW_SM;

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    backgroundColor: WHIMSY.cream,
  },
	content: { flex: 1 },
	topFade: { position: "absolute", top: 0, left: 0, right: 0, height: 190 },

	// paddingTop 56 is a status-bar safe offset (this overlay has no SafeAreaView),
	// not an on-scale gap — kept literal.
	chrome: { paddingHorizontal: SPACE.lg, paddingTop: 56 },
	// Header row: title column (shrinks / wraps the chip) beside the Leave pill.
	// alignItems flex-start so a two-line title + chip keeps Leave pinned top.
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: SPACE.md,
  },
	headerTitleCol: { flexShrink: 1, alignItems: "flex-start" },
	kicker: { ...TYPE.kicker, letterSpacing: 1.2, color: WHIMSY.slopBand },
	title: {
		...TYPE.sectionTitle,
		color: WHIMSY.paper,
		marginTop: 1,
		textShadowColor: "rgba(0,0,0,0.55)",
		textShadowOffset: { width: 0, height: 2 },
		textShadowRadius: 3,
	},
	leavePill: {
		flexShrink: 0,
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.sm,
		borderRadius: RADII.pill,
		borderWidth: 2,
		borderColor: INK,
		backgroundColor: WHIMSY.paper,
		...sticker,
	},
	leaveText: { ...TYPE.label, color: INK },
  partingScrim: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
    backgroundColor: MODAL_BACKDROP_BG,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACE.xl,
  },
  partingCard: {
    width: "100%",
    maxWidth: 390,
    backgroundColor: WHIMSY.cream,
    borderWidth: 2,
    borderColor: INK,
    borderRadius: RADII.xxl,
    padding: SPACE.lg,
    ...sticker,
  },
  partingKicker: {
    ...TYPE.kicker,
    color: WHIMSY.slopBand,
    textAlign: "center",
  },
  partingTitle: {
    ...TYPE.sectionTitle,
    color: INK,
    textAlign: "center",
    marginTop: SPACE.xs,
  },
  partingBody: {
    ...TYPE.body,
    color: WHIMSY.mute,
    textAlign: "center",
    marginTop: SPACE.xs,
  },
  partingGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: SPACE.sm,
    marginTop: SPACE.lg,
  },
  partingChoice: {
    width: "30%",
    minWidth: 82,
    alignItems: "center",
    paddingVertical: SPACE.sm,
    borderWidth: 1.5,
    borderColor: INK,
    borderRadius: RADII.lg,
    backgroundColor: WHIMSY.paper,
  },
  partingChoiceSelected: { backgroundColor: WHIMSY.sun, borderWidth: 2 },
  partingImage: { width: 58, height: 58 },
  partingLabel: {
    ...TYPE.kickerPill,
    color: INK,
    marginTop: 2,
    textAlign: "center",
  },
  partingError: {
    ...TYPE.bodySm,
    color: WHIMSY.roseDeep,
    textAlign: "center",
    marginTop: SPACE.sm,
  },
  partingSkip: { alignSelf: "center", padding: SPACE.sm, marginTop: SPACE.sm },
  partingSkipText: {
    ...TYPE.bodySm,
    color: WHIMSY.mute,
    textDecorationLine: "underline",
  },
  stampScrim: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 43,
    backgroundColor: MODAL_BACKDROP_BG,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: SPACE.lg,
    paddingBottom: 34,
  },
  stampCard: {
    width: "100%",
    maxWidth: 390,
    backgroundColor: WHIMSY.paper,
    borderWidth: 2,
    borderColor: WHIMSY.ink,
    borderRadius: RADII.xl,
    paddingHorizontal: SPACE.lg,
    paddingTop: SPACE.lg,
    paddingBottom: SPACE.md,
    ...SHADOW_SM,
  },
  stampKicker: { ...TYPE.kicker, color: WHIMSY.roseDeep, textAlign: "center" },
  stampTitle: {
    ...TYPE.sectionTitle,
    color: WHIMSY.ink,
    textAlign: "center",
    marginTop: SPACE.xs,
  },
  stampBody: {
    ...TYPE.body,
    color: WHIMSY.mute,
    textAlign: "center",
    marginTop: SPACE.xs,
  },
  stampChoices: {
    flexDirection: "row",
    gap: SPACE.sm,
    marginTop: SPACE.md,
  },
  stampChoice: {
    flex: 1,
    minHeight: 76,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACE.xs,
    paddingVertical: SPACE.sm,
    backgroundColor: WHIMSY.cream,
    borderWidth: 1.5,
    borderColor: WHIMSY.ink,
    borderRadius: RADII.md,
  },
  stampChoiceSelected: { backgroundColor: WHIMSY.sun, borderWidth: 2 },
  stampLabel: {
    ...TYPE.kickerPill,
    color: WHIMSY.ink,
    textAlign: "center",
    marginTop: SPACE.xs,
  },
  stampError: {
    ...TYPE.bodySm,
    color: WHIMSY.roseDeep,
    textAlign: "center",
    marginTop: SPACE.sm,
  },
  stampSkip: { alignSelf: "center", padding: SPACE.sm, marginTop: SPACE.xs },
  stampSkipText: {
    ...TYPE.bodySm,
    color: WHIMSY.mute,
    textDecorationLine: "underline",
  },
  kindnessIcon: {
    width: 72,
    height: 72,
    resizeMode: "contain",
    alignSelf: "center",
    marginVertical: SPACE.sm,
  },
  kindnessSend: {
    alignSelf: "stretch",
    alignItems: "center",
    marginTop: SPACE.md,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
    backgroundColor: WHIMSY.sun,
    borderWidth: 2,
    borderColor: WHIMSY.ink,
    borderRadius: RADII.md,
    ...SHADOW_SM,
  },
  kindnessSendText: {
    ...TYPE.sectionTitle,
    fontSize: 15,
    color: WHIMSY.ink,
    textAlign: "center",
  },

	heartCard: {
		flexDirection: "row",
		alignItems: "stretch",
		marginTop: SPACE.lg - 2,
		borderWidth: 2,
		borderColor: INK,
		borderRadius: RADII.xl,
		backgroundColor: WHIMSY.paper,
		overflow: "hidden",
		...sticker,
	},
	heartDivider: { width: 2, backgroundColor: INK, opacity: 0.45 },
  tally: {
    flex: 1,
    paddingVertical: SPACE.sm + 2,
    alignItems: "center",
    overflow: "hidden",
  },
	tallyTick: {
		position: "absolute",
		top: 2,
		flexDirection: "row",
		alignItems: "center",
		gap: 2,
		zIndex: 3,
	},
  tallyTickText: {
    fontFamily: FONTS.whimsy,
    fontSize: 13,
    color: WHIMSY.roseDeep,
  },
	tallyRow: { flexDirection: "row", alignItems: "center", gap: SPACE.xs + 1 },
	tallyNum: { ...TYPE.sectionTitle, color: INK },
  tallyLabel: {
    ...TYPE.kickerPill,
    letterSpacing: 1,
    color: WHIMSY.mute,
    marginTop: SPACE.xs,
  },
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
	guestbookAction: {
		minHeight: 44,
		alignSelf: "flex-end",
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: SPACE.sm,
		marginTop: SPACE.md,
		paddingHorizontal: SPACE.lg,
		borderWidth: 2,
		borderColor: INK,
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.paper,
		...sticker,
	},
	guestbookActionPressed: {
		transform: [{ translateX: 1 }, { translateY: 1 }],
	},
	guestbookActionText: {
		...TYPE.label,
		color: INK,
	},
	// Visits-left chip — a gold-accent sticker in the header, under the title.
	// "2 of 3 visits left · resets in 2h" — the visit's headline stat, up front.
	visitsChip: {
		marginTop: SPACE.sm,
		alignSelf: "flex-start",
		backgroundColor: WHIMSY.slopBand,
		borderWidth: 2,
		borderColor: INK,
		borderRadius: RADII.lg,
		paddingHorizontal: SPACE.md,
		paddingVertical: 5,
		...sticker,
	},
	visitsChipText: { ...TYPE.label, letterSpacing: 0, color: INK },
	visitsChipNum: { fontFamily: FONTS.whimsy, fontSize: 14 },

	stage: { flex: 1, paddingBottom: 18 },
	// The depth diorama: two pigs absolutely placed, staggered for a sense of depth.
	diorama: { flex: 1, position: "relative" },
	spotlight: {
		position: "absolute",
		alignSelf: "center",
		bottom: "6%",
		width: 300,
		height: 220,
		borderRadius: 150,
		backgroundColor: "rgba(255,249,228,0.35)",
		opacity: 0.7,
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
	float: { position: "absolute", bottom: "60%", fontFamily: FONTS.whimsy },
	pigBox: { alignItems: "center", justifyContent: "center" },
  groundShadow: {
    position: "absolute",
    bottom: "11%",
    height: 13,
    borderRadius: RADII.pill,
    backgroundColor: "rgba(42,31,21,0.22)",
  },
  nameTag: {
    marginTop: -8,
    borderWidth: 2,
    borderColor: INK,
    borderRadius: RADII.pill,
    ...sticker,
  },
  nameTagYou: {
    backgroundColor: WHIMSY.paper,
    paddingHorizontal: SPACE.md,
    paddingVertical: 2,
  },
  nameTagFriend: {
    backgroundColor: WHIMSY.sun,
    paddingHorizontal: SPACE.md,
    paddingVertical: 3,
  },
  nameTagText: {
    fontFamily: FONTS.whimsy,
    fontSize: 12,
    color: INK,
    maxWidth: 130,
    textAlign: "center",
  },

	// Match the main Barn's compact upper-left bury control, but dig here.
  visitTruffleControl: {
    position: "absolute",
    left: SPACE.lg,
    top: SPACE.md,
    zIndex: 6,
  },
	truffleFoundWrap: {
		position: "absolute",
		left: SPACE.lg,
		top: SPACE.md,
		zIndex: 6,
		maxWidth: "84%", // cooldown note is a full sentence — wrap, don't overflow
		backgroundColor: WHIMSY.sun,
		borderWidth: 2,
		borderColor: INK,
		borderRadius: RADII.pill,
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.xs + 1,
		...sticker,
	},
	truffleFoundRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  truffleFound: {
    fontFamily: FONTS.whimsy,
    fontSize: 14,
    color: INK,
    flexShrink: 1,
  },

	// Barn-forage Golden Truffle reveal — a cozy sticker banner above the pigs.
	forageReveal: {
		position: "absolute",
		top: "6%",
		alignSelf: "center",
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.md - 2,
		maxWidth: "88%",
		backgroundColor: WHIMSY.paper,
		borderWidth: 2,
		borderColor: INK,
		borderRadius: RADII.lg,
		paddingHorizontal: SPACE.lg - 2,
		paddingVertical: SPACE.sm + 2,
		zIndex: 7,
		...sticker,
	},
	forageTruffle: { width: 38, height: 38 },
	forageTextWrap: { flexShrink: 1 },
  forageKicker: {
    ...TYPE.kicker,
    fontSize: 11,
    letterSpacing: 1,
    color: WHIMSY.accent,
  },
  forageTitle: {
    fontFamily: FONTS.whimsy,
    fontSize: 15,
    color: INK,
    marginTop: 1,
  },
	forageSub: { ...TYPE.hand, fontSize: 12, color: WHIMSY.mute, marginTop: 1 },

	// Post-tickle callout — sits in normal flow BELOW the tally band with its
	// own breathing room, so it never covers the hearts. Centered under the band.
	ticklesPopWrap: { marginTop: SPACE.md, alignItems: "center" },
	ticklesPop: {
		alignSelf: "center",
		backgroundColor: WHIMSY.rose,
		borderWidth: 2,
		borderColor: INK,
		borderRadius: RADII.md,
		paddingHorizontal: SPACE.lg,
		paddingVertical: SPACE.sm,
		alignItems: "center",
		...sticker,
	},
	ticklesPopTitle: { fontFamily: FONTS.whimsy, fontSize: 14, color: INK },
  ticklesPopSub: {
    ...TYPE.kicker,
    fontSize: 11,
    color: WHIMSY.mute,
    marginTop: 1,
  },
	// Tail on TOP, pointing UP at the tally band it's celebrating.
	ticklesPopTail: {
		position: "absolute",
		top: -8,
		alignSelf: "center",
		width: 0,
		height: 0,
		borderLeftWidth: 7,
		borderRightWidth: 7,
		borderBottomWidth: 8,
		borderLeftColor: "transparent",
		borderRightColor: "transparent",
		borderBottomColor: INK,
	},

  napScrim: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    backgroundColor: MODAL_BACKDROP_BG,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACE.xl - 4,
  },
	napCard: {
		width: "100%",
		maxWidth: 320,
		backgroundColor: WHIMSY.paper,
		borderWidth: 2,
		borderColor: INK,
		borderRadius: RADII.xl,
		padding: SPACE.xl - 2,
		alignItems: "center",
		...sticker,
	},
	napGlyph: {},
  napKicker: {
    ...TYPE.kicker,
    letterSpacing: 1,
    color: WHIMSY.accent,
    marginTop: SPACE.xs + 2,
  },
	napTitle: { ...TYPE.pageTitle, color: INK, marginTop: 2 },
  napBody: {
    ...TYPE.body,
    lineHeight: 22,
    color: WHIMSY.mute,
    textAlign: "center",
    marginTop: SPACE.sm,
    marginBottom: SPACE.lg,
  },
	napStats: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-around",
		alignSelf: "stretch",
		backgroundColor: WHIMSY.cream,
		borderWidth: 2,
		borderColor: INK,
		borderRadius: RADII.md,
		paddingVertical: SPACE.sm + 2,
		marginBottom: SPACE.lg,
	},
	napStat: { flex: 1, alignItems: "center", paddingHorizontal: SPACE.xs + 2 },
  napStatNumRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
	napStatNum: { fontFamily: FONTS.whimsy, fontSize: 18, color: INK },
  napStatLabel: {
    ...TYPE.kickerPill,
    letterSpacing: 0.5,
    textTransform: "none",
    color: WHIMSY.mute,
    marginTop: 2,
    textAlign: "center",
  },
  napStatDivider: {
    width: 2,
    alignSelf: "stretch",
    backgroundColor: INK,
    opacity: 0.5,
  },
  napBtn: {
    alignSelf: "stretch",
    backgroundColor: WHIMSY.sun,
    borderWidth: 2,
    borderColor: INK,
    borderRadius: RADII.lg,
    paddingVertical: SPACE.md,
    alignItems: "center",
    ...sticker,
  },
	napBtnText: { ...TYPE.numeral, fontSize: 17, color: INK },
});
