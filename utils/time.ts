// Shared duration formatting. Several screens hand-rolled the identical
// "split a millisecond span into whole hours + minutes" arithmetic with
// `Math.floor(ms / 3_600_000)` / `Math.floor((ms % 3_600_000) / 60_000)`.
// formatHM() is that one kernel; callers keep their own floor copy
// ("moments" / "closing" / "now") and any "left" suffix, since those vary
// per surface.

const MS_PER_HOUR = 3_600_000;
const MS_PER_MIN = 60_000;

// "2h 15m" when there's an hour or more, otherwise "15m". Truncates (floor)
// toward zero — a 119-second span reads "1m", a 59-second span reads "0m".
// Pass `{ minMinute: 1 }` for the "never show 0m" countdown flavor (a sub-minute
// tail floors up to "1m" instead of "0m") used by the patch/feeding phases.
export function formatHM(ms: number, opts?: { minMinute?: number }): string {
	const h = Math.floor(ms / MS_PER_HOUR);
	let m = Math.floor((ms % MS_PER_HOUR) / MS_PER_MIN);
	if (h === 0 && opts?.minMinute != null) m = Math.max(opts.minMinute, m);
	return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
