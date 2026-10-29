// The one-time "fresh start" moment for a season that began with a reset
// (Season 2, The Feast: the flip archives then zeroes snouts, the tickle bank
// and the Satchel, per the server's app_settings.season2_reset_scope).
//
// WHO SEES IT: a pig the flip actually zeroed something for. The server says
// which buckets through my_season_reset() (20261029190000), keyed to the
// active season, so a pig who joined after the flip, or one whose buckets were
// already empty, never sees it, and the line names only what really reset.
//
// ONCE: dismissing writes `fresh_start_seen:{season}:{uid}` to AsyncStorage.
// FAIL-SOFT: no RPC (unpushed migration), offline, a malformed answer, or a
// season without `announcesFreshStart` shows nothing.

import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { rpc } from "@/utils/rpc";
import { seasonTheme } from "@/utils/seasonTheme";

export type FreshStartKind = "snouts" | "tickle_bank" | "satchel";

const KIND_ORDER: readonly FreshStartKind[] = ["snouts", "tickle_bank", "satchel"];

const KIND_WORDS: Record<FreshStartKind, string> = {
	snouts: "snouts",
	tickle_bank: "tickle bank",
	satchel: "Satchel",
};

export const freshStartSeenKey = (seasonId: string, uid: string): string =>
	`fresh_start_seen:${seasonId}:${uid}`;

/** The known kinds in a server answer for this season, in a fixed order. Empty on any mismatch. */
export function parseFreshStart(raw: unknown, seasonId: string): FreshStartKind[] {
	if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return [];
	const r = raw as Record<string, unknown>;
	if (r.season_id !== seasonId || !Array.isArray(r.kinds)) return [];
	const got = new Set(r.kinds.filter((k): k is string => typeof k === "string"));
	return KIND_ORDER.filter((k) => got.has(k));
}

/**
 * The card's sentence, naming only what reset: "The Feast starts every pig
 * fresh, so your snouts, tickle bank and Satchel begin again at zero." A
 * single non-plural bucket takes "begins".
 */
export function freshStartLine(seasonTitle: string, kinds: readonly FreshStartKind[]): string {
	const words = KIND_ORDER.filter((k) => kinds.includes(k)).map((k) => KIND_WORDS[k]);
	if (words.length === 0) return "";
	const list =
		words.length === 1
			? words[0]
			: `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
	const verb = words.length === 1 && words[0] !== "snouts" ? "begins" : "begin";
	return `${seasonTitle} starts every pig fresh, so your ${list} ${verb} again at zero.`;
}

export const FRESH_START_KEEPS =
	"Your wardrobe, titles, Golden Truffles and Wallow rank all came with you.";

export interface FreshStart {
	/** What reset for this pig, or null when there is nothing to tell. */
	kinds: FreshStartKind[] | null;
	dismiss: () => void;
}

export function useFreshStart(seasonId: string | null | undefined, uid: string | null): FreshStart {
	const [kinds, setKinds] = useState<FreshStartKind[] | null>(null);

	useEffect(() => {
		setKinds(null);
		if (!seasonId || !uid || !seasonTheme(seasonId).announcesFreshStart) return;
		let alive = true;
		(async () => {
			try {
				if (await AsyncStorage.getItem(freshStartSeenKey(seasonId, uid))) return;
				const raw = await rpc<Record<string, unknown>>("my_season_reset");
				const parsed = parseFreshStart(raw, seasonId);
				if (alive && parsed.length > 0) setKinds(parsed);
			} catch {
				// fail-soft: no card
			}
		})();
		return () => {
			alive = false;
		};
	}, [seasonId, uid]);

	const dismiss = useCallback(() => {
		setKinds(null);
		if (seasonId && uid) {
			AsyncStorage.setItem(freshStartSeenKey(seasonId, uid), "1").catch(() => {});
		}
	}, [seasonId, uid]);

	return { kinds, dismiss };
}
