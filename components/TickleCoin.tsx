// The Barn's top-right corner: the coin. It is the LIVE number — how many
// tickles you can spend right now, out of how many — and it carries every
// other live thing with it: the streak stamped on its shoulder, the regen clock
// as one hand line under it, and (only while one is running) a lucky-pig or
// wallow ribbon hanging under that line. The permanent total lives across the
// sky on `EarnedStamp` and never comes over here.
//
// The rule this sets (taste-standard, 2026-09-13): a transient state joins the
// coin's corner as a line or a tag — it never gets a sticker of its own.
// From the two-corner layout (E) in docs/design/claude-design/barn/coin.html.
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Glyph, Hand, Label, T, Tag } from "./ui";
import {
	BORDER,
	OPACITY,
	PRESSED,
	RADII,
	SHADOW_SM,
	SPACE,
	STICKER_SHADOW,
	WHIMSY,
} from "@/constants/theme";
import { formatClockMS } from "@/utils/duration";

// --- ART -------------------------------------------------------------------
// Drawing geometry for one object, in points — the coin is a picture, so none
// of these borrow a step off the spacing scale.
const COIN = 100;
// The minted ring inside the rim.
const RING_INSET = 6;
// The sparkle chip on the coin's top-left edge, and how far it overhangs.
const CHIP = 30;
const CHIP_OVERHANG = -8;
const CHIP_GLYPH = 18;
// The streak stamp on the coin's lower-right shoulder: how far it overlaps
// the rim, and the flame riding it.
const STAMP_OVERLAP = -14;
const STAMP_RIGHT = 10;
const STREAK_GLYPH = 16;
// The room the coin keeps under itself for the stamp's overhang plus its hard
// shadow, so the clock line and the ribbon start BELOW the flame instead of
// under it. Reserved whether or not a streak is running, so nothing below the
// coin jumps when one starts (the lucky-pig ribbon sat on the flame, 2026-09-17).
const STAMP_ROOM = -STAMP_OVERLAP + SHADOW_SM.shadowOffset.height;
// Leans: the coin sits a touch clockwise, the marks on it a touch counter, so
// the corner reads as stuck on by hand rather than laid out.
const COIN_TILT = "4deg";
const CHIP_TILT = "-8deg";
const STAMP_TILT = "-3deg";
const RIBBON_TILT = "-1.5deg";
// The clock line is hand ink on the sky, so it wears a hairline of ink shadow
// to stay legible on a bright background — a text shadow, not a pill.
const CLOCK_SHADOW = { width: 0, height: 1 };
const CLOCK_SHADOW_RADIUS = 2;

interface Props {
	/** Tickles banked right now. */
	count: number;
	/** The bank's ceiling. Over-cap banks read "banked" instead of "of N". */
	cap: number;
	/** Days in the current tickle streak; 0 hides the stamp. */
	streak: number;
	/** The regen snapshot from the last stats fetch — null while unknown. */
	nextRegenSeconds: number | null;
	/** The true regen period (VIP, blessings, curses folded in). */
	regenSeconds: number;
	/** When that snapshot was taken, so the line can tick between fetches. */
	fetchedAtMs: number;
	/** The bank grew while we stared — ask for a quiet resync. */
	onRegenElapsed?: () => void;
	/** A live window on the bank ("Lucky pig · 3 left"), or nothing. */
	ribbon?: string;
	/** Tap on the coin: the bank's own explanation (a toast). */
	onPress: () => void;
	/** Tap on the streak stamp: the share sheet. */
	onShareStreak?: () => void;
	/** Whether the bank has loaded at all — the numeral mutes while it hasn't. */
	loaded?: boolean;
}

/**
 * The seconds until the next tickle lands, ticking off the last fetch. Repeat
 * reads used to re-show the same frozen snapshot; this subtracts the wall
 * clock once a second, rolls into the next cycle when one has landed, and asks
 * for a quiet resync once per snapshot when it does.
 */
function useRegenCountdown(
	nextRegenSeconds: number | null,
	regenSeconds: number,
	fetchedAtMs: number,
	live: boolean,
	onElapsed?: () => void,
) {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		if (!live || nextRegenSeconds == null) return;
		const id = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(id);
	}, [live, nextRegenSeconds, fetchedAtMs]);
	const raw =
		live && nextRegenSeconds != null
			? nextRegenSeconds - Math.floor((now - fetchedAtMs) / 1000)
			: null;
	const rolled = raw != null && raw <= 0;
	// One resync per snapshot: the fetch that answers moves `fetchedAtMs`, which
	// re-arms this for the next cycle.
	const asked = useRef<number | null>(null);
	useEffect(() => {
		if (!rolled || asked.current === fetchedAtMs) return;
		asked.current = fetchedAtMs;
		onElapsed?.();
	}, [rolled, fetchedAtMs, onElapsed]);
	if (raw == null) return null;
	if (!rolled) return raw;
	const period = Math.max(1, regenSeconds);
	return ((raw % period) + period) % period || period;
}

export function TickleCoin({
	count,
	cap,
	streak,
	nextRegenSeconds,
	regenSeconds,
	fetchedAtMs,
	onRegenElapsed,
	ribbon,
	onPress,
	onShareStreak,
	loaded = true,
}: Props) {
	const full = count >= cap;
	const remaining = useRegenCountdown(
		nextRegenSeconds,
		regenSeconds,
		fetchedAtMs,
		loaded && !full,
		onRegenElapsed,
	);
	const capLine = count > cap ? "banked" : `of ${cap}`;
	const spoken = [
		`${count} ${capLine === "banked" ? "tickles banked" : `of ${cap} tickles ready`}`,
		streak > 0 ? `${streak} day streak` : "",
		remaining != null ? `next in ${formatClockMS(remaining)}` : "",
		ribbon ?? "",
	]
		.filter(Boolean)
		.join(", ");

	return (
		<View style={styles.corner}>
			<View style={styles.coinWrap}>
				<Pressable
					onPress={onPress}
					accessibilityRole="button"
					accessibilityLabel={spoken}
					accessibilityHint="Shows when your next tickle arrives"
					style={({ pressed }) => [styles.coin, pressed && styles.coinPressed]}
				>
					<View pointerEvents="none" style={styles.ring} />
					<View style={styles.chip}>
						<Glyph name="sparkle" size={CHIP_GLYPH} />
					</View>
					<T
						role="displayLg"
						tone={loaded && count > 0 ? "primary" : "secondary"}
						numberOfLines={1}
						style={styles.numeral}
					>
						{loaded ? count : "·"}
					</T>
					<Hand tone="secondary" numberOfLines={1} style={styles.cap}>
						{capLine}
					</Hand>
				</Pressable>
				{/* THE STREAK IS A STAMP ON THE SHOULDER. Absolute and overlapping
				    the rim, so the coin's size never depends on whether a streak is
				    running, and the fire stays loud without a row of its own. */}
				{streak > 0 ? (
					<Pressable
						onPress={onShareStreak}
						disabled={!onShareStreak}
						hitSlop={SPACE.sm}
						accessibilityRole="button"
						accessibilityLabel={`Share your ${streak}-day tickle streak`}
						accessibilityHint="Opens the share sheet with your streak"
						style={({ pressed }) => [styles.stamp, pressed && styles.stampPressed]}
					>
						<Glyph name="flame" size={STREAK_GLYPH} />
						<Label>{streak}</Label>
					</Pressable>
				) : null}
			</View>
			{/* The regen clock: one hand line, nothing to tap. Gone while the bank
			    is full — a full bank has nothing to count down to. */}
			{remaining != null ? (
				<Hand tone="onDark" numberOfLines={1} style={styles.clock}>
					+1 in {formatClockMS(remaining)}
				</Hand>
			) : null}
			{ribbon ? (
				<Tag label={ribbon} tone="sun" glyph="sparkle" style={styles.ribbon} />
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	// The whole corner hangs off the right edge: coin, then line, then tag,
	// each right-aligned under the one above.
	corner: {
		alignItems: "flex-end",
		gap: SPACE.xs,
	},
	coinWrap: {
		width: COIN,
		height: COIN,
		marginBottom: STAMP_ROOM,
	},
	coin: {
		width: COIN,
		height: COIN,
		borderRadius: RADII.pill,
		borderWidth: BORDER.heavy,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.paper,
		alignItems: "center",
		justifyContent: "center",
		transform: [{ rotate: COIN_TILT }],
		// The full sticker shadow: the coin is the corner's one big object.
		...STICKER_SHADOW,
	},
	coinPressed: {
		...PRESSED,
		transform: [{ rotate: COIN_TILT }, { translateX: SPACE.xxs }, { translateY: SPACE.xxs }],
		elevation: 0,
	},
	// The minted ring: a dashed hairline just inside the rim.
	ring: {
		position: "absolute",
		top: RING_INSET,
		left: RING_INSET,
		right: RING_INSET,
		bottom: RING_INSET,
		borderRadius: RADII.pill,
		borderWidth: BORDER.ink,
		borderStyle: "dashed",
		borderColor: WHIMSY.ink,
		opacity: OPACITY.rule,
	},
	chip: {
		position: "absolute",
		top: CHIP_OVERHANG,
		left: CHIP_OVERHANG,
		width: CHIP,
		height: CHIP,
		borderRadius: RADII.pill,
		borderWidth: BORDER.ink,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.rose,
		alignItems: "center",
		justifyContent: "center",
		transform: [{ rotate: CHIP_TILT }],
		...SHADOW_SM,
	},
	numeral: {
		// The numeral sits on the coin's centre; the role's line box would push
		// it a hair low against the cap line beneath it.
		marginTop: -SPACE.xs,
	},
	cap: {
		marginTop: -SPACE.xs,
	},
	stamp: {
		position: "absolute",
		bottom: STAMP_OVERLAP,
		right: STAMP_RIGHT,
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.xs,
		paddingLeft: SPACE.xs,
		paddingRight: SPACE.sm,
		paddingVertical: SPACE.xxs,
		borderRadius: RADII.md,
		borderWidth: BORDER.ink,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.sun,
		transform: [{ rotate: STAMP_TILT }],
		...SHADOW_SM,
	},
	stampPressed: {
		...PRESSED,
		transform: [{ rotate: STAMP_TILT }, { translateX: SPACE.xxs }, { translateY: SPACE.xxs }],
		elevation: 0,
	},
	clock: {
		// No extra lead: `STAMP_ROOM` on the coin already clears the flame.
		textShadowColor: WHIMSY.ink,
		textShadowOffset: CLOCK_SHADOW,
		textShadowRadius: CLOCK_SHADOW_RADIUS,
	},
	ribbon: {
		transform: [{ rotate: RIBBON_TILT }],
	},
});
