// Client-side mirror of the SQL `alignment_label` function. Keep
// thresholds in sync with supabase/migrations/20260521000000_alignment.sql
// or the UI will disagree with the backend on edge cases.
//
// See docs/season-1-goblins-vs-angels.md for the design.

export type AlignmentLabel = "goblin" | "neutral" | "angel";

export const ALIGNMENT_ANGEL_THRESHOLD = 34;
export const ALIGNMENT_GOBLIN_THRESHOLD = -34;

export function alignmentLabel(score: number): AlignmentLabel {
	if (score >= ALIGNMENT_ANGEL_THRESHOLD) return "angel";
	if (score <= ALIGNMENT_GOBLIN_THRESHOLD) return "goblin";
	return "neutral";
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
