// Profile hydration — the one read that turns a bag of user ids into names.
//
// Feeds, inboxes, and the while-away recap all store the OTHER player as a
// bare id (requester_id, sender_id, actor_id) and then look the username up
// in a second query. Four surfaces each hand-rolled the same
// `profiles.select("id, username").in("id", ids)` + Map; this is that read,
// once. Fail-soft: a missing profile (deleted account, RLS) simply has no
// entry, so callers `.get(id) ?? null` and render "Anonymous"-style copy.

import { supabase } from "./supabase";

/** user id → username (null when the profile has no name yet). */
export async function fetchUsernamesById(
	ids: readonly string[]
): Promise<Map<string, string | null>> {
	const unique = [...new Set(ids)];
	if (unique.length === 0) return new Map();
	const { data } = await supabase
		.from("profiles")
		.select("id, username")
		.in("id", unique);
	return new Map((data ?? []).map((p) => [p.id, p.username]));
}
