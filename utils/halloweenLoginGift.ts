import {
	HALLOWEEN_LOGIN_GIFT_FIT_POLICY_VERSION,
	parseHalloweenLoginGiftResult,
	type HalloweenLoginGiftResult,
} from "@/features/cards/domain/halloweenLoginGift";
import { rpcOutcome } from "@/utils/rpc";

/**
 * Claims or replays the server-selected gift. Missing-function builds are a
 * normal dark-launch state and resolve to inactive; other failures stay null so
 * login can continue and retry later without acknowledging the gift.
 */
export async function claimHalloweenLoginGift(
	clientBuild: number,
	fitPolicyVersion: number = HALLOWEEN_LOGIN_GIFT_FIT_POLICY_VERSION,
): Promise<HalloweenLoginGiftResult | null> {
	if (!Number.isSafeInteger(clientBuild) || clientBuild < 1) return null;
	if (!Number.isSafeInteger(fitPolicyVersion) || fitPolicyVersion < 1) return null;
	const outcome = await rpcOutcome<unknown>("claim_halloween_login_gift", {
		p_client_build: clientBuild,
		p_fit_policy_version: fitPolicyVersion,
	});
	if (!outcome.ok) return outcome.kind === "missing_function" ? { ok: true, status: "inactive" } : null;
	return parseHalloweenLoginGiftResult(outcome.data);
}

/** Call only from an explicit Continue/Try-on action. Safe to repeat. */
export async function acknowledgeHalloweenLoginGift(receiptId: string): Promise<HalloweenLoginGiftResult | null> {
	if (!receiptId) return null;
	const outcome = await rpcOutcome<unknown>("acknowledge_halloween_login_gift", { p_receipt_id: receiptId });
	if (!outcome.ok) return outcome.kind === "missing_function" ? { ok: true, status: "inactive" } : null;
	return parseHalloweenLoginGiftResult(outcome.data);
}
