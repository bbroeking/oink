// Defensive jsonb coercion helpers.
//
// Server jsonb payloads (RPC return values, dynamic-select rows) are typed
// loosely: a field may be missing, null, a string where a number is expected, or
// a number where a string is expected. These helpers turn any such value into a
// safe, well-typed default so the UI can read a malformed field without ever
// crashing. They are the single home for that "never trust the wire" coercion —
// utils/dig.ts (race + feeding parsing) and utils/crews.ts (crew_state hoisting)
// both import from here so the rules can't drift between call sites.

/** Any value → a finite number, falling back to `dflt` (default 0). */
export function num(v: unknown, dflt = 0): number {
	const n = typeof v === "number" ? v : Number(v);
	return Number.isFinite(n) ? n : dflt;
}

/** Any value → a string (only genuine strings pass), falling back to `dflt`. */
export function str(v: unknown, dflt = ""): string {
	return typeof v === "string" ? v : dflt;
}

/** Any value → a non-empty string, or null. */
export function strOrNull(v: unknown): string | null {
	return typeof v === "string" && v ? v : null;
}

/** Any value → a plain object (own keys read-safe), or {} for non-objects. */
export function obj(v: unknown): Record<string, unknown> {
	return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

/** Any value → a non-negative integer (floored, clamped at 0). */
export function nonneg(v: unknown): number {
	return Math.max(0, Math.floor(num(v)));
}

/** Any value → an array of finite integers; non-arrays / bad entries dropped. */
export function coerceIntArray(v: unknown): number[] {
	if (!Array.isArray(v)) return [];
	return v.map((x) => Math.floor(Number(x))).filter((n) => Number.isFinite(n));
}
