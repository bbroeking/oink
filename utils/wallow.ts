// The Wallow is the season-pass prestige loop. XP remains monotonic in the
// database; each completed Wallow moves the visible window forward by one
// pass-length. Keeping the math pure here makes the client preview and the SQL
// contract easy to compare.

// The first two Wallows are major power ranks: 25% faster, then 50% faster.
// Lifetime rank keeps rising after that, but regeneration caps at rank two so
// prestige stays exciting without eventually collapsing the tickle clock.
export const WALLOW_REGEN_STEP_PCT = 25;
export const WALLOW_MAX_POWER_LEVEL = 2;

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

export function wallowPowerLevel(wallowCount: number): number {
	return Math.min(
		WALLOW_MAX_POWER_LEVEL,
		Math.max(0, Math.floor(wallowCount))
	);
}

export function wallowRegenPercent(wallowCount: number): number {
	return wallowPowerLevel(wallowCount) * WALLOW_REGEN_STEP_PCT;
}

export function wallowRegenMultiplier(wallowCount: number): number {
	return 1 - wallowRegenPercent(wallowCount) / 100;
}

export function wallowRankLabel(wallowCount: number): string {
	const rank = Math.max(0, Math.floor(wallowCount));
	return rank > 0 ? `Wallow Rank ${rank}` : "Unwallowed";
}
