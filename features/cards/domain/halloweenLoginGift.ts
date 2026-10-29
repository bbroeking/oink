export const HALLOWEEN_LOGIN_GIFT_CAMPAIGN = "halloween_2026_login_gift_v1" as const;
export const HALLOWEEN_LOGIN_GIFT_FIT_POLICY_VERSION = 1 as const;

export const HALLOWEEN_LOGIN_GIFT_POOL = [
	{ costumeId: "halloween_2026_linen_lurker_costume", cardId: "halloween_2026_card_linen_lurker_costume" },
	{ costumeId: "halloween_2026_starspell_costume", cardId: "halloween_2026_card_starspell_costume" },
	{ costumeId: "halloween_2026_bat_nap_costume", cardId: "halloween_2026_card_bat_nap_costume" },
	{ costumeId: "halloween_2026_little_imp_costume", cardId: "halloween_2026_card_little_imp_costume" },
	{ costumeId: "halloween_2026_marshmallow_boo_costume", cardId: "halloween_2026_card_marshmallow_boo_costume" },
] as const;

export type HalloweenLoginGiftCostumeId = (typeof HALLOWEEN_LOGIN_GIFT_POOL)[number]["costumeId"];
export type HalloweenLoginGiftCardId = (typeof HALLOWEEN_LOGIN_GIFT_POOL)[number]["cardId"];

export interface HalloweenLoginGiftReceipt {
	receiptId: string;
	campaignKey: typeof HALLOWEEN_LOGIN_GIFT_CAMPAIGN;
	costumeId: HalloweenLoginGiftCostumeId;
	cardId: HalloweenLoginGiftCardId;
	claimedAt: string;
	acknowledgedAt: string | null;
}

export type HalloweenLoginGiftResult =
	| { ok: true; status: "inactive"; reason?: "client_build" | "fit_policy" | "costume_catalog" }
	| { ok: true; status: "new" | "replay"; receipt: HalloweenLoginGiftReceipt };

const poolByCostume = new Map(HALLOWEEN_LOGIN_GIFT_POOL.map((entry) => [entry.costumeId, entry.cardId]));

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Fail closed at the client boundary; the database remains authoritative. */
export function parseHalloweenLoginGiftResult(value: unknown): HalloweenLoginGiftResult | null {
	if (!isRecord(value) || value.ok !== true) return null;
	if (value.status === "inactive") {
		const reason = value.reason;
		return reason === "client_build" || reason === "fit_policy" || reason === "costume_catalog"
			? { ok: true, status: "inactive", reason }
			: { ok: true, status: "inactive" };
	}
	if ((value.status !== "new" && value.status !== "replay") || !isRecord(value.receipt)) return null;
	const receipt = value.receipt;
	if (
		typeof receipt.receiptId !== "string" ||
		receipt.campaignKey !== HALLOWEEN_LOGIN_GIFT_CAMPAIGN ||
		typeof receipt.costumeId !== "string" ||
		typeof receipt.cardId !== "string" ||
		poolByCostume.get(receipt.costumeId as HalloweenLoginGiftCostumeId) !== receipt.cardId ||
		typeof receipt.claimedAt !== "string" ||
		!(receipt.acknowledgedAt === null || typeof receipt.acknowledgedAt === "string")
	) return null;
	return { ok: true, status: value.status, receipt: receipt as unknown as HalloweenLoginGiftReceipt };
}

export function shouldPresentHalloweenLoginGift(result: HalloweenLoginGiftResult | null): boolean {
	return !!result && result.status !== "inactive" && result.receipt.acknowledgedAt === null;
}
