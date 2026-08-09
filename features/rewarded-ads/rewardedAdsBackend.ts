export type RewardedAdOfferStatus =
	| { kind: "hidden" }
	| { kind: "age_required"; rewardAmount: number }
	| { kind: "available"; rewardAmount: number }
	| { kind: "limit_reached"; nextEligibleAt: string | null };

export interface RewardedAdOfferBackend {
	offerStatus(): Promise<RewardedAdOfferStatus>;
	confirmAgeEligibility(is13OrOlder: boolean): Promise<{ ok: boolean }>;
}
