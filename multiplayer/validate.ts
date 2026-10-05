// Tiny runtime guards for untrusted wire input. Every `parseAction` and every
// protocol parser is built from these, so a malformed message is rejected at
// the edge with a typed `bad_request` rather than reaching game rules.

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isInt(value: unknown, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER): value is number {
	return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

export function isOneOf<T extends string>(value: unknown, options: readonly T[]): value is T {
	return typeof value === "string" && (options as readonly string[]).includes(value);
}

export function isShortString(value: unknown, maxLength = 64): value is string {
	return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

/** Reads `raw.type` against an allow-list; the common first step of parseAction. */
export function actionType<T extends string>(raw: unknown, types: readonly T[]): T | null {
	if (!isRecord(raw)) return null;
	return isOneOf(raw.type, types) ? raw.type : null;
}

/** An array of ints, each within [min, max], of exactly `length` (or any length
 *  up to `maxLength` when length is omitted). */
export function isIntArray(
	value: unknown,
	opts: { min: number; max: number; length?: number; maxLength?: number },
): value is number[] {
	if (!Array.isArray(value)) return false;
	if (opts.length !== undefined && value.length !== opts.length) return false;
	if (opts.maxLength !== undefined && value.length > opts.maxLength) return false;
	return value.every((v) => isInt(v, opts.min, opts.max));
}
