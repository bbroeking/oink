// Wire-level verification of the live rhythm migration (anon key, read-only / unauth).
// Confirms mud_rhythm_on()'s value and that the new RPCs EXIST on the deployed schema
// (an unauth call returns a STRUCTURED result/error, not PostgREST's "function not found").
// Run: node scripts/verify_rhythm.mjs
import { createClient } from "@supabase/supabase-js";

const url = "https://wbcnhvvakptoinwkulmn.supabase.co";
const anon =
	"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndiY25odnZha3B0b2lud2t1bG1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU4NzQ4NDAsImV4cCI6MjA1MTQ1MDg0MH0.tFthqZOKZaBVd5NYhNbF5LHTGpm5hClfLl8F5QESv9o";
const sb = createClient(url, anon, { auth: { persistSession: false } });

const ZERO = "00000000-0000-0000-0000-000000000000";

function classify(fn, data, error) {
	if (error) {
		if (error.code === "PGRST202") return `MISSING (not in schema): ${error.message}`;
		return `exists (errored: ${error.code ?? ""} ${error.message})`;
	}
	return `exists -> ${JSON.stringify(data)}`;
}

const { data: flag, error: flagErr } = await sb.rpc("mud_rhythm_on");
console.log(`mud_rhythm_on() = ${flag}${flagErr ? "  ERR " + flagErr.message : ""}`);

const probes = [
	["submit_run", { p_war: ZERO, p_bands: ["perfect"] }],
	["set_deploy", { p_war: ZERO, p_hard_front: "truffle", p_med_front: "bridge", p_easy_front: "gate" }],
	["dev_skip_to_hold", { p_war: ZERO }],
	["grant_war_access", { p_war: ZERO, p_recipient: ZERO }], // REVOKEd from PUBLIC -> should be a perms error, i.e. it EXISTS
	["war_state", { p_war: ZERO }],
];
for (const [fn, args] of probes) {
	const { data, error } = await sb.rpc(fn, args);
	console.log(`${fn.padEnd(18)} ${classify(fn, data, error)}`);
}
