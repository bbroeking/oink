// Expedition v0 — the pure sim kernel for Rosie's Ramble (technical name:
// "expedition"; player-facing: "Rosie's Ramble"). See
// docs/expedition-v0-playable-spec.md and docs/expedition-idle-battler-plan.md.
//
// PURITY LAW: this module is a pure sim kernel. NO react / react-native /
// AsyncStorage imports, and it never reads the platform clock — every function
// that needs the time takes `nowMs` from its caller. The guard-test in
// __tests__/expedition.test.ts source-scans this file to keep it that way
// (mirroring the repo's clock-guard idiom). Callers (hooks/useExpedition.ts)
// own the clock and persistence.
//
// GEAR → HAT ART MAPPING (v0 placeholder art). Gear renders its `artHatId` PNG
// from constants/hats.ts HAT_IMAGES until real ImageGen sprites land. The six
// nearest visual matches among existing items:
//   saucepan_lid    → slop_bucket_hat   (a metal dome worn on the head)
//   tin_colander    → bog_helmet        (a perforated metal helmet)
//   quilted_vest    → cape_scarf        (drapes over the body)
//   wooden_spoon    → mud_shovel        (a wooden-handled held tool)
//   rolled_newspaper→ toy_sword         (a rolled tube swung like a bat)
//   lucky_clover    → particle_clover   (literally a clover charm)

// ── Ability recipes (data, not code — the cosmeticFx.ts pattern) ─────────────
export type AbilityTrigger =
	| "on_wall_start"
	| "on_swing"
	| "on_zoomies"
	| "on_find"
	| "on_segment_enter"
	| "on_return";
export type AbilityEffect =
	| "block_hits"
	| "bonus_bonk"
	| "extra_find"
	| "find_quality_up"
	| "speed_up"
	| "zoomies_charge_up"
	| "cushion_up"
	| "double_first_swing";
export type AbilityRecipe = {
	trigger: AbilityTrigger;
	effect: AbilityEffect;
	magnitude: number;
	flavorLine: string;
};

export type GearSlot = "head" | "body" | "held" | "charm";
export type Rarity = "common" | "uncommon" | "rare"; // reuse RARITY_COLORS keys

export type GearPiece = {
	id: string;
	name: string;
	slot: GearSlot;
	bonk: number;
	cushion: number;
	sparkle: number;
	ability?: AbilityRecipe;
	rarity: Rarity;
	artHatId: string; // an existing constants/hats.ts HAT_IMAGES id (placeholder art)
};

export type TrickCard = {
	id: string;
	name: string;
	ability: AbilityRecipe;
	rarity: Rarity;
	starter: boolean;
};

export type EnemyDef = {
	id: string;
	name: string;
	hp: number;
	openingHit: boolean; // hits first unless blocked
	behaviorLine: string; // shown BEFORE the fight — the legibility law
	segment: number; // where it stands on the road
};

export type StatKey = "bonk" | "cushion" | "sparkle";

export type ExpeditionState = {
	chapter: 1;
	segment: number; // 0..12
	wallEnemyId: string | null;
	wallHp: number | null;
	loadout: Record<GearSlot, string | null>;
	tuckedCardId: string | null;
	cardPlayedThisFight: boolean;
	// A wall with openingHit knocks the first tickle off unless block_hits is
	// live; resolved lazily on the first tickle. (Not in the spec's type block —
	// added so the opening peck is legible + testable without a hidden re-scan.)
	openingHitPending: boolean;
	deck: Record<string, number>; // cardId -> count (dupes)
	gearOwned: string[];
	training: { pigId: string; cardId: string; stat: StatKey }[];
	zoomies: number; // 0..5
	mockTickles: number; // local stand-in bank, starts 20
	// Sub-interval carry for the mock tickle regen (Fix 3): the leftover real ms
	// that hasn't yet minted a whole tickle, banked across settles so no elapsed
	// time is lost. Derived deterministically in settle(); starts 0.
	tickleRegenRemainderMs: number;
	bestiary: Record<string, "unseen" | "met" | "defeated">;
	settledAtMs: number;
	tripIndex: number;
	lastReport: TripReport | null;
	chapterCleared: boolean;
};

export type FindRecord = {
	id: string;
	name: string;
	kind: "gear" | "card" | "snoutlet";
	quality: 1 | 2;
};

export type TripReport = {
	elapsedH: number;
	cappedH: number;
	segmentsWalked: number;
	finds: FindRecord[];
	wallStory: string | null; // why she stopped, in one glance
	gearMoments: string[]; // "Her Saucepan Lid blocked the opening peck"
	comedyBeat: string; // one per trip, seeded pick from a table of ~10
	// The Trick that rode this trip and then came home to the deck (Fix 4's
	// untuck-on-return). The postcard names it; null when nothing was tucked.
	tuckedHome: string | null;
};

// The blow-by-blow of one Zoomies burst / played card. (Referenced but not
// defined in the spec's type block; defined here.)
export type SwingResult = {
	damage: number;
	wallHpBefore: number;
	wallHpAfter: number;
	defeated: boolean;
	lines: string[];
};

export type Verdict = "wins" | "close" | "stuck";

// ── Content catalogs (v0) ────────────────────────────────────────────────────

export const ZOOMIES_MAX = 5;
export const AWAY_CAP_H = 8;
export const START_TICKLES = 20;
export const TRAINING_CAP = 5;
export const CHAPTER_END = 12;
// Mock tickle regen (Fix 3): the jar refills +1 per 10 real minutes, capped at
// START_TICKLES. Real elapsed time (not the away-walk cap) drives it — the jar
// fills while she walks, waits at a wall, or the app is closed.
export const TICKLE_REGEN_MS = 600_000; // 10 real minutes per tickle

export const GEAR_LIST: GearPiece[] = [
	{
		id: "saucepan_lid",
		name: "Saucepan Lid",
		slot: "head",
		bonk: 0,
		cushion: 2,
		sparkle: 0,
		rarity: "common",
		artHatId: "slop_bucket_hat",
		ability: {
			trigger: "on_wall_start",
			effect: "block_hits",
			magnitude: 1,
			flavorLine: "Her Saucepan Lid blocked the opening hit.",
		},
	},
	{
		id: "tin_colander",
		name: "Tin Colander",
		slot: "head",
		bonk: 0,
		cushion: 1,
		sparkle: 1,
		rarity: "uncommon",
		artHatId: "bog_helmet",
		ability: {
			trigger: "on_find",
			effect: "find_quality_up",
			magnitude: 1,
			flavorLine: "The Tin Colander made her finds shine brighter.",
		},
	},
	{
		id: "quilted_vest",
		name: "Quilted Vest",
		slot: "body",
		bonk: 0,
		cushion: 3,
		sparkle: 0,
		rarity: "uncommon",
		artHatId: "cape_scarf",
	},
	{
		id: "wooden_spoon",
		name: "Wooden Spoon",
		slot: "held",
		bonk: 2,
		cushion: 0,
		sparkle: 0,
		rarity: "common",
		artHatId: "mud_shovel",
		ability: {
			trigger: "on_zoomies",
			effect: "bonus_bonk",
			magnitude: 2,
			flavorLine: "Her Wooden Spoon made the Zoomies bonk for +2.",
		},
	},
	{
		id: "rolled_newspaper",
		name: "Rolled Newspaper",
		slot: "held",
		bonk: 1,
		cushion: 0,
		sparkle: 0,
		rarity: "uncommon",
		artHatId: "toy_sword",
		ability: {
			trigger: "on_wall_start",
			effect: "double_first_swing",
			magnitude: 1,
			flavorLine: "Her first swing bonked twice with the Rolled Newspaper.",
		},
	},
	{
		id: "lucky_clover",
		name: "Lucky Clover",
		slot: "charm",
		bonk: 0,
		cushion: 0,
		sparkle: 2,
		rarity: "rare",
		artHatId: "particle_clover",
		ability: {
			trigger: "on_return",
			effect: "extra_find",
			magnitude: 1,
			flavorLine: "The Lucky Clover turned up one extra find.",
		},
	},
];

export const GEAR: Record<string, GearPiece> = Object.fromEntries(
	GEAR_LIST.map((g) => [g.id, g])
);

export const CARD_LIST: TrickCard[] = [
	{
		id: "press_on",
		name: "Press On",
		starter: true,
		rarity: "common",
		ability: {
			trigger: "on_segment_enter",
			effect: "speed_up",
			magnitude: 2,
			flavorLine: "She walks two segments farther.",
		},
	},
	{
		id: "nose_for_shinies",
		name: "Nose for Shinies",
		starter: true,
		rarity: "common",
		ability: {
			trigger: "on_find",
			effect: "extra_find",
			magnitude: 1,
			flavorLine: "Her nose turns up one extra find.",
		},
	},
	{
		id: "study_the_wall",
		name: "Study the Wall",
		starter: true,
		rarity: "common",
		ability: {
			trigger: "on_wall_start",
			effect: "bonus_bonk",
			magnitude: 1,
			flavorLine: "She studied the wall — bonk +1 this fight.",
		},
	},
	{
		id: "zoomie_zephyr",
		name: "Zoomie Zephyr",
		starter: false,
		rarity: "uncommon",
		ability: {
			trigger: "on_zoomies",
			effect: "zoomies_charge_up",
			magnitude: 1,
			flavorLine: "Tickles charge the Zoomies double.",
		},
	},
	{
		id: "mud_mask",
		name: "Mud Mask",
		starter: false,
		rarity: "uncommon",
		ability: {
			trigger: "on_segment_enter",
			effect: "cushion_up",
			magnitude: 1,
			flavorLine: "A Mud Mask cushions the whole trip.",
		},
	},
	{
		id: "warm_tea",
		name: "Warm Tea",
		starter: false,
		rarity: "uncommon",
		ability: {
			trigger: "on_wall_start",
			effect: "block_hits",
			magnitude: 1,
			flavorLine: "Warm Tea steadies her against the opening hit.",
		},
	},
	{
		id: "braveheart_oink",
		name: "Braveheart Oink",
		starter: false,
		rarity: "rare",
		ability: {
			trigger: "on_swing",
			effect: "bonus_bonk",
			magnitude: 1,
			flavorLine: "A braveheart oink — every swing bonks +1.",
		},
	},
	{
		id: "second_snack",
		name: "Second Snack",
		starter: false,
		rarity: "rare",
		ability: {
			trigger: "on_return",
			effect: "extra_find",
			magnitude: 1,
			flavorLine: "A Second Snack — one extra find, and it shines.",
		},
	},
];

export const CARDS: Record<string, TrickCard> = Object.fromEntries(
	CARD_LIST.map((c) => [c.id, c])
);

export const STARTER_CARD_IDS = CARD_LIST.filter((c) => c.starter).map((c) => c.id);

export const ENEMY_LIST: EnemyDef[] = [
	{
		id: "gate_snail",
		name: "Gate Snail",
		hp: 3,
		openingHit: false,
		behaviorLine: "He is slow, but so is the gate.",
		segment: 3,
	},
	{
		id: "puddle_toad",
		name: "Puddle Toad",
		hp: 5,
		openingHit: true,
		behaviorLine: "He splashes first — bring a lid.",
		segment: 6,
	},
	{
		id: "tollbooth_goose",
		name: "Tollbooth Goose",
		hp: 9,
		openingHit: true,
		behaviorLine: "NO PIGS PAST. She pecks first.",
		segment: 12,
	},
];

export const ENEMIES: Record<string, EnemyDef> = Object.fromEntries(
	ENEMY_LIST.map((e) => [e.id, e])
);

// The Bramble is a hazard, not a fight — a Cushion gate that still lights a
// Bestiary page when she passes it.
export const BRAMBLE_ID = "the_bramble";
export const BRAMBLE_NAME = "The Bramble";
export const BRAMBLE_SEGMENT = 8;
export const BRAMBLE_CUSHION_ASK = 3;

// The four Bestiary entries (three fights + the hazard), in road order.
export const BESTIARY_IDS = [
	"gate_snail",
	"puddle_toad",
	BRAMBLE_ID,
	"tollbooth_goose",
];

export const BESTIARY_NAMES: Record<string, string> = {
	gate_snail: "Gate Snail",
	puddle_toad: "Puddle Toad",
	the_bramble: BRAMBLE_NAME,
	tollbooth_goose: "Tollbooth Goose",
};

type RoadSegment = {
	segment: number;
	wallEnemyId?: string;
	cushionAsk?: number;
	bestiaryId?: string;
};

// Chapter 1 road, segments 1..12. Walls at 3/6/12, the Bramble Cushion gate at 8.
export const ROAD: RoadSegment[] = (() => {
	const road: RoadSegment[] = [];
	for (let seg = 1; seg <= CHAPTER_END; seg++) {
		const wall = ENEMY_LIST.find((e) => e.segment === seg);
		if (wall) {
			road.push({ segment: seg, wallEnemyId: wall.id, bestiaryId: wall.id });
		} else if (seg === BRAMBLE_SEGMENT) {
			road.push({
				segment: seg,
				cushionAsk: BRAMBLE_CUSHION_ASK,
				bestiaryId: BRAMBLE_ID,
			});
		} else {
			road.push({ segment: seg });
		}
	}
	return road;
})();

function roadAt(segment: number): RoadSegment | undefined {
	return ROAD.find((r) => r.segment === segment);
}

const SNOUTLET_NAMES = [
	"a smooth river pebble",
	"a curl of birch bark",
	"a lucky acorn cap",
	"a tuft of sheep's wool",
	"a warm little stone",
	"a speckled feather",
	"a wax-sealed conker",
	"a shard of blue sea-glass",
	"a knot of soft moss",
	"a whistle made of reed",
];

const COMEDY_BEATS = [
	"Rosie napped in a sunbeam for a suspiciously long time.",
	"A butterfly was chased. The butterfly won.",
	"She practiced her most menacing oink at a fencepost.",
	"Rosie tried to befriend a scarecrow. Results inconclusive.",
	"A very important puddle required three full inspections.",
	"She rolled downhill on purpose, then acted like she meant to.",
	"Rosie collected a stick, lost the stick, mourned the stick.",
	"A bee explained the local politics. She listened politely.",
	"She found the exact center of a meadow and sat in it.",
	"Rosie snorted at her own reflection and won the argument.",
];

// ── Seeded RNG — mulberry32 over a hash of (seedDate, tripIndex, step) ────────

function hashSeed(parts: (number | string)[]): number {
	let h = 2166136261 >>> 0;
	for (const p of parts) {
		const s = String(p);
		for (let i = 0; i < s.length; i++) {
			h ^= s.charCodeAt(i);
			h = Math.imul(h, 16777619);
		}
		h = (h ^ 0x9e3779b9) >>> 0; // separator between parts
	}
	return h >>> 0;
}

function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return function () {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function pick<T>(rng: () => number, arr: T[]): T {
	return arr[Math.floor(rng() * arr.length) % arr.length];
}

// The per-trip seed base — a "daily seed" (the day of settledAtMs) crossed with
// the trip index, so a replayed trip is byte-identical.
function tripSeedDate(s: ExpeditionState): number {
	return Math.floor(s.settledAtMs / 86_400_000);
}

function round1(n: number): number {
	return Math.round(n * 10) / 10;
}

// ── Recipe gathering ─────────────────────────────────────────────────────────

function equippedGear(s: ExpeditionState): GearPiece[] {
	const slots: GearSlot[] = ["head", "body", "held", "charm"];
	const out: GearPiece[] = [];
	for (const slot of slots) {
		const id = s.loadout[slot];
		if (id && GEAR[id]) out.push(GEAR[id]);
	}
	return out;
}

function gearRecipes(s: ExpeditionState): AbilityRecipe[] {
	return equippedGear(s)
		.map((g) => g.ability)
		.filter((a): a is AbilityRecipe => !!a);
}

function tuckedRecipe(s: ExpeditionState): AbilityRecipe | null {
	if (!s.tuckedCardId) return null;
	return CARDS[s.tuckedCardId]?.ability ?? null;
}

// Trip effects (settle-time): equipped gear (always) + the tucked card's passive
// (always active for the trip it rode along on).
function tripRecipes(s: ExpeditionState): AbilityRecipe[] {
	const r = gearRecipes(s);
	const t = tuckedRecipe(s);
	return t ? [...r, t] : r;
}

// Fight effects: equipped gear (always) + the tucked card ONLY when it was
// played this fight (the one authored tap).
function fightRecipes(s: ExpeditionState): AbilityRecipe[] {
	const r = gearRecipes(s);
	const t = tuckedRecipe(s);
	return t && s.cardPlayedThisFight ? [...r, t] : r;
}

function sumEffect(
	recipes: AbilityRecipe[],
	effect: AbilityEffect,
	triggers?: AbilityTrigger[]
): number {
	return recipes
		.filter(
			(r) =>
				r.effect === effect && (!triggers || triggers.includes(r.trigger))
		)
		.reduce((acc, r) => acc + r.magnitude, 0);
}

// ── Public: stat totals ──────────────────────────────────────────────────────

export function statTotals(s: ExpeditionState): {
	bonk: number;
	cushion: number;
	sparkle: number;
} {
	// Base pig.
	let bonk = 1;
	let cushion = 0;
	let sparkle = 0;
	for (const g of equippedGear(s)) {
		bonk += g.bonk;
		cushion += g.cushion;
		sparkle += g.sparkle;
	}
	for (const t of s.training) {
		if (t.stat === "bonk") bonk += 1;
		else if (t.stat === "cushion") cushion += 1;
		else if (t.stat === "sparkle") sparkle += 1;
	}
	return { bonk, cushion, sparkle };
}

// ── Public: initial state ────────────────────────────────────────────────────

export function initialState(nowMs: number): ExpeditionState {
	const bestiary: ExpeditionState["bestiary"] = {};
	for (const id of BESTIARY_IDS) bestiary[id] = "unseen";
	const deck: Record<string, number> = {};
	for (const id of STARTER_CARD_IDS) deck[id] = 1;
	return {
		chapter: 1,
		segment: 0,
		wallEnemyId: null,
		wallHp: null,
		loadout: {
			head: "saucepan_lid",
			body: null,
			held: "wooden_spoon",
			charm: null,
		},
		tuckedCardId: null,
		cardPlayedThisFight: false,
		openingHitPending: false,
		deck,
		gearOwned: ["saucepan_lid", "wooden_spoon"],
		training: [],
		zoomies: 0,
		mockTickles: START_TICKLES,
		tickleRegenRemainderMs: 0,
		bestiary,
		settledAtMs: nowMs,
		tripIndex: 0,
		lastReport: null,
		chapterCleared: false,
	};
}

// ── Public: loadout + deck actions ───────────────────────────────────────────

export function equipGear(s: ExpeditionState, gearId: string): ExpeditionState {
	const gear = GEAR[gearId];
	if (!gear || !s.gearOwned.includes(gearId)) return s;
	return { ...s, loadout: { ...s.loadout, [gear.slot]: gearId } };
}

export function tuckCard(s: ExpeditionState, cardId: string): ExpeditionState {
	if (!CARDS[cardId] || (s.deck[cardId] ?? 0) < 1) return s;
	return { ...s, tuckedCardId: cardId, cardPlayedThisFight: false };
}

// Training — slide a DUPLICATE card under the pig for a permanent +1 to one stat.
// Dupe-only (count must exceed 1), capped at TRAINING_CAP tucks. (Not in the
// spec's kernel-API list, but required by the Training test + TrainingSheet.)
export function tuckTraining(
	s: ExpeditionState,
	cardId: string,
	stat: StatKey
): ExpeditionState {
	if (s.training.length >= TRAINING_CAP) return s;
	if ((s.deck[cardId] ?? 0) <= 1) return s; // dupe-only: keep the last copy usable
	const deck = { ...s.deck, [cardId]: s.deck[cardId] - 1 };
	return {
		...s,
		deck,
		training: [...s.training, { pigId: "rosie", cardId, stat }],
	};
}

// ── Public: deterministic daily hand ─────────────────────────────────────────

export function drawHand(s: ExpeditionState, dateKey: string): string[] {
	// The owned multiset — each card id repeated `count` times, so a dupe can
	// only appear in the hand when the owned count covers it.
	const pool: string[] = [];
	for (const id of Object.keys(s.deck)) {
		const count = s.deck[id] ?? 0;
		if (!CARDS[id]) continue;
		for (let i = 0; i < count; i++) pool.push(id);
	}
	// Fisher–Yates with a seed stable per day.
	const rng = mulberry32(hashSeed([dateKey, "hand"]));
	for (let i = pool.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		const tmp = pool[i];
		pool[i] = pool[j];
		pool[j] = tmp;
	}
	return pool.slice(0, 3);
}

// ── Fight math ───────────────────────────────────────────────────────────────

function blockActive(recipes: AbilityRecipe[]): boolean {
	return sumEffect(recipes, "block_hits") > 0;
}

// Damage of one Zoomies burst, given whether it's the first swing of the fight.
function burstDamage(
	s: ExpeditionState,
	isFirstSwing: boolean,
	recipes: AbilityRecipe[]
): number {
	let dmg = statTotals(s).bonk;
	dmg += sumEffect(recipes, "bonus_bonk", [
		"on_zoomies",
		"on_swing",
		"on_wall_start",
	]);
	if (isFirstSwing && sumEffect(recipes, "double_first_swing", ["on_wall_start"]) > 0) {
		dmg *= 2; // the first swing bonks twice
	}
	return dmg;
}

function chargeStep(recipes: AbilityRecipe[]): number {
	return 1 + sumEffect(recipes, "zoomies_charge_up", ["on_zoomies"]);
}

// Mock tickle regen (Fix 3) — derive the refilled jar from real elapsed ms,
// deterministically. A jar already at/over START_TICKLES banks no partial time;
// otherwise mint +1 per TICKLE_REGEN_MS and carry the sub-interval leftover so
// nothing is lost across settles. Never REDUCES an over-cap bank (test rigs set
// mockTickles well above the cap).
function regenTickles(
	s: ExpeditionState,
	elapsedMs: number
): { mockTickles: number; tickleRegenRemainderMs: number } {
	if (s.mockTickles >= START_TICKLES) {
		return { mockTickles: s.mockTickles, tickleRegenRemainderMs: 0 };
	}
	const totalMs = elapsedMs + (s.tickleRegenRemainderMs ?? 0);
	const rawGained = Math.floor(totalMs / TICKLE_REGEN_MS);
	const gained = Math.min(rawGained, START_TICKLES - s.mockTickles);
	return {
		mockTickles: s.mockTickles + gained,
		tickleRegenRemainderMs: totalMs % TICKLE_REGEN_MS,
	};
}

// ── Public: settle (the heart — advance the road from a daily seed) ───────────

export function settle(
	s: ExpeditionState,
	nowMs: number
): { state: ExpeditionState; report: TripReport | null } {
	const elapsedMs = Math.max(0, nowMs - s.settledAtMs);
	const elapsedH = elapsedMs / 3_600_000;
	const cappedH = Math.min(AWAY_CAP_H, elapsedH);
	// The jar refills over real elapsed time regardless of whether she walks —
	// threaded into every return below (waiting at a wall still refills).
	const regen = regenTickles(s, elapsedMs);

	// Already stuck at a wall → she waits (warmly). Advance the clock + refill the
	// jar; the tuck stays so it can be played in the fight (no report → no untuck).
	if (s.wallEnemyId) {
		return { state: { ...s, ...regen, settledAtMs: nowMs }, report: null };
	}
	// Chapter already cleared → the road rests.
	if (s.chapterCleared) {
		return { state: { ...s, ...regen, settledAtMs: nowMs }, report: null };
	}

	const totals = statTotals(s);
	const recipes = tripRecipes(s);
	const speed = sumEffect(recipes, "speed_up", ["on_segment_enter", "on_return"]);
	const cushion =
		totals.cushion + sumEffect(recipes, "cushion_up", ["on_segment_enter", "on_return"]);
	const maxSteps = Math.floor(cappedH) + speed;

	if (maxSteps <= 0) {
		return { state: { ...s, ...regen, settledAtMs: nowMs }, report: null };
	}

	const seedDate = tripSeedDate(s);
	const bestiary = { ...s.bestiary };
	const gearMoments: string[] = [];
	let segment = s.segment;
	let walked = 0;
	let wallEnemyId: string | null = null;
	let wallHp: number | null = null;
	let openingHitPending = false;
	let wallStory: string | null = null;
	let chapterCleared: boolean = s.chapterCleared;

	for (let step = 0; step < maxSteps; step++) {
		const next = segment + 1;
		if (next > CHAPTER_END) break;
		const seg = roadAt(next);
		if (!seg) break;

		// A wall she hasn't yet defeated stops her at its segment.
		if (seg.wallEnemyId && bestiary[seg.wallEnemyId] !== "defeated") {
			const enemy = ENEMIES[seg.wallEnemyId];
			segment = next;
			walked += 1;
			wallEnemyId = enemy.id;
			wallHp = enemy.hp;
			bestiary[enemy.id] = "met";
			if (enemy.openingHit) {
				if (blockActive(recipes)) {
					openingHitPending = false;
					const blocker = tripRecipes(s).find(
						(r) => r.effect === "block_hits"
					);
					if (blocker) gearMoments.push(blocker.flavorLine);
				} else {
					openingHitPending = true;
				}
			}
			wallStory = `Rosie reached the ${enemy.name}. ${enemy.behaviorLine}`;
			break;
		}

		// A Cushion gate she can't meet stops her at its edge (she never enters).
		if (seg.cushionAsk && seg.cushionAsk > cushion) {
			wallStory = `The Bramble wants Cushion ${seg.cushionAsk} and Rosie had ${cushion}. She waited at its edge — the Quilted Vest would carry her through.`;
			break;
		}

		// Otherwise she enters the segment.
		segment = next;
		walked += 1;
		if (seg.bestiaryId && bestiary[seg.bestiaryId] === "unseen") {
			bestiary[seg.bestiaryId] = "met"; // e.g. passing the Bramble lights its page
		}
		if (segment === CHAPTER_END && bestiary["tollbooth_goose"] === "defeated") {
			chapterCleared = true;
		}
	}

	const didSomething = walked > 0 || wallEnemyId !== null;
	if (!didSomething) {
		return { state: { ...s, ...regen, settledAtMs: nowMs }, report: null };
	}

	// Finds: 1 per 2 segments walked, + extra_find effects.
	const extraFinds = sumEffect(recipes, "extra_find", ["on_find", "on_return"]);
	const findCount = Math.floor(walked / 2) + extraFinds;
	const qualityUp =
		totals.sparkle >= 2 ||
		sumEffect(recipes, "find_quality_up", ["on_find", "on_return"]) > 0;
	const ownedGear = new Set(s.gearOwned);
	const gearOwned = [...s.gearOwned];
	const deck = { ...s.deck };
	const finds: FindRecord[] = [];

	for (let i = 0; i < findCount; i++) {
		const rng = mulberry32(hashSeed([seedDate, s.tripIndex, "find", i]));
		const roll = rng();
		const quality: 1 | 2 = qualityUp ? 2 : 1;
		if (roll < 0.6) {
			// snoutlet — flavor pebble, no currency
			const name = pick(rng, SNOUTLET_NAMES);
			finds.push({ id: `snoutlet_${i}`, name, kind: "snoutlet", quality });
		} else if (roll < 0.85) {
			// card — dupes accumulate in the deck (Training fuel)
			const card = pick(rng, CARD_LIST);
			deck[card.id] = (deck[card.id] ?? 0) + 1;
			finds.push({ id: card.id, name: card.name, kind: "card", quality });
		} else {
			// gear — prefer undropped pieces; fall through to a card when all owned
			const undropped = GEAR_LIST.filter((g) => !ownedGear.has(g.id));
			if (undropped.length > 0) {
				const gear = pick(rng, undropped);
				ownedGear.add(gear.id);
				gearOwned.push(gear.id);
				finds.push({ id: gear.id, name: gear.name, kind: "gear", quality });
			} else {
				const card = pick(rng, CARD_LIST);
				deck[card.id] = (deck[card.id] ?? 0) + 1;
				finds.push({ id: card.id, name: card.name, kind: "card", quality });
			}
		}
	}

	// A clover / on_return gear moment when it earned its extra find.
	if (extraFinds > 0) {
		const finder = recipes.find((r) => r.effect === "extra_find");
		if (finder && finder.flavorLine && !gearMoments.includes(finder.flavorLine)) {
			gearMoments.push(finder.flavorLine);
		}
	}

	const comedyRng = mulberry32(hashSeed([seedDate, s.tripIndex, "comedy"]));
	const comedyBeat = pick(comedyRng, COMEDY_BEATS);

	// Untuck-on-return (Fix 4): the tuck rides the WHOLE trip — the wall she walks
	// into is part of that trip, so the card SURVIVES arrival and stays playable in
	// that very fight (a morning-tucked Warm Tea must block the peck it walked into,
	// or the keepable-advice we just fixed becomes unkeepable for morning tucks). It
	// comes home only when the trip completes on the OPEN road (no wall reached).
	// tuckedHome — the postcard's "back in her deck" line — is driven by that alone,
	// so it never appears on a report where the card is still tucked at a wall.
	const arrivedAtWall = wallEnemyId !== null;
	const tuckedHome =
		!arrivedAtWall && s.tuckedCardId ? CARDS[s.tuckedCardId]?.name ?? null : null;

	const report: TripReport = {
		elapsedH: round1(elapsedH),
		cappedH: round1(cappedH),
		segmentsWalked: walked,
		finds,
		wallStory,
		gearMoments,
		comedyBeat,
		tuckedHome,
	};

	const state: ExpeditionState = {
		...s,
		...regen,
		segment,
		wallEnemyId,
		wallHp,
		openingHitPending,
		bestiary,
		gearOwned,
		deck,
		// Survives arrival at a wall (still playable in that fight); comes home only
		// when the trip finishes on the open road.
		tuckedCardId: arrivedAtWall ? s.tuckedCardId : null,
		// A fresh wall resets the per-fight lock; an open-road finish has no card
		// left to have played — either way the lock clears.
		cardPlayedThisFight: false,
		// Zoomies charged on the walk / send-off CARRY INTO the wall she meets. The
		// send-off tickle is a real head start: affection helps; absence never hurts.
		// (P0 founder fix — the arrival used to zero Zoomies, killing pre-charge.)
		zoomies: s.zoomies,
		chapterCleared,
		settledAtMs: nowMs,
		tripIndex: s.tripIndex + 1,
		lastReport: report,
	};
	return { state, report };
}

// ── Public: tickle (charge Zoomies; auto-burst at a wall) ─────────────────────

// Why a tickle was declined, so the journal CTA can stay honest (Fix 1). A
// refusal never decrements the jar or mutates state — it mirrors the road-card
// refusal envelope in playCard().
export type TickleRefusal =
	| "empty" // the jar is dry — nothing to spend
	| "full_open_road" // already fully charged with no wall to burst against
	| "full_at_wall_quiet" // a quiet journal tickle can't charge past the wall cap
	| null;

export function tickle(
	s: ExpeditionState,
	opts?: { quiet?: boolean }
): {
	state: ExpeditionState;
	burst: SwingResult | null;
	refusal: TickleRefusal;
} {
	const quiet = opts?.quiet ?? false;

	if (s.mockTickles <= 0) return { state: s, burst: null, refusal: "empty" };

	const atWall = !!s.wallEnemyId && s.wallHp !== null;

	// Not at a wall → a send-off / affection tickle just charges Zoomies. But at
	// FULL charge there is no wall to burst against, so the spend would be a silent
	// no-op — refuse it (no decrement) so the UI can say she's already bursting.
	if (!atWall) {
		if (s.zoomies >= ZOOMIES_MAX) {
			return { state: s, burst: null, refusal: "full_open_road" };
		}
		const spent = { ...s, mockTickles: s.mockTickles - 1 };
		const recipes = fightRecipes(spent);
		const zoomies = Math.min(ZOOMIES_MAX, spent.zoomies + chargeStep(recipes));
		return { state: { ...spent, zoomies }, burst: null, refusal: null };
	}

	// A quiet tickle from the JOURNAL never fires the burst off-screen (Fix 1c):
	// it charges only up to ZOOMIES_MAX - 1, leaving the burst itself for the fight
	// view where it can be seen. At the cap it refuses, pointing the player inside.
	if (quiet) {
		const cap = ZOOMIES_MAX - 1;
		if (s.zoomies >= cap) {
			return { state: s, burst: null, refusal: "full_at_wall_quiet" };
		}
		const spent = { ...s, mockTickles: s.mockTickles - 1 };
		const recipes = fightRecipes(spent);
		const zoomies = Math.min(cap, spent.zoomies + chargeStep(recipes));
		return { state: { ...spent, zoomies }, burst: null, refusal: null };
	}

	const spent = { ...s, mockTickles: s.mockTickles - 1 };

	// The opening peck eats the first tickle unless it's blocked. Re-check the
	// CURRENT fight recipes (Fix 2) so equipping a lid / playing Warm Tea NOW
	// genuinely negates the pending peck — the flinch advice is keepable, and the
	// tickle then charges normally instead of being spent on the peck.
	let working = spent;
	if (working.openingHitPending) {
		if (blockActive(fightRecipes(working))) {
			working = { ...working, openingHitPending: false };
		} else {
			return {
				state: { ...working, openingHitPending: false },
				burst: null,
				refusal: null,
			};
		}
	}

	const recipes = fightRecipes(working);
	const nz = working.zoomies + chargeStep(recipes);
	if (nz < ZOOMIES_MAX) {
		return { state: { ...working, zoomies: nz }, burst: null, refusal: null };
	}

	// Burst!
	const enemy = ENEMIES[working.wallEnemyId!];
	const isFirst = working.wallHp === enemy.hp;
	const damage = burstDamage(working, isFirst, recipes);
	const wallHpBefore = working.wallHp!;
	const wallHpAfter = Math.max(0, wallHpBefore - damage);
	const defeated = wallHpAfter === 0;
	const lines: string[] = [
		`Zoomies! Rosie bonks the ${enemy.name} for ${damage}.`,
	];
	if (isFirst) {
		for (const r of recipes) {
			if (r.effect === "double_first_swing") lines.push(r.flavorLine);
		}
	}
	if (defeated) lines.push(`The ${enemy.name} steps aside. The road opens.`);

	const bestiary = { ...working.bestiary };
	let chapterCleared = working.chapterCleared;
	if (defeated) {
		bestiary[enemy.id] = "defeated";
		if (enemy.id === "tollbooth_goose") chapterCleared = true;
	}

	const state: ExpeditionState = {
		...working,
		zoomies: 0,
		wallHp: defeated ? null : wallHpAfter,
		wallEnemyId: defeated ? null : working.wallEnemyId,
		cardPlayedThisFight: defeated ? false : working.cardPlayedThisFight,
		bestiary,
		chapterCleared,
	};
	return {
		state,
		burst: { damage, wallHpBefore, wallHpAfter, defeated, lines },
		refusal: null,
	};
}

// The triggers that actually resolve inside a wall fight (the rest — segment /
// return / find triggers — only shape the walk). A card whose ability fires on
// none of these does nothing when tapped at a wall, so the UI disables it warmly
// and the kernel refuses the spend rather than eat the once-per-fight tap.
const FIGHT_TRIGGERS: AbilityTrigger[] = ["on_wall_start", "on_zoomies", "on_swing"];

export function cardAffectsFight(card: TrickCard): boolean {
	return FIGHT_TRIGGERS.includes(card.ability.trigger);
}

// ── Public: play the tucked card (once per fight) ────────────────────────────

export function playCard(s: ExpeditionState): {
	state: ExpeditionState;
	result: SwingResult | null;
} {
	if (!s.tuckedCardId || s.cardPlayedThisFight || !s.wallEnemyId || s.wallHp === null) {
		return { state: s, result: null };
	}
	const card = CARDS[s.tuckedCardId];
	if (!card) return { state: s, result: null };
	// A walking-only card would spend the tap for zero fight effect — refuse it.
	if (!cardAffectsFight(card)) return { state: s, result: null };
	// A block card whose block is already satisfied — gear already blocks AND no
	// pending peck it could help — is a no-op (Fix 2). Refuse rather than burn the
	// once-per-fight play. (s.cardPlayedThisFight is false here, so fightRecipes(s)
	// is the equipped-gear set only.)
	if (
		card.ability.effect === "block_hits" &&
		blockActive(fightRecipes(s)) &&
		!s.openingHitPending
	) {
		return { state: s, result: null };
	}
	const state = { ...s, cardPlayedThisFight: true };
	const result: SwingResult = {
		damage: 0,
		wallHpBefore: s.wallHp,
		wallHpAfter: s.wallHp,
		defeated: false,
		lines: [`${card.name} — ${card.ability.flavorLine}`],
	};
	return { state, result };
}

// ── Public: the next obstacle on the road (shared by the prediction + UI) ─────

// The first thing that would stop her from where she stands: the wall she's at,
// or — scanning ahead — a Cushion gate she can't meet, or the next undefeated
// wall. Returns its ask so the prediction sticker can show it beside the verdict
// (the legibility law: the choice and its grade share one glance).
export type NextObstacle =
	| { kind: "wall"; enemyId: string; enemy: EnemyDef; hp: number }
	| { kind: "cushion"; segment: number; ask: number }
	| null;

export function nextObstacle(s: ExpeditionState): NextObstacle {
	const totals = statTotals(s);
	const recipes = tripRecipes(s);
	const cushion =
		totals.cushion + sumEffect(recipes, "cushion_up", ["on_segment_enter", "on_return"]);

	// At a wall now → that's the obstacle.
	if (s.wallEnemyId) {
		const enemy = ENEMIES[s.wallEnemyId];
		return {
			kind: "wall",
			enemyId: s.wallEnemyId,
			enemy,
			hp: s.wallHp ?? enemy.hp,
		};
	}
	for (let seg = s.segment + 1; seg <= CHAPTER_END; seg++) {
		const r = roadAt(seg);
		if (!r) continue;
		if (r.cushionAsk && r.cushionAsk > cushion) {
			return { kind: "cushion", segment: seg, ask: r.cushionAsk };
		}
		if (r.wallEnemyId && s.bestiary[r.wallEnemyId] !== "defeated") {
			return { kind: "wall", enemyId: r.wallEnemyId, enemy: ENEMIES[r.wallEnemyId], hp: ENEMIES[r.wallEnemyId].hp };
		}
	}
	return null;
}

// ── Public: the ±20% legibility law — predict the next wall ──────────────────

export function predictFight(s: ExpeditionState): { verdict: Verdict; why: string } {
	const recipes = tripRecipes(s);
	const obstacle = nextObstacle(s);

	if (!obstacle) {
		return { verdict: "wins", why: "The road is open — she'll ramble on." };
	}
	if (obstacle.kind === "cushion") {
		return {
			verdict: "stuck",
			why: `She'll wait at the Bramble — a Quilted Vest (Cushion ${obstacle.ask}) would carry her through.`,
		};
	}

	const enemy = obstacle.enemy;
	const hp = obstacle.hp;
	// Optimistic loadout: assume she'd play a tucked card whose punch helps.
	const fight = tuckedRecipe(s) ? [...gearRecipes(s), tuckedRecipe(s)!] : gearRecipes(s);
	const firstBurst = burstDamage(s, true, fight);
	const laterBurst = burstDamage(s, false, fight);
	const opening = enemy.openingHit && !blockActive(recipes) ? 1 : 0;
	const bursts = Math.floor((s.mockTickles - opening) / ZOOMIES_MAX);
	const perBurst = Math.max(firstBurst, laterBurst);

	// P1: the empty-jar branch. If the loadout could land a burst but the jar has
	// too few tickles for even one, the blocker is the jar — not her gear. Name it
	// warmly and never blame a piece she's wearing fine.
	if (bursts <= 0 && perBurst > 0) {
		return {
			verdict: "stuck",
			why: "Her tickle jar is empty — a few tickles will charge her Zoomies.",
		};
	}

	const maxDamage =
		bursts <= 0 ? 0 : firstBurst + Math.max(0, bursts - 1) * laterBurst;

	if (maxDamage >= hp) {
		return { verdict: "wins", why: `She'll win this one — the ${enemy.name} won't last.` };
	}
	if (maxDamage >= hp * 0.8) {
		return {
			verdict: "close",
			why: `This looks close at the ${enemy.name} — one more charge would seal it.`,
		};
	}
	const hint =
		enemy.openingHit && !blockActive(recipes)
			? " A Saucepan Lid would block the opening hit."
			: " A Wooden Spoon would help her bonk harder.";
	return {
		verdict: "stuck",
		why: `She'll wait at the ${enemy.name}.${hint}`,
	};
}

// ── Public: dev time-warp (shift settledAtMs back so more time "elapsed") ─────

export function devWarp(s: ExpeditionState, hours: number): ExpeditionState {
	return { ...s, settledAtMs: s.settledAtMs - hours * 3_600_000 };
}
