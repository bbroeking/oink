import { useState } from "react";

// The stake-selection state machine shared by the two buried-truffle sheets
// (BuryTruffleSheet = open a fresh pot, BuriedTruffleSheet = top an existing
// one up). Both drive the identical fixed-chips + "Max" grid: a `sel` that is
// either a fixed amount or the sentinel "max", a `busy`/`note` pair for the RPC
// round-trip, and the same three derivations off them. Only the numbers differ
// per sheet, so they arrive as config:
//
//   floor    — the server minimum for a valid submit (MIN_STAKE when burying,
//              1 when topping up). Also the threshold the "Max" chip must clear
//              to stay enabled.
//   ceiling  — the upper bound a submit must sit under: the live balance when
//              burying, min(headroom, balance) when topping up.
//   maxStake — the concrete snout amount the "Max" chip resolves to, computed by
//              the caller from the pure helpers (maxBuryStake / maxTopUp). The
//              hook does no economy math itself — burySnouts.ts owns that.
//
// The pure pot math stays in utils/burySnouts.ts; the per-sheet floor, RPC name,
// refusal-reason copy, and chip styling stay in the sheets. This hook owns only
// the wiring the two sheets had each reimplemented.
export interface PotStakeConfig {
	// Fixed chip pre-selected on first mount (sel persists across re-opens, so
	// this is an initial value only — it is not re-applied when the sheet reopens).
	defaultSel: number;
	// Concrete "Max" amount for the current balance/pot (caller-computed).
	maxStake: number;
	// Server minimum for a valid submit / for the Max chip to be enabled.
	floor: number;
	// Upper bound a valid submit must not exceed.
	ceiling: number;
}

export interface PotStake {
	// Either a fixed chip amount or the "max" sentinel.
	sel: number | "max";
	// Select a chip: sets `sel` and clears any stale refusal note. Callers with
	// extra per-sheet reset (e.g. disarming a pending reclaim) chain their own
	// setter after this.
	select: (value: number | "max") => void;
	busy: boolean;
	setBusy: (b: boolean) => void;
	note: string | null;
	setNote: (n: string | null) => void;
	// Concrete snouts the action will move: the resolved Max amount, or the
	// selected fixed chip.
	stake: number;
	// Is the "Max" chip enabled? (its resolved amount clears the floor)
	maxOk: boolean;
	// Is the current selection a legal submit? (within [floor, ceiling])
	canSubmit: boolean;
}

export function usePotStake({ defaultSel, maxStake, floor, ceiling }: PotStakeConfig): PotStake {
	const [sel, setSel] = useState<number | "max">(defaultSel);
	const [busy, setBusy] = useState(false);
	const [note, setNote] = useState<string | null>(null);

	const stake = sel === "max" ? maxStake : sel;
	const maxOk = maxStake >= floor;
	const canSubmit = stake >= floor && stake <= ceiling;

	const select = (value: number | "max") => {
		setSel(value);
		setNote(null);
	};

	return { sel, select, busy, setBusy, note, setNote, stake, maxOk, canSubmit };
}
