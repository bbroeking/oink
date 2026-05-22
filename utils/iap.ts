// RevenueCat in-app purchase integration.
//
// SETUP (one-time, in this order):
//   1. Sign Paid Apps Agreement in App Store Connect (Account > Agreements)
//   2. Add banking + tax info in App Store Connect
//   3. Create products in App Store Connect:
//      a) The "Slop Club" membership — yearly + monthly Auto-Renewable
//         subscriptions in one Subscription Group:
//           - yearly  ($29.99/yr)
//           - monthly ($3.99/mo)
//      b) The Season Pass — a Consumable, $4.99. (Consumable, NOT
//         non-consumable: it's re-bought every season. The per-season
//         scoping is handled server-side by grant_season_pass.)
//   4. RevenueCat dashboard: https://app.revenuecat.com
//      - Create iOS app, paste the App-Specific Shared Secret from ASC
//      - Map both products to entitlement `tickle_the_pig_pro`
//      - Create an Offering (default) with both packages
//      - Configure a Paywall on the offering (RevenueCat dashboard → Paywalls)
//   5. Replace REVENUECAT_IOS_API_KEY below if needed
//
// In dev, sandbox testers handle purchases (App Store Connect > Users and Access > Sandbox Testers).

import Purchases, {
	CustomerInfo,
	PurchasesError,
	PurchasesOffering,
	PurchasesPackage,
	LOG_LEVEL,
} from "react-native-purchases";
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";
import { Platform } from "react-native";
import { log } from "./log";

// Master kill switch — when false, every IAP entry point becomes a no-op,
// nothing is initialized, no network calls are made, and UI gates on it to
// hide paywall surfaces. Flip to `true` to bring monetization back online.
export const IAP_ENABLED = false;

// Public iOS API key — find at: https://app.revenuecat.com/projects/<project>/apps/<app>
//
// Override at build time by setting EXPO_PUBLIC_REVENUECAT_IOS_KEY in your env
// or in a `.env` file at the project root. The default is a sandbox key and
// will work for dev/sandbox testing but MUST be replaced for production.
const REVENUECAT_IOS_API_KEY =
	process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ??
	"test_HbqMbZIVgDwzJBpsgudluPEOSNb";

// Entitlement identifier for the membership — MUST match the exact ID
// in the RevenueCat dashboard. The user-facing name is "Slop Club";
// the identifier slug below is internal and stays as-is (renaming it
// means re-configuring App Store Connect + RevenueCat).
export const ENTITLEMENT_PRO = "tickle_the_pig_pro";

// Product identifiers — must match App Store Connect AND the RC
// offering. `monthly` / `yearly` are the Slop Club subscription;
// `seasonPass` is the one-time per-season Season Pass.
export const PRODUCT_IDS = {
	yearly: "yearly",
	monthly: "monthly",
	seasonPass: "season_pass",
} as const;

let initialized = false;

// ──────────────────────────────────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────────────────────────────────

export async function initIAP(userId: string) {
	if (!IAP_ENABLED) return;
	if (initialized) {
		try {
			await Purchases.logIn(userId);
		} catch (e) {
			log.error("[iap] logIn:", e);
		}
		return;
	}
	if (Platform.OS !== "ios") {
		// Android: also configure if you ship an Android app — uses a separate Google API key
		return;
	}
	if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
	try {
		await Purchases.configure({
			apiKey: REVENUECAT_IOS_API_KEY,
			appUserID: userId,
		});
		initialized = true;
	} catch (e) {
		log.error("[iap] configure:", e);
	}
}

// ──────────────────────────────────────────────────────────────────────────
// Entitlement / customer info
// ──────────────────────────────────────────────────────────────────────────

// Single source of truth for "does the user have Tickle the Pig Pro?"
export async function isPro(): Promise<boolean> {
	if (!IAP_ENABLED) return false;
	try {
		const info = await Purchases.getCustomerInfo();
		return !!info.entitlements.active[ENTITLEMENT_PRO];
	} catch {
		return false;
	}
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
	if (!IAP_ENABLED) return null;
	try {
		return await Purchases.getCustomerInfo();
	} catch (e) {
		log.error("[iap] getCustomerInfo:", e);
		return null;
	}
}

// Subscribe to entitlement changes — e.g., when an Apple webhook fires after
// purchase, or when restore returns. Use in a useEffect.
export function onCustomerInfoUpdate(cb: (info: CustomerInfo) => void) {
	if (!IAP_ENABLED) return () => {};
	Purchases.addCustomerInfoUpdateListener(cb);
	return () => Purchases.removeCustomerInfoUpdateListener(cb);
}

// ──────────────────────────────────────────────────────────────────────────
// Offerings (the products configured in RC dashboard)
// ──────────────────────────────────────────────────────────────────────────

export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
	if (!IAP_ENABLED) return null;
	try {
		const offerings = await Purchases.getOfferings();
		return offerings.current;
	} catch (e) {
		log.error("[iap] getCurrentOffering:", e);
		return null;
	}
}

// ──────────────────────────────────────────────────────────────────────────
// Paywall — RevenueCat's native paywall component (set up in RC dashboard).
// This is the recommended modern flow: one call, RC handles the UI + purchase.
// ──────────────────────────────────────────────────────────────────────────

type PaywallOutcome = {
	ok: boolean;
	reason?: "purchased" | "restored" | "cancelled" | "no_offering" | "error";
};

// Present paywall ONLY if the user doesn't already have the entitlement.
// Returns immediately as { ok:true, reason: "purchased" } if they do.
export async function presentPaywallIfNeeded(): Promise<PaywallOutcome> {
	if (!IAP_ENABLED) return { ok: false, reason: "cancelled" };
	try {
		const result = await RevenueCatUI.presentPaywallIfNeeded({
			requiredEntitlementIdentifier: ENTITLEMENT_PRO,
		});
		return mapPaywallResult(result);
	} catch (e) {
		log.error("[iap] presentPaywallIfNeeded:", e);
		return { ok: false, reason: "error" };
	}
}

// Always present the paywall (even if user already has Pro — useful if you want
// to let them upgrade from Monthly to Lifetime, etc.).
export async function presentPaywall(): Promise<PaywallOutcome> {
	if (!IAP_ENABLED) return { ok: false, reason: "cancelled" };
	try {
		const result = await RevenueCatUI.presentPaywall();
		return mapPaywallResult(result);
	} catch (e) {
		log.error("[iap] presentPaywall:", e);
		return { ok: false, reason: "error" };
	}
}

function mapPaywallResult(result: PAYWALL_RESULT): PaywallOutcome {
	switch (result) {
		case PAYWALL_RESULT.PURCHASED:
			return { ok: true, reason: "purchased" };
		case PAYWALL_RESULT.RESTORED:
			return { ok: true, reason: "restored" };
		case PAYWALL_RESULT.CANCELLED:
			return { ok: false, reason: "cancelled" };
		case PAYWALL_RESULT.NOT_PRESENTED:
			return { ok: true, reason: "purchased" }; // already had it
		case PAYWALL_RESULT.ERROR:
		default:
			return { ok: false, reason: "error" };
	}
}

// ──────────────────────────────────────────────────────────────────────────
// Customer Center — RevenueCat's native subscription management UI.
// Lets users see active subscriptions, cancel, restore, get help — all in
// one screen managed by RC. Apple-required UX, free with the SDK.
// ──────────────────────────────────────────────────────────────────────────

export async function presentCustomerCenter(): Promise<void> {
	if (!IAP_ENABLED) return;
	try {
		await RevenueCatUI.presentCustomerCenter();
	} catch (e) {
		log.error("[iap] presentCustomerCenter:", e);
	}
}

// ──────────────────────────────────────────────────────────────────────────
// Lower-level purchase API (only needed if you build a custom paywall instead
// of using RC's). Most callers should use presentPaywallIfNeeded() above.
// ──────────────────────────────────────────────────────────────────────────

export async function purchasePackage(pkg: PurchasesPackage): Promise<{
	ok: boolean;
	customerInfo?: CustomerInfo;
	reason?: string;
}> {
	if (!IAP_ENABLED) return { ok: false, reason: "cancelled" };
	try {
		const { customerInfo } = await Purchases.purchasePackage(pkg);
		return { ok: true, customerInfo };
	} catch (e) {
		const err = e as PurchasesError;
		if (err.userCancelled) return { ok: false, reason: "cancelled" };
		log.error("[iap] purchase:", e);
		return { ok: false, reason: err.message ?? "unknown" };
	}
}

// Buy a single product by its identifier — used for the one-time
// Season Pass (the subscription goes through the paywall instead).
// Searches every offering, not just `current`, so the pass and the
// subscription can live in separate offerings.
export async function purchaseProductId(
	productId: string
): Promise<{ ok: boolean; reason?: string }> {
	if (!IAP_ENABLED) return { ok: false, reason: "cancelled" };
	const offerings = await Purchases.getOfferings();
	const pkg = Object.values(offerings.all)
		.flatMap((o) => o.availablePackages)
		.find((p) => p.product.identifier === productId);
	if (!pkg) return { ok: false, reason: "product_not_found" };
	return purchasePackage(pkg);
}

// Apple-required "Restore Purchases" button. Customer Center already handles
// this internally, but expose this if you want a standalone link.
export async function restorePurchases(): Promise<{
	ok: boolean;
	customerInfo?: CustomerInfo;
}> {
	if (!IAP_ENABLED) return { ok: false };
	try {
		const info = await Purchases.restorePurchases();
		return { ok: true, customerInfo: info };
	} catch (e) {
		log.error("[iap] restore:", e);
		return { ok: false };
	}
}
