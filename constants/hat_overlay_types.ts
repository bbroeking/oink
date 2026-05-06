// Shared overlay positioning type. Lives in its own module so both
// `hats.ts` and the auto-generated `hat_overlays.generated.ts` can
// depend on it without forming a circular import.
export interface HatOverlay {
	bottom: number;
	left: number;
	width: number;
	height: number;
}
