export type RewardedAdReservation =
	| {
			ok: true;
			attemptId: string;
			rewardAmount: number;
	  }
	| { ok: false; reason: string };

export type RewardedAdVerification =
	| { kind: "verified"; rewardAmount: number; balance: number }
	| { kind: "pending" }
	| { kind: "rejected"; reason: string };

export interface RewardedAdBackend {
	reserve(): Promise<RewardedAdReservation>;
	markStarted(attemptId: string, responseId?: string): Promise<{ ok: boolean }>;
	cancel(attemptId: string): Promise<void>;
	waitForVerification(attemptId: string): Promise<RewardedAdVerification>;
}

export interface RewardedAdProvider {
	load(attemptId: string): Promise<{ responseId?: string }>;
	show(): Promise<{ kind: "earned" } | { kind: "closed" }>;
}

export type RewardedAdFlowResult =
	| { kind: "granted"; rewardAmount: number; balance: number }
	| { kind: "unavailable"; reason: string }
	| { kind: "closed" }
	| { kind: "pending" };

export async function runRewardedAdFlow({
	backend,
	provider,
}: {
	backend: RewardedAdBackend;
	provider: RewardedAdProvider;
}): Promise<RewardedAdFlowResult> {
	const reservation = await backend.reserve();
	if (!reservation.ok) {
		return { kind: "unavailable", reason: reservation.reason };
	}

	let loaded: { responseId?: string };
	try {
		loaded = await provider.load(reservation.attemptId);
	} catch {
		await backend.cancel(reservation.attemptId);
		return { kind: "unavailable", reason: "ad_unavailable" };
	}
	const started = await backend.markStarted(reservation.attemptId, loaded.responseId);
	if (!started.ok) {
		await backend.cancel(reservation.attemptId);
		return { kind: "unavailable", reason: "reservation_expired" };
	}
	let watched: { kind: "earned" } | { kind: "closed" };
	try {
		watched = await provider.show();
	} catch {
		await backend.cancel(reservation.attemptId);
		return { kind: "unavailable", reason: "ad_unavailable" };
	}
	if (watched.kind !== "earned") {
		await backend.cancel(reservation.attemptId);
		return { kind: "closed" };
	}

	const verification = await backend.waitForVerification(reservation.attemptId);
	if (verification.kind === "verified") {
		return {
			kind: "granted",
			rewardAmount: verification.rewardAmount,
			balance: verification.balance,
		};
	}
	if (verification.kind === "rejected") {
		return { kind: "unavailable", reason: verification.reason };
	}
	return { kind: "pending" };
}
