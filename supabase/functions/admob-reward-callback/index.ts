// Google AdMob rewarded-ad server-side verification callback.
// Deploy without Supabase JWT verification: Google authenticates by signing the
// exact query string. Never log the URL; it carries the opaque reward attempt.

// deno-lint-ignore-file no-explicit-any
// @ts-nocheck — Deno Edge entrypoint; the pure verifier is covered by Jest.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAdMobRewardCallback } from "./verify.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EXPECTED_AD_UNIT = Deno.env.get("ADMOB_REWARDED_IOS_UNIT_ID")!;
const EXPECTED_REWARD_ITEM = Deno.env.get("ADMOB_REWARD_ITEM") ?? "personal_tickles";
const EXPECTED_REWARD_AMOUNT = Number(Deno.env.get("ADMOB_REWARD_AMOUNT") ?? "3");
const KEY_URL = "https://www.gstatic.com/admob/reward/verifier-keys.json";

let cachedKeys: Map<string, CryptoKey> | null = null;
let keysExpireAt = 0;

function pemBytes(pem: string): Uint8Array {
	const base64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s/g, "");
	const binary = atob(base64);
	return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function resolveGoogleKey(keyId: string): Promise<CryptoKey | null> {
	if (!cachedKeys || Date.now() >= keysExpireAt) {
		const response = await fetch(KEY_URL);
		if (!response.ok) throw new Error("key_fetch_failed");
		const payload = await response.json();
		const imported = new Map<string, CryptoKey>();
		for (const key of payload.keys ?? []) {
			imported.set(
				String(key.keyId),
				await crypto.subtle.importKey(
					"spki",
					pemBytes(key.pem),
					{ name: "ECDSA", namedCurve: "P-256" },
					false,
					["verify"]
				)
			);
		}
		cachedKeys = imported;
		keysExpireAt = Date.now() + 6 * 60 * 60_000;
	}
	return cachedKeys.get(keyId) ?? null;
}

Deno.serve(async (request) => {
	if (request.method !== "GET") return new Response("method not allowed", { status: 405 });
	if (!EXPECTED_AD_UNIT || !Number.isSafeInteger(EXPECTED_REWARD_AMOUNT)) {
		return new Response("configuration error", { status: 500 });
	}

	let callback;
	try {
		callback = await verifyAdMobRewardCallback(request.url, {
			resolveKey: resolveGoogleKey,
			expectedAdUnit: EXPECTED_AD_UNIT,
			expectedRewardAmount: EXPECTED_REWARD_AMOUNT,
			expectedRewardItem: EXPECTED_REWARD_ITEM,
		});
	} catch {
		return new Response("invalid callback", { status: 401 });
	}

	const client = createClient(SUPABASE_URL, SERVICE_KEY, {
		auth: { persistSession: false },
	});
	const { data, error } = await client.rpc("finalize_rewarded_ad", {
		p_attempt_id: callback.attemptId,
		p_provider_transaction_id: callback.transactionId,
	});
	if (error) return new Response("temporary failure", { status: 500 });
	if (data?.ok !== true) {
		const permanent = [
			"invalid_attempt",
			"invalid_transaction",
			"expired_attempt",
			"limit_reached",
		].includes(data?.reason);
		return new Response(permanent ? "rejected" : "temporary failure", {
			status: permanent ? 200 : 500,
		});
	}
	return new Response(null, { status: 204 });
});
