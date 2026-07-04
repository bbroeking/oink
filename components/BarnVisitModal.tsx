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
	Dimensions,
	Image,
	ActivityIndicator,
	StyleSheet,
	Animated,
	Easing,
	type StyleProp,
	type ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "@/utils/supabase";
import { rpcAction } from "@/utils/rpc";
import { PigStage, type EquippedItem } from "./ui/PigStage";
import { Shovel } from "./ui/Shovel";
import { Glyph, IconText, glyphSource } from "./ui/Glyph";
import { SnoutCoin } from "./ui/SnoutCoin";
import { HAT_IMAGES } from "@/constants/hats";
import { FONTS, WHIMSY, SHADOW_SM } from "@/constants/theme";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

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
const EMPTY_EQUIP: EquipSet = { hat: null, glasses: null, mask: null, neck: null, aura: null, held: null };

// Shape of a joined `hats` row (to-one FK). Supabase may surface a to-one embed
// as a single object or a single-element array depending on the relation hint.
type HatRow = { id?: string; category?: string | null; emoji?: string | null } | null;
const one = (v: HatRow | HatRow[]): HatRow => (Array.isArray(v) ? v[0] ?? null : v ?? null);
const toSlot = (v: HatRow | HatRow[]): Slot => {
	const row = one(v);
	return row && row.id ? { id: row.id, category: row.category ?? null, emoji: row.emoji ?? null } : null;
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
}

interface MyProfileRow extends ProfileEquipRow {
	tickles_earned: number | null;
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

export function BarnVisitModal({ targetUserId, targetName, onClose }: Props) {
	const [barn, setBarn] = useState<Barn | null>(null);
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);

	// Live lifetime tickle totals (seeded from each profile's tickles_earned),
	// then both tick up together by one on every tap.
	const [youHearts, setYouHearts] = useState(0);
	const [friendHearts, setFriendHearts] = useState(0);
	// Hearts shared THIS visit only — for the nap summary.
	const [gained, setGained] = useState(0);

	// Tap-session: the friend's pig tires over a random 3–7 taps. The CAP is now
	// rolled and enforced server-side (tickle_at_barn / barn_visit_status), so we
	// seed tapCap from the server and the bar matches what it will actually allow.
	// Default 7 (full bar) until the server reports the roll on first status/tap.
	const [tapCount, setTapCount] = useState(0);
	const [tapCap, setTapCap] = useState(1);
	const [tired, setTired] = useState(false);
	// Your shared visit budget: 3 different friends per window. All 3 refresh
	// together 3h after your first visit. Server-authoritative (barn_visit_status).
	const [visitsLeft, setVisitsLeft] = useState<number | null>(null);
	const [visitBudget, setVisitBudget] = useState(3);
	const [visitsRefreshAt, setVisitsRefreshAt] = useState<string | null>(null);
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
				.select(`username, tickles_earned, active_background_id, ${EQUIP_SELECT}`)
				.eq("id", targetUserId)
				.maybeSingle();
			if (cancelled || !data) {
				setLoading(false);
				return;
			}
			const d = data as unknown as BarnProfileRow;
			setBarn({
				username: d.username ?? null,
				tickles_earned: d.tickles_earned ?? 0,
				active_background_id: d.active_background_id ?? null,
			});
			setHostEquip(rowToEquip(d));
			setFriendHearts(d.tickles_earned ?? 0); // live base for the HOST tally

			const { data: ures } = await supabase.auth.getUser();
			if (ures.user) {
				const { data: me } = await supabase
					.from("profiles")
					.select(`tickles_earned, ${EQUIP_SELECT}`)
					.eq("id", ures.user.id)
					.maybeSingle();
				if (!cancelled && me) {
					const m = me as unknown as MyProfileRow;
					setMyEquip(rowToEquip(m));
					setYouHearts(m.tickles_earned ?? 0); // live base for the YOU tally
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
			}>("barn_visit_status", { p_target: targetUserId });
			if (!cancelled && st.ok) {
				if (st.locked) {
					setLockedUntil(st.next_at ?? null);
					setRestingOnArrival(true);
				}
				if (st.resting) setRestingOnArrival(true);
				if (st.tap_cap != null) {
					setTapCap(st.tap_cap);
					if (st.taps_left != null) setTapCount(st.tap_cap - st.taps_left);
				}
				// Your 3-visits-per-window budget, for the "visits left" bar.
				if (st.visits_left != null) setVisitsLeft(st.visits_left);
				if (st.visit_budget != null) setVisitBudget(st.visit_budget);
				setVisitsRefreshAt(st.visits_refresh_at ?? null);
			}
			setLoading(false);
		})();
		return () => {
			cancelled = true;
		};
	}, [targetUserId]);

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
		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
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
				Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
			}
			setYouHearts((n) => n + 1);
			setFriendHearts((n) => n + 1);
			setGained((g) => g + 1);
			if (r.tap_cap != null) setTapCap(r.tap_cap);
			if (r.visits_left != null) setVisitsLeft(r.visits_left);
			if (r.visits_refresh_at !== undefined)
				setVisitsRefreshAt(r.visits_refresh_at ?? null);
			setTapCount(tapCount + 1);
			// Server is authoritative on when the visit is spent: taps_left is the
			// remaining tickles of this visit's 3–7 cap and hits 0 exactly on the
			// cap-hitting tap. Gate on THAT, not local tapCap state — the cap is
			// rolled server-side on the first tap, so the freshly-returned value is
			// the only reliable signal (local tapCap is still its seed here). The
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
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
			setLockedUntil(r.next_at ?? null);
			setRestingOnArrival(true);
		}
	};

	const dig = async () => {
		if (digging || dug != null) return;
		setDigging(true);
		const r = await rpcAction<{ reward?: number; remaining?: number; next_at?: string | null }>(
			"dig_truffle",
			{ p_host: targetUserId }
		);
		setDigging(false);
		if (r.ok) {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
			setTruffleAvail(false);
			setDug(r.reward ?? 0);
		} else if (r.reason === "dig_cooldown") {
			// Re-dig cooldown (server 20260629): the pot allows another bite per
			// visitor every 3h, so this shovel isn't spent forever — retire it for
			// now with the wait time so coming back later reads as worthwhile.
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
			setTruffleAvail(false);
			setDigNote(`You've dug here recently — come back in ${lockLabel(r.next_at ?? null)}.`);
		} else if (r.reason === "none" || r.reason === "already_dug") {
			// Terminal: someone else emptied the shared pot first — or, on a server
			// older than 20260629 (one dig EVER, no re-dig cooldown), we already
			// took our share. The shovel is genuinely spent — retire it with a note
			// instead of vanishing silently.
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
			setTruffleAvail(false);
			setDigNote("Already dug up!");
		} else {
			// Transient (network / SQL) failure — keep the shovel tappable so the
			// dig can be retried rather than disappearing with no reward.
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
		}
	};

	// Your visit budget (display only): how many of your 3 visits remain this
	// window. All 3 refresh together 3h after your first visit.
	const vLeft = visitsLeft ?? visitBudget;
	const visitsColor = vLeft > 1 ? "#62b048" : vLeft === 1 ? "#e8a82e" : "#ef7a5a";
	// Show the reset countdown whenever a window is active (you've used ≥1).
	const visitsFreshIn = visitsRefreshAt ? lockLabel(visitsRefreshAt) : null;

	// Shared squish transform entries for both pigs. Passed as an ARRAY so each
	// pig can compose it WITH its own { scale } in one transform list — a second
	// `transform` style object would clobber the scale and render the pig at full
	// 300px (clipped to nothing in its box).
	const squishTransform = [
		{ scaleX: squish.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] }) },
		{ scaleY: squish.interpolate({ inputRange: [0, 1], outputRange: [1, 0.93] }) },
	];
	const tickStyle = {
		opacity: tick.interpolate({ inputRange: [0, 0.2, 0.9, 1], outputRange: [0, 1, 1, 0] }),
		transform: [{ translateY: tick.interpolate({ inputRange: [0, 1], outputRange: [4, -16] }) }],
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
				style={{ position: "absolute", top: 0, left: -2, width: SCREEN_W + 4, height: SCREEN_H }}
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
					<ActivityIndicator color={WHIMSY.paper} style={{ marginTop: 120 }} />
				) : (
					<>
						{/* ===== top chrome ===== */}
						<View style={styles.chrome}>
							<View style={styles.headerRow}>
								<View style={{ flexShrink: 1 }}>
									<IconText left={<Glyph name="star" size={12} />} gap={4}>
										<Text style={styles.kicker}>VISITING</Text>
									</IconText>
									<Text style={styles.title} numberOfLines={1}>
										{targetName}'s Barn
									</Text>
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
										onClose();
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
									<Glyph name="heart" size={15} />
								</Animated.View>
							</View>

							{/* Visits remaining — a plain status line, NOT a progress
							    bar. You don't track "how full" your visits are; you just
							    want "2 of 3 left · resets in 2h". One tickle per friend. */}
							<View style={styles.visitsLine}>
								<IconText left={<Glyph name="sparkle" size={13} />} gap={6}>
									<Text style={styles.visitsLineText}>
										<Text style={[styles.visitsLineNum, { color: visitsColor }]}>
											{vLeft} of {visitBudget}
										</Text>
										<Text> Barn visits left</Text>
										{visitsFreshIn ? (
											<Text style={styles.visitsLineMute}>
												{"  ·  resets in "}
												{visitsFreshIn}
											</Text>
										) : null}
									</Text>
								</IconText>

								{/* post-tickle nudge — go spread the love to another friend */}
								{tired && !restingOnArrival && !napOpen && (
									<View style={styles.ticklesPop} pointerEvents="none">
										<Text style={styles.ticklesPopTitle}>Tickled!</Text>
										<Text style={styles.ticklesPopSub}>
											{vLeft > 0
												? "go tickle another friend"
												: "tap Leave when you're ready"}
										</Text>
										<View style={styles.ticklesPopTail} />
									</View>
								)}
							</View>
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
										<Image source={HAT_IMAGES.golden_truffle} style={styles.forageTruffle} resizeMode="contain" />
										<View style={styles.forageTextWrap}>
											<IconText left={<Glyph name="sparkle" size={12} />} gap={4}>
												<Text style={styles.forageKicker}>A GLINT IN THE HAY</Text>
											</IconText>
											<Text style={styles.forageTitle}>You uncovered a Golden Truffle!</Text>
											<Text style={styles.forageSub}>One the Great Hungerer missed.</Text>
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
									equip={myEquip}
									tired={tired}
									floats={floats}
								/>
								{/* host — up front: bigger, lower, shifted right (the pig you tickle) */}
								<TapPig
									slotStyle={[styles.pigSlot, styles.pigSlotFront]}
									squishTransform={squishTransform}
									onPress={tickle}
									label={barn?.username ?? targetName}
									equip={hostEquip}
									tired={tired}
									floats={floats}
								/>

								{/* barn truffle — a cartoony shovel planted in the ground, tucked
								    near the front pig's feet so it's an easy, quick tap. */}
								{dug != null ? (
									<View pointerEvents="none" style={[styles.truffleFoundWrap, styles.truffleFoundRow]}>
										<SnoutCoin size={16} />
										<Glyph name="sparkles" size={14} />
										<Text style={styles.truffleFound}>+{dug} snouts!</Text>
									</View>
								) : digNote != null ? (
									<View pointerEvents="none" style={[styles.truffleFoundWrap, styles.truffleFoundRow]}>
										<Glyph name="pigface" size={14} />
										<Text style={styles.truffleFound}>{digNote}</Text>
									</View>
								) : truffleAvail && !tired ? (
									<DigSpot digging={digging} onPress={dig} />
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
											: `The pigs need a rest! You can visit 3 different Barns every 3 hours — and each friend just once a day. Come back soon to tickle more.`}
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
													<Text style={styles.napStatLabel}>until you can visit again</Text>
												</View>
											</>
										)}
									</View>
									<Pressable onPress={onClose} style={styles.napBtn}>
										<IconText right={<Glyph name="arrowRight" size={14} />} gap={6}>
										<Text style={styles.napBtnText}>Head home</Text>
									</IconText>
									</Pressable>
								</View>
							</View>
						)}
					</>
				)}
			</View>
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

// The dig affordance: a tappable shovel planted in a little dirt mound, set in
// the scene near the pigs (not tucked at the far bottom) for a quick, easy tap.
function DigSpot({ digging, onPress }: { digging: boolean; onPress: () => void }) {
	const bob = useRef(new Animated.Value(0)).current;
	const wig = useRef(new Animated.Value(0)).current;
	const pulse = useRef(new Animated.Value(0)).current;
	useEffect(() => {
		const loop = Animated.loop(
			Animated.sequence([
				Animated.timing(bob, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
				Animated.timing(bob, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
			])
		);
		loop.start();
		// Attract pulse — a ring that expands + fades to draw the eye to the
		// (otherwise easy-to-miss) dig spot.
		const pulseLoop = Animated.loop(
			Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true })
		);
		pulseLoop.start();
		return () => {
			loop.stop();
			pulseLoop.stop();
		};
	}, [bob, pulse]);
	const press = () => {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
		wig.setValue(0);
		Animated.sequence([
			Animated.timing(wig, { toValue: 1, duration: 80, useNativeDriver: true }),
			Animated.timing(wig, { toValue: -1, duration: 80, useNativeDriver: true }),
			Animated.spring(wig, { toValue: 0, friction: 4, tension: 140, useNativeDriver: true }),
		]).start();
		onPress();
	};
	const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -5] });
	// Rests at a slight planted tilt; wiggles on press.
	const rotate = wig.interpolate({ inputRange: [-1, 0, 1], outputRange: ["-26deg", "-12deg", "4deg"] });
	return (
		<Pressable onPress={press} disabled={digging} style={styles.digSpot} hitSlop={24}>
			<Animated.View
				pointerEvents="none"
				style={[
					styles.digPulse,
					{
						opacity: pulse.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.5, 0.15, 0] }),
						transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.8] }) }],
					},
				]}
			/>
			<Glyph name="sparkle" size={18} style={styles.digSparkle} />
			<Animated.View style={{ transform: [{ translateY }, { rotate }] }}>
				<Shovel size={64} />
			</Animated.View>
			<View style={styles.dirtMound} />
			<View style={styles.digPill}>
				<Text style={styles.digPillText}>{digging ? "digging…" : "Dig for a truffle!"}</Text>
			</View>
		</Pressable>
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
	equip,
	tired,
	floats,
}: {
	me?: boolean;
	slotStyle?: StyleProp<ViewStyle>;
	// Shared squish transform entries — composed WITH this pig's own scale.
	squishTransform: (
			| { scaleX: Animated.AnimatedInterpolation<number> }
			| { scaleY: Animated.AnimatedInterpolation<number> }
		)[]
	onPress: () => void;
	label: string;
	equip: EquipSet;
	tired: boolean;
	floats: { id: number; anim: Animated.Value; rx: number; star: boolean }[];
}) {
	const front = !me; // the host pig you're visiting reads as nearer/larger
	const scale = front ? 0.66 : 0.44;
	const box = front ? 212 : 146;
	const shadowW = box * 0.5;
	return (
		<Pressable onPress={onPress} style={slotStyle}>
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
									opacity: f.anim.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 1, 0] }),
									transform: [
										{ translateX: f.rx * (front ? 1 : 0.6) },
										{ translateY: f.anim.interpolate({ inputRange: [0, 1], outputRange: [10, -96] }) },
										{ scale: f.anim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.5, 1.1, 0.9] }) },
									],
								},
							]}
						/>
					);
				})}
			</View>
			<View style={[styles.pigBox, { width: box, height: box }]}>
				<View pointerEvents="none" style={[styles.groundShadow, { width: shadowW, left: (box - shadowW) / 2 }]} />
				<Animated.View style={{ transform: [{ scale }, ...squishTransform] }}>
					<PigStage
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
			<View style={[styles.nameTag, me ? styles.nameTagYou : styles.nameTagFriend]}>
				<Text style={[styles.nameTagText, front && { fontSize: 14 }]} numberOfLines={1}>
					{label}
				</Text>
			</View>
		</Pressable>
	);
}

const INK = WHIMSY.ink;
const sticker = SHADOW_SM;

const styles = StyleSheet.create({
	root: { ...StyleSheet.absoluteFillObject, zIndex: 100, backgroundColor: WHIMSY.cream },
	content: { flex: 1 },
	topFade: { position: "absolute", top: 0, left: 0, right: 0, height: 190 },

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
		flexDirection: "row",
		alignItems: "center",
		gap: 2,
		zIndex: 3,
	},
	tallyTickText: { fontFamily: FONTS.whimsy, fontSize: 13, color: WHIMSY.roseDeep },
	tallyRow: { flexDirection: "row", alignItems: "center", gap: 5 },
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
	// Plain "2 of 3 Barn visits left · resets in 2h" status line (no bar).
	visitsLine: {
		marginTop: 9,
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: 6,
	},
	visitsLineText: { fontFamily: FONTS.bodyExtra, fontSize: 13, color: INK },
	visitsLineNum: { fontFamily: FONTS.whimsy, fontSize: 15 },
	visitsLineMute: { fontFamily: FONTS.bodyExtra, fontSize: 13, color: WHIMSY.mute },
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
	floatLayer: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center", zIndex: 5 },
	float: { position: "absolute", bottom: "60%", fontFamily: FONTS.whimsy },
	pigBox: { alignItems: "center", justifyContent: "center" },
	groundShadow: { position: "absolute", bottom: "11%", height: 13, borderRadius: 999, backgroundColor: "rgba(42,31,21,0.22)" },
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

	// Dig spot — a planted shovel near the pigs' feet (low-left, off the host).
	digSpot: { position: "absolute", left: "8%", bottom: "9%", alignItems: "center", zIndex: 6 },
	digPulse: {
		position: "absolute",
		top: 10,
		width: 76,
		height: 76,
		borderRadius: 38,
		borderWidth: 3,
		borderColor: WHIMSY.sun,
	},
	digSparkle: { position: "absolute", top: -10, left: "60%", zIndex: 2 },
	dirtMound: { width: 52, height: 15, borderRadius: 999, backgroundColor: "#8a5a36", borderWidth: 2, borderColor: INK, marginTop: -11 },
	digPill: {
		marginTop: 5,
		backgroundColor: WHIMSY.sun,
		borderWidth: 2,
		borderColor: INK,
		borderRadius: 999,
		paddingHorizontal: 14,
		paddingVertical: 5,
		...sticker,
	},
	digPillText: { fontFamily: FONTS.whimsy, fontSize: 14, color: INK },
	truffleFoundWrap: {
		position: "absolute",
		left: "8%",
		bottom: "11%",
		zIndex: 6,
		maxWidth: "84%", // cooldown note is a full sentence — wrap, don't overflow
		backgroundColor: WHIMSY.sun,
		borderWidth: 2,
		borderColor: INK,
		borderRadius: 999,
		paddingHorizontal: 12,
		paddingVertical: 5,
		...sticker,
	},
	truffleFoundRow: { flexDirection: "row", alignItems: "center", gap: 5 },
	truffleFound: { fontFamily: FONTS.whimsy, fontSize: 14, color: INK, flexShrink: 1 },

	// Barn-forage Golden Truffle reveal — a cozy sticker banner above the pigs.
	forageReveal: {
		position: "absolute",
		top: "6%",
		alignSelf: "center",
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		maxWidth: "88%",
		backgroundColor: WHIMSY.paper,
		borderWidth: 2,
		borderColor: INK,
		borderRadius: 16,
		paddingHorizontal: 14,
		paddingVertical: 10,
		zIndex: 7,
		...sticker,
	},
	forageTruffle: { width: 38, height: 38 },
	forageTextWrap: { flexShrink: 1 },
	forageKicker: { fontFamily: FONTS.hand, fontSize: 11, letterSpacing: 1, color: WHIMSY.accent },
	forageTitle: { fontFamily: FONTS.whimsy, fontSize: 15, color: INK, marginTop: 1 },
	forageSub: { fontFamily: FONTS.hand, fontSize: 12, color: WHIMSY.mute, marginTop: 1 },

	// Out-of-tickles callout — anchored just above the YOUR TICKLES bar.
	ticklesPop: {
		position: "absolute",
		bottom: "100%",
		marginBottom: 8,
		alignSelf: "center",
		backgroundColor: WHIMSY.rose,
		borderWidth: 2,
		borderColor: INK,
		borderRadius: 12,
		paddingHorizontal: 14,
		paddingVertical: 7,
		alignItems: "center",
		zIndex: 30,
		...sticker,
	},
	ticklesPopTitle: { fontFamily: FONTS.whimsy, fontSize: 14, color: INK },
	ticklesPopSub: { fontFamily: FONTS.hand, fontSize: 11.5, color: WHIMSY.mute, marginTop: 1 },
	ticklesPopTail: {
		position: "absolute",
		bottom: -7,
		alignSelf: "center",
		width: 0,
		height: 0,
		borderLeftWidth: 7,
		borderRightWidth: 7,
		borderTopWidth: 8,
		borderLeftColor: "transparent",
		borderRightColor: "transparent",
		borderTopColor: INK,
	},

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
	napGlyph: {},
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
	napStatNumRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3 },
	napStatNum: { fontFamily: FONTS.whimsy, fontSize: 18, color: INK },
	napStatLabel: { fontFamily: FONTS.bodyExtra, fontSize: 9, letterSpacing: 0.5, color: WHIMSY.mute, marginTop: 2, textAlign: "center" },
	napStatDivider: { width: 2, alignSelf: "stretch", backgroundColor: INK, opacity: 0.5 },
	napBtn: { alignSelf: "stretch", backgroundColor: WHIMSY.sun, borderWidth: 2, borderColor: INK, borderRadius: 14, paddingVertical: 12, alignItems: "center", ...sticker },
	napBtnText: { fontFamily: FONTS.whimsy, fontSize: 17, color: INK },
});
