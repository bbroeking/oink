// DEV admin tool — inspect / reset a user's onboarding state via the service role.
//
// Run with Node's --env-file so the key is read from .env.local (never committed):
//   node --env-file=.env --env-file=.env.local scripts/reset-onboarding.mjs <username>
//     (no flag)     inspect only — print the account's onboarding done-state + claims
//     --reset       delete the user's onboarding_claims (clears the "claimed" ledger)
//     --wipe-state  also undo the milestone ACTIONS so the chores show unchecked:
//                   zero tickles_earned, un-equip everything, and delete this user's
//                   accepted friendships / barn visits / sent blessings + curses.
//
// The service-role key bypasses RLS. It is read from the environment, never hard-coded.
import { createClient } from "@supabase/supabase-js";

const username = process.argv[2];
const doReset = process.argv.includes("--reset");
const wipeState = process.argv.includes("--wipe-state");

if (!username) {
	console.error("Usage: node --env-file=.env --env-file=.env.local scripts/reset-onboarding.mjs <username> [--reset] [--wipe-state]");
	process.exit(1);
}

const REF = "wbcnhvvakptoinwkulmn";
const url =
	process.env.SUPABASE_URL ||
	process.env.EXPO_PUBLIC_SUPABASE_URL ||
	`https://${REF}.supabase.co`;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) {
	console.error("Missing SUPABASE_SERVICE_ROLE_KEY — add it to .env.local and retry.");
	process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

const EQUIP_COLS = [
	"active_hat_id", "active_glasses_id", "active_mask_id", "active_neck_id",
	"active_aura_id", "active_held_id", "active_tickle_particle_id",
];

// 1. Resolve the user (case-insensitive on username).
const { data: prof, error: pErr } = await db
	.from("profiles")
	.select(`id, username, tickles_earned, counter, ${EQUIP_COLS.join(", ")}`)
	.ilike("username", username)
	.maybeSingle();
if (pErr) { console.error("profiles lookup failed:", pErr.message); process.exit(1); }
if (!prof) { console.error(`No profile with username '${username}'.`); process.exit(1); }

const uid = prof.id;

// 2. Read the live "done" signals (same sources as onboarding_done()).
const countOf = async (table, col) => {
	const { count } = await db.from(table).select("*", { count: "exact", head: true }).eq(col, uid);
	return count ?? 0;
};
const { count: friends } = await db
	.from("friendships")
	.select("*", { count: "exact", head: true })
	.eq("status", "accepted")
	.or(`requester_id.eq.${uid},receiver_id.eq.${uid}`);
const tickles = prof.tickles_earned ?? 0;
const equipped = EQUIP_COLS.filter((k) => prof[k]).length;
const visits = await countOf("barn_visits", "visitor_id");
const blessings = await countOf("blessings", "sender_id");
const curses = await countOf("curses", "sender_id");
const { data: claims } = await db.from("onboarding_claims").select("milestone_id").eq("user_id", uid);

const mark = (b) => (b ? "DONE" : "undone");
console.log(`\nUser: ${prof.username} (${uid})  ·  counter=${prof.counter}`);
console.log("Milestone done-state (live):");
console.log(`  first_tickle  tickles_earned=${tickles}        → ${mark(tickles >= 1)}`);
console.log(`  dress         equipped=${equipped}              → ${mark(equipped > 0)}`);
console.log(`  friend        acceptedFriends=${friends ?? 0}   → ${mark((friends ?? 0) > 0)}`);
console.log(`  visit         barnVisits=${visits}              → ${mark(visits > 0)}`);
console.log(`  ritual        blessings=${blessings} curses=${curses}  → ${mark(blessings + curses > 0)}`);
console.log(`Claimed: [${(claims ?? []).map((c) => c.milestone_id).join(", ") || "none"}]`);

if (!doReset) {
	console.log("\nInspect only. Re-run with --reset (clear claims) and optionally --wipe-state (undo the actions).\n");
	process.exit(0);
}

// 3. Clear the claims ledger.
const { error: cErr, count: cleared } = await db
	.from("onboarding_claims").delete({ count: "exact" }).eq("user_id", uid);
if (cErr) { console.error("claim delete failed:", cErr.message); process.exit(1); }
console.log(`\nCleared ${cleared ?? "?"} onboarding_claims rows.`);

// 4. Optionally undo the actions so the chores render unchecked.
if (wipeState) {
	const clearEquip = Object.fromEntries(EQUIP_COLS.map((k) => [k, null]));
	await db.from("profiles").update({ tickles_earned: 0, ...clearEquip }).eq("id", uid);
	const f = await db.from("friendships").delete({ count: "exact" }).or(`requester_id.eq.${uid},receiver_id.eq.${uid}`);
	const v = await db.from("barn_visits").delete({ count: "exact" }).eq("visitor_id", uid);
	const b = await db.from("blessings").delete({ count: "exact" }).eq("sender_id", uid);
	const c = await db.from("curses").delete({ count: "exact" }).eq("sender_id", uid);
	console.log(`Wiped done-state: tickles_earned→0, un-equipped, friendships=${f.count ?? "?"}, visits=${v.count ?? "?"}, blessings=${b.count ?? "?"}, curses=${c.count ?? "?"} deleted.`);
}
console.log("Done — reload the app (Cmd+R) as this user to walk the checklist.\n");
