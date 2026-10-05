// The Wallow is the season-pass prestige loop. XP remains monotonic in the
// database; each completed Wallow moves the visible window forward by one
// pass-length. Keeping the math pure here makes the client preview and the SQL
// contract easy to compare.

import { createConfigCell } from "@/utils/configCell";

export interface WallowTuning {
	majorRanks: number;
	majorStepPct: number;
	minorStepPct: number;
	regenCapPct: number;
	visitBaseHours: number;
	visitStepHours: number;
	visitMinHours: number;
}

const DEFAULT_WALLOW_TUNING: WallowTuning = Object.freeze({
	majorRanks: 2,
	majorStepPct: 25,
	minorStepPct: 5,
	regenCapPct: 70,
	visitBaseHours: 8,
	visitStepHours: 1,
	visitMinHours: 3,
});

function positive(raw: unknown, fallback: number): number {
	const value = typeof raw === "number" ? raw : Number(raw);
	return Number.isFinite(value) && value > 0 ? value : fallback;
}

function sanitizeWallowTuning(raw: unknown): WallowTuning {
	if (!raw || typeof raw !== "object") return DEFAULT_WALLOW_TUNING;
	const value = raw as Record<string, unknown>;
	const defaults = DEFAULT_WALLOW_TUNING;
	return {
		majorRanks: Math.floor(positive(value.major_ranks, defaults.majorRanks)),
		majorStepPct: positive(value.major_step_pct, defaults.majorStepPct),
		minorStepPct: positive(value.minor_step_pct, defaults.minorStepPct),
		regenCapPct: Math.min(
			95,
			positive(value.regen_cap_pct, defaults.regenCapPct),
		),
		visitBaseHours: positive(
			value.visit_base_hours,
			defaults.visitBaseHours,
		),
		visitStepHours: positive(
			value.visit_step_hours,
			defaults.visitStepHours,
		),
		visitMinHours: positive(value.visit_min_hours, defaults.visitMinHours),
	};
}

const tuningCell = createConfigCell<WallowTuning>({
	key: "wallow_tuning",
	fallback: DEFAULT_WALLOW_TUNING,
	sanitize: sanitizeWallowTuning,
	cacheKey: "wallow_tuning_v1",
	minRefreshMs: 60_000,
});

const wallowTuning = tuningCell.read;
export const refreshWallowTuning = tuningCell.refresh;

// Compatibility exports for the existing progress-pip surfaces.
export const WALLOW_REGEN_STEP_PCT = DEFAULT_WALLOW_TUNING.majorStepPct;
export const WALLOW_MAX_POWER_LEVEL = 6;

export function wallowCycleXp(totalTiers: number, xpPerTier: number): number {
	return Math.max(1, Math.floor(totalTiers)) * Math.max(1, Math.floor(xpPerTier));
}

export function xpInWallow(
	lifetimeSeasonXp: number,
	wallowCount: number,
	cycleXp: number
): number {
	const safeCycle = Math.max(1, Math.floor(cycleXp));
	return Math.max(
		0,
		Math.floor(lifetimeSeasonXp) - Math.max(0, Math.floor(wallowCount)) * safeCycle
	);
}

export function canWallow(
	lifetimeSeasonXp: number,
	wallowCount: number,
	cycleXp: number
): boolean {
	return xpInWallow(lifetimeSeasonXp, wallowCount, cycleXp) >= Math.max(1, cycleXp);
}

export function wallowWaitReductionLabel(percent: number): string {
	const safePercent = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
	return `wait reduced by ${safePercent}%`;
}

export function wallowProgress({
	xp,
	xpPerTier,
	currentTier,
	totalTiers,
	canWallow: ready,
	prestigeMode,
}: {
	xp: number;
	xpPerTier: number;
	currentTier: number;
	totalTiers: number;
	canWallow: boolean | undefined;
	prestigeMode: boolean;
}): { fraction: number; label: string } {
	const perTier = Math.max(1, Math.floor(xpPerTier));
	const safeXp = Math.max(0, Math.floor(xp));
	const intoTier = safeXp % perTier;
	const finalTierReached = currentTier >= totalTiers;

	if (ready === true) {
		return {
			fraction: 1,
			label: prestigeMode
				? "Ready to raise your Wallow rank ★"
				: "Ready to Wallow ★",
		};
	}

	// Tier N unlocks at the start of its XP band, so the final tier appears at
	// 2,900 XP in a 30 × 100 pass. That is not a completed 3,000 XP Wallow.
	if (ready === false && finalTierReached) {
		const remaining = intoTier === 0 ? perTier : perTier - intoTier;
		return {
			fraction: intoTier / perTier,
			label: `${remaining} XP left to Wallow`,
		};
	}

	if (finalTierReached) {
		return { fraction: 1, label: "Max tier reached ★" };
	}

	return {
		fraction: Math.max(0, Math.min(1, intoTier / perTier)),
		// Lowercase "tier", as the Pass panel's own "34 XP to tier 8" says it.
		label: `${intoTier} / ${perTier} XP to tier ${currentTier + 1}`,
	};
}

export function wallowPowerLevel(wallowCount: number): number {
	return Math.min(
		WALLOW_MAX_POWER_LEVEL,
		Math.max(0, Math.floor(wallowCount))
	);
}

export function wallowRegenPercent(wallowCount: number): number {
	const rank = Math.max(0, Math.floor(wallowCount));
	const tuning = wallowTuning();
	const major = Math.min(rank, tuning.majorRanks) * tuning.majorStepPct;
	const minor = Math.max(0, rank - tuning.majorRanks) * tuning.minorStepPct;
	return Math.min(tuning.regenCapPct, major + minor);
}

export function wallowRegenMultiplier(wallowCount: number): number {
	return 1 - wallowRegenPercent(wallowCount) / 100;
}

export function wallowRankLabel(wallowCount: number): string {
	const rank = Math.max(0, Math.floor(wallowCount));
	return rank > 0 ? `Wallow Rank ${rank}` : "Unwallowed";
}

export function wallowRegenSeconds(wallowCount: number): number {
	return Math.max(60, Math.round(3600 * wallowRegenMultiplier(wallowCount)));
}

export function wallowVisitCooldownHours(wallowCount: number): number {
	const rank = Math.max(0, Math.floor(wallowCount));
	const tuning = wallowTuning();
	return Math.max(
		tuning.visitMinHours,
		tuning.visitBaseHours - rank * tuning.visitStepHours,
	);
}

// ---------------------------------------------------------------------------
// The ladder — what a rank GRANTS, as rules over an unbounded integer.
//
// `docs/prestige-wallow-spec.md` (rewritten 2026-09-22): ranks 1–6 are the
// first chapter (one regalia piece and one clock step each, the set complete
// and the clock capped at W6); from rank 7 every rank still pays, by the rule
// below. Nothing here is a finite table of ranks — the tables are of ART, and
// a rank past the last drawn frame falls through to a rule that always holds.
//
// The SAME rule runs in the `wallow()` migration. Keep the two in step: this
// module is the client's statement of the server contract, not a second one.
// ---------------------------------------------------------------------------

/** Past this rank the clock never changes again (spec, invariant 4). */
export const WALLOW_CLOCK_CAP_RANK = 6;

/** What the W6 rung says instead of a clock delta, so no later rank reads as a missing step. */
export const WALLOW_CLOCK_CAP_NOTE = "your clock is at full blaze";

/** The catalog categories the regalia equips into (constants/slots routes them to columns). */
export type WallowRegaliaSlot = "hat" | "glasses" | "necklace" | "bow" | "held";

export interface WallowRegaliaPiece {
	/** The catalog item id — the same id `equip_cosmetic` takes. */
	hatId: string;
	name: string;
	slot: WallowRegaliaSlot;
}

// One outfit, five slots plus the aura: a W6 pig wears the whole set. The
// Sovereign Crown replaces the Rookie Cap on the head; both stay owned.
export const WALLOW_REGALIA: Readonly<Record<number, WallowRegaliaPiece>> =
	Object.freeze({
		1: { hatId: "wallow_rookie_cap", name: "Rookie Wallow Cap", slot: "hat" },
		2: { hatId: "wallow_bronze_specs", name: "Bronze Wallow Specs", slot: "glasses" },
		3: { hatId: "wallow_marsh_crown", name: "Marsh Wreath", slot: "necklace" },
		4: { hatId: "wallow_gilded_bow", name: "Gilded Wallow Bow", slot: "bow" },
		5: { hatId: "wallow_golden_trowel", name: "Golden Wallow Trowel", slot: "held" },
		6: { hatId: "wallow_sovereign_crown", name: "Wallow Sovereign Crown", slot: "hat" },
	});

/** How many pieces the first chapter holds — the "k of 6" every rank line counts against. */
export const WALLOW_REGALIA_COUNT = 6;

/** The regalia piece a rank granted, or null for W0 and for every rank past the set. */
export function wallowRegaliaFor(rank: number): WallowRegaliaPiece | null {
	return WALLOW_REGALIA[Math.max(0, Math.floor(rank))] ?? null;
}

/** Pieces of the set a rank owns: 0 at W0, every piece from W6 up. */
export function wallowRegaliaOwned(rank: number): number {
	return Math.min(WALLOW_REGALIA_COUNT, Math.max(0, Math.floor(rank)));
}

/** Aura ring stages that have art today. Past this the latest drawn ring holds. */
export const WALLOW_AURA_STAGES_DRAWN = 5;

/**
 * The aura stage a rank stands at. One stage per rank through W5, then one
 * every third rank forever: W6 and W7 hold stage 5, W8 is 6, W11 is 7, W14 is
 * 8. The badge numeral is the rank itself and is never capped.
 */
export function wallowAuraStage(rank: number): number {
	const r = Math.max(0, Math.floor(rank));
	if (r === 0) return 0;
	if (r <= WALLOW_AURA_STAGES_DRAWN) return r;
	return WALLOW_AURA_STAGES_DRAWN + Math.floor((r - WALLOW_AURA_STAGES_DRAWN) / 3);
}

/** The stage whose ring is actually DRAWN — a stage past the last one holds it. */
export function wallowAuraArtStage(rank: number): number {
	return Math.min(WALLOW_AURA_STAGES_DRAWN, wallowAuraStage(rank));
}

/** The inscribed Barn frames that have art, by the rank that grants them. */
export const WALLOW_KEEPSAKE_FRAMES: Readonly<Record<number, string>> =
	Object.freeze({ 1: "Bronze", 3: "Silver", 6: "Gold", 10: "Celestial" });

/** The same set as a sorted list — the "is this keepsake rank drawn yet?" gate. */
export const WALLOW_KEEPSAKE_RANKS_DRAWN: readonly number[] = Object.freeze([
	1, 3, 6, 10,
]);

/** The consolation every other rank past the set pays, minted through the audited grant paths. */
export const WALLOW_RANK_TRUFFLES = 2;
export const WALLOW_RANK_MOTES = 1;

export type WallowRankPrize =
	| ({ kind: "regalia"; label: string; note?: string } & WallowRegaliaPiece)
	| { kind: "keepsake"; label: string; frame: string; frameRank: number }
	| { kind: "aura"; label: string; stage: number }
	| { kind: "truffles"; label: string; truffles: number; motes: number };

/**
 * The one prize a rank grants, checked in the server's order:
 *
 *   1–6  · the regalia piece (and, at W6, the note that the clock has capped);
 *   ≥10 on a fifth rank WITH a drawn frame · a keepsake (only W10 today);
 *   ≥8 on every third rank · a new aura stage;
 *   everything else · two Golden Truffles and one Mote.
 *
 * A keepsake rank with no frame drawn yet (W15, W20 …) falls THROUGH to the
 * later rules rather than paying nothing — the ladder never has a dead rung.
 */
export function wallowRankPrize(rank: number): WallowRankPrize | null {
	const r = Math.floor(rank);
	if (r <= 0) return null;
	const piece = WALLOW_REGALIA[r];
	if (piece) {
		return {
			kind: "regalia",
			label: piece.name,
			...piece,
			...(r === WALLOW_CLOCK_CAP_RANK ? { note: WALLOW_CLOCK_CAP_NOTE } : null),
		};
	}
	const frame = WALLOW_KEEPSAKE_FRAMES[r];
	if (r >= 10 && r % 5 === 0 && frame) {
		return { kind: "keepsake", label: `${frame} keepsake`, frame, frameRank: r };
	}
	if (r >= 8 && (r - WALLOW_AURA_STAGES_DRAWN) % 3 === 0) {
		return { kind: "aura", label: "a new aura stage", stage: wallowAuraStage(r) };
	}
	return {
		kind: "truffles",
		label: `${WALLOW_RANK_TRUFFLES} Golden Truffles · ${WALLOW_RANK_MOTES} Mote`,
		truffles: WALLOW_RANK_TRUFFLES,
		motes: WALLOW_RANK_MOTES,
	};
}

/** What the next rank pays, for the rows that name it in one line. */
export function wallowNextPrizeLabel(rank: number): string {
	return wallowRankPrize(Math.max(0, Math.floor(rank)) + 1)?.label ?? "";
}
