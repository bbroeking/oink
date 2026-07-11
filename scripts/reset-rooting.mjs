// DEV admin tool — inspect / reset a user's rooting (dig) state via the service role.
//
// Run with Node's --env-file so the key is read from .env.local (never committed):
//   node --env-file=.env --env-file=.env.local scripts/reset-rooting.mjs <username> [--all]
//     (no flag)  inspect + delete the user's war_rootings row for the CURRENT
//                window (floor(now/28800)). Prints what it found before deleting.
//     --all      delete ALL of this user's war_rootings rows (every window).
//
// The service-role key bypasses RLS. It is read from the environment, never hard-coded.
// No key in the prod env → this can't touch prod; keep it that way.
import { createClient } from "@supabase/supabase-js";

const username = process.argv[2];
const doAll = process.argv.includes("--all");

if (!username) {
	console.error("Usage: node --env-file=.env --env-file=.env.local scripts/reset-rooting.mjs <username> [--all]");
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

// The 8h feeding window the RPCs bucket on: floor(epoch_seconds / 28800).
// Must match open_rooting/submit_rooting's `floor(extract(epoch FROM now)/28800)`.
const WINDOW_SECONDS = 28800;
const curWindow = Math.floor(Date.now() / 1000 / WINDOW_SECONDS);

// 1. Resolve the user (case-insensitive on username).
const { data: prof, error: pErr } = await db
	.from("profiles")
	.select("id, username")
	.ilike("username", username)
	.maybeSingle();
if (pErr) { console.error("profiles lookup failed:", pErr.message); process.exit(1); }
if (!prof) { console.error(`No profile with username '${username}'.`); process.exit(1); }

const uid = prof.id;

// 2. Read the rooting rows we're about to touch (current window, or all).
let q = db
	.from("war_rootings")
	.select("window_index, submitted_at, finds, truffles_minted")
	.eq("user_id", uid)
	.order("window_index", { ascending: true });
if (!doAll) q = q.eq("window_index", curWindow);

const { data: rows, error: rErr } = await q;
if (rErr) { console.error("war_rootings lookup failed:", rErr.message); process.exit(1); }

const scope = doAll ? "ALL windows" : `current window (window_index=${curWindow})`;
console.log(`\nUser: ${prof.username} (${uid})`);
console.log(`Scope: ${scope}`);
if (!rows || rows.length === 0) {
	console.log("No war_rootings rows found for this scope. Nothing to delete.\n");
	process.exit(0);
}
console.log(`Found ${rows.length} rooting row(s):`);
for (const r of rows) {
	const finds = Array.isArray(r.finds) ? r.finds.join(", ") : "—";
	const sub = r.submitted_at ?? "(open, not submitted)";
	console.log(
		`  window_index=${r.window_index}  submitted_at=${sub}  ` +
		`truffles_minted=${r.truffles_minted}  finds=[${finds}]`,
	);
}

// 3. Delete the matching rows.
let del = db.from("war_rootings").delete({ count: "exact" }).eq("user_id", uid);
if (!doAll) del = del.eq("window_index", curWindow);
const { error: dErr, count: deleted } = await del;
if (dErr) { console.error("war_rootings delete failed:", dErr.message); process.exit(1); }
console.log(`\nDeleted ${deleted ?? "?"} war_rootings row(s).`);

// 4. The device keeps a per-window "already dug" mirror in AsyncStorage under
//    rooting_done_<window>. Deleting the DB row alone leaves that key set, so
//    the app can still gate the dig as done until it's cleared.
//    Simulator trick: AsyncStorage lives in a JSON manifest on disk —
//      ~/Library/Developer/CoreSimulator/Devices/<DEVICE-UDID>/data/Containers/
//        Data/Application/<APP-UUID>/Library/Application Support/<...>/manifest.json
//    (grep the tree for "rooting_done_" to find the right app container), then
//    remove the rooting_done_<window> entry and relaunch. On device, log out /
//    reinstall or wait for the next window.
console.log(`Reminder: clear the device AsyncStorage mirror key rooting_done_${doAll ? "<window>" : curWindow} (see comment in this script for the simulator manifest.json trick), then reload the app as this user.\n`);
