// useRitualCaster — the one place the daily blessing / curse is cast.
//
// There is exactly ONE blessing and ONE curse per day (`dailyRitual`), so the
// only decision a player ever makes is WHO. This hook holds everything that
// decision needs — today's ritual, how many casts are left, the RPC, the
// haptics, the outcome vocabulary — so a surface that wants to cast needs a
// target and a tap, not a panel.
//
// Three surfaces share it: the friend row's one-tap doors (`Friends`), the
// Inbox's "bless back" (`ActiveEffects`), and the sheet's `RitualPicker`,
// which was where all of this used to live.
//
// The server never reports WHICH friends you've already blessed today — only
// `already_blessed_today` / `already_cursed_today` when you try. So a cast's
// answer is the signal, and `outcomeFor` remembers it for the session: a row
// that came back "done" can say so without a server read.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Haptics from "expo-haptics";
import { rpcAction } from "@/utils/rpc";
import {
	BLESSING_META,
	CURSE_META,
	dailyRitual,
	type BlessingKind,
	type CurseKind,
	type RitualMode,
	type TodayRitual,
} from "@/utils/rituals";

// What a cast came back as. `sent` and `error` carry the line a surface shows;
// `done` and `capped` are fully described by the target and the mode, so the
// caller writes its own copy in its own voice (a row says it in a label, the
// picker says it in a beat).
export type CastOutcome =
	| { kind: "sent"; text: string }
	| { kind: "done" }
	| { kind: "capped" }
	| { kind: "error"; text: string };

export interface RitualUsage {
	used: number;
	cap: number;
	remaining: number;
}

export interface UseRitualCaster {
	/** Today's allowance for a mode, or null until `ritual_status` lands. */
	usage: (mode: RitualMode) => RitualUsage | null;
	/** Today's ritual for a mode — the kind plus its name / icon / blurb. */
	today: (mode: RitualMode) => TodayRitual;
	/** Cast today's ritual on one friend. Resolves with what happened. */
	cast: (
		mode: RitualMode,
		targetUserId: string,
		targetName: string
	) => Promise<CastOutcome>;
	/** What this session's last cast on that friend came back as. */
	outcomeFor: (mode: RitualMode, targetUserId: string) => CastOutcome | undefined;
	/** Re-read the allowance (after a cast elsewhere, or a day roll). */
	refresh: () => Promise<void>;
}

interface RitualStatus {
	bless_used?: number;
	bless_cap?: number;
	curse_used?: number;
	curse_cap?: number;
	// The server's own weekday rotation (added by the weekday-rituals
	// migration). Optional strings, not `BlessingKind` / `CurseKind`: an
	// older or newer server may name a kind this build has never heard of,
	// and an unknown name falls back to the local table rather than
	// rendering a nameless door.
	bless_kind?: string;
	curse_kind?: string;
}

type Allowance = { used: number; cap: number } | null;

// The server's kind, when `ritual_status` reports one this build knows.
// The local weekday table is only the fallback while the RPC is dark — both
// index the same Monday-first arrays, so they can't disagree in practice.
function serverRitual(
	mode: RitualMode,
	kind: string | undefined
): TodayRitual | null {
	if (!kind) return null;
	if (mode === "bless") {
		const meta = BLESSING_META[kind as BlessingKind];
		return meta ? { kind: kind as BlessingKind, ...meta } : null;
	}
	const meta = CURSE_META[kind as CurseKind];
	return meta ? { kind: kind as CurseKind, ...meta } : null;
}

// Only the unexpected cases reach here — `daily_cap` and the already-cast-today
// reasons are outcomes of their own.
function ritualReasonText(reason: string | undefined, isBless: boolean): string {
	switch (reason) {
		case "not_friends":
			return "Only friends can be reached.";
		case "self":
			return "That's you.";
		default:
			return isBless ? "Couldn't bless. Try again." : "Couldn't curse. Try again.";
	}
}

export function useRitualCaster(): UseRitualCaster {
	const [allowance, setAllowance] = useState<Record<RitualMode, Allowance>>({
		bless: null,
		curse: null,
	});
	// What `ritual_status` said today's kinds are. Null until it answers (or
	// forever, on a server without the weekday-rituals migration).
	const [serverKinds, setServerKinds] = useState<Record<RitualMode, string | undefined>>({
		bless: undefined,
		curse: undefined,
	});
	const [outcomes, setOutcomes] = useState<Record<string, CastOutcome>>({});

	// The hook outlives a single row: a FlatList may drop the row that fired a
	// cast before the RPC answers, and a state write after that is a leak.
	const mounted = useRef(true);
	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
		};
	}, []);

	const refresh = useCallback(async () => {
		const r = await rpcAction<RitualStatus>("ritual_status");
		if (!mounted.current || !r.ok) return;
		setAllowance({
			bless: { used: r.bless_used ?? 0, cap: r.bless_cap ?? 1 },
			curse: { used: r.curse_used ?? 0, cap: r.curse_cap ?? 1 },
		});
		setServerKinds({ bless: r.bless_kind, curse: r.curse_kind });
	}, []);

	useEffect(() => {
		refresh();
	}, [refresh]);

	// The server's word first, the local weekday table second. Typed as
	// `TodayRitual` either way, so every door reads one shape.
	const rituals = useMemo((): Record<RitualMode, TodayRitual> => {
		const now = new Date();
		return {
			bless: serverRitual("bless", serverKinds.bless) ?? dailyRitual("bless", now),
			curse: serverRitual("curse", serverKinds.curse) ?? dailyRitual("curse", now),
		};
	}, [serverKinds.bless, serverKinds.curse]);

	const today = useCallback((mode: RitualMode) => rituals[mode], [rituals]);

	const usage = useCallback(
		(mode: RitualMode): RitualUsage | null => {
			const a = allowance[mode];
			if (!a) return null;
			return { ...a, remaining: Math.max(0, a.cap - a.used) };
		},
		[allowance]
	);

	const outcomeFor = useCallback(
		(mode: RitualMode, targetUserId: string) => outcomes[`${mode}:${targetUserId}`],
		[outcomes]
	);

	const cast = useCallback(
		async (
			mode: RitualMode,
			targetUserId: string,
			targetName: string
		): Promise<CastOutcome> => {
			const isBless = mode === "bless";
			const ritual = rituals[mode];
			const r = await rpcAction<{ kind?: string }>(
				isBless ? "send_blessing" : "send_curse",
				{ target_user_id: targetUserId }
			);

			let outcome: CastOutcome;
			if (r.ok) {
				// The toast names WHAT WAS CAST, which is the server's returned
				// kind — a door armed before 00:00 UTC and pressed after it sends
				// the new day's ritual, and the line must say so. The local guess
				// is only the fallback for a server that doesn't return a kind.
				const castName = serverRitual(mode, r.kind)?.name ?? ritual.name;
				// A blessing lands as success, a curse as a warning — the two
				// sends do not feel the same in the hand.
				Haptics.notificationAsync(
					isBless
						? Haptics.NotificationFeedbackType.Success
						: Haptics.NotificationFeedbackType.Warning
				).catch(() => {});
				outcome = {
					kind: "sent",
					text: isBless
						? `${castName} sent to ${targetName}`
						: `${targetName} has been cursed`,
				};
			} else if (
				r.reason === "already_blessed_today" ||
				r.reason === "already_cursed_today"
			) {
				outcome = { kind: "done" };
			} else if (r.reason === "daily_cap") {
				outcome = { kind: "capped" };
			} else {
				outcome = { kind: "error", text: ritualReasonText(r.reason, isBless) };
			}

			if (!mounted.current) return outcome;
			setOutcomes((prev) => ({ ...prev, [`${mode}:${targetUserId}`]: outcome }));
			if (outcome.kind === "sent") {
				// Optimistic: the counter moves the moment the cast lands, so the
				// strip and every door read the new allowance this frame.
				setAllowance((prev) => {
					const a = prev[mode];
					return a ? { ...prev, [mode]: { ...a, used: a.used + 1 } } : prev;
				});
			} else if (outcome.kind === "capped") {
				// The server says we're out — spend the local allowance to match,
				// so every door of that mode rests at once rather than one per
				// refused tap. (Deliberately NOT a re-read: `ritual_status` would
				// land after this frame and could undo it.)
				setAllowance((prev) => {
					const a = prev[mode];
					return a ? { ...prev, [mode]: { ...a, used: a.cap } } : prev;
				});
			}
			return outcome;
		},
		[rituals]
	);

	// One stable object for the whole list. The friend rows are `React.memo`,
	// and a fresh caster literal every render would re-render all of them on a
	// menu open — the layout-stability requirement the actions menu is held to.
	// (2026-09-14)
	return useMemo(
		() => ({ usage, today, cast, outcomeFor, refresh }),
		[cast, outcomeFor, refresh, today, usage]
	);
}
