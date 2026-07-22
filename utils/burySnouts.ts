// Buried-truffle stake math — the pure "Max" helpers shared by both truffle
// sheets (BuryTruffleSheet + BuriedTruffleSheet) so the pot-cap / min-stake
// constants live in ONE place instead of being re-declared per sheet.
//
// "Max" means "fill up to the 50-snout pot cap, bounded by my balance". The two
// flows differ only in their floor: a fresh bury needs the server minimum stake
// (10), a top-up only needs 1 (so a 43/50 pot can be topped to exactly 50). The
// callers decide validity against those floors and dim the Max chip accordingly;
// these functions just return the concrete number Max resolves to.

export const POT_CAP = 50; // a buried pot never holds more than 50 snouts
export const MIN_STAKE = 10; // the server's minimum fresh-bury stake

// Fresh-bury Max: fill the whole pot, bounded by the host's balance. Returns 0
// for an empty/negative balance; the caller treats anything < MIN_STAKE as an
// invalid (dimmed) Max chip.
export function maxBuryStake(balance: number): number {
	return Math.min(Math.max(0, Math.floor(balance)), POT_CAP);
}

// Top-up Max: fill the remaining headroom to the cap, bounded by balance. A pot
// already at/over the cap (or an empty balance) yields 0; the caller treats
// anything < 1 as an invalid (dimmed) Max chip.
export function maxTopUp(balance: number, remaining: number): number {
	const headroom = Math.max(0, POT_CAP - remaining);
	return Math.min(Math.max(0, Math.floor(balance)), headroom);
}
