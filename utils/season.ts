// Season 1 schedule — the single source of truth for WHEN each
// Season 1 feature goes live.
//
// Both the release-notes drip (constants/release_notes.ts) and the
// in-app feature gates key off this map, so a "what's new" card can
// never arrive before — or after — the thing it announces. Authoring
// future entries here does NOT spoil them: they only surface in-app
// once their date arrives.
//
// Dates are ISO (YYYY-MM-DD), UTC. Lexical compare == chronological.

export const SEASON_1_START = "2026-05-20";
// Judgement Day: 8:00 PM ET Jul 12, 2026 (= 00:00 UTC Jul 13; the server cron in
// 20260704500000 is authoritative). Date-only here drives the whole-days countdown.
export const SEASON_1_END = "2026-07-12";

// ISO date each Season 1 feature unlocks, keyed by feature id.
// Week 1 features ship live at launch; the rest drip weekly.
export const SEASON_1_UNLOCKS = {
	alignment: "2026-05-20", // W1 — alignment + schism, live at launch
	blessings: "2026-06-03", // W3
	curses:    "2026-06-10", // W4
	bounties:  "2026-06-24", // W6
	finale:    "2026-07-08", // W8 — Judgement Day
} as const;

export type SeasonFeature = keyof typeof SEASON_1_UNLOCKS;

function todayISO(now: Date): string {
	return now.toISOString().slice(0, 10);
}

// True once a feature's unlock date has arrived. Wire the in-app
// surface for each feature behind this so the UI and the
// announcement roll out together.
export function featureUnlocked(
	feature: SeasonFeature,
	now: Date = new Date()
): boolean {
	return todayISO(now) >= SEASON_1_UNLOCKS[feature];
}

// Which season "week" we're in (1-based). Clamps at 1 before the
// season and keeps counting after — callers cap as needed.
export function seasonWeek(now: Date = new Date()): number {
	const start = Date.parse(SEASON_1_START + "T00:00:00Z");
	const diff = now.getTime() - start;
	return Math.max(1, Math.floor(diff / (7 * 86_400_000)) + 1);
}

// True while Season 1 is running (between start and end, inclusive).
export function seasonActive(now: Date = new Date()): boolean {
	const t = todayISO(now);
	return t >= SEASON_1_START && t <= SEASON_1_END;
}

// Whole days remaining until Judgement Day (SEASON_1_END). 0 once reached.
export function daysUntilJudgement(now: Date = new Date()): number {
	const end = Date.parse(SEASON_1_END + "T23:59:59Z");
	return Math.max(0, Math.ceil((end - now.getTime()) / 86_400_000));
}
