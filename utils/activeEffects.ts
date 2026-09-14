// Receiver-side effects layer — the blessings + curses currently
// active on the caller. Backs everything that reads `my_active_effects`:
// the Barn chip strip, the Hoofprints sheet, the Inbox panel, and the
// in-game "Cleanse" flow.
//
// Pure helpers live here so they're trivially unit-testable; the
// stateful hook (useActiveEffects) composes them in `hooks/`.

import type { EffectCardEffect } from "@/components/ui/EffectCard";
import { rpc } from "./rpc";
import { formatExpiry, remainingMs } from "./duration";
import {
	BLESSING_META,
	CURSE_META,
	LEGACY_RITUAL_META,
	type BlessingKind,
	type CurseKind,
	type RitualMeta,
} from "./rituals";

export interface Effect {
	source: "blessing" | "curse";
	kind: string;
	expires_at: string;
	sender_id: string | null;
	sender_username: string | null;
}

// Per-effect display derivation shared by every render surface (the Barn
// chip strip + the Inbox panel both hand-rolled the identical four lines):
// whether it's a blessing, its ritual meta (icon/name/blurb — may be
// undefined for an unknown kind, so callers keep guarding with `meta?.`),
// the sender label with its blessing/curse fallback, and the avatar initial.
export function effectMeta(e: Effect) {
	const blessed = e.source === "blessing";
	// `kind` arrives as a raw server string, so the lookup can miss — the
	// annotation keeps that honest and forces the `meta?.` guards below.
	// Live kinds first, then the retired S0/S1 table: a row cast before the
	// weekday rotation shipped keeps its own name and icon until it expires
	// (weekday rituals, 2026-09-14).
	const meta: RitualMeta | undefined =
		(blessed
			? BLESSING_META[e.kind as BlessingKind]
			: CURSE_META[e.kind as CurseKind]) ?? LEGACY_RITUAL_META[e.kind];
	const senderName = e.sender_username ?? (blessed ? "a friend" : "someone");
	const initial = (e.sender_username ?? "?").slice(0, 1).toUpperCase();
	return { blessed, meta, senderName, initial };
}

// Server row → the `EffectCard` display shape. The card renders a blessing or a
// curse; it does not know `source` / `expires_at` / `sender_username`. Lives
// beside `effectMeta` because every effect surface needs the same mapping —
// the Barn strip, the Inbox panel and the Hoofprints sheet each used to derive
// it their own way (audit A-10).
export function toEffectCardEffect(e: Effect): EffectCardEffect {
	const { blessed, meta, senderName } = effectMeta(e);
	return {
		kind: blessed ? "bless" : "curse",
		name: meta?.name ?? e.kind,
		from: senderName,
		expiresAt: e.expires_at,
		icon: meta?.icon,
		blurb: meta?.blurb,
	};
}

// Fetch + cast the live effects on the caller. Always resolves with
// an array (null + error both become []), since every caller treats
// "empty" as the rest state — there's no useful distinction between
// "no effects" and "couldn't fetch effects" at the render layer.
export async function fetchActiveEffects(): Promise<Effect[]> {
	const rows = (await rpc<Effect[]>("my_active_effects")) ?? [];
	// blessings first, then curses — stable iteration order for the
	// callers that render a unified list.
	rows.sort((a, b) => (a.source < b.source ? -1 : 1));
	return rows;
}

// ── Somebody else's effects ─────────────────────────────────────────────
// What a VISITOR may know about their host (weekday rituals, 2026-09-14,
// plan phase 4): which rituals are on them, and nothing else. Deliberately
// narrower than `Effect` — `active_effects_of` returns no sender, because who
// left a mark on you is yours to see. A visitor only needs the kinds so the
// Barn scene and the host's pig can render the way the host sees them.
export interface VisitorEffect {
	source: "blessing" | "curse";
	kind: string;
	expires_at: string;
}

// Fetch the rituals currently on a friend or crewmate (or yourself — the RPC
// allows it, and `my_active_effects` already tells you strictly more).
//
// Fail-soft in the strong sense: the RPC is dark until the weekday-rituals
// migration is pushed, and a visit must never break because a friend's Barn
// could not be read. Every failure — unpushed function, non-friend, transport
// blip — resolves to the rest state, exactly like `fetchActiveEffects`. The
// shape guard is belt-and-braces for the same dark-RPC reason.
export async function fetchActiveEffectsOf(
	targetUserId: string,
): Promise<VisitorEffect[]> {
	const data = await rpc<VisitorEffect[]>("active_effects_of", {
		p_target: targetUserId,
	});
	if (!Array.isArray(data)) return [];
	const rows = [...data];
	// blessings first, then curses — the same stable order `fetchActiveEffects`
	// hands the merge, so a visitor folds the recipes in the host's own order.
	rows.sort((a, b) => (a.source < b.source ? -1 : 1));
	return rows;
}

export interface Partitioned {
	blessings: Effect[];
	curses: Effect[];
}

export function partitionBySource(effects: Effect[]): Partitioned {
	const blessings: Effect[] = [];
	const curses: Effect[] = [];
	for (const e of effects) {
		(e.source === "blessing" ? blessings : curses).push(e);
	}
	return { blessings, curses };
}

// Compact countdown formatter. `withSuffix=true` appends "left" for
// the Inbox panel ("5m left"); the chip + sheet use the bare form
// ("5m"). Returns "expiring" once the timestamp's in the past.
export function formatLeft(iso: string, withSuffix = false): string {
	const label = formatExpiry(remainingMs(iso));
	if (label === "expiring" || !withSuffix) return label;
	return `${label} left`;
}
