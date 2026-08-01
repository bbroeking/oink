# Expedition v0 — the playable slice (spec)

*2026-07-28. Build spec for the first fully playable Rosie's Ramble. Client-local, dev-gated, zero server/migration surface — the point is to feel the loop and iterate on UI (Impeccable passes follow implementation). The real server (per `docs/expedition-idle-battler-plan.md` §5) lands only after this slice proves the design. The existing `app/idle-battler-prototype.tsx` stays untouched for comparison.*

## Scope

**In:** chapter 1 road (12 segments), 4 bestiary enemies (2 road walls + hazard + boss), 6 gear pieces, 8 Trick cards, send-off (gear + card draw + tickle), real-elapsed-time away accrual with dev time-warp, postcard return, wall fight with Zoomies, Training tucks, bestiary shelf, chapter-clear end card.
**Out (v0):** server/RPCs, real tickle debits (local mock bank), Sounder Scuffle, companions/signature abilities, Critter cards, real snout minting, push/popup-queue integration, non-dev entry points.

## Files

```
utils/expedition.ts                     -- pure sim kernel + catalogs + types (no RN imports)
hooks/useExpedition.ts                  -- AsyncStorage persistence, elapsed-time settle,
                                           actions, dev time-warp
app/expedition.tsx                      -- stack screen shell + view routing (journal|fight)
components/expedition/JournalHome.tsx   -- road map, send-off, satchel summary
components/expedition/RoadMap.tsx       -- 12-segment path w/ walls, pig position
components/expedition/GearRack.tsx      -- 4 slots, owned gear chips, stat readout
components/expedition/CardHand.tsx      -- 3-card draw, tuck selection, card frame
components/expedition/PostcardModal.tsx -- trip report ceremony
components/expedition/ScuffleView.tsx   -- wall fight: HP bar, tickle→zoomies, card play
components/expedition/TrainingSheet.tsx -- dupe tuck flow (pick card dupe → pick stat)
components/expedition/BestiaryShelf.tsx -- 4 entries, silhouette→met→defeated
__tests__/expedition.test.ts            -- kernel tests (see Testing)
```

## Kernel contract (`utils/expedition.ts`)

Pure functions only — `(state, input) → {state, events}`. No `Date.now()` inside the kernel; callers pass `nowMs`. Deterministic RNG: mulberry32-style hash of `(seedDate, tripIndex, step)` — same trip replays identically.

```ts
export type AbilityTrigger = "on_wall_start" | "on_swing" | "on_zoomies" | "on_find"
  | "on_segment_enter" | "on_return";
export type AbilityEffect = "block_hits" | "bonus_bonk" | "extra_find" | "find_quality_up"
  | "speed_up" | "zoomies_charge_up" | "cushion_up" | "double_first_swing";
export type AbilityRecipe = {
  trigger: AbilityTrigger; effect: AbilityEffect; magnitude: number; flavorLine: string;
};
export type GearSlot = "head" | "body" | "held" | "charm";
export type Rarity = "common" | "uncommon" | "rare";  // reuse RARITY_COLORS keys

export type GearPiece = {
  id: string; name: string; slot: GearSlot;
  bonk: number; cushion: number; sparkle: number;
  ability?: AbilityRecipe; rarity: Rarity;
  artHatId: string;  // an existing constants/hats.ts HAT_IMAGES id chosen as placeholder art
};
export type TrickCard = {
  id: string; name: string; ability: AbilityRecipe; rarity: Rarity; starter: boolean;
};
export type EnemyDef = {
  id: string; name: string; hp: number;
  openingHit: boolean;          // hits first unless blocked
  behaviorLine: string;         // shown BEFORE the fight — the legibility law
  segment: number;              // where it stands on the road
};

export type ExpeditionState = {
  chapter: 1; segment: number;            // 0..12
  wallEnemyId: string | null; wallHp: number | null;
  loadout: Record<GearSlot, string | null>;
  tuckedCardId: string | null; cardPlayedThisFight: boolean;
  deck: Record<string, number>;           // cardId -> count (dupes)
  gearOwned: string[];
  training: { pigId: string; cardId: string; stat: "bonk" | "cushion" | "sparkle" }[];
  zoomies: number;                        // 0..5
  mockTickles: number;                    // local stand-in bank, starts 20
  bestiary: Record<string, "unseen" | "met" | "defeated">;
  settledAtMs: number; tripIndex: number;
  lastReport: TripReport | null; chapterCleared: boolean;
};

export type TripReport = {
  elapsedH: number; cappedH: number; segmentsWalked: number;
  finds: { id: string; name: string; kind: "gear" | "card" | "snoutlet"; quality: 1 | 2 }[];
  wallStory: string | null;               // why she stopped, in one glance
  gearMoments: string[];                  // "Her Saucepan Lid blocked the opening peck"
  comedyBeat: string;                     // one per trip, seeded pick from a table of ~10
};

// The API the hook consumes:
export function initialState(nowMs: number): ExpeditionState;
export function settle(s: ExpeditionState, nowMs: number): { state: ExpeditionState; report: TripReport | null };
export function drawHand(s: ExpeditionState, dateKey: string): string[];   // 3 owned cards, seeded, stable per day
export function tuckCard(s: ExpeditionState, cardId: string): ExpeditionState;
export function equipGear(s: ExpeditionState, gearId: string): ExpeditionState;  // routes to its slot
export function tickle(s: ExpeditionState): { state: ExpeditionState; burst: SwingResult | null };  // +1 zoomies; at 5, auto-burst if at a wall
export function playCard(s: ExpeditionState): { state: ExpeditionState; result: SwingResult | null };
export function statTotals(s: ExpeditionState): { bonk: number; cushion: number; sparkle: number };  // gear + training
export function predictFight(s: ExpeditionState): { verdict: "wins" | "close" | "stuck"; why: string }; // the ±20% law
export function devWarp(s: ExpeditionState, hours: number): ExpeditionState;  // shifts settledAtMs back
```

**Sim rules (keep every number small and honest):**
- Base pig: bonk 1, cushion 0, sparkle 0. Totals = base + equipped gear + training tucks.
- Walking pace: 1 segment/hour, `speed_up` adds magnitude segments per trip. Away cap: 8h.
- A segment with `cushionAsk > cushion` stops the pig at its edge (report says which gear would help). A wall (enemy) stops her at its segment until defeated.
- Fight: each **tickle** charges zoomies; at 5 the burst swings for `bonk (+on_zoomies bonuses)`. `playCard` is once per fight. Enemy `openingHit` knocks 1 zoomies off first unless `block_hits` is live. No pig HP — she is never hurt, only stalled (no shame states).
- Finds while walking: 1 per 2 segments walked, +`extra_find`; sparkle ≥2 upgrades quality (2 = shiny frame in the postcard). Finds are drawn from a seeded drop table: 60% snoutlet (flavor pebble, no currency), 25% card, 15% gear (undropped pieces first, then dupes→deck counts).
- Training: tuck a dupe (count > 1) for permanent +1 to one stat; cap 5 tucks total in v0.
- Chapter clear at segment 12 with the Goose defeated → `chapterCleared`, end card, road rests.

## Content (v0 catalogs — live in `utils/expedition.ts`)

**Gear (6).** Starters: Saucepan Lid + Wooden Spoon.

| id | name | slot | stats | ability |
|---|---|---|---|---|
| `saucepan_lid` | Saucepan Lid | head | cushion 2 | on_wall_start block_hits 1 — "blocks the opening hit" |
| `tin_colander` | Tin Colander | head | cushion 1, sparkle 1 | on_find find_quality_up 1 |
| `quilted_vest` | Quilted Vest | body | cushion 3 | — |
| `wooden_spoon` | Wooden Spoon | held | bonk 2 | on_zoomies bonus_bonk 2 |
| `rolled_newspaper` | Rolled Newspaper | held | bonk 1 | on_wall_start double_first_swing 1 |
| `lucky_clover` | Lucky Clover | charm | sparkle 2 | on_return extra_find 1 |

**Cards (8).** Starters owned ×1 each; droppables enter via finds.

| id | name | starter | ability |
|---|---|---|---|
| `press_on` | Press On | yes | speed_up 2 — "she walks two segments farther" |
| `nose_for_shinies` | Nose for Shinies | yes | extra_find 1 |
| `study_the_wall` | Study the Wall | yes | on_wall_start bonus_bonk 1 (played: bonk +1 this fight) |
| `zoomie_zephyr` | Zoomie Zephyr | no | zoomies_charge_up 1 (tickles charge double) |
| `mud_mask` | Mud Mask | no | cushion_up 1 for the trip |
| `warm_tea` | Warm Tea | no | block_hits 1 |
| `braveheart_oink` | Braveheart Oink | no | on_swing bonus_bonk 1 |
| `second_snack` | Second Snack | no | on_return extra_find 1, quality up |

**Road + enemies (chapter 1, 12 segments).**

| segment | thing | notes |
|---|---|---|
| 3 | **Gate Snail** (hp 3) | no opening hit; "He is slow, but so is the gate." |
| 6 | **Puddle Toad** (hp 5) | opening hit; "He splashes first — bring a lid." |
| 8–9 | **The Bramble** (hazard, cushionAsk 3) | not a fight; bestiary "met" on pass |
| 12 | **Tollbooth Goose** (hp 9, boss) | opening hit; "NO PIGS PAST. She pecks first." |

## UI rules (the taste law applies fully — this is not throwaway)

- **No emoji anywhere.** Gear renders its `artHatId` PNG from `HAT_IMAGES` (implementer picks 6 visually-plausible existing items and records the mapping). Enemies render as **ink silhouettes** (simple SVG shapes in ink `#2a1f15` via the `Icon`/inline-Svg pattern) — canonically correct, since the Bestiary shows silhouettes until met; "defeated" swaps in nothing fancier (real art comes later via ImageGen).
- Tokens only: `WHIMSY/TYPE/RADII/SPACE/FONTS`, `Sticker` surfaces, `STICKER_SHADOW`/`SHADOW_SM`, `PageHeader`/`SectionHeader`, `EmptyState`/`LoadingBeat`. No raw hex/size/radius/pad.
- Rosie renders via existing sprite frames (`assets/images/sprites/rosie/*`), mood mapped: walking=walk/idle, at wall=surprise, defeated wall=happy, postcard=happy/tired.
- The send-off screen must state the prediction (`predictFight`) in words — "She'll win this one" / "This looks close" / "She'll wait at the Toad — a lid would help." The legibility law is a UI requirement, not just sim.
- Dev-only affordances (time-warp buttons "+1h/+8h", reset, state readout on bark) live in a collapsed dev drawer, styled like the prototype's bark readout.
- Screen gated `if (!__DEV__) return <Redirect href="/" />` like the prototype; navigable at `/expedition`.

## Testing (`__tests__/expedition.test.ts`)

- Determinism: same seed + same actions → identical state and reports (run twice, deep-equal).
- Away cap: 20h elapsed settles as 8h.
- Cushion gating: pig stops at bramble with cushion 2; passes with vest (3).
- Fight math: goose opening hit costs zoomies unless lid/warm-tea; spoon burst = 1+2+2; double_first_swing fires once.
- Cards: hand draw is stable per dateKey, only owned cards, no dupes in hand unless owned count covers it.
- Training: dupe-only, cap 5, statTotals reflects tucks.
- Drop table: gear drops prefer unowned; every find has a name.
- predictFight: "stuck" whenever totals genuinely can't win; never "wins" when they can't (the ±20% law's floor).
- No `Date.now()` inside utils/expedition.ts (source-scan assertion, mirroring the repo's guard-test idiom).

## Definition of done (v0)

`npx tsc --noEmit` clean · jest suite green · `/expedition` playable end-to-end in dev: send off with gear+card, warp 8h, read the postcard, fight the toad with tickles, tuck a dupe, clear the chapter · zero emoji, zero raw style literals · prototype untouched.

## After implementation

Impeccable UI passes per screen (journal, send-off, postcard, fight, bestiary) → fold verdicts back into `docs/expedition-idle-battler-plan.md` §5.4 before any server work.
