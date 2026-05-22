// RevenueCat webhook → server-authoritative entitlement grants.
//
// Two separate products (see docs/pass-and-slop-club-spec.md):
//   • Slop Club   — the membership subscription. RevenueCat
//                   entitlement `tickle_the_pig_pro` → profiles.is_vip.
//   • Season Pass — a one-time consumable (product id `season_pass`)
//                   → user_season_progress.premium_unlocked for the
//                   active season. NOT tied to an RC entitlement.
//
// The membership and the pass are independent — buying one must NOT
// grant the other.
//
// Configure in RevenueCat → your project → Integrations → Webhooks:
//   URL:    https://<your-project>.supabase.co/functions/v1/revenuecat-webhook
//   Header: Authorization: Bearer <RC_WEBHOOK_AUTH_HEADER value>
//
// Set the shared secret + deploy:
//   supabase secrets set RC_WEBHOOK_AUTH_HEADER=<random_secret>
//   supabase functions deploy revenuecat-webhook --no-verify-jwt
// (--no-verify-jwt: RevenueCat is not a Supabase-authed caller; we
//  verify it ourselves via the Authorization header below.)
//
// SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are auto-injected.

// deno-lint-ignore-file
// @ts-nocheck — runs in Deno on Supabase Edge, not in our RN tsconfig.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RC_AUTH_TOKEN = Deno.env.get("RC_WEBHOOK_AUTH_HEADER");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MEMBERSHIP_ENTITLEMENT = "tickle_the_pig_pro";
const SEASON_PASS_PRODUCT = "season_pass";

interface RcEvent {
	event: {
		type: string;
		app_user_id?: string;
		original_app_user_id?: string;
		product_id?: string;
		entitlement_ids?: string[];
		expiration_at_ms?: number;
		environment?: "SANDBOX" | "PRODUCTION";
	};
}

// Membership activates on these. Access ENDS only on EXPIRATION /
// REFUND — CANCELLATION merely turns off auto-renew, the user keeps
// access until the paid period ends, so it is deliberately ignored.
const MEMBERSHIP_GRANT = new Set([
	"INITIAL_PURCHASE",
	"RENEWAL",
	"PRODUCT_CHANGE",
	"UNCANCELLATION",
]);
const MEMBERSHIP_REVOKE = new Set(["EXPIRATION", "REFUND"]);

Deno.serve(async (req) => {
	if (req.method !== "POST") {
		return new Response("Method not allowed", { status: 405 });
	}

	// Auth — verify the shared secret RevenueCat sends.
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

	const ev = payload.event;
	if (!ev?.type) return new Response("Missing event.type", { status: 400 });

	// app_user_id = the Supabase user UUID — set in initIAP via
	// Purchases.configure({ appUserID }) in utils/iap.ts.
	const userId = ev.app_user_id || ev.original_app_user_id;
	if (!userId) return new Response("Missing app_user_id", { status: 400 });

	const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
		auth: { persistSession: false },
	});

	// ── Season Pass — one-time purchase of the `season_pass` product.
	// Unlocks the premium reward track for the active season. The
	// upsert is idempotent, so RevenueCat retries are safe.
	if (
		ev.product_id === SEASON_PASS_PRODUCT &&
		ev.type === "NON_RENEWING_PURCHASE"
	) {
		const { data: seasons } = await supabase.rpc("active_season");
		const seasonId = Array.isArray(seasons) ? seasons[0]?.id : seasons?.id;
		if (!seasonId) {
			console.error("season_pass purchase with no active season", userId);
			return new Response("no active season", { status: 200 });
		}
		const { error } = await supabase
			.from("user_season_progress")
			.upsert(
				{ user_id: userId, season_id: seasonId, premium_unlocked: true },
				{ onConflict: "user_id,season_id" }
			);
		if (error) {
			console.error("season_pass grant failed", error);
			return new Response("DB error", { status: 500 });
		}
		return new Response("ok season_pass granted", { status: 200 });
	}

	// ── Slop Club membership — the subscription entitlement.
	const hasMembership = (ev.entitlement_ids || []).includes(
		MEMBERSHIP_ENTITLEMENT
	);
	if (hasMembership && MEMBERSHIP_GRANT.has(ev.type)) {
		const { error } = await supabase
			.from("profiles")
			.update({
				is_vip: true,
				vip_until: ev.expiration_at_ms
					? new Date(ev.expiration_at_ms).toISOString()
					: null,
			})
			.eq("id", userId);
		if (error) {
			console.error("membership grant failed", error);
			return new Response("DB error", { status: 500 });
		}
		return new Response("ok membership granted", { status: 200 });
	}

	// EXPIRATION / REFUND — the subscription's access has ended.
	// NOTE: a REFUND of the one-time Season Pass is not separately
	// unwound here (rare; the premium track simply stays for the
	// season). Revisit if refund abuse shows up.
	if (MEMBERSHIP_REVOKE.has(ev.type)) {
		const { error } = await supabase
			.from("profiles")
			.update({ is_vip: false, vip_until: null })
			.eq("id", userId);
		if (error) {
			console.error("membership revoke failed", error);
			return new Response("DB error", { status: 500 });
		}
		return new Response("ok membership revoked", { status: 200 });
	}

	// CANCELLATION / BILLING_ISSUE / TEST / TRANSFER / etc. — ack with
	// no state change.
	return new Response("ok ignored", { status: 200 });
});
