// RevenueCat in-app purchase integration.
//
// SETUP (one-time, in this order):
//   1. Sign Paid Apps Agreement in App Store Connect (Account > Agreements)
//   2. Add banking + tax info in App Store Connect
//   3. Create products in App Store Connect:
//      a) The "Slop Club" membership — yearly + monthly Auto-Renewable
//         subscriptions in one Subscription Group:
//           - yearly  ($29.99/yr)
//           - monthly ($2.99/mo)
//      b) The Season Pass — a Consumable, $4.99. (Consumable, NOT
//         non-consumable: it's re-bought every season. The per-season
//         scoping is handled server-side by grant_season_pass.)
//   4. RevenueCat dashboard: https://app.revenuecat.com
//      - Create iOS app, paste the App-Specific Shared Secret from ASC
//      - Map ONLY the subscriptions (monthly/yearly) to entitlement
//        `tickle_the_pig_pro`. Do NOT attach `season_pass` — the one-time
//        pass unlocks the premium *track* via grant_season_pass (webhook),
//        not the membership; mapping it would gift pass buyers full
//        Slop Club. (docs/revenuecat-asc-setup.md, "Note on season_pass".)
//      - Offerings: `slop_club` (monthly+yearly) and `season_pass`
//      - Configure a Paywall per offering (RevenueCat dashboard → Paywalls)
//   5. Replace REVENUECAT_IOS_API_KEY below if needed
//
// In dev, sandbox testers handle purchases (App Store Connect > Users
// and Access > Sandbox Testers).
//
// ── Architecture ─────────────────────────────────────────────────
// Two adapters at one seam: `realIAP` wraps RevenueCat; `noopIAP`
// returns cancelled / empty for every call. The module-level
// `iap = IAP_ENABLED ? realIAP : noopIAP` picks one at load time;
// the public re-exports below delegate. Adding a `mockIAP` for
// tests would be a third adapter at the same seam — no call-site
// changes needed.

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

// Master kill switch — when false, the noop adapter is selected and
// every IAP entry point becomes a no-op, nothing is initialized, and
// no network calls are made. UI gates on it to hide paywall surfaces.
//
// Default OFF. Turn it on at BUILD time with EXPO_PUBLIC_IAP_ENABLED=true
// (set it in your env / eas.json profile) — for a sandbox/StoreKit demo build,
// or the eventual production launch. Kept env-driven (not a hardcoded `true`)
// so monetization can be demoed without committing it live before the
// subscription redesign (regen pay-to-win removal, perks) lands.
// Public iOS API key — find at: https://app.revenuecat.com/projects/<project>/apps/<app>
//
// Override at build time by setting EXPO_PUBLIC_REVENUECAT_IOS_KEY in your env
// or in a `.env` file at the project root. The default is a sandbox key and
// will work for dev/sandbox testing but MUST be replaced for production.
const REVENUECAT_IOS_API_KEY =
	process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ??
	"test_HbqMbZIVgDwzJBpsgudluPEOSNb";

// Android is a separate RevenueCat app backed by Google Play. Do not fall
// back to the iOS/Test Store key: if the Android key has not been configured,
// the noop adapter hides purchase surfaces and keeps the rest of the game
// fully usable.
const REVENUECAT_ANDROID_API_KEY =
	process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

export const IAP_ENABLED =
	process.env.EXPO_PUBLIC_IAP_ENABLED === "true" &&
	(Platform.OS === "ios" ||
		(Platform.OS === "android" && !!REVENUECAT_ANDROID_API_KEY));

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

// Offering identifiers. Each RevenueCat *paywall design* is attached to
// an Offering, so to route to a specific design you present a specific
// offering — `slop_club` carries the subscription paywall, `season_pass`
// carries the one-time Season Pass paywall. These MUST match the
// Offering identifiers configured in the RevenueCat dashboard. Pass one
// to presentPaywall(); omit it to fall back to the `current` offering.
export const OFFERING_IDS = {
	slopClub: "slop_club",
	seasonPass: "season_pass",
} as const;

export type PaywallOutcome = {
	ok: boolean;
	reason?: "purchased" | "restored" | "cancelled" | "no_offering" | "error";
};

export type PurchaseOutcome = {
	ok: boolean;
	customerInfo?: CustomerInfo;
	reason?: string;
};

export type RestoreOutcome = {
	ok: boolean;
	customerInfo?: CustomerInfo;
};

// ──────────────────────────────────────────────────────────────────
// IAP interface — the public surface every adapter satisfies.
// ──────────────────────────────────────────────────────────────────

interface IAP {
	initIAP(userId: string): Promise<void>;
	isPro(): Promise<boolean>;
	getCustomerInfo(): Promise<CustomerInfo | null>;
	onCustomerInfoUpdate(cb: (info: CustomerInfo) => void): () => void;
	getCurrentOffering(): Promise<PurchasesOffering | null>;
	// offeringId routes to that offering's paywall design; omit for the
	// dashboard's `current` offering.
	presentPaywallIfNeeded(offeringId?: string): Promise<PaywallOutcome>;
	presentPaywall(offeringId?: string): Promise<PaywallOutcome>;
	presentCustomerCenter(): Promise<void>;
	purchasePackage(pkg: PurchasesPackage): Promise<PurchaseOutcome>;
	purchaseProductId(productId: string): Promise<PurchaseOutcome>;
	restorePurchases(): Promise<RestoreOutcome>;
}

// ──────────────────────────────────────────────────────────────────
// realIAP — backed by RevenueCat.
// IIFE captures the `initialized` flag in a closure so it isn't
// reachable outside this adapter.
// ──────────────────────────────────────────────────────────────────

const realIAP: IAP = (() => {
	let initialized = false;

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

	return {
		async initIAP(userId) {
			if (initialized) {
				try {
					await Purchases.logIn(userId);
				} catch (e) {
					log.error("[iap] logIn:", e);
				}
				return;
			}
			const apiKey =
				Platform.OS === "ios"
					? REVENUECAT_IOS_API_KEY
					: REVENUECAT_ANDROID_API_KEY;
			if (!apiKey) return;
			if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
			try {
				await Purchases.configure({
					apiKey,
					appUserID: userId,
				});
				initialized = true;
			} catch (e) {
				log.error("[iap] configure:", e);
			}
		},

		async isPro() {
			try {
				const info = await Purchases.getCustomerInfo();
				return !!info.entitlements.active[ENTITLEMENT_PRO];
			} catch {
				return false;
			}
		},

		async getCustomerInfo() {
			try {
				return await Purchases.getCustomerInfo();
			} catch (e) {
				log.error("[iap] getCustomerInfo:", e);
				return null;
			}
		},

		onCustomerInfoUpdate(cb) {
			Purchases.addCustomerInfoUpdateListener(cb);
			return () => Purchases.removeCustomerInfoUpdateListener(cb);
		},

		async getCurrentOffering() {
			try {
				const offerings = await Purchases.getOfferings();
				return offerings.current;
			} catch (e) {
				log.error("[iap] getCurrentOffering:", e);
				return null;
			}
		},

		async presentPaywallIfNeeded(offeringId) {
			try {
				let offering: PurchasesOffering | undefined;
				if (offeringId) {
					const offerings = await Purchases.getOfferings();
					offering = offerings.all[offeringId];
					if (!offering) return { ok: false, reason: "no_offering" };
				}
				const result = await RevenueCatUI.presentPaywallIfNeeded({
					requiredEntitlementIdentifier: ENTITLEMENT_PRO,
					...(offering ? { offering } : {}),
				});
				return mapPaywallResult(result);
			} catch (e) {
				log.error("[iap] presentPaywallIfNeeded:", e);
				return { ok: false, reason: "error" };
			}
		},

		async presentPaywall(offeringId) {
			try {
				const offerings = await Purchases.getOfferings();
				// Prefer the requested offering; fall back to the current/default
				// one so a Test Store or default-offering setup still shows a
				// paywall (its monthly/yearly packages). Only truly-empty → the
				// dev "Storefront not configured" fallback.
				const offering =
					(offeringId ? offerings.all[offeringId] : undefined) ??
					offerings.current ??
					undefined;
				if (!offering) return { ok: false, reason: "no_offering" };
				const result = await RevenueCatUI.presentPaywall({ offering });
				return mapPaywallResult(result);
			} catch (e) {
				log.error("[iap] presentPaywall:", e);
				return { ok: false, reason: "error" };
			}
		},

		async presentCustomerCenter() {
			try {
				await RevenueCatUI.presentCustomerCenter();
			} catch (e) {
				log.error("[iap] presentCustomerCenter:", e);
			}
		},

		async purchasePackage(pkg) {
			try {
				const { customerInfo } = await Purchases.purchasePackage(pkg);
				return { ok: true, customerInfo };
			} catch (e) {
				const err = e as PurchasesError;
				if (err.userCancelled) return { ok: false, reason: "cancelled" };
				log.error("[iap] purchase:", e);
				return { ok: false, reason: err.message ?? "unknown" };
			}
		},

		async purchaseProductId(productId) {
			const offerings = await Purchases.getOfferings();
			const pkg = Object.values(offerings.all)
				.flatMap((o) => o.availablePackages)
				.find((p) => p.product.identifier === productId);
			if (!pkg) return { ok: false, reason: "product_not_found" };
			return this.purchasePackage(pkg);
		},

		async restorePurchases() {
			try {
				const info = await Purchases.restorePurchases();
				return { ok: true, customerInfo: info };
			} catch (e) {
				log.error("[iap] restore:", e);
				return { ok: false };
			}
		},
	};
})();

// ──────────────────────────────────────────────────────────────────
// noopIAP — every method resolves with cancelled / empty. Selected
// when IAP_ENABLED=false; nothing is initialized + no network calls.
// ──────────────────────────────────────────────────────────────────

const noopIAP: IAP = {
	initIAP: async () => {},
	isPro: async () => false,
	getCustomerInfo: async () => null,
	onCustomerInfoUpdate: () => () => {},
	getCurrentOffering: async () => null,
	presentPaywallIfNeeded: async (_offeringId?: string) => ({
		ok: false,
		reason: "cancelled" as const,
	}),
	presentPaywall: async (_offeringId?: string) => ({
		ok: false,
		reason: "cancelled" as const,
	}),
	presentCustomerCenter: async () => {},
	purchasePackage: async () => ({ ok: false, reason: "cancelled" }),
	purchaseProductId: async () => ({ ok: false, reason: "cancelled" }),
	restorePurchases: async () => ({ ok: false }),
};

// ──────────────────────────────────────────────────────────────────
// Adapter selection + public re-exports.
// Choose the adapter ONCE at module load. Call sites stay byte-
// identical (the same function names are exported as before); the
// kill-switch decision lives at this one seam instead of branching
// inside every function body.
// ──────────────────────────────────────────────────────────────────

const iap: IAP = IAP_ENABLED ? realIAP : noopIAP;

export const initIAP = (userId: string) => iap.initIAP(userId);
export const isPro = () => iap.isPro();
export const getCustomerInfo = () => iap.getCustomerInfo();
export const onCustomerInfoUpdate = (cb: (info: CustomerInfo) => void) =>
	iap.onCustomerInfoUpdate(cb);
export const getCurrentOffering = () => iap.getCurrentOffering();
export const presentPaywallIfNeeded = (offeringId?: string) =>
	iap.presentPaywallIfNeeded(offeringId);
export const presentPaywall = (offeringId?: string) =>
	iap.presentPaywall(offeringId);
export const presentCustomerCenter = () => iap.presentCustomerCenter();
export const purchasePackage = (pkg: PurchasesPackage) =>
	iap.purchasePackage(pkg);
export const purchaseProductId = (productId: string) =>
	iap.purchaseProductId(productId);
export const restorePurchases = () => iap.restorePurchases();
