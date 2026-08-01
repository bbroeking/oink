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

export const DEFAULT_WALLOW_TUNING: WallowTuning = Object.freeze({
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

export function sanitizeWallowTuning(raw: unknown): WallowTuning {
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

export const wallowTuning = tuningCell.read;
export const refreshWallowTuning = tuningCell.refresh;
export const resetWallowTuningForTests = tuningCell.resetForTests;

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
		label: `${intoTier} / ${perTier} XP to Tier ${currentTier + 1}`,
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
