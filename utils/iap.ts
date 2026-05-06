// RevenueCat in-app purchase integration.
//
// SETUP (one-time, in this order):
//   1. Sign Paid Apps Agreement in App Store Connect (Account > Agreements)
//   2. Add banking + tax info in App Store Connect
//   3. Create products in App Store Connect:
//        - lifetime (Non-Consumable)
//        - yearly (Auto-Renewable Subscription, Subscription Group "Tickle the Pig Pro")
//        - monthly (Auto-Renewable Subscription, same group)
//   4. RevenueCat dashboard: https://app.revenuecat.com
//      - Create iOS app, paste the App-Specific Shared Secret from ASC
//      - Map the 3 products to entitlement `tickle_the_pig_pro`
//      - Create an Offering (default) with all 3 packages
//      - Configure a Paywall on the offering (RevenueCat dashboard → Paywalls)
//   5. Replace REVENUECAT_IOS_API_KEY below if needed
//
// In dev, sandbox testers handle purchases (App Store Connect > Users and Access > Sandbox Testers).

import Purchases, {
	CustomerInfo,
	PurchasesOffering,
	PurchasesPackage,
	LOG_LEVEL,
} from "react-native-purchases";
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";
import { Platform } from "react-native";

// Public iOS API key — find at: https://app.revenuecat.com/projects/<project>/apps/<app>
//
// Override at build time by setting EXPO_PUBLIC_REVENUECAT_IOS_KEY in your env
// or in a `.env` file at the project root. The default is a sandbox key and
// will work for dev/sandbox testing but MUST be replaced for production.
const REVENUECAT_IOS_API_KEY =
	process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ??
	"test_HbqMbZIVgDwzJBpsgudluPEOSNb";

// Entitlement identifier — MUST match the exact ID in RevenueCat dashboard.
// (The user-facing display name is "Tickle the Pig Pro", but the identifier
// is the snake-case slug below. Update if your dashboard uses a different ID.)
export const ENTITLEMENT_PRO = "tickle_the_pig_pro";

// Product identifiers — must match App Store Connect AND the RC offering
export const PRODUCT_IDS = {
	lifetime: "lifetime",
	yearly: "yearly",
	monthly: "monthly",
} as const;

let initialized = false;

// ──────────────────────────────────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────────────────────────────────

export async function initIAP(userId: string) {
	if (initialized) {
		try {
			await Purchases.logIn(userId);
		} catch (e) {
			console.error("[iap] logIn:", e);
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
		console.error("[iap] configure:", e);
	}
}

// ──────────────────────────────────────────────────────────────────────────
// Entitlement / customer info
// ──────────────────────────────────────────────────────────────────────────

// Single source of truth for "does the user have Tickle the Pig Pro?"
export async function isPro(): Promise<boolean> {
	try {
		const info = await Purchases.getCustomerInfo();
		return !!info.entitlements.active[ENTITLEMENT_PRO];
	} catch {
		return false;
	}
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
	try {
		return await Purchases.getCustomerInfo();
	} catch (e) {
		console.error("[iap] getCustomerInfo:", e);
		return null;
	}
}

// Subscribe to entitlement changes — e.g., when an Apple webhook fires after
// purchase, or when restore returns. Use in a useEffect.
export function onCustomerInfoUpdate(cb: (info: CustomerInfo) => void) {
	Purchases.addCustomerInfoUpdateListener(cb);
	return () => Purchases.removeCustomerInfoUpdateListener(cb);
}

// ──────────────────────────────────────────────────────────────────────────
// Offerings (the products configured in RC dashboard)
// ──────────────────────────────────────────────────────────────────────────

export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
	try {
		const offerings = await Purchases.getOfferings();
		return offerings.current;
	} catch (e) {
		console.error("[iap] getCurrentOffering:", e);
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
	try {
		const result = await RevenueCatUI.presentPaywallIfNeeded({
			requiredEntitlementIdentifier: ENTITLEMENT_PRO,
		});
		return mapPaywallResult(result);
	} catch (e) {
		console.error("[iap] presentPaywallIfNeeded:", e);
		return { ok: false, reason: "error" };
	}
}

// Always present the paywall (even if user already has Pro — useful if you want
// to let them upgrade from Monthly to Lifetime, etc.).
export async function presentPaywall(): Promise<PaywallOutcome> {
	try {
		const result = await RevenueCatUI.presentPaywall();
		return mapPaywallResult(result);
	} catch (e) {
		console.error("[iap] presentPaywall:", e);
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
	try {
		await RevenueCatUI.presentCustomerCenter();
	} catch (e) {
		console.error("[iap] presentCustomerCenter:", e);
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
	try {
		const { customerInfo } = await Purchases.purchasePackage(pkg);
		return { ok: true, customerInfo };
	} catch (e: any) {
		if (e.userCancelled) return { ok: false, reason: "cancelled" };
		console.error("[iap] purchase:", e);
		return { ok: false, reason: e.message ?? "unknown" };
	}
}

export async function purchaseProductId(
	productId: string
): Promise<{ ok: boolean; reason?: string }> {
	const offerings = await Purchases.getOfferings();
	const allPackages = offerings.current?.availablePackages ?? [];
	const pkg = allPackages.find((p) => p.product.identifier === productId);
	if (!pkg) return { ok: false, reason: "product_not_found" };
	return purchasePackage(pkg);
}

// Apple-required "Restore Purchases" button. Customer Center already handles
// this internally, but expose this if you want a standalone link.
export async function restorePurchases(): Promise<{
	ok: boolean;
	customerInfo?: CustomerInfo;
}> {
	try {
		const info = await Purchases.restorePurchases();
		return { ok: true, customerInfo: info };
	} catch (e) {
		console.error("[iap] restore:", e);
		return { ok: false };
	}
}

// ──────────────────────────────────────────────────────────────────────────
// Backwards-compat for existing call sites (`hasPremium`, `hasVIP`, etc.).
// All collapse to the single "Pro" entitlement now.
// ──────────────────────────────────────────────────────────────────────────

export async function hasPremium(): Promise<boolean> {
	return isPro();
}
export async function hasPremiumPlus(): Promise<boolean> {
	return isPro();
}
export async function hasVIP(): Promise<boolean> {
	return isPro();
}

export const ENTITLEMENTS = {
	pro: ENTITLEMENT_PRO,
	premium: ENTITLEMENT_PRO,
	premiumPlus: ENTITLEMENT_PRO,
	vip: ENTITLEMENT_PRO,
} as const;
