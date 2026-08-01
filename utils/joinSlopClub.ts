import type { PaywallOutcome } from "./iap";
import type { RpcResult } from "./rpc";
import type { PigId } from "./pigs";

export type JoinSlopClubOutcome =
	| { kind: "joined"; pigId: PigId }
	| { kind: "cancelled" }
	| { kind: "unavailable" }
	| { kind: "paywall_error"; reason: string }
	| { kind: "recruit_error"; reason: string };

interface JoinSlopClubDependencies {
	iapEnabled: boolean;
	presentPaywall: () => Promise<PaywallOutcome>;
	recruit: (pigId: PigId) => Promise<RpcResult<{ pig_id: PigId }>>;
	wait?: (milliseconds: number) => Promise<void>;
}

const MEMBERSHIP_SYNC_ATTEMPTS = 8;
const MEMBERSHIP_SYNC_DELAY_MS = 750;

const defaultWait = (milliseconds: number) =>
	new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

// A purchase and the promised companion are one user action. RevenueCat's
// webhook may reach Supabase a few seconds after the paywall dismisses, so a
// membership_required response is retried briefly instead of making the player
// tap Recruit again after already paying.
export async function joinSlopClubAndRecruit(
	pigId: PigId,
	dependencies: JoinSlopClubDependencies,
): Promise<JoinSlopClubOutcome> {
	if (!dependencies.iapEnabled) return { kind: "unavailable" };

	const paywall = await dependencies.presentPaywall();
	if (!paywall.ok) {
		if (paywall.reason === "cancelled") return { kind: "cancelled" };
		return {
			kind: "paywall_error",
			reason: paywall.reason ?? "error",
		};
	}

	const wait = dependencies.wait ?? defaultWait;
	for (let attempt = 0; attempt < MEMBERSHIP_SYNC_ATTEMPTS; attempt += 1) {
		const result = await dependencies.recruit(pigId);
		if (result.ok) return { kind: "joined", pigId };
		if (result.reason !== "membership_required") {
			return { kind: "recruit_error", reason: result.reason };
		}
		if (attempt < MEMBERSHIP_SYNC_ATTEMPTS - 1) {
			await wait(MEMBERSHIP_SYNC_DELAY_MS);
		}
	}

	return { kind: "recruit_error", reason: "membership_syncing" };
}
