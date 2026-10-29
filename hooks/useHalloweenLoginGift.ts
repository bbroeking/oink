import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import type {
	HalloweenLoginGiftReceipt,
	HalloweenLoginGiftResult,
} from "@/features/cards/domain/halloweenLoginGift";
import {
	acknowledgeHalloweenLoginGift,
	claimHalloweenLoginGift,
} from "@/utils/halloweenLoginGift";

export type HalloweenLoginGiftError = "claim_failed" | "ack_failed";

export interface UseHalloweenLoginGiftOptions {
	userId: string | null;
	enabled: boolean;
	clientBuild: number;
	fitPolicyVersion: number;
}

export interface UseHalloweenLoginGiftResult {
	receipt: HalloweenLoginGiftReceipt | null;
	pending: boolean;
	error: HalloweenLoginGiftError | null;
	claim: () => Promise<HalloweenLoginGiftResult | null>;
	acknowledge: () => Promise<boolean>;
}

/**
 * Login lifecycle for the durable server receipt. State is scoped to the full
 * account/config identity so a late request from a signed-out or switched
 * account cannot publish a receipt into the new session.
 */
export function useHalloweenLoginGift({
	userId,
	enabled,
	clientBuild,
	fitPolicyVersion,
}: UseHalloweenLoginGiftOptions): UseHalloweenLoginGiftResult {
	const identityKey = `${userId ?? "signed-out"}:${enabled ? 1 : 0}:${clientBuild}:${fitPolicyVersion}`;
	const identityRef = useRef(identityKey);
	identityRef.current = identityKey;
	const inFlight = useRef<{ key: string; promise: Promise<HalloweenLoginGiftResult | null> } | null>(null);
	const ackInFlight = useRef<{ key: string; promise: Promise<boolean> } | null>(null);
	const [publication, setPublication] = useState<{
		key: string;
		receipt: HalloweenLoginGiftReceipt;
	} | null>(null);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<HalloweenLoginGiftError | null>(null);
	// State clearing happens in an effect, but consumers render immediately on
	// an auth prop change. Never expose the prior account's receipt during that
	// intervening render.
	const receipt = publication?.key === identityKey ? publication.receipt : null;

	const eligible = !!userId && enabled && Number.isSafeInteger(clientBuild) && clientBuild > 0
		&& Number.isSafeInteger(fitPolicyVersion) && fitPolicyVersion > 0;

	const claim = useCallback(async (): Promise<HalloweenLoginGiftResult | null> => {
		if (!eligible) return null;
		const key = identityKey;
		if (inFlight.current?.key === key) return inFlight.current.promise;

		const request = claimHalloweenLoginGift(clientBuild, fitPolicyVersion);
		inFlight.current = { key, promise: request };
		if (identityRef.current === key) {
			setPending(true);
			setError(null);
		}
		try {
			const result = await request;
			if (identityRef.current !== key) return null;
			if (!result) {
				setError("claim_failed");
				return null;
			}
			setError(null);
			if (result.status === "inactive" || result.receipt.acknowledgedAt !== null) {
				setPublication(null);
			} else {
				setPublication({ key, receipt: result.receipt });
			}
			return result;
		} finally {
			if (inFlight.current?.key === key) inFlight.current = null;
			if (identityRef.current === key) setPending(false);
		}
	}, [clientBuild, eligible, fitPolicyVersion, identityKey]);

	const acknowledge = useCallback(async (): Promise<boolean> => {
		if (!eligible || !receipt) return false;
		const key = identityKey;
		const receiptId = receipt.receiptId;
		const ackKey = `${key}:${receiptId}`;
		if (ackInFlight.current?.key === ackKey) return ackInFlight.current.promise;
		const request = (async () => {
			setPending(true);
			setError(null);
			try {
				const result = await acknowledgeHalloweenLoginGift(receiptId);
				if (identityRef.current !== key) return false;
				if (!result || result.status === "inactive" || result.receipt.receiptId !== receiptId
					|| result.receipt.acknowledgedAt === null) {
					setError("ack_failed");
					return false;
				}
				setPublication(null);
				setError(null);
				return true;
			} finally {
				if (identityRef.current === key) setPending(false);
			}
		})();
		ackInFlight.current = { key: ackKey, promise: request };
		try {
			return await request;
		} finally {
			if (ackInFlight.current?.key === ackKey) ackInFlight.current = null;
		}
	}, [eligible, identityKey, receipt]);

	useEffect(() => {
		setPublication(null);
		setPending(false);
		setError(null);
		if (eligible) void claim();
	}, [eligible, identityKey, claim]);

	useEffect(() => () => {
		identityRef.current = "unmounted";
	}, []);

	useEffect(() => {
		if (!eligible) return;
		const appStateSubscription = AppState.addEventListener("change", (state) => {
			if (state === "active") void claim();
		});
		// React Native has no connection observer in this project. Web's online
		// event covers browser recovery; native recovery is covered by foreground
		// plus the public retry function used by the visible error action.
		const onlineTarget = globalThis as typeof globalThis & {
			addEventListener?: (type: string, listener: () => void) => void;
			removeEventListener?: (type: string, listener: () => void) => void;
		};
		const onOnline = () => { void claim(); };
		onlineTarget.addEventListener?.("online", onOnline);
		return () => {
			appStateSubscription.remove();
			onlineTarget.removeEventListener?.("online", onOnline);
		};
	}, [claim, eligible]);

	return { receipt, pending, error, claim, acknowledge };
}
