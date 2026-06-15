---
title: "War Spoils — the war-exclusive item/reward system"
type: memo
date: 2026-06-14
tags: [mud-wars, items, cosmetics, animated, pipeline, build-plan]
---

# War Spoils

> **Vision.** Every Sounder Mud Fight should end with the crew opening the app to a *pile of mud* — a deep, war-only cosmetic vault they cannot get any other way: animated bog backgrounds, hats that splatter with mud over the season, themed "mud sets" with a completion-only effect, recolor floors, gacha buckets, named-season scarcity. The catalog must be **large** (hundreds of SKUs) but cheap to author (recolor/theme multipliers over a few dozen anchors via the ChatGPT/icon-gen pipeline), durable (rarity ladder + scarcity protect value), and *fair* (server-authoritative, contribution-gated, capped, idempotent grants — the cash-faucet lesson). War Spoils is the prestige flex that makes winning a Mud Fight *visible* on the pig, on the leaderboard, and in the crew roster — the cosmetics-are-80%-of-revenue engine, in TTP's cozy voice.

This is a **system** plan, not one item. It defines (1) the item pool shape, (2) how items are earned and distributed off the existing `mud_fights` mechanics, (3) the real "animated cosmetic" tech gap and the chosen approach, (4) the pipeline that produces volume cheaply, and (5) the schema + grant RPCs to build. It is grounded in the shipped cosmetics infra (`public.hats` / `public.user_hats` / equip-slot columns / `HAT_IMAGES` / `PigStage` / `grant_mystery_box`) and the unpushed mud-fights stack (`supabase/migrations/20260647000000_mud_fights.sql`).

**Honors the resolved design:** telephone-type = asynchronous (no co-presence); a capped co-op bonus layered on the flat-20 base sling; war fully isolated + reset each war; cadence ~3 on / 1 off; rewards = many war-exclusive cosmetics + a capped core snout/tickle payout. **All grants are server-authoritative, contribution-gated, capped, idempotent** — the anti-collusion spine from the fairness research.

---

## The item pool (types, sets, rarity, animated)

The pool is built the way Lens 3 of `coop-telephone-items-research-2026-06.md` prescribes: **multiplier mechanics over a small base-art pool**, not "more unique art." Every War Spoils item is a normal `public.hats` row (so the shop preview, `PigStage`, `daily_shop`, the Closet, and `user_hats` all resolve it for free) — distinguished only by new metadata columns (`war_exclusive`, `war_season`, `set_id`, `anim_*`). The pig render, equip routing, and inventory are **already built**; War Spoils is catalog + grant logic on top.

### Rarity ladder (the anti-devaluation spine)

`public.hats.rarity` already exists with the 5-tier CHECK `common|uncommon|rare|epic|legendary` (`20260502030000_shop_catalog.sql`) and `RARITY_COLORS` in `constants/hats.ts`. War Spoils reuses it verbatim — **no new rarity enum** — and maps the research's 5 mud tiers onto it so the existing rarity chip/border UI just works:

| Mud tier (player-facing) | `rarity` value | What it is | Animated? |
|---|---|---|---|
| **Muddy** | `common` | Recolor floor — one anchor in N mud-tones | no |
| **Caked** | `uncommon` | Material/pattern variant | no |
| **Prize** | `rare` | Bespoke static art | no |
| **Champion** | `epic` | Animated (sprite-sheet) hat/aura | **yes** |
| **Heirloom** | `legendary` | Animated + evolving + set-capstone | **yes** |

**Animation/particles are reserved for the top two tiers** (the research's "put motion at the top because players can't fake it"). Floors stay cheap static PNGs.

### Types (which equip slots War Spoils fills)

Every slot in `constants/slots.ts` is fair game; the headline categories:

- **Animated backgrounds** (`category 'background'` → `active_background_id`) — the marquee. A bog/swamp/mud-derby backdrop that *moves* (rain, drifting fog, bubbling mud). This is the "you finished the war" trophy.
- **Animated hats / auras** (`'hat'` → `active_hat_id`, `'aura'` → `active_aura_id`) — a mud-splatter aura, a dripping-mud crown.
- **Static mud hats/bows/masks/held** — the recolor + variant floor (Muddy/Caked/Prize) that supplies *volume*.
- **Tickle particles** (`'tickle_particle'` → `active_tickle_particle_id`) — mud-splat / muddy-hoofprint glyphs that fling off the pig on each tap (existing slot, `20260549000000`).
- **Titles** (`public.titles`, source `'mud_war'`) — already seeded `mud_champion/veteran/legend` in `20260647`; War Spoils adds per-season flavor titles ("Mud Derby Champ — S4").

> **Categories to avoid:** `scarf`/`cape`/`necklace` are in `HIDDEN_CATEGORIES` (`constants/hats.ts` — the set is exactly `{scarf, cape, necklace}`); `flag` is World-Cup-only and denylisted separately in `grant_mystery_box`'s `category NOT IN ('scarf','cape','necklace','flag')`. War Spoils must not generate into any of them — the art never sat right on the pig, and `grant_mud_bucket` must carry the **same four-category denylist verbatim** so a future box can't leak them.

### Themed mud sets + set bonuses (the collection engine)

A **set** is a named group of War Spoils items (e.g. *"Swamp King"* = mud crown + mud aura + mud-splat particle + animated bog background). New table `public.cosmetic_sets` + a `set_id` FK on `hats`. Completing the whole set (owning every member) unlocks a **set-exclusive animated capstone** that cannot be granted à la carte — the Diablo/Apex "complete the set → capstone" pattern. The capstone is itself a `hats` row flagged `set_capstone = true` and granted by `grant_set_capstones()` (below) the moment the last member lands.

**Sets are the async-interdependence lever (the co-op feel).** Because each war drops *one* guaranteed member + one bucket pull per contributor, **no single member can finish a multi-piece set alone in one war** — completion is paced across several wars, and the *crew you keep winning with* is what gets you there (a stalled or losing crew slows everyone's set toward the capstone). This is the deliberate substitute for synchronous co-op: the interdependence is **temporal and roster-based**, not co-presence. The capstone is the "we got there together" artifact (research Lens 1 #5, Lens 3 #3), surfaced with a crew-roster reveal ("your Sounder completed Swamp King") rather than a solo toast.

**Making the interdependence *visible* (the authorship payoff).** The async free-rider's invisibility is the core fairness problem (Lens 4) — so make contribution *legible*, gift-framed. Two cheap, grounded surfaces, both read-only over data the loop already writes:
- **Whose win dropped it.** The `war_spoils_*` reveal announcement names the *war* (`war_id` is already in the announce payload) and can name the winning crew, so the drop reads as "this came from the Mud Derby your Sounder won," not a vending-machine pull. Authorship + surprise = the Gartic reveal satisfaction (Lens 1 #5) without a synchronous moment.
- **Crew set-progress on the war screen.** `war_side`/`crew_state` already project the roster; a read-only `cosmetic_sets` progress strip ("Swamp King: 3/5 across the Sounder") turns each crewmate's wins into *visible shared progress* toward the capstone — the legible "your piece is missing" open-loop pull (Zeigarnik, Lens 1) that makes a quiet crewmate's contribution matter to *you*. No new write path; it's a `COUNT(DISTINCT member)` over `user_hats` ⨝ `cosmetic_sets` for the crew.

### Named-season scarcity + Flashback

`public.hats.war_season text` tags each item to a named war season ("Season 4 — Mud Derby"). The shop/Closet shows a "last seen N seasons ago" badge for vaulted items (manufacturing scarcity, Lens 3 #6). A future **Flashback** mechanic can re-issue an old season's pool to relieve FOMO — no schema change needed, just flip the gating window.

### Evolving apex items (the legendary ceiling)

A **Heirloom** hat that gains a mud-splatter layer per war won. Modeled as `evolve_stage int` on `user_hats` + a small client `anim_evolve` frame map keyed `(item_id, stage)`: the `useFrameCycler` (below) reads the row's `evolve_stage` and picks that stage's strip from `ANIMATED_ITEM_FRAMES`, the same require-map binding everything else uses. `grant_war_spoils` bumps `evolve_stage` (a single `UPDATE ... SET evolve_stage = LEAST(max_stage, evolve_stage + 1)`) on the winner's owned evolving items, **capped at a per-item `max_stage`** so it can't run unbounded. This is the LoL-Ultimate / Apex-Prestige "evolves during play" mechanic, cozy-fied. Note the **precedent vs data** distinction: `ITEM_PREBAKED` is presently an *empty* map with a documented authoring recipe (`constants/prebaked.ts`) — it proves the *swap-in-a-multi-frame-strip* mechanism and the slicing convention, but War Spoils ships the *first populated* multi-frame item data, so budget the asset-slicing work as new, not copy-paste.

---

## How items are earned & distributed (per mechanic + war win; fairness; caps)

The earning surface is the **existing** mud-fights loop in `20260647000000_mud_fights.sql`. War Spoils bolts grant calls onto the verbs already there — it does **not** add new player actions. Three earning channels, each contribution-gated, capped, idempotent:

### Channel 1 — The flat sling (per-mechanic participation floor)

`sling_mud(p_war)` is the async telephone verb: flat-20 slings/day, use-or-lose, no modifiers. The fairness research's "low binary participation floor" maps directly: **a member who logged ≥1 sling this war is contribution-eligible.** That floor gates *every* War Spoils grant — kills the pure lurker, costs a casual one tap. The flat-20 cap is the anti-snowball / anti-collusion spine (a whale or an alt can't out-sling the cap), exactly as the existing `resolve_war` per-capita-average + quorum-2 already enforces.

### Channel 2 — Winning the war (the prestige drop)

`resolve_war(p_war)` is the lazy, idempotent payout engine (`FOR UPDATE` + `resolved_at` guard). It already loops `FOR m IN SELECT user_id ... crew_id = winner ... HAVING SUM(slings) > 0` — i.e. **it already iterates exactly the contribution-gated winners.** War Spoils inserts its grant calls inside that loop, each in its own savepoint-guarded `BEGIN ... EXCEPTION WHEN OTHERS THEN NULL; END` block (the 20260624 hardening pattern the migration already uses for titles/blessings), so a cosmetic-grant fault can never roll back the snout payout.

Distribution model per the fairness table (`coop-telephone-items-research-2026-06.md`, Lens 4) — **contribution-gated, not flat, not proportional/DKP:**

- **Every contributing winner** (logged ≥1 sling, on the winning crew) gets:
  - the season's **guaranteed War Spoils drop** (e.g. that season's Prize-tier mud item) — *flat above the floor* so there's no DKP-gap snowball;
  - one **Mud Bucket** pull (Channel 3);
  - `evolve_stage` bumps on any owned evolving Heirlooms (capped per war);
  - the existing capped snout/tickle payout (`m.own + share`, half-the-loser-pot, `floor(... / win_active)`) — already capped and idempotent.
- **Bot wins stay practice:** `resolve_war` already withholds `tickles_earned`/`war_wins`/titles for `is_bot_war` (the bot-farm exploit guard). **War Spoils withholds cosmetic drops from bot wins too** — beating The Mudlarks gives the flat house snout stipend + regen buff only. Re-challengeable + fixed-pace = must not be a cosmetic faucet.
- **Losing crew, contributors:** an "everyone scores win or lose" consolation — a single **Muddy-tier (common) recolor** for contributors on the *losing* crew (the Clash Royale "earn on a loss" valve). Capped at one per war; gift-framed in copy ("your Sounder pulled together").

### The stalled-chain / no-quorum valve (the single-blocker fix)

The research's central async failure mode is **one no-show freezing the chain** (Lens 1; Lens 4 pity). The mud-fights loop already degrades gracefully on *time* (`resolve_war` resolves on the clock regardless of laggards) — but a **small crew that can never field quorum-2** would otherwise earn *nothing, ever*, the cosmetic-economy version of a permanent stall, and the losing-crew consolation only fires on a *resolved* war with a winner, not on a `winner IS NULL` no-quorum settle (`resolve_war`'s `winner := NULL` branch pays no one). Two grounded, low-cost valves close this without touching the cap-and-flatten spine:

- **No-quorum consolation.** Extend the *contributors* grant to also fire on the `winner IS NULL` branch (both crews, anyone who logged ≥1 sling): the same single Muddy-tier recolor. A crew that showed up but couldn't muster quorum still gets the participation floor's reward. This is one extra savepoint-guarded loop in `resolve_war` over `mud_slings ... HAVING SUM(slings) > 0` across both crews when `winner IS NULL` — no new player action, no scaling.
- **Catch-up odds bump (soft pity, research Lens 4 / Lens 3 #5).** `grant_mud_bucket` weights the pull toward *unowned* members and, for a user who has **lost or drawn their last `M` wars**, applies a rising rarity-floor bump (e.g. guarantee ≥ uncommon after M=2, ≥ rare after M=3). Source the streak from a cheap `COUNT` over `mud_wars`/`mud_slings` (wars the user contributed to whose `winner_crew` ≠ their crew), computed *inside* the SECURITY DEFINER RPC — no new column required, so it stays migrate-safe. The streak query runs **once per bucket pull** (a cold path — only at war resolution), not on the hot `sling_mud` path, so it needs no new index beyond `mud_slings`'s existing `UNIQUE (war_id, user_id, war_day)` constraint; if it ever shows up in EXPLAIN, an index on `mud_wars(winner_crew)` is the fix. This is the gacha soft-pity "deficits self-correct" mechanic; it is **cosmetic-only and capped at the rarity ceiling**, so it can't be farmed for value.

### Channel 3 — The Mud Bucket (cozy gacha, dupe-insured)

A war-themed reskin of `grant_mystery_box` — same proven shape: rarity-weighted Efraimidis–Spirakis pick (`-ln(1-random())/weight`), `cost > 0` filter (excludes pass exclusives), category denylist, **snout fallback when the user owns everything eligible**, `ON CONFLICT DO NOTHING`, INLINE announcement, internal-only (REVOKE from PUBLIC/anon/authenticated). New `grant_mud_bucket(target_user, p_season)` restricts the eligible pool to `war_exclusive = true AND war_season = p_season AND NOT war-pass-exclusive`. Add a **dig-stamp dupe-insurance card** (Lens 3 #5): after K dupes, the next pull guarantees a missing set member — a `user_id`-scoped counter, cozy not predatory.

### Fairness & caps (the hard rules)

- **Idempotent.** Grants ride inside `resolve_war`'s `resolved_at`-guarded body; the loop already runs once per war. Each `INSERT INTO user_hats ... ON CONFLICT DO NOTHING`. The savepoint guards mean a grant fault can't double-fire or roll back the payout.
- **Capped.** Per war: 1 guaranteed drop + 1 Mud Bucket + bounded evolve bumps per contributing winner; 1 consolation for losers. No grant scales with sling-count above the floor (anti-DKP, anti-whale, anti-collusion — capping payout *is* the strongest anti-alt tool, Lens 4).
- **Anti-collusion.** `challenge_crew` already enforces a 24h rematch cooldown per crew pair + a friends-graph gate (`are_friends`, verified in `20260647` lines 306/906). Note the gate *cuts both ways*: it means wars only happen between friends, so an alt ring **is** structurally a friend cluster — which is exactly why the design leans on **payoff-starvation, not detection**. The capped, flat-above-floor drop + the bot-war cosmetic withholding mean a main + N alts on one crew can win every war and still only ever collect the *flat per-contributor* drop, never a proportional multiple. Capping payout *is* the anti-alt tool (Lens 4); no fingerprinting needed for v1. (If a graph check is ever wanted, the dense who-only-wars-with-whom subgraph is already queryable from `mud_wars` — defer it.)
- **Server-authoritative.** Every grant is a SECURITY DEFINER RPC writing `user_hats` directly; the client only *reads* inventory and equips via the existing `profiles.update({ [column]: id })` path. No client can mint a War Spoils item.
- **Gift-framing + the reveal heartbeat.** All announcement copy celebrates the crew, never shames the absent (Snapchat-streak caution). INLINE `system_announcements` inserts, kind `war_spoils_*`, surfaced in the WhileAway feed (mirrors `mystery_box_opened`). The **resolution drop is the push heartbeat** (research Lens 1): the existing `war_won`/`war_lost` announcements already fire from `resolve_war`'s announce loop — the War Spoils reveal rides the *same* row so the "you opened a pile of mud" moment lands in the high-CTR post-war window without a new notification surface.
- **Cadence neutrality (3-on / 1-off).** Grants are driven **only** by `resolve_war` firing, which only fires on an *active→resolved* transition. The off-week ("rest war") simply means no war is active, so no grant fires — the cadence needs **no special-casing in the grant logic**; a rest week is the absence of a `resolve_war` call, not a suppressed grant. This keeps the off-week a genuine Duolingo-style forgiveness beat (no FOMO penalty for the gap) for free.

### Worked alt-farming trace (where each cap bites)

To show the cap-and-flatten spine isn't hand-waving, trace the canonical attack — **one main + 4 alts on a single crew, repeatedly beating another sock-crew (or the bot)** — against the *actual* `20260647` logic:

1. **Bot-crew farm?** Blocked at the source: `resolve_war`'s `winner IS NOT NULL AND NOT (w.is_bot_war AND winner = w.defender_crew)` gate pays nothing on a bot win, and War Spoils withholds cosmetics on `is_bot_war` (the bot stipend is snouts-only). A re-challengeable bot is *never* a cosmetic faucet. ✅
2. **Sock-crew farm (real crew B is also the attacker's alts)?** Each war, every contributor on the winning crew gets **exactly one** guaranteed drop + **one** Mud Bucket pull — `grant_war_spoils` is flat-per-contributor, not scaled by slings (the flat-20 `sling_mud` cap already removes any per-account volume advantage). 5 alts winning = 5 individual flat drops, the *same* yield as 5 honest players on an honest crew. There is **no concentration multiplier** to farm — running alts costs effort and returns nothing a normal crew wouldn't get. ✅
3. **Speed farm (resolve many wars fast)?** `challenge_crew`'s 24h per-pair rematch cooldown (line 434) + the `mud_wars_one_active_*` partial unique indexes (one active war per crew) bound throughput to roughly one war per crew-pair per day — the same `River Race` daily-token logic the research endorses. ✅
4. **Dupe-into-value farm (re-pull the bucket for snouts)?** The snout fallback only fires when the user **owns every eligible item**; the dig-stamp insurance converts dupes into *missing set members*, not currency. Owning-everything yields the fixed +150 fallback (same as `grant_mystery_box`), not a scaling drip. ✅

**Net:** every payoff an alt ring could chase is either zero (bot/proportional) or identical to honest play (flat drop), so the *economic* incentive to run alts collapses before any detection is needed — the Lens-4 thesis, demonstrated against the shipped code. The only residual is alts diluting an *honest* opponent's win-rate, which is a matchmaking concern for the mud-fights system, not a War Spoils faucet.

---

## The "animated" capability (the real tech gap + chosen approach)

**The gap is real.** Today every cosmetic is a static PNG: `HAT_IMAGES[id]` → `<Image source={...} resizeMode="contain" />` inside `PigStage`'s `ItemOverlay`. Backgrounds and auras are full-canvas static images. **There is no per-item animation path** for accessories — `CATEGORY_PERANIM_SHIFTS` only nudges position per *pig* pose; it doesn't animate the item itself.

**But the primitive already exists.** `components/ui/SpritePig.tsx` is a working sprite-sheet animator: a `FRAMES` require-map of PNGs, an `ANIMATIONS` table (`frames[]`, `fps`, `loop`), a `setInterval` frame-stepper, `onComplete`/`onFrame` callbacks. And `constants/prebaked.ts` (`ITEM_PREBAKED`) already proves the "swap in a multi-frame strip for a specific item" pattern — `SpritePig` accepts `customFrames` to render bespoke "pig wearing X" frames instead of default Rosie.

### Chosen approach: **sprite-sheet frames** (extend the existing primitive)

Reject Rive and Lottie for v1:
- **Rive** (there's a rive-pig thread) — best motion quality, but adds a native runtime (`rive-react-native`), a `.riv` asset pipeline, and a new render path that doesn't compose with the anchor/overlay system. A bigger bet than a *first* war-cosmetic season warrants. **Park it for the Heirloom-marquee tier later.**
- **Lottie** (`lottie-react-native`) — great for vector FX (the bog-rain, sparkle drift), but our art is raster (ChatGPT/icon-gen output), and Lottie wants vector JSON. Mismatched with the pipeline that produces volume.
- **Sprite-sheet frames** — **reuses `SpritePig`'s exact mechanism**, the icon-gen pipeline already outputs PNG strips, and it composes with the overlay/anchor system. Lowest-risk, ships this season, and the `customFrames`/`ITEM_PREBAKED` precedent means the renderer change is small.

### What the render needs

A new `AnimatedItemOverlay` in `PigStage.tsx` that mirrors `SpritePig`'s frame-stepper for an *item* overlay: when an equipped item has an animated frame-set, cycle its frames at the item's fps instead of drawing one static PNG. Concretely:

- A new client constant `ANIMATED_ITEM_FRAMES: Record<string, { frames: number[]; fps: number; loop: boolean }>` (require-map of strip PNGs, keyed by item id), parallel to `HAT_IMAGES`.
- `resolveSlot` already returns `imageSrc`; add an `animFrames` field. `ItemOverlay` renders the animated strip via a tiny `useFrameCycler` hook (lifted from `SpritePig`'s `useEffect` interval) when `animFrames` is present, else the static `Image` as today.
- Full-canvas categories (background/aura) keep the same `isFullCanvasCat` z-order; only the inner image source becomes a frame-cycler. Animated backgrounds live as the full-page `ImageBackground` at the top of the Barn (per the `PigStage` comment) — so the Barn screen's background renderer (not `PigStage`) gets the cycler for backgrounds; `PigStage` gets it for hats/auras/held.
- **Performance discipline:** cap concurrent item animators (one background + one aura + one hat is the realistic max), reuse `SpritePig`'s single-`setInterval` pattern, and gate fps low (2–6, like the pig). Preload strip frames the same way `FRAMES` does (static `require`).

### What the schema needs

Animation is **render metadata**, so the source of truth is the catalog. Add to `public.hats`:
- `anim_kind text` — `NULL` (static, today's default) | `'spritesheet'` (v1) | reserved `'rive'`/`'lottie'` for later.
- `anim_frames int` — frame count (the client maps id → strip require()s; the column drives the cycler config + lets the shop badge "animated").
- `anim_fps int` — playback rate.

Static items leave all three NULL and render exactly as today (zero regression). The client's `ANIMATED_ITEM_FRAMES` require-map is the actual asset binding (RN bundler needs literal `require` paths — same constraint as `HAT_IMAGES`); the DB columns are the *catalog flag + config* that tells the UI an item animates.

---

## Generating volume (the ChatGPT/icon-gen pipeline at scale)

The volume target (hundreds of SKUs) is met by the Lens 3 #8 **constrained-batch pipeline over a locked style anchor**, driven by the **shipped `icon-gen` skill** (`~/.claude/skills/icon-gen/SKILL.md` — drives a ChatGPT tab via the Claude-in-Chrome connector, parses a brief with a `## Style anchor` block + `## Batch N of M` blocks, sends batches, auto-downloads). This is the *exact* pipeline that produced `HAT_IMAGES` Batches 1–10 (see the dated comments in `constants/hats.ts`).

### The multiplication math

1. **Lock one mud-style anchor** from ~10–20 concepts (the brief's `## Style anchor (paste once)` block) — palette, lighting, the "wet bog / brown-green / splatter" look that reads as War Spoils at a glance.
2. **Recolor floor (cheapest multiplier).** One mud-hat anchor × 8 mud-tones = 8 Muddy (common) SKUs from one base prompt — a palette swap. The research's "6,357 LoL chromas from a few hundred models" caution applies: variants are catalog volume, not new art.
3. **Themed sets (the multiplier across themes).** `8 palettes × 5 set themes (Swamp King / Mud Derby / Bog Witch / Pigpen Brawler / Trench)` = **40 style-consistent entries per base prompt.** A handful of base prompts → hundreds of catalog rows.
4. **Animated apex via image-to-video → strip.** For Champion/Heirloom: take the static apex PNG, image-to-video, slice into a 4-frame strip (the `SpritePig`/prebaked slicing convention already documented in `constants/prebaked.ts` step 1–4). The strip drops into `assets/images/<war-spoils>/<id>/<n>.png` + a `require` entry, exactly like `FRAMES`.

### The catalog-authoring loop (where the volume lands)

The icon-gen output is PNGs; turning them into *catalog rows* needs the boring half:
- A **`docs/builds/war-spoils-batch-N.md` brief** (style anchor + batch blocks) feeds `/icon-gen`.
- Generated PNGs land in `assets/images/war-spoils/` and get `require` entries appended to `HAT_IMAGES` (static) or `ANIMATED_ITEM_FRAMES` (animated) — same edit shape as every prior batch.
- A **catalog seed migration** inserts the `public.hats` rows (id, name, emoji, cost, display_order, category, rarity, description, + new `war_exclusive/war_season/set_id/anim_*`). Recolor/variant rows are mechanical to generate — a small SQL-or-script templating pass over `(theme × palette × rarity)`.
- The **anchor placement** for each new hat is solved by the existing `tools/item-anchor` web tool writing `hat_rel.generated.ts` (the `HAT_REL` path in `constants/hats.ts`) — no per-item hand-math.

**Net:** a few dozen base prompts + the recolor/theme/animate multipliers + the existing anchor tool = hundreds of style-consistent War Spoils SKUs at low marginal cost, all rendering through infra that already exists.

---

## Already built ✅

- **Catalog table** `public.hats` (id, name, emoji, image_path, cost, display_order, **category**, **rarity** w/ 5-tier CHECK, description) — `20260501210000_hats_shop.sql`, `20260502030000_shop_catalog.sql`.
- **Inventory** `public.user_hats` (user_id, hat_id, acquired_at, PK) with `ON CONFLICT (user_id, hat_id) DO NOTHING` grant idiom everywhere.
- **Equip slots** — profile columns `active_hat_id / active_glasses_id / active_mask_id / active_neck_id / active_aura_id / active_background_id / active_held_id / active_tickle_particle_id / active_flag_id` (`20260514000000`, `20260519000000`, `20260549000000`, `20260596000000`), routed by `constants/slots.ts` (`SLOT_FOR_CATEGORY`, `SLOT_COLUMN`, `columnForCategory`).
- **Equip write** — client `supabase.from("profiles").update({ [column]: itemId })` in `app/(tabs)/shop.tsx` `handleEquip`; Closet equips via the same `onEquip` (`components/ClosetView.tsx`).
- **Render** — `HAT_IMAGES` static require-map + `PigStage` (`resolveSlot` → `ItemOverlay`), z-ordered, anchor-aware (`HAT_REL` / `resolveAnchor` / `frameDelta`).
- **Animation primitive** — `SpritePig` (frame-stepper, `customFrames`) + `ITEM_PREBAKED` baked-strip path (`constants/prebaked.ts`). The mechanism to extend exists.
- **Drop pattern** — `grant_mystery_box` (rarity-weighted pick, `cost>0`/category filters, snout fallback, INLINE announcement, internal-only REVOKE) — `20260631000000_mystery_hat_box.sql`.
- **Grant+equip pattern** — `choose_allegiance` (validate → lock → grant + equip, idempotent, `ON CONFLICT DO NOTHING`) — `20260585000000_world_cup_allegiance.sql`.
- **Earning surface** — `sling_mud` (flat-20 floor) + `resolve_war` (idempotent, savepoint-guarded, already loops contributing winners, already withholds bot rewards) + `mud_war` titles — `20260647000000_mud_fights.sql` (**unpushed**).
- **Daily shop** — `daily_shop()` deterministic-per-day, excludes owned (`20260502030000`); War Spoils items can ride it post-season.

## What's needed 🔨

Ship as **one follow-on migration** (filename **must sort after `20260649000000`** — e.g. `20260650000000_war_spoils.sql`; the mud-fights `20260647` migration is unpushed and ships before/with it).

**1. Catalog schema (animated cosmetics + war flags)** — `ALTER TABLE public.hats`:
```
ADD COLUMN IF NOT EXISTS war_exclusive boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS war_season    text,                    -- "mud_derby_s4"
ADD COLUMN IF NOT EXISTS set_id        text,                    -- FK → cosmetic_sets
ADD COLUMN IF NOT EXISTS set_capstone  boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS anim_kind     text,                    -- NULL|'spritesheet'
ADD COLUMN IF NOT EXISTS anim_frames   int,
ADD COLUMN IF NOT EXISTS anim_fps      int;
```
New `public.cosmetic_sets (id text PK, name text, war_season text, description text)`; `hats.set_id` FK. `user_hats` gains `evolve_stage int NOT NULL DEFAULT 0` for Heirlooms. (Migrate-safe: all defaults make existing rows behave exactly as today.)

**2. The War-item catalog seed** — the first named season's pool: recolor floors + themed sets + animated apex. Most rows are the icon-gen multiplier output; seed them `ON CONFLICT (id) DO NOTHING` like every prior batch. Define 2–3 `cosmetic_sets` with their capstones.

**3. Grant RPCs** (all SECURITY DEFINER, `search_path public`, INLINE `system_announcements`, internal-only where appropriate):
- `grant_mud_bucket(target_user, p_season)` — `grant_mystery_box` reskin scoped to `war_exclusive AND war_season = p_season`; dig-stamp dupe-insurance; snout fallback. **REVOKE from PUBLIC/anon/authenticated** (internal).
- `grant_war_spoils(target_user, p_war, p_won boolean)` — internal: the per-winner bundle (guaranteed drop + `grant_mud_bucket` + evolve bumps) or the loser consolation; `ON CONFLICT DO NOTHING`; savepoint-safe.
- `grant_set_capstones(target_user)` — internal: for each `cosmetic_sets` row where the user owns **every non-capstone, `war_exclusive` member** (`NOT EXISTS` an unowned member with `set_capstone = false`) and does **not** yet own the capstone, grant the capstone. The "count only non-capstone war_exclusive members" predicate is the partial-set false-positive guard (Risks → Set churn) baked into the query, not left to copy. Called after any War Spoils grant.
- **Wire into `resolve_war`** — `CREATE OR REPLACE` carrying the **latest** `20260647` body **verbatim** (carry-latest-def footgun), adding only, inside the `IF winner IS NOT NULL AND NOT (w.is_bot_war ...)` block's winner loop (real wars only): a savepoint-guarded `PERFORM grant_war_spoils(m.user_id, p_war, true)`; **plus** a second guarded loop over *losing-crew contributors* (`grant_war_spoils(..., false)`); **plus** the no-quorum valve — a guarded loop in the `winner IS NULL` path over both crews' contributors granting the same consolation. Every loop reuses the existing `HAVING SUM(slings) > 0` contribution gate. No other line of the carried body changes — diff line-for-line against `20260647` before push (see Verification below).

**4. Client** — `ANIMATED_ITEM_FRAMES` require-map (`constants/`); `AnimatedItemOverlay` / `useFrameCycler` in `PigStage.tsx` (+ the Barn background renderer for animated backgrounds); a "War Spoils" Closet section + "animated"/"vaulted" badges (reuse `RARITY_COLORS`); the WhileAway reveal card for `war_spoils_*` announcements (mirror `mystery_box_opened`). Mirror any new constants into `constants/mudFights.ts` per its own note.

**5. Wiki** — new `docs/wiki/war-spoils.md` concept page; cross-link from `sounder-mud-fights.md`, the cosmetics pages, and `_index`/`_topics`/`_glossary`; append `log.md`.

**6. Verification & rollback gate (do before any DB push).**
- **Diff gate.** `git show HEAD:supabase/migrations/20260647000000_mud_fights.sql` → extract the `resolve_war` body → diff against the new migration's carried body; the *only* additions allowed are the three guarded grant loops. Any other delta = a carry-latest-def regression, stop.
- **Idempotency test.** In a scratch DB: resolve a real war twice (call `resolve_war` again after `resolved_at` is set) → assert zero new `user_hats` rows the second time (the `resolved_at` guard + `ON CONFLICT DO NOTHING`).
- **Bot-faucet test.** Resolve an `is_bot_war` win → assert no `war_exclusive` `user_hats` rows granted, only the `c_house` snout stipend + regen blessing.
- **No-quorum test.** Resolve a `winner IS NULL` war where one crew logged ≥1 sling → assert each contributor got exactly one Muddy-tier consolation, no duplicates.
- **Migrate-safe test.** Run the `ALTER TABLE` block against a copy of prod → assert every existing `hats`/`user_hats` row renders unchanged (all new columns default to the static/false path).
- **Rollback.** The migration is additive (ALTER ADD COLUMN IF NOT EXISTS + new tables + CREATE OR REPLACE). Rollback = restore `resolve_war` from `20260647` verbatim and drop the new columns/tables; no data migration to unwind. Note this in the migration header.

### Acceptance criteria (per workstream "done")
- **Schema:** all seven `hats` columns + `cosmetic_sets` + `user_hats.evolve_stage` exist with defaults; an existing static item still equips and renders identically (zero-regression check).
- **Seed:** ≥1 named season's pool inserted `ON CONFLICT (id) DO NOTHING`; 2–3 sets each have a `set_capstone` member not granted à la carte; every seeded row passes the rarity CHECK and avoids the four denylisted categories.
- **RPCs:** `grant_mud_bucket`/`grant_war_spoils`/`grant_set_capstones` REVOKEd from PUBLIC/anon/authenticated; all verification tests above pass.
- **Client:** an animated background + animated aura render concurrently at ≤6fps on a low-end device without dropped frames; a static item is byte-for-byte the same render path as today.
- **Reveal:** a `war_spoils_*` announcement surfaces in the WhileAway feed with crew gift-framing; no copy names an absent member.

## Risks

- **Carry-latest-def footgun (highest).** `resolve_war` must be re-created from its **current** `20260647` body verbatim, adding only the grant calls. Re-deriving from an older base silently deletes the bot-farm guard, the savepoint hardening, or the per-capita scoring (the build-93 referral-gate class of bug). Diff the new body against `20260647` line-for-line before pushing.
- **Migration ordering.** Filename must sort after `20260649000000`. `20260647` (mud-fights) is unpushed; both go out together — verify `20260647` is applied first (it owns `mud_wars`/`mud_slings`/`resolve_war`).
- **INLINE announcements only.** Every reveal/drop uses a direct `INSERT INTO system_announcements`. **Never `send_system_announcement`** — it's admin-gated and raises `admin_only`, silently rolling back a non-admin's whole RPC (the `donate_to_drive` / 20260618-19 footgun, already documented in `20260631`).
- **Idempotency / double-grant.** All grants live inside `resolve_war`'s `resolved_at`-guarded, run-once body, each `ON CONFLICT DO NOTHING` + savepoint-guarded. A cosmetic fault must never roll back the snout payout — wrap every grant in its own `BEGIN ... EXCEPTION WHEN OTHERS THEN NULL; END` (the existing title/blessing pattern).
- **Cash-faucet / cosmetic-faucet.** Bot wins grant **no** cosmetics (re-challengeable, fixed-pace). The snout payout stays capped (`floor(loser_pot*0.5 / win_active)`). Cosmetics are flat-per-war above the floor — no proportional scaling that an alt ring could farm.
- **Animation perf.** Cap concurrent item animators; low fps; preload strips via static `require`. Test on a low-end device before shipping animated backgrounds + auras together.
- **Pipeline rate limits.** ChatGPT image-gen caps ~3–5/day on the active account (icon-gen skill constraint). Plan batches across days; the recolor/theme multipliers reduce raw generation count.
- **Set churn.** `set_capstone` grants fire on the *last* set member acquired — the false-positive guard (count only non-capstone `war_exclusive` members) lives **in the `grant_set_capstones` query predicate** (workstream 3), not as an afterthought. Test: own all-but-one member → no capstone; own the last → exactly one capstone, idempotent on re-run.
- **Stalled chain / permanent shut-out (async single-blocker).** A crew that can never field quorum-2, or keeps losing, would earn nothing forever — the cosmetic-economy form of the research's single-blocker stall. Mitigated by the **no-quorum consolation** + **catch-up odds bump** (Channel 2 → stalled-chain valve); both are cosmetic-only and capped, so the fix can't itself become a faucet. Test the `winner IS NULL` consolation path explicitly (Verification).

## Effort

- **Catalog schema + grant RPCs + `resolve_war` rewire** (the migration): ~M. Mechanically close to `grant_mystery_box` + `choose_allegiance` + the existing `resolve_war` loop; the care is in the verbatim carry + savepoint discipline.
- **First-season catalog seed** (recolors + 2–3 sets + a few animated apex): ~M, mostly icon-gen pipeline runs + a templated seed; gated by ChatGPT rate limits.
- **Client animated-overlay path** (`AnimatedItemOverlay` + `useFrameCycler` + Barn bg cycler): ~M. Reuses `SpritePig`'s frame-stepper; the surface area is `PigStage` + the Barn background + a Closet section.
- **Wiki + reveal UI:** ~S.
- **Total:** a contained season's worth of work; the heavy infra (catalog, inventory, equip, render, drop pattern, earning loop) is all built. Biggest time sink is *art volume* through the pipeline, not code.

### Phasing — the MVP cut line (de-risks the solo-dev scope)

The "hundreds of SKUs + animated apex" target is the *ambition*, not the *first shippable*. Phase to keep each push small and reversible:

- **Phase 1 (MVP, ships first, all-static).** Schema + the three grant RPCs + the `resolve_war` rewire + a **static-only** first season (Muddy/Caked/Prize recolors + one themed set whose capstone is a *static* Prize-tier item). **Zero client render changes** — every item rides the existing `HAT_IMAGES`/`PigStage` path. This proves the earn/grant/fairness spine in production with no animation risk. `anim_kind` ships NULL everywhere.
- **Phase 2 (animation).** `ANIMATED_ITEM_FRAMES` + `useFrameCycler` + the Barn-bg cycler; promote the apex tiers (Champion/Heirloom) to `anim_kind = 'spritesheet'`; the first animated background + aura. Gated behind a low-end-device perf pass.
- **Phase 3 (depth).** Evolving Heirlooms (`evolve_stage` render), Flashback re-issue, additional sets, the catch-up bump tuning. Each is independently shippable; none blocks Phase 1.

The fairness/anti-abuse spine (cap, floor, bot-withholding, idempotency, no-quorum valve) is **entirely in Phase 1** — the risky-to-get-wrong part ships first and small, the art-volume grind backfills behind it.

## Connects to

- [[sounder-mud-fights]] — the crews/`mud_wars`/`mud_slings`/`resolve_war` stack War Spoils grants ride on (`20260647`).
- **Cosmetics infra** — `public.hats` / `user_hats` / equip-slot columns / `constants/slots.ts` / `HAT_IMAGES` / `PigStage` / `SpritePig` / `ITEM_PREBAKED`.
- **Mystery Hat Box** — `grant_mystery_box` (`20260631`), the proven rarity-weighted drop pattern the Mud Bucket clones.
- **World Cup allegiance** — `choose_allegiance` (`20260585`), the grant-+-equip-+-lock pattern for war-exclusive backgrounds.
- **Titles** — `mud_war` source titles already seeded in `20260647`; War Spoils adds per-season title flavor.
- **Daily shop** — `daily_shop()` (`20260502030000`), where post-season vaulted War Spoils items can later resurface (Flashback).
- **Research** — `coop-telephone-items-research-2026-06.md` (item-systems + fairness lenses) and `coop-mechanics-research-2026-06.md` (async / shared-goal / anti-abuse) that resolved this design.
- **icon-gen skill** (`~/.claude/skills/icon-gen/SKILL.md`) — the ChatGPT-driven pipeline that produces the catalog art at volume.
