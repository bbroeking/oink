// useRitualDoor — one ritual door's state machine, extracted.
//
// `useRitualCaster` owns the day (what today's blessing is, how many casts are
// left, what a cast came back as). THIS hook owns one *door*: busy / armed /
// settled / capped, the sentence that door says, and the press that moves it.
//
// It exists because the friend row draws the same door twice — the blessing
// and the curse, side by side in the panel the row's "…" opens. Both are the
// same machine; only the vocabulary differs, and the curse's two-tap arm is the
// one asymmetry (a hostile, irreversible send does not happen by accident).
// (2026-09-12; the tray it was extracted for became an actions menu 2026-09-14)

import { useCallback, useEffect, useRef, useState } from "react";
import type { ImageSourcePropType } from "react-native";
import { MOTION, WHIMSY } from "@/constants/theme";
import { untilDailyReset, type RitualMode } from "@/utils/rituals";
import type { CastOutcome, UseRitualCaster } from "@/hooks/useRitualCaster";

/** The per-mode drawing + vocabulary. One blessing, one curse, one voice each. */
export interface RitualDoorCopy {
	fill: string;
	glyph: "sparkle" | "cloud";
	verb: string;
	done: string;
	word: string;
	/** The action cell's short label — a verb, one word. */
	action: string;
}

export const RITUAL_DOOR: Record<RitualMode, RitualDoorCopy> = {
	bless: {
		fill: WHIMSY.sun,
		glyph: "sparkle",
		verb: "Bless",
		done: "Blessed",
		word: "blessing",
		action: "Bless",
	},
	curse: {
		// The curse pair's pale surface — the same paper an Inbox curse row sits
		// on, so a curse is one color everywhere it appears.
		fill: WHIMSY.curseSurface,
		glyph: "cloud",
		verb: "Curse",
		done: "Cursed",
		word: "curse",
		action: "Curse",
	},
};

// How long an armed curse stays armed. Three beats: long enough to move a thumb
// across the panel, short enough that a forgotten arm doesn't fire tomorrow.
// `disarm` is the other half: the arm dies with the panel that showed it.
const CURSE_ARM_MS = MOTION.beat * 3;

export type RitualDoorState = "ready" | "armed" | "busy" | "settled" | "capped";

export interface RitualDoorView {
	state: RitualDoorState;
	armed: boolean;
	disabled: boolean;
	/** The full sentence a screen reader hears. */
	label: string;
	/** What happens on press, or undefined when the door is resting. */
	hint: string | undefined;
	/** The same state in two or three words, for an action cell's state line. */
	sub: string;
	/** The cast ritual's own art, once this friend has today's ritual from you. */
	icon: ImageSourcePropType | null;
	/** The resting door's hand-drawn mark. */
	glyph: RitualDoorCopy["glyph"];
	copy: RitualDoorCopy;
	press: () => void;
	/** Drop an armed curse without casting it. */
	disarm: () => void;
}

export function useRitualDoor({
	mode,
	name,
	targetUserId,
	caster,
	onOutcome,
}: {
	mode: RitualMode;
	name: string;
	targetUserId: string;
	caster: UseRitualCaster;
	onOutcome: (mode: RitualMode, name: string, outcome: CastOutcome) => void;
}): RitualDoorView {
	const [busy, setBusy] = useState(false);
	// Curse only: the first tap arms, the second casts. A curse is a hostile,
	// irreversible send — it does not get to happen by accident.
	const [armed, setArmed] = useState(false);
	const disarmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const alive = useRef(true);
	useEffect(() => {
		alive.current = true;
		return () => {
			alive.current = false;
			if (disarmTimer.current) clearTimeout(disarmTimer.current);
		};
	}, []);

	const isBless = mode === "bless";
	const copy = RITUAL_DOOR[mode];
	const ritual = caster.today(mode);
	const usage = caster.usage(mode);
	const outcome = caster.outcomeFor(mode, targetUserId);
	const capped = usage?.remaining === 0 || outcome?.kind === "capped";
	// Sent and already-cast read the same: the ritual's own art on a resting
	// door. Both mean "this friend has today's ritual from you".
	const settled = outcome?.kind === "sent" || outcome?.kind === "done";
	const disabled = busy || capped || settled;

	const disarm = useCallback(() => {
		if (disarmTimer.current) clearTimeout(disarmTimer.current);
		setArmed(false);
	}, []);

	const press = useCallback(async () => {
		if (disabled) return;
		if (!isBless && !armed) {
			setArmed(true);
			if (disarmTimer.current) clearTimeout(disarmTimer.current);
			disarmTimer.current = setTimeout(() => {
				if (alive.current) setArmed(false);
			}, CURSE_ARM_MS);
			return;
		}
		if (disarmTimer.current) clearTimeout(disarmTimer.current);
		setArmed(false);
		setBusy(true);
		const r = await caster.cast(mode, targetUserId, name);
		if (alive.current) setBusy(false);
		onOutcome(mode, name, r);
	}, [armed, caster, disabled, isBless, mode, name, onOutcome, targetUserId]);

	const label = capped
		? usage
			? `All ${usage.cap} ${copy.word}s used today`
			: `No ${copy.word}s left today`
		: outcome?.kind === "sent"
			? `${copy.done} ${name} with ${ritual.name} today`
			: outcome?.kind === "done"
				? `Already ${copy.done.toLowerCase()} ${name} today; next in ${untilDailyReset()}`
				: armed
					? `Tap again to curse ${name}`
					: `${copy.verb} ${name} with ${ritual.name}`;

	const hint = disabled
		? undefined
		: isBless
			? "Casts today's blessing right away — it can't be taken back"
			: armed
				? "Casts today's curse right away — it can't be taken back"
				: `Arms today's curse. Tap again to cast it on ${name}.`;

	// The action cell's state line — the same register as the Visit cell's
	// ("3 left" / "Tickled today"), short enough to sit on one line inside a
	// fifth-width cell rather than clip. The full sentence above is what a
	// screen reader gets, and a narrow phone drops this line, never the sentence.
	const sub = capped
		? "None left"
		: settled
			? "Sent today"
			: busy
				? "Sending…"
				: armed
					? "Tap again"
					: isBless
						// The blessing reads like the Visit cell beside it — how many
						// are left today — because that is the only state it has.
						// The curse's line is the one place the arm gets explained.
						? usage
							? `${usage.remaining} left`
							: "Ready"
						: "Tap twice";

	const state: RitualDoorState = capped
		? "capped"
		: settled
			? "settled"
			: busy
				? "busy"
				: armed
					? "armed"
					: "ready";

	return {
		state,
		armed,
		disabled,
		label,
		hint,
		sub,
		icon: settled ? ritual.icon : null,
		glyph: copy.glyph,
		copy,
		press,
		disarm,
	};
}
