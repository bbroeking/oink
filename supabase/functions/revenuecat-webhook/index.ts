// RevenueCat webhook → server-side entitlement validation.
//
// Configure in RevenueCat dashboard → your project → Integrations → Webhooks:
//   URL: https://<your-project>.supabase.co/functions/v1/revenuecat-webhook
//   Authorization header: Bearer <RC_WEBHOOK_AUTH_HEADER value below>
//
// Deploy:
//   supabase functions deploy revenuecat-webhook --no-verify-jwt
//
// Required env vars (set via supabase CLI):
//   supabase secrets set RC_WEBHOOK_AUTH_HEADER=<random_secret>
//   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are auto-injected.

// deno-lint-ignore-file
// @ts-nocheck — runs in Deno on Supabase Edge, not in our RN tsconfig.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RC_AUTH_TOKEN = Deno.env.get("RC_WEBHOOK_AUTH_HEADER");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PRO_ENTITLEMENT = "tickle_the_pig_pro";

interface RcEvent {
	event: {
		type: string;
		app_user_id?: string;
		original_app_user_id?: string;
		entitlement_ids?: string[];
		expiration_at_ms?: number;
		environment?: "SANDBOX" | "PRODUCTION";
	};
}

const ACTIVATING_EVENTS = new Set([
	"INITIAL_PURCHASE",
	"RENEWAL",
	"PRODUCT_CHANGE",
	"NON_RENEWING_PURCHASE",
	"UNCANCELLATION",
]);

const DEACTIVATING_EVENTS = new Set([
	"CANCELLATION",
	"EXPIRATION",
	"BILLING_ISSUE",
	"REFUND",
	"SUBSCRIPTION_PAUSED",
]);

Deno.serve(async (req) => {
	// Auth: check shared secret in Authorization header
	if (RC_AUTH_TOKEN) {
		const auth = req.headers.get("authorization") || "";
		if (auth !== `Bearer ${RC_AUTH_TOKEN}`) {
			return new Response("Unauthorized", { status: 401 });
		}
	}

	let payload: RcEvent;
	try {
		payload = (await req.json()) as RcEvent;
	} catch {
		return new Response("Bad JSON", { status: 400 });
	}

	const { event } = payload;
	if (!event?.type) {
		return new Response("Missing event.type", { status: 400 });
	}

	// app_user_id is what we set in initIAP via Purchases.configure({ appUserID }).
	// In Tickle the Pig, that's the Supabase user UUID.
	const userId = event.app_user_id || event.original_app_user_id;
	if (!userId) {
		return new Response("Missing app_user_id", { status: 400 });
	}

	const isPro = (event.entitlement_ids || []).includes(PRO_ENTITLEMENT);

	const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
		auth: { persistSession: false },
	});

	if (ACTIVATING_EVENTS.has(event.type) && isPro) {
		// Flip is_vip + premium_unlocked = true
		const { error } = await supabase
			.from("profiles")
			.update({
				is_vip: true,
				vip_until: event.expiration_at_ms
					? new Date(event.expiration_at_ms).toISOString()
					: null,
			})
			.eq("id", userId);
		if (error) {
			console.error("activate failed", error);
			return new Response("DB error", { status: 500 });
		}
		// Also unlock current season's premium track
		await supabase.rpc("dev_unlock_premium", { plus: true }).catch(() => {});
		return new Response("ok activated", { status: 200 });
	}

	if (DEACTIVATING_EVENTS.has(event.type)) {
		// Don't stomp an active referral-granted free month of Slop Club.
		// is_vip can be on for two reasons (paid sub OR a referral grant);
		// clearing it on a store expiration must preserve a grant that's
		// still in its window. The nightly cron expires the grant later.
		const { data: prof } = await supabase
			.from("profiles")
			.select("slop_club_grant_until")
			.eq("id", userId)
			.single();
		const grantActive =
			!!prof?.slop_club_grant_until &&
			new Date(prof.slop_club_grant_until).getTime() > Date.now();
		const { error } = await supabase
			.from("profiles")
			.update({
				is_vip: grantActive,
				vip_until: null,
			})
			.eq("id", userId);
		if (error) {
			console.error("deactivate failed", error);
			return new Response("DB error", { status: 500 });
		}
		return new Response("ok deactivated", { status: 200 });
	}

	// TEST_NOTIFICATION, TRANSFER, etc. — acknowledge without changing state
	return new Response("ok ignored", { status: 200 });
});
