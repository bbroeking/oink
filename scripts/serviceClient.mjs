// Shared service-role Supabase client for the DEV admin scripts.
//
// Every reset-*/mint-* script bypasses RLS with the service-role key, read from
// the environment (never hard-coded) so a missing key means it can't touch prod.
// This centralizes that setup so the project ref + env-var precedence + the
// persistSession:false client options can't drift between scripts.
//
//   import { serviceClient } from "./serviceClient.mjs";
//   const db = serviceClient(); // exits(1) with a clear message if the key is unset
import { createClient } from "@supabase/supabase-js";

const REF = "wbcnhvvakptoinwkulmn";

// Build a service-role client, or abort with a clear message if the key is unset.
// `onMissingKey` lets a caller with its own die()/usage helper report uniformly;
// the default prints + exits(1).
export function serviceClient(onMissingKey) {
	const url =
		process.env.SUPABASE_URL ||
		process.env.EXPO_PUBLIC_SUPABASE_URL ||
		`https://${REF}.supabase.co`;
	const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!key) {
		const msg = "Missing SUPABASE_SERVICE_ROLE_KEY — add it to .env.local and retry.";
		if (onMissingKey) onMissingKey(msg);
		else {
			console.error(msg);
			process.exit(1);
		}
	}
	return createClient(url, key, { auth: { persistSession: false } });
}
