// Client-side mirror of the SQL `alignment_label` function. Keep
// thresholds in sync with supabase/migrations/20260521000000_alignment.sql
// (later unified with the schism reveal at ±25 in
// supabase/migrations/20260536000000_alignment_notifications.sql) or
// the UI will disagree with the backend on edge cases.
//
// See docs/season-1-goblins-vs-angels.md for the design.

export type AlignmentLabel = "goblin" | "neutral" | "angel";

// Schism modal and the Generous/Greedy label both fire here — the
// audit found three staggered "picked a side" moments (leaderboard >0,
// schism ±25, label ±34); unifying schism + label at ±25 makes
// "crossing into Generous/Greedy" a single beat.
export const ALIGNMENT_ANGEL_THRESHOLD = 25;
export const ALIGNMENT_GOBLIN_THRESHOLD = -25;

export function alignmentLabel(score: number): AlignmentLabel {
	if (score >= ALIGNMENT_ANGEL_THRESHOLD) return "angel";
	if (score <= ALIGNMENT_GOBLIN_THRESHOLD) return "goblin";
	return "neutral";
}

// The mechanical effects of alignment, mirrored from the SQL in
// 20260577000000_alignment_teeth.sql so the UI can show the player exactly
// what their nature is doing. Percentages are player-positive when > 0.
//   regen   — generous regen faster (+10%), greedy slower (−10%), by label
//   blessing — generous = better blesser (longer); scales with score
//   curse    — greedy = better curser (longer); scales with score
export function alignmentEffects(score: number): {
	regenPct: number;
	blessingPct: number;
	cursePct: number;
} {
	return {
		regenPct:
			score >= ALIGNMENT_ANGEL_THRESHOLD
				? 10
				: score <= ALIGNMENT_GOBLIN_THRESHOLD
					? -10
					: 0,
		blessingPct: Math.round(score * 0.5),
		cursePct: Math.round(-score * 0.5),
	};
}

// Short descriptive name used in UI ("you are Generous" / "they are
// a Pilgrim" / etc.). Distinct from the raw label so we can tune
// copy without breaking SQL queries that key on the label.
export function alignmentDisplay(label: AlignmentLabel): string {
	switch (label) {
		case "angel":   return "Generous";
		case "goblin":  return "Greedy";
		case "neutral": return "Pilgrim";
	}
}

// Icon name (see components/ui/Icon) for the alignment emblem.
// Replaces the old emoji glyphs (😇 ⚖️ 👹) — emoji render
// inconsistently per-OS and clash with the app's drawn look.
export function alignmentIcon(
	label: AlignmentLabel
): "halo" | "scales" | "horns" {
	switch (label) {
		case "angel":   return "halo";
		case "goblin":  return "horns";
		case "neutral": return "scales";
	}
}

// Theme color name for badge backgrounds. Resolved against the WHIMSY
// palette at the call site so this file stays framework-free + testable.
export function alignmentColorKey(label: AlignmentLabel): "sun" | "paper" | "moss" {
	switch (label) {
		case "angel":   return "sun";
		case "goblin":  return "moss";
		case "neutral": return "paper";
	}
}
