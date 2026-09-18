#!/usr/bin/env node
// Dress a test profile: grant one item per pig slot and equip it, so the
// whole rig (hat, bow, glasses, mask, neck, held, aura, background, tickle
// particle) can be checked on the real renderer in one go.
//
//   node scripts/equip-slots-for-user.mjs Brian
//   node scripts/equip-slots-for-user.mjs Brian hat=wizard glasses=monocle
//
// Preferred picks below lean on items with SIDE art (the turned families)
// and hand-tuned RelSpecs; a pick the catalog lacks falls back to the first
// live item of that category. Uses the same service-role lane as
// unlock-auras-for-user.mjs. Never touches anything but user_hats rows and
// the profile's active_*_id columns for the named user.
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const PROJECT_REF = "wbcnhvvakptoinwkulmn";
const [username, ...overrides] = process.argv.slice(2);
if (!username) {
	console.error("Usage: equip-slots-for-user.mjs <username> [category=item_id …]");
	process.exit(2);
}

// category → profiles column (mirrors constants/slots.ts columnForCategory).
const COLUMN = {
	hat: "active_hat_id",
	bow: "active_bow_id",
	glasses: "active_glasses_id",
	mask: "active_mask_id",
	scarf: "active_neck_id",
	necklace: "active_neck_id",
	held: "active_held_id",
	aura: "active_aura_id",
	background: "active_background_id",
	tickle_particle: "active_tickle_particle_id",
};

// One pick per column; the first id that exists in `hats` wins.
const PREFERRED = {
	hat: ["cowboy", "wizard", "tophat"],
	bow: ["acorn_bow", "bumblebee_bow", "black_bow_tie"],
	glasses: ["aviator_sunglasses", "heart_sunglasses"],
	mask: ["cat_mask", "hero_mask"],
	scarf: ["bandana_red"],
	held: ["mud_shovel", "magic_wand", "balloon"],
	aura: ["firefly_aura"],
	background: [],
	tickle_particle: [],
};

function serviceRoleKey() {
	if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY;
	const raw = execFileSync(
		"supabase",
		["projects", "api-keys", "--project-ref", PROJECT_REF, "--output", "json"],
		{ encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
	);
	const key = JSON.parse(raw).find((e) => e.name === "service_role")?.api_key;
	if (!key) throw new Error("Supabase service-role key is unavailable");
	return key;
}

const db = createClient(
	process.env.SUPABASE_URL || `https://${PROJECT_REF}.supabase.co`,
	serviceRoleKey(),
	{ auth: { persistSession: false } },
);

const { data: profile, error: profileError } = await db
	.from("profiles")
	.select("id, username")
	.ilike("username", username)
	.maybeSingle();
if (profileError) throw profileError;
if (!profile) throw new Error(`Profile not found: ${username}`);

const { data: hats, error: hatsError } = await db
	.from("hats")
	.select("id, category")
	.order("id");
if (hatsError) throw hatsError;
const byId = new Map(hats.map((h) => [h.id, h]));

// Resolve one item per COLUMN (glasses and mask both, so the face is full).
const wanted = new Map(); // column → { id, category }
for (const [category, column] of Object.entries(COLUMN)) {
	if (wanted.has(column)) continue;
	const forced = overrides
		.map((o) => o.split("="))
		.find(([c]) => c === category)?.[1];
	const candidates = forced ? [forced] : PREFERRED[category] ?? [];
	let pick = candidates.map((id) => byId.get(id)).find(Boolean);
	if (!pick && category !== "necklace") {
		// Fall back to the first live item of any category that maps here.
		const cats = Object.entries(COLUMN).filter(([, c]) => c === column).map(([c]) => c);
		pick = hats.find((h) => cats.includes(h.category));
	}
	if (forced && !pick) throw new Error(`${forced} is not in the hats catalog`);
	if (pick) {
		if (COLUMN[pick.category] !== column) {
			throw new Error(`${pick.id} is a ${pick.category}, not a ${category}`);
		}
		wanted.set(column, pick);
	}
}

// Grant (idempotent), then equip.
const rows = [...wanted.values()].map((h) => ({ user_id: profile.id, hat_id: h.id }));
const { error: grantError } = await db
	.from("user_hats")
	.upsert(rows, { onConflict: "user_id,hat_id", ignoreDuplicates: true });
if (grantError) throw grantError;

const patch = Object.fromEntries([...wanted].map(([column, h]) => [column, h.id]));
const { error: equipError } = await db.from("profiles").update(patch).eq("id", profile.id);
if (equipError) throw equipError;

console.log(JSON.stringify({ ok: true, username: profile.username, equipped: patch }));
