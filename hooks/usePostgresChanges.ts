// Single owner of the Supabase `postgres_changes` subscription
// lifecycle. Three receiver-side hooks used to hand-roll this same
// dance — resolve the authed uid, build a per-subject channel topic,
// register a fixed spec list, subscribe, and tear the channel down on
// unmount / spec-change — with subtly inconsistent cleanup between the
// copies. This module is that lifecycle, once.
//
// Consumers:
//   • useActiveEffects  — INSERT blessings/curses + UPDATE curses,
//                         scoped to receiver_id; uid from auth.
//   • useCrew           — crew_invites + (crew_members / crew_join_requests),
//                         topic + spec set branch on crewId; uid from auth.
//   • components/Inbox  — six social-table filters; uid is a prop.
//
// (hooks/useLoungePeers.ts is presence/broadcast, NOT postgres_changes —
// it is deliberately NOT routed through here.)
//
// Teardown invariant — the correct behavior unified from three copies:
//   1. NO double-teardown: the returned disposer is idempotent.
//   2. NO orphaned channel on fast remount: we hold a ref to the EXACT
//      channel created and remove THAT one. If the effect's cleanup
//      fires while auth is still resolving (unmount mid-await), the
//      channel is torn down the instant it is created.
//   3. unsubscribe on unmount AND on spec-change (dep-array rebuild).
// The old copies removed channels by re-finding them via
// getChannels().filter(topic===key) — which, on a fast remount that
// produced two channels sharing one per-subject topic, removed BOTH
// (the orphan and the live one). Holding the exact ref avoids that.
//
// Auth-not-ready is handled the way the callers did: if the subject id
// cannot be resolved (no session, or a falsy uid prop), we simply skip
// the subscribe — no channel, no throw — until a dep change re-runs us.

import { useEffect, useRef } from "react";
import type { DependencyList } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/utils/supabase";

export type PgChangeEvent = "INSERT" | "UPDATE" | "DELETE" | "*";

// The callbacks all ignore the payload today (`() => refresh()`); the
// payload shape is kept loose so a caller that wants it isn't blocked.
export type PgChangePayload = Record<string, unknown>;

export interface PostgresChangeSpec {
	event: PgChangeEvent;
	// Defaults to "public" when omitted (every current caller is public).
	schema?: string;
	table: string;
	// Row-scoping filter, e.g. `receiver_id=eq.<uid>`. Omit for unfiltered.
	filter?: string;
	callback: (payload: PgChangePayload) => void;
}

// Minimal surface this module drives on the client. The real supabase
// client satisfies it; tests inject a fake through subscribePostgresChanges.
export type PgChangesClient = Pick<SupabaseClient, "channel" | "removeChannel">;

// ── Pure helpers (unit-tested without a React mount or a live client) ──

// Stable channel topic for a subject. Nullish key parts collapse to
// "none" so a crewless caller gets a deterministic, non-colliding topic
// (matches the old `${crewId ?? "none"}`). Shape: realtime:<topic>:<uid>[:<part>…].
export function buildChannelKey(
	topic: string,
	uid: string,
	...keyParts: (string | null | undefined)[]
): string {
	return ["realtime", topic, uid, ...keyParts.map((p) => p ?? "none")].join(
		":"
	);
}

// Normalize a spec into the on() filter object, applying the "public"
// schema default and dropping an absent filter (an empty `filter` key
// changes the subscription semantics, so only include it when set).
export function normalizeSpecFilter(spec: PostgresChangeSpec): {
	event: PgChangeEvent;
	schema: string;
	table: string;
	filter?: string;
} {
	const out: { event: PgChangeEvent; schema: string; table: string; filter?: string } = {
		event: spec.event,
		schema: spec.schema ?? "public",
		table: spec.table,
	};
	if (spec.filter) out.filter = spec.filter;
	return out;
}

// ── Lifecycle (testable via an injected client) ──

// Build one channel, register every spec, subscribe, and return an
// idempotent disposer that removes exactly this channel. Pure w.r.t.
// React — the hook wraps it; tests call it directly.
export function subscribePostgresChanges(
	client: PgChangesClient,
	channelKey: string,
	specs: PostgresChangeSpec[]
): () => void {
	let ch = client.channel(channelKey);
	for (const spec of specs) {
		// The on() postgres_changes overload keys off an event string
		// literal; our event is a runtime union, so the filter object is
		// cast — behavior is identical, only the compile-time overload is
		// side-stepped.
		ch = ch.on(
			"postgres_changes",
			normalizeSpecFilter(spec) as never,
			spec.callback
		);
	}
	ch.subscribe();
	let removed = false;
	return () => {
		if (removed) return; // idempotent — no double-teardown
		removed = true;
		client.removeChannel(ch);
	};
}

// ── Hook ──

export interface UsePostgresChangesConfig {
	// Channel-topic namespace, e.g. "active-effects" | "crew" | "inbox".
	topic: string;
	// Subject id. `undefined` → resolve via supabase auth (getUser).
	// A concrete string is used directly (Inbox's userId prop). A falsy
	// value (null / "") means not-ready → skip the subscribe.
	uid?: string | null;
	// Extra topic discriminators appended after the uid AND expected in
	// `deps` so the channel rebuilds when they change (e.g. crewId).
	keyParts?: (string | null | undefined)[];
	// Spec list built from the resolved uid. Read fresh at subscribe time
	// (via a ref) so its closure identity never forces a resubscribe —
	// `deps` is the single source of truth for WHEN we rebuild.
	specs: (uid: string) => PostgresChangeSpec[];
	// When false, no subscription; `onDisabled` runs instead (state reset).
	enabled?: boolean;
	// Side effect for the disabled branch (callers clear their state).
	onDisabled?: () => void;
	// The exact dep array the subscription rebuilds on. Mirrors what each
	// hand-rolled effect used, e.g. [enabled, crewId, refresh].
	deps: DependencyList;
}

export function usePostgresChanges(config: UsePostgresChangesConfig): void {
	const enabled = config.enabled ?? true;

	// Latest-closure refs so the effect can read fresh values without
	// pulling function/array identity into its dep list.
	const specsRef = useRef(config.specs);
	const onDisabledRef = useRef(config.onDisabled);
	const uidRef = useRef(config.uid);
	const keyPartsRef = useRef(config.keyParts);
	const topicRef = useRef(config.topic);
	specsRef.current = config.specs;
	onDisabledRef.current = config.onDisabled;
	uidRef.current = config.uid;
	keyPartsRef.current = config.keyParts;
	topicRef.current = config.topic;

	useEffect(() => {
		if (!enabled) {
			onDisabledRef.current?.();
			return;
		}
		let cancelled = false;
		let teardown: (() => void) | null = null;

		(async () => {
			let uid = uidRef.current;
			if (uid === undefined) {
				// Auth-driven callers resolve the subject here; skip on no session.
				const {
					data: { user },
				} = await supabase.auth.getUser();
				uid = user?.id ?? null;
			}
			if (cancelled || !uid) return; // not-ready → no channel

			const key = buildChannelKey(
				topicRef.current,
				uid,
				...(keyPartsRef.current ?? [])
			);
			teardown = subscribePostgresChanges(supabase, key, specsRef.current(uid));
			// Unmounted while auth was resolving — tear the channel down now
			// so it can't outlive the effect (invariant 2).
			if (cancelled) {
				teardown();
				teardown = null;
			}
		})();

		return () => {
			cancelled = true;
			if (teardown) {
				teardown();
				teardown = null;
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [enabled, ...config.deps]);
}
