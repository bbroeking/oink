// Tiny typed Supabase RPC helper. Absorbs the cast + error log
// that every call site was hand-rolling. Returns the data cast to
// T, or null when the RPC errored or returned no rows.
//
// Errors flow through log.error() so they reach Sentry instead of
// vanishing into a destructured-but-ignored `error` field — the
// silent-on-error semantics callers already rely on stays intact;
// the observability around it improves.

import { supabase } from "./supabase";
import { log } from "./log";

export async function rpc<T = unknown>(
	name: string,
	params?: Record<string, unknown>
): Promise<T | null> {
	const { data, error } = await supabase.rpc(name, params);
	if (error) {
		log.error(`[rpc:${name}]`, error.message);
		return null;
	}
	return (data as T) ?? null;
}
