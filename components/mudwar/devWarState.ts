// __DEV__-only WarState override layer for the Mud Scuffle war page.
//
// Follows the MOCK_SOUNDERS precedent in app/clan-ladder.tsx: a design body
// so a real UI can be judged against tweakable data. Here it's a live-tweak
// harness — `useWarStateOverride` merges Brian's overrides over the REAL
// fetched war (or a synthesized mock when there's no war), and the war page
// renders the merged state through its normal components. Never ships: the
// hook is a no-op passthrough when `!__DEV__`, and nothing here is imported by
// a production path except behind that gate.
//
// The pure merge (`applyWarOverride`, `mockWarState`) lives here, React-free,
// so jest can cover it directly.

import { useMemo, useState } from "react";
import type { WarState, WarStatus, WarPhase, WarSide } from "@/utils/mudWars";
import { warTotalDays } from "./warCopy";

// WarState-level fields the sheet can override (everything else is derived).
export interface WarOverride {
	opponentName?: string;
	myPerCapita?: number;
	themPerCapita?: number;
	ropeNorm?: number; // −1..1
	day?: number; // 1..totalDays
	throwsRemaining?: number;
	status?: WarStatus;
	isBotWar?: boolean;
	rhythmEnabled?: boolean;
	phase?: WarPhase;
	/** For a resolved war: did MY crew win? Maps to winnerCrew. */
	won?: boolean;
}

// UI-local values that aren't part of WarState but the WHAT-TO-DO block reads.
export interface DevUiOverride {
	runsRemaining?: number;
	dugThisWindow?: boolean;
}

export const MOCK_MY_CREW_ID = "dev-my-sounder";
export const MOCK_THEM_CREW_ID = "dev-their-sounder";

// Turn a target day (1-based) into an endsAt that siegeDay() reads back as
// that day. siegeDay: day = total − ceil((ends−now)/86.4M) + 1, so we want
// ceil((ends−now)/day) = total − day + 1; sit half a day inside the band.
export function endsAtForDay(
	day: number,
	totalDays: number,
	now: number = Date.now()
): string {
	const daysLeft = Math.max(0.5, totalDays - day + 1 - 0.5);
	return new Date(now + daysLeft * 86_400_000).toISOString();
}

// A plausible mid-scuffle active war — the body Brian tweaks from.
export function mockWarState(now: number = Date.now()): WarState {
	const mine: WarSide = {
		crew: { id: MOCK_MY_CREW_ID, name: "The Mud Maulers", is_bot: false },
		members: [
			{ user_id: "dev-u1", username: "Rosie", slings: 9 },
			{ user_id: "dev-u2", username: "Pip", slings: 5 },
			{ user_id: "dev-u3", username: "Clover", slings: 0 },
		],
		total: 14,
		active: 2,
		perCapita: 7,
		quorumMet: true,
	};
	const them: WarSide = {
		crew: { id: MOCK_THEM_CREW_ID, name: "Trough Loyalists", is_bot: false },
		members: [],
		total: 10,
		active: 2,
		perCapita: 5,
		quorumMet: true,
	};
	return {
		warId: "dev-mock-war",
		status: "active",
		endsAt: endsAtForDay(3, 7, now),
		isBotWar: false,
		winnerCrew: null,
		iAmChallenger: true,
		myRemainingToday: 14,
		myThrowsRemaining: 5,
		ropeNorm: 0.25,
		// A representative modern scuffle: a 7-day fronts war (no board synthesized
		// — the FrontBoard is guarded on war.fronts, which stays null here).
		frontsEnabled: true,
		rhythmEnabled: false,
		phase: "war",
		mine,
		them,
	};
}

// Merge WarState-level overrides over a base war. `mockOn` swaps a synthesized
// mock in for the base (so the harness works with no real war). Returns null
// only when there's nothing to render (no base, mock off) → the NoWar screen.
export function applyWarOverride(
	base: WarState | null,
	ov: WarOverride | null | undefined,
	mockOn: boolean,
	now: number = Date.now()
): WarState | null {
	const war = mockOn ? mockWarState(now) : base;
	if (!war) return null;
	if (!ov) return war;

	const next: WarState = {
		...war,
		mine: { ...war.mine, crew: war.mine.crew ? { ...war.mine.crew } : null },
		them: { ...war.them, crew: war.them.crew ? { ...war.them.crew } : null },
	};

	if (ov.opponentName != null) {
		next.them.crew = {
			id: next.them.crew?.id ?? MOCK_THEM_CREW_ID,
			name: ov.opponentName,
			is_bot: next.them.crew?.is_bot ?? false,
		};
	}
	if (ov.myPerCapita != null) next.mine.perCapita = ov.myPerCapita;
	if (ov.themPerCapita != null) next.them.perCapita = ov.themPerCapita;
	if (ov.ropeNorm != null) next.ropeNorm = ov.ropeNorm;
	if (ov.day != null) next.endsAt = endsAtForDay(ov.day, warTotalDays(next), now);
	if (ov.throwsRemaining != null) next.myThrowsRemaining = ov.throwsRemaining;
	if (ov.isBotWar != null) next.isBotWar = ov.isBotWar;
	if (ov.rhythmEnabled != null) next.rhythmEnabled = ov.rhythmEnabled;
	if (ov.phase != null) next.phase = ov.phase;
	if (ov.status != null) next.status = ov.status;
	if (ov.won != null) {
		next.winnerCrew = ov.won
			? next.mine.crew?.id ?? MOCK_MY_CREW_ID
			: next.them.crew?.id ?? MOCK_THEM_CREW_ID;
	}
	return next;
}

// Split a combined override into its WarState-level and UI-local halves.
export function splitUiOverride(ov: WarOverride & DevUiOverride): {
	war: WarOverride;
	ui: DevUiOverride;
} {
	const { runsRemaining, dugThisWindow, ...war } = ov;
	return { war, ui: { runsRemaining, dugThisWindow } };
}

export interface UseWarStateOverride {
	/** The effective war the page should render. */
	war: WarState | null;
	/** UI-local overrides (runs/dig) the WHAT-TO-DO block reads. */
	ui: DevUiOverride;
	/** True when the harness is changing what the page shows. */
	active: boolean;
	// Sheet controls:
	override: WarOverride & DevUiOverride;
	mockOn: boolean;
	setField: <K extends keyof (WarOverride & DevUiOverride)>(
		key: K,
		value: (WarOverride & DevUiOverride)[K] | undefined
	) => void;
	setMockOn: (on: boolean) => void;
	reset: () => void;
}

// The hook the war page mounts. In production it's an inert passthrough.
export function useWarStateOverride(base: WarState | null): UseWarStateOverride {
	const [override, setOverride] = useState<WarOverride & DevUiOverride>({});
	const [mockOn, setMockOn] = useState(false);

	const setField: UseWarStateOverride["setField"] = (key, value) => {
		setOverride((o) => {
			const next = { ...o };
			if (value === undefined) delete next[key];
			else next[key] = value;
			return next;
		});
	};
	const reset = () => {
		setOverride({});
		setMockOn(false);
	};

	const { war: warOv, ui } = splitUiOverride(override);

	const war = useMemo(() => {
		if (!__DEV__) return base;
		return applyWarOverride(base, warOv, mockOn);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [base, JSON.stringify(warOv), mockOn]);

	const active =
		!!__DEV__ && (mockOn || Object.keys(override).length > 0);

	return {
		war: __DEV__ ? war : base,
		ui: __DEV__ ? ui : {},
		active,
		override,
		mockOn,
		setField,
		setMockOn,
		reset,
	};
}
