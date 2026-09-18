// The Errand — the compiled tuning FALLBACK and the wire shapes.
//
// Brief: docs/pig-errands-build-brief.md (Build 1, 2026-09-18); spec:
// docs/pig-errands-spec.md. The server owns every number in ERRAND_TUNING
// (app_settings.errand_tuning, read through utils/errands' config cell); this
// file is only what the binary boots on. Build 1 ships every pig identical
// (R5: nose 1 · trot 2 · pockets 1 · glint 1, family null) — the pips are
// catalog data per pig so Build 2 is a data change, never a binary.
//
// The flag ships FALSE. `enabled=false` hides the action, the fan row and the
// yard line; open errands still return and can be claimed (the kill switch
// never strands a pig in the hedge).

import type { SatchelFindId } from "@/constants/satchel";
import type { PigId } from "@/utils/pigs";

export type ErrandPip = 1 | 2 | 3;
export type ErrandFamily = "brook" | "hedge" | "meadow" | "lost";

export interface ErrandPigStats {
	/** Better odds on the target find. */
	nose: ErrandPip;
	/** Faster home: trot 1 = 6 h, 2 = 4 h, 3 = 2 h. */
	trot: ErrandPip;
	/** How many finds fit in the mouth (a second roll from 2). */
	pockets: ErrandPip;
	/** Rarer "anything" finds. */
	glint: ErrandPip;
	family: ErrandFamily | null;
}

export interface ErrandTuning {
	enabled: boolean;
	durationHours: { trot1: number; trot2: number; trot3: number };
	targetOddsPts: { common: number; uncommon: number; rare: number };
	noseBonusPts: { 1: number; 2: number; 3: number };
	anythingWeights: {
		glint1: [number, number, number];
		glint2: [number, number, number];
		glint3: [number, number, number];
	};
	/** Odds (in points of 100) a pig that missed its target comes back with
	 *  something else instead of nothing. */
	distractedPts: number;
	/** How many returns wait on the corkboard before a pig rests. */
	boardCap: number;
	pigs: Record<PigId, ErrandPigStats>;
}

const GENERIC_WORKER: ErrandPigStats = Object.freeze({
	nose: 1,
	trot: 2,
	pockets: 1,
	glint: 1,
	family: null,
}) as ErrandPigStats;

/** Every pig's pips in Build 1 — identical on purpose (R5). */
export const ERRAND_PIGS: Readonly<Record<PigId, ErrandPigStats>> = Object.freeze({
	rosie: GENERIC_WORKER,
	copper: GENERIC_WORKER,
	pepper: GENERIC_WORKER,
	bandit: GENERIC_WORKER,
	pickles: GENERIC_WORKER,
	biscuit: GENERIC_WORKER,
});

export const ERRAND_TUNING: Readonly<ErrandTuning> = Object.freeze<ErrandTuning>({
	enabled: false,
	durationHours: { trot1: 6, trot2: 4, trot3: 2 },
	targetOddsPts: { common: 60, uncommon: 40, rare: 20 },
	noseBonusPts: { 1: 0, 2: 10, 3: 20 },
	anythingWeights: {
		glint1: [70, 25, 5],
		glint2: [60, 30, 10],
		glint3: [50, 35, 15],
	},
	distractedPts: 10,
	boardCap: 3,
	pigs: ERRAND_PIGS,
});

/** Where an errand row stands. `back` is the only state the corkboard draws;
 *  `kept` / `given` / `recalled` are history. */
export type ErrandStatus = "out" | "back" | "kept" | "given" | "recalled";

export const ERRAND_STATUSES: readonly ErrandStatus[] = ["out", "back", "kept", "given", "recalled"];

export interface ErrandRow {
	id: number;
	pig_id: PigId;
	/** null = "anything". */
	target_find_id: SatchelFindId | null;
	/** The friend whose wish this is, when the target is a friend's wish. */
	for_user_id: string | null;
	for_wish_no: number | null;
	started_at: string;
	ends_at: string;
	status: ErrandStatus;
	/** What the pig brought back — filled by the server at `ends_at`, never
	 *  by the client. Empty = muddy trotters. */
	result_find_ids: SatchelFindId[];
}
