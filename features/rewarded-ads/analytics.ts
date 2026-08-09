import { analyticsSessionId } from "@/utils/interactionAnalytics";
import { rpcAction } from "@/utils/rpc";

export type RewardedAdAnalyticsEvent =
	| "rewarded_ad_offer_opened"
	| "rewarded_ad_started"
	| "rewarded_ad_finished";

export type RewardedAdAnalyticsResult =
	| "cancelled"
	| "failed"
	| "succeeded"
	| "unavailable";

export async function trackRewardedAdInteraction(
	eventName: RewardedAdAnalyticsEvent,
	result?: RewardedAdAnalyticsResult
): Promise<boolean> {
	try {
		const response = await rpcAction("record_rewarded_ad_interaction", {
			p_session_id: analyticsSessionId,
			p_event_name: eventName,
			p_result: result ?? null,
		});
		return response.ok;
	} catch {
		return false;
	}
}
