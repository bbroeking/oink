import { rpcAction } from "@/utils/rpc";
import type {
	RewardedAdBackend,
	RewardedAdVerification,
} from "./rewardedAdFlow";
import type {
	RewardedAdOfferBackend,
	RewardedAdOfferStatus,
} from "./rewardedAdsBackend";

type RpcCall = typeof rpcAction;

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * The app never mints an ad reward. It reserves an attempt, gives its opaque ID
 * to AdMob SSV, then polls until the signed callback has finalized the grant.
 */
export function createSupabaseRewardedAdBackend({
	call = rpcAction,
	delay = pause,
	pollAttempts = 12,
	pollDelayMs = 1_000,
}: {
	call?: RpcCall;
	delay?: (ms: number) => Promise<void>;
	pollAttempts?: number;
	pollDelayMs?: number;
} = {}): RewardedAdBackend & RewardedAdOfferBackend {
	return {
		async offerStatus(): Promise<RewardedAdOfferStatus> {
			const result = await call<{
				kind?: string;
				reward_amount?: number;
				next_eligible_at?: string | null;
			}>("rewarded_ad_offer_status");
			if (!result.ok) return { kind: "hidden" };
			if (result.kind === "age_required") {
				return { kind: "age_required", rewardAmount: result.reward_amount ?? 3 };
			}
			if (result.kind === "available") {
				return { kind: "available", rewardAmount: result.reward_amount ?? 3 };
			}
			if (result.kind === "limit_reached") {
				return {
					kind: "limit_reached",
					nextEligibleAt: result.next_eligible_at ?? null,
				};
			}
			return { kind: "hidden" };
		},

		async confirmAgeEligibility(is13OrOlder) {
			const result = await call("confirm_rewarded_ad_age_eligibility", {
				p_is_13_or_older: is13OrOlder,
			});
			return { ok: result.ok };
		},

		async reserve() {
			const result = await call<{ attempt_id?: string; reward_amount?: number }>(
				"reserve_rewarded_ad"
			);
			if (!result.ok || !result.attempt_id) {
				return {
					ok: false as const,
					reason: result.ok ? "unavailable" : result.reason,
				};
			}
			return {
				ok: true as const,
				attemptId: result.attempt_id,
				rewardAmount: result.reward_amount ?? 3,
			};
		},

		async markStarted(attemptId, responseId) {
			const result = await call("mark_rewarded_ad_started", {
				p_attempt_id: attemptId,
				p_provider_response_id: responseId ?? null,
			});
			return { ok: result.ok };
		},

		async cancel(attemptId) {
			await call("cancel_rewarded_ad_attempt", { p_attempt_id: attemptId });
		},

		async waitForVerification(attemptId): Promise<RewardedAdVerification> {
			for (let attempt = 0; attempt < pollAttempts; attempt += 1) {
				const result = await call<{
					kind?: string;
					reward_amount?: number;
					balance?: number;
					reason?: string;
				}>("rewarded_ad_attempt_status", { p_attempt_id: attemptId });
				if (result.ok && result.kind === "verified") {
					return {
						kind: "verified",
						rewardAmount: result.reward_amount ?? 0,
						balance: result.balance ?? 0,
					};
				}
				if (!result.ok) {
					return { kind: "rejected", reason: result.reason };
				}
				if (result.kind === "rejected") {
					return { kind: "rejected", reason: result.reason ?? "rejected" };
				}
				if (attempt < pollAttempts - 1) await delay(pollDelayMs);
			}
			return { kind: "pending" };
		},
	};
}
