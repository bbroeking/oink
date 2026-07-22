#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const PROJECT_REF = "wbcnhvvakptoinwkulmn";
const username = process.argv[2];

if (!username) {
	console.error("Usage: unlock-auras-for-user.mjs <username>");
	process.exit(2);
}

function serviceRoleKey() {
	if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
		return process.env.SUPABASE_SERVICE_ROLE_KEY;
	}

	const raw = execFileSync(
		"supabase",
		[
			"projects",
			"api-keys",
			"--project-ref",
			PROJECT_REF,
			"--output",
			"json",
		],
		{ encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
	);
	const keys = JSON.parse(raw);
	const serviceRole = keys.find((entry) => entry.name === "service_role");
	if (!serviceRole?.api_key) {
		throw new Error("Supabase service-role key is unavailable");
	}
	return serviceRole.api_key;
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

const { data: auras, error: auraError } = await db
	.from("hats")
	.select("id")
	.eq("category", "aura")
	.order("id");

if (auraError) throw auraError;

const auraIds = (auras || []).map(({ id }) => id);
const { data: owned, error: ownedError } = await db
	.from("user_hats")
	.select("hat_id")
	.eq("user_id", profile.id)
	.in("hat_id", auraIds);

if (ownedError) throw ownedError;

const ownedIds = new Set((owned || []).map(({ hat_id }) => hat_id));
const missingIds = auraIds.filter((id) => !ownedIds.has(id));

if (missingIds.length) {
	const { error: grantError } = await db.from("user_hats").upsert(
		missingIds.map((hatId) => ({ user_id: profile.id, hat_id: hatId })),
		{ onConflict: "user_id,hat_id", ignoreDuplicates: true },
	);
	if (grantError) throw grantError;
}

console.log(
	JSON.stringify({
		ok: true,
		username: profile.username,
		auraCount: auraIds.length,
		alreadyOwned: ownedIds.size,
		granted: missingIds.length,
	}),
);
