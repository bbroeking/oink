// Duration + countdown formatting — one home for the "turn a span of time into
// a label" arithmetic that several screens had each hand-rolled. Three surfaces
// render three GENUINELY different strings from the same kind of input, so this
// module exposes them as distinct named formatters rather than forcing one
// shape on every caller. Do not collapse them: each call site must keep
// rendering the exact string it renders today.
//
//   formatHM(ms)            "2h 15m" / "15m"          — floored h+m, hours roll up
//   formatCountdownHM(secs) "1h 0m" / "5m"            — formatHM over a seconds span
//   formatDurationCompact() "2h" / "1h 5m" / "5m"     — exact hour collapses, min 1m,
//                                                        minutes ROUNDED (regen rates)
//   formatClockMS(secs)     "30s" / "1m 30s"          — mm:ss clock, no hour rollover,
//                                                        seconds zero-padded
//
// plus remainingMs(iso): the "how long until this ISO timestamp" span callers
// then format themselves.

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

// formatHM over a span given in whole seconds. The shop's "resets in …" chip:
// exact hour reads "1h 0m", sub-hour reads just "5m". Floors like formatHM.
export function formatCountdownHM(seconds: number): string {
	return formatHM(seconds * 1000);
}

// Compact regen-rate label: "1 tickle / <this>". An exact hour collapses to
// "2h" (no trailing "0m"); anything below a minute clamps up to "1m"; minutes
// are ROUNDED (not floored) so a 90s rate reads "2m", not "1m". Distinct from
// formatHM's floor-and-always-show-minutes behavior.
export function formatDurationCompact(seconds: number): string {
	const safe = Math.max(60, Math.round(seconds));
	if (safe % 3600 === 0) return `${safe / 3600}h`;
	if (safe >= 3600) return `${Math.floor(safe / 3600)}h ${Math.round((safe % 3600) / 60)}m`;
	return `${Math.round(safe / 60)}m`;
}

// Short mm:ss clock for sub-hour regen countdowns: "30s" under a minute,
// otherwise "1m 30s" with the seconds zero-padded to two digits. There is no
// hour rollover here — a 65-minute span reads "65m 00s" by design.
export function formatClockMS(totalSeconds: number): string {
	const m = Math.floor(totalSeconds / 60);
	const s = totalSeconds % 60;
	if (m === 0) return `${s}s`;
	return `${m}m ${s.toString().padStart(2, "0")}s`;
}

// Milliseconds remaining until an ISO-8601 instant (negative once it's past).
// The bare `new Date(iso).getTime() - Date.now()` that countdown surfaces open-code;
// callers format the result themselves ("closing" / "now" / "Nh left" vary per surface).
export function remainingMs(iso: string): number {
	return new Date(iso).getTime() - Date.now();
}
