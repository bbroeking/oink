// Lucky Pig — pure helpers + tunables. The trigger-roll math lives
// here so it's unit-testable without mounting a React tree. The
// stateful hook (useLuckyPig) consumes these.
//
// Tunables are client-rolled by design (D in the design grill);
// trade-off documented in migrations/20260519020000_lucky_pig.sql.

export const LUCKY_TRIGGER_CHANCE        = 0.05;  // 5% steady-state on any non-lucky tickle
export const LUCKY_TRIGGER_CHANCE_BOOST  = 0.12;  // ~2.4× boost during the launch window
export const LUCKY_WINDOW_SIZE           = 10;    // tickles affected after a trigger
export const LUCKY_DOUBLE_CHANCE         = 0.30;  // 30% of window tickles double
export const LUCKY_TITLE_UNLOCK_CHANCE   = 0.20;  // 20% of lucky triggers also drop a title
export const LUCKY_STORAGE_KEY           = "lucky_pig_state_v1";
export const LUCKY_EVER_KEY              = "lucky_pig_ever_v1";
export const LUCKY_PRE_FIRST_KEY         = "lucky_pig_pre_first_v1";

// Time-bounded launch boost: while now() < this ISO, every tickle
// uses the boosted chance instead of steady-state. Update if you
// ship another lucky-pig promotion.
export const LUCKY_BOOST_UNTIL_ISO       = "2026-05-22T00:00:00Z";

// Per-user first-time guarantee: any user who has NEVER triggered a
// lucky pig will be force-fired on their Nth tickle. Caps the worst
// case of "I never see this feature."
export const LUCKY_GUARANTEED_BY_TICKLE_N = 8;

// sun_beam blessing → strong lucky-trigger boost (ritual effect).
export const LUCKY_TRIGGER_CHANCE_SUNBEAM = 0.4;

export interface RollLuckyInputs {
	isFirstTimeUser: boolean;
	// Pre-first tickles INCLUDING the current one (i.e. the count
	// already incremented for this tap). The guarantee fires when
	// this value is >= LUCKY_GUARANTEED_BY_TICKLE_N.
	preFirstTicklesIncludingThis: number;
	sunBeamActive: boolean;
	// Injection points for tests.
	now?: number;
	random?: () => number;
}

export type RollLuckyReason =
	| "first_time_guarantee"
	| "sunbeam"
	| "boost"
	| "steady"
	| "miss";

export interface RollLuckyDecision {
	triggerNow: boolean;
	reason: RollLuckyReason;
}

export function rollLucky({
	isFirstTimeUser,
	preFirstTicklesIncludingThis,
	sunBeamActive,
	now = Date.now(),
	random = Math.random,
}: RollLuckyInputs): RollLuckyDecision {
	if (
		isFirstTimeUser &&
		preFirstTicklesIncludingThis >= LUCKY_GUARANTEED_BY_TICKLE_N
	) {
		return { triggerNow: true, reason: "first_time_guarantee" };
	}
	const withinBoost = now < new Date(LUCKY_BOOST_UNTIL_ISO).getTime();
	const chance = sunBeamActive
		? LUCKY_TRIGGER_CHANCE_SUNBEAM
		: withinBoost
			? LUCKY_TRIGGER_CHANCE_BOOST
			: LUCKY_TRIGGER_CHANCE;
	if (random() < chance) {
		return {
			triggerNow: true,
			reason: sunBeamActive ? "sunbeam" : withinBoost ? "boost" : "steady",
		};
	}
	return { triggerNow: false, reason: "miss" };
}
