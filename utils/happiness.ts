import type { PigAnimation } from "@/components/ui/SpritePig";

// Happiness (20–80) → the pig's resting idle animation. Three mood bands map to
// the three sprite sets (docs/happiness-spec.md): Sad 20–37, Content 38–62
// (the neutral `idle`), Happy 63–80. The sprite is the only readout — no number.
export function moodAnimation(
	happiness: number | null | undefined
): PigAnimation {
	const h = happiness ?? 50;
	if (h < 38) return "sad";
	if (h <= 62) return "idle";
	return "happy";
}
