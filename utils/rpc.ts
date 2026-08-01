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

// A transient connectivity blip (offline, Supabase API outage, DNS hiccup)
// surfaces as a fetch-level TypeError — "Network request failed" on RN,
// "Failed to fetch" on web. These are routine and self-heal on the next
// poll/focus, so they log as a warning (Sentry breadcrumb, no LogBox red
// box) instead of an error. Every OTHER failure class (permission denied,
// SQL error, bad params, …) still routes to log.error → Sentry issue.
function isTransientNetworkError(error: { message?: string; name?: string } | null): boolean {
	if (!error) return false;
	if (error.name === "TypeError") return true;
	return /network request failed|failed to fetch|fetch failed|network error|request timed out/i.test(
		error.message ?? ""
	);
}

// A dark-launched client calling an RPC whose migration hasn't been pushed
// yet surfaces as PostgREST's "Could not find the function …" (PGRST202).
// Callers built for this (feature-dark fallbacks: hunger_meter, digoff_state)
// render nothing on null — the miss is expected, not a bug.
function isMissingFunctionError(error: { message?: string; code?: string } | null): boolean {
	if (!error) return false;
	if (error.code === "PGRST202") return true;
	return /could not find the function/i.test(error.message ?? "");
}

// Routes an RPC error to warn (transient network blip, unpushed function) or
// error (everything else), so Sentry/LogBox don't treat routine failures as bugs.
function logRpcError(name: string, error: { message?: string; name?: string; code?: string }): void {
	if (isTransientNetworkError(error)) {
		log.warn(`[rpc:${name}]`, error.message, "(transient network)");
	} else if (isMissingFunctionError(error)) {
		log.warn(`[rpc:${name}]`, error.message, "(feature dark — migration unpushed)");
	} else {
		log.error(`[rpc:${name}]`, error.message);
	}
}

export async function rpc<T = unknown>(
	name: string,
	params?: Record<string, unknown>
): Promise<T | null> {
	const result = await rpcOutcome<T>(name, params);
	if (!result.ok) {
		return null;
	}
	return result.data;
}

export type RpcFailureKind = "missing_function" | "network" | "rpc_error";

export interface RpcFailure {
	message?: string;
	name?: string;
	code?: string;
}

export type RpcOutcome<T> =
	| { ok: true; data: T | null }
	| { ok: false; kind: RpcFailureKind; error: RpcFailure };

// Detailed counterpart to rpc() for callers whose fallback behavior depends on
// WHY a call failed. Keep rpc() above for its historical null-on-error contract;
// new fail-closed write paths should use this result instead of guessing from
// null.
export async function rpcOutcome<T = unknown>(
	name: string,
	params?: Record<string, unknown>
): Promise<RpcOutcome<T>> {
	const { data, error } = await supabase.rpc(name, params);
	if (error) {
		logRpcError(name, error);
		return {
			ok: false,
			kind: isMissingFunctionError(error)
				? "missing_function"
				: isTransientNetworkError(error)
					? "network"
					: "rpc_error",
			error,
		};
	}
	return { ok: true, data: (data as T) ?? null };
}

// ── Typed result for ACTION RPCs ────────────────────────────────────────────
// Action RPCs return jsonb `{ ok: boolean, reason?|error?: string, ...payload }`.
// rpcAction() collapses the THREE historical failure shapes into ONE:
//   • transport / SQL error   → { ok: false, reason: "network" }
//   • null / non-object data  → { ok: false, reason: "no_data" }
//   • { ok: false, error: x } → { ok: false, reason: x }   ← the 4 legacy outliers
//   • { ok: false, reason: x } → { ok: false, reason: x }
// so every caller branches on the SAME `r.ok` / `r.reason` — no more juggling
// `.error` vs `.reason` vs `null`. Purely client-side: the server is unchanged,
// so deployed builds that still read `.error` keep working.
// On failure the payload is kept as Partial<T> too — some failures carry data
// (e.g. tickle_at_barn's `cooldown` returns `next_at`), so callers can read it
// off the same result without a cast.
export type RpcResult<T> =
	| ({ ok: true } & T)
	| ({ ok: false; reason: string } & Partial<T>);

export async function rpcAction<T = Record<string, never>>(
	name: string,
	params?: Record<string, unknown>
): Promise<RpcResult<T>> {
	const { data, error } = await supabase.rpc(name, params);
	if (error) {
		logRpcError(name, error);
		return { ok: false, reason: "network" };
	}
	if (data == null || typeof data !== "object") {
		return { ok: false, reason: "no_data" };
	}
	const d = data as Record<string, unknown>;
	if (d.ok === true) {
		return { ...d, ok: true } as { ok: true } & T;
	}
	const reason = (d.reason ?? d.error ?? "unknown") as string;
	return { ...d, ok: false, reason } as { ok: false; reason: string } & Partial<T>;
}
