# The Snout Almanac + The Hog Line
> Fill Rosie's trophy room with lore-stamped finery, then retire her into the Herd so her heirloom — and one daft trait — passes to the pig who carries your name next season.

**Tier:** Long-term · **Effort:** L (content-labor-bound, not plumbing-bound) · **Mode:** Async, single-player-authoritative (collection state + a once-per-season generational settle) with read-only social surfaces · **Depends on:** `hats`/`user_hats` catalog (shipped), `finalize_season()` + `season_finales` (shipped), Interior/`habitat` slot system (shipped), `system_announcements` (shipped). Lands warmest *after* the Schism Front exists so the Front's fate cosmetics have an Almanac to be paid into — but the Almanac stands alone on the existing closet.

## The fantasy
You are a keeper of a long line of pigs, not the owner of one. Every hat you collect is a page in Rosie's world-almanac — a thing with a name and a sentence of lore — and filling shelves earns you the slow museum-curator glow of a near-complete set. Then, once a season, your pig grows old with dignity, walks out into a visible Herd of ancestors, and hands her heirloom and one inherited quirk to the next generation. The alignment "reset" you used to dread becomes the proudest moment of the year: not erasure, but passing the torch.

## Player loop
- **Daily (incidental):** You acquire cosmetics the way you already do — `daily_shop()` buys, battle-pass/Slop-Club grants, lucky-pig drops, Schism-Front fate cosmetics, drive payouts. Each new `user_hats` row lights up a page in the **Snout Almanac**, a new room in the Interior. Tapping a filled page reveals one line of Rosie-world lore. Discovering a page is the daily dopamine; reading the lore is the wonder.
- **Weekly (a returning pull):** Set-completion is the heartbeat. The Almanac groups items into **12–18 lore sets** (e.g. "The Mire Court," "Harvest Regalia"). Completing a set lights a **set bonus** (a cosmetic-only aura/title, never a stat). Seasonal recurring sets make completion a *moving target* — last season's "Festival of Snouts" set returns with one new recolored member, so a 100% collector slips to 95% and chases it again (the deliberate Stardew-museum / moving-completion design).
- **Seasonal (the climax):** At Judgement Day, after `finalize_season()` banks your alignment verdict, the **Hog Line** offers a once-per-season **retirement**: your current pig walks into the **Herd** (a portrait wall in the Interior), banking that season's alignment outcome as a permanent epitaph. A new generation pig is born, inheriting one **heirloom** (an item you nominate to carry forward) and one **random quirky trait** from the trait bank. The torch passes; the Almanac persists across the whole lineage (collection is account-level, not per-generation).

## Mechanics

**Almanac milestone tiers (the museum spine).** Completion is `% of the active season catalog the caller owns`. Three Stardew-museum milestone tiers fire at **40% / 70% / 95%** of the season's collectible catalog. Each tier grants a cosmetic-only reward (a milestone title + an Interior wallpaper/`habitat` background, granted via `user_hats`/`user_titles` `ON CONFLICT DO NOTHING`). 95%, not 100%, is the top tier on purpose — the last few items are often legendary/seasonal long-tail, so 95% keeps the milestone reachable while 100% stays a flex, and recurring sets guarantee 100% drifts back down each season anyway.

**Lore.** ~115 lore lines total — one per collectible item — authored as static catalog data (`hats.lore_line`). Pure read content; revealed only for owned items. No formula, no cron, no abuse surface.

**Sets + set bonuses.** 12–18 sets, each a hand-curated `lore_set` of item ids. A set bonus unlocks when `user_hats` covers every member of the set. Bonuses are aura/title cosmetics — **never** stat-affecting (no happiness/regen/Tide multiplier), so a wealthy collector gains prestige, not power. Seasonal recurring sets add exactly one new member per season (a recolor), reopening completion.

**The Hog Line retirement (once per season, hard-gated).**
- Eligible only after the season's `finalize_season()` row exists for the caller (`season_finales(user_id, season_key)`), so retirement is the *last* beat of the season, not a mid-season choice — mirrors the existing one-finale-per-season idempotency.
- Retirement is **opt-in and one-shot per season_key**: a `hog_line_retirements` PK on `(user_id, season_key)` makes a re-call a no-op (clones the `season_finales` idempotency idiom exactly).
- On retire: snapshot the retiring pig (name, equipped look, final alignment side from `season_finales.side`, generation number) into `herd_members`; nominate **one heirloom** item id (must be in caller's `user_hats`); roll **one trait** from the trait bank using a deterministic `hashtext(user_id::text || season_key)` seed (the `daily_shop()` seeding idiom — reproducible, no RNG-reroll abuse); INLINE a `system_announcements` "passing of the torch" dispatch.
- The new generation pig keeps the **account-level** Almanac/closet (collection never resets) but starts a fresh `generation` counter and carries the heirloom + trait as cosmetic flavor.

**Traits.** A bank of ~24 quirky, cosmetic-only traits (e.g. "Snores in C-sharp," "Allergic to Mondays," "Born under a lucky truffle"). A trait is a *flavor string + optional idle-animation/aura tweak* surfaced on the pig and the Herd portrait. **No trait grants mechanical advantage** — this is the load-bearing anti-power-creep rule. Traits can be flavor-keyed to alignment side (a Giver-retired pig draws from the "warm" sub-bank) so the lineage tells a moral story.

**Edge cases.** Retiring with zero owned items → heirloom nomination is skipped, trait still rolls (a humble-origins line). Neutral final side → trait drawn from a neutral sub-bank. Account-level collection means a player who never retires still gets the full Almanac; the Hog Line is purely additive legacy, never a gate on cosmetics.

## Schema sketch

Migration prefix must sort after `20260623000000` → use **`20260626000000_snout_almanac_hog_line.sql`** (leaving room for Schism-Front migrations at 24/25).

- `ALTER TABLE public.hats ADD COLUMN lore_line text, ADD COLUMN lore_set text, ADD COLUMN season_key text, ADD COLUMN collectible bool DEFAULT true;` — extends the **shipped `hats` catalog** (the `category`/`rarity`/`description` ALTER pattern from `20260502030000_shop_catalog.sql`). `season_key` flags which seasonal catalog an item counts toward; `collectible=false` exempts joke/event items from the % denominator.
- `lore_sets(slug text PK, name text, season_key text, member_ids text[], bonus_title_id text, bonus_bg_id text, recurring bool)` — the 12–18 curated sets.
- `almanac_milestones(user_id uuid, season_key text, tier int CHECK (tier IN (40,70,95)), reached_at timestamptz, PK(user_id, season_key, tier))` — idempotent milestone ledger (clones the `user_bounty_claims` / `season_finales` PK-as-idempotency idiom).
- `herd_members(id bigserial PK, user_id uuid, season_key text, generation int, pig_name text, look jsonb, final_side text, epitaph text, trait_slug text, heirloom_hat_id text REFERENCES hats(id), retired_at timestamptz)` — the Herd portrait wall (the dated-lineage-epitaph idea from the doc's breadth sweep).
- `hog_line_retirements(user_id uuid, season_key text, generation int, heirloom_hat_id text, trait_slug text, retired_at timestamptz, PK(user_id, season_key))` — the one-shot guard (clones `season_finales` PK idempotency).
- `traits(slug text PK, label text, flavor text, side_band text CHECK (side_band IN ('warm','greedy','neutral','any')))` — the static trait bank.

**RPCs (clone the real patterns):**
- `my_almanac() -> jsonb` — STABLE, SECURITY DEFINER, GRANT authenticated. Returns owned/total per active season, % complete, per-set completion, revealed lore lines for owned items, milestone tiers reached. Clones the `daily_shop()` "LEFT JOIN user_hats to flag owned" shape.
- `claim_almanac_milestone(target_season_key text) -> jsonb` — SECURITY DEFINER, GRANT authenticated. Recomputes % from `user_hats`, inserts any newly-crossed tier into `almanac_milestones ON CONFLICT DO NOTHING`, grants title/bg via `user_titles`/`user_hats ON CONFLICT DO NOTHING`. Server recomputes — never trusts a client-supplied %.
- `retire_pig(heirloom_hat_id text) -> jsonb` — SECURITY DEFINER, GRANT authenticated. Asserts a `season_finales` row exists for caller+current season; asserts heirloom is in caller's `user_hats`; inserts `hog_line_retirements ON CONFLICT (user_id, season_key) DO NOTHING`; if `FOUND`, snapshots into `herd_members`, rolls trait via `hashtext()`, **INLINEs** a `system_announcements` torch-passing row. (NEVER calls `send_system_announcement` — admin-gated, silent rollback.)
- `my_herd() -> jsonb` — STABLE, SECURITY DEFINER, GRANT authenticated. Returns the caller's lineage portraits.

## Economy
- **Snout sinks:** Collection drives existing `daily_shop()` snout spend — the Almanac gives a *reason* to complete-the-set-buy items a player would otherwise skip, deepening the existing sink without adding a new one. Heirloom nomination costs nothing (you already own it).
- **Tickle faucets:** **None.** Milestone/set/retirement rewards are cosmetic-only (titles, backgrounds, auras, trait flavor) granted via `user_hats`/`user_titles ON CONFLICT DO NOTHING` (cost 0, non-purchasable). If a small "you raised a generation" tickle gift is ever added, it must route through `grant_tickles()` (the only over-cap-safe faucet) and ship the `GREATEST(...)` display-debt fix to `home_stats` + `admin_tickle_overview`; the MVP avoids this entirely.
- **Why it can't inflate:** SNOUTS (`profiles.counter`) only move as transfers/spends; the Almanac mints zero currency. Set bonuses are deliberately non-stat so collection wealth buys prestige, not power — sidestepping the Neopets death-spiral the doc warns against. Collection is account-level and non-tradable, so there's no secondary market to police solo.

## Anti-abuse / cheat model
- **Milestone forgery (Tier 1 — client lies about %):** `claim_almanac_milestone` recomputes ownership server-side from `user_hats`; the client `%` is display-only. PK idempotency on `almanac_milestones` blocks double-claims.
- **Trait reroll farming (Tier 2 — retire/re-retire to fish a trait):** retirement is hard-gated to once per `season_key` via `hog_line_retirements` PK, and the trait is a deterministic `hashtext(user_id || season_key)` roll — the same player+season always yields the same trait, so there's nothing to reroll.
- **Heirloom spoofing:** server asserts `heirloom_hat_id` is in the caller's `user_hats` before snapshotting.
- **No collusion/vote surface:** the Almanac and Hog Line are single-player-authoritative; the Herd is read-only display. There is no voting, rating, or peer-awarded value, so the vote-gaming/Sybil tiers don't apply. The only social surface (friends viewing your Herd via Visit) is read-only.
- **Premature retirement:** the `season_finales`-exists assertion prevents retiring before Judgement Day banks the verdict, so the epitaph can never record an unsettled season.

## Feel
Hits the **evoke-online-game-feel** lenses the doc names as this concept's strengths:
- **Discovery-as-content** — 115 lore lines that reveal only on ownership turn the closet into a slow-unfolding storybook; the world deepens as you collect.
- **Identity expression** — your equipped look, your set auras, and your visible multi-generation Herd are a personal museum friends walk through on Visit.
- **Earned mastery** — the 40/70/95 climb and recurring-set chase reward the long, patient collector without an Elo ladder or relegation (the doc's banned structure).
- **Slow time / persistent-world FOMO** — recurring seasonal sets mean "100%" is always drifting; the Herd is unerasable history.
- **Cozy guardrail held:** the alignment reset is reframed as a *dignified retirement and torch-passing*, not a wipe; traits are gentle and daft, never vicious; loss-as-story (a Greedy-retired ancestor still earns a wry epitaph). No PvP, no scarcity-panic, no miss-it-forever (sets recur annually).

## How it composes
- **Schism Front (meta-frame):** the doc designates the Almanac as the Front's warmest complement — the Front *pays its season-fate cosmetics (Golden-Age / Reckoning / Knife's-Edge recolors) into the Almanac as collectible trophy pages*, so winning the war literally fills your museum. A Reckoning-Survivor item becomes a lore-stamped Almanac page and an heirloom you can pass down — the war's outcome enters your lineage.
- **Judgement Day / `finalize_season`:** retirement chains *after* the existing finale (gated on `season_finales`), reusing the seasonal cron instead of adding one — same "reset the score, never the record" philosophy the doc commits to, now with a player-facing rite.
- **Battle Pass / Slop Club / Drives / Lucky Pig / daily_shop:** every existing cosmetic source becomes an Almanac-feeder, giving those modes a season-scale collection consequence they currently lack.
- **Interior / Habitat:** the Almanac room and Herd wall are new Interior surfaces using the shipped slot/background system; friends see them on Visit.

## MVP
Smallest shippable seed proves "cosmetics → a lore-bearing, milestone'd Pig-Dex," deferring the Hog Line:
1. **One migration:** `ALTER hats ADD lore_line, lore_set, season_key, collectible` + `almanac_milestones` table + seed lore on the existing ~40-item catalog (a partial 40 lines, not all 115).
2. **One RPC:** `my_almanac()` returning owned/total %, per-set grouping, revealed lore for owned items, tiers reached.
3. **One RPC for the reward:** `claim_almanac_milestone()` granting the 40% milestone title/background via `ON CONFLICT DO NOTHING`.
4. **One component:** an Interior "Snout Almanac" room — a shelf grid of owned (lit + lore on tap) vs locked (silhouette) pages with a 40/70/95 progress bar. Clones `daily_shop`'s owned-flag rendering + `RARITY_GRADIENT` styling.

**Increment 1:** sets + set bonuses. **Increment 2:** the Hog Line — `retire_pig()`, `herd_members`, `traits` bank, the Herd portrait wall. **Increment 3:** wire the Schism Front's fate cosmetics in as collectible Almanac trophies.

## Risks & open questions
- **Content cadence (the real cost):** ~115 lore lines + 12–18 set definitions + ~24 traits is the dominant solo-dev labor; it is *front-loaded* (author once) but recurring sets add ~1 recolor + 1 lore line + occasional new set per season. Mitigation: ship MVP on the existing ~40 items (40 lines), grow the catalog toward 115 over seasons.
- **Recurring-set frustration:** dropping a 100% collector to 95% every season is a moving target by design but could feel like a treadmill; mitigate by capping recurring additions to exactly one member per recurring set and keeping milestones at 40/70/95 (never 100).
- **Trait scope creep:** traits MUST stay cosmetic; the first time a trait grants a regen/happiness/Tide bonus, the Almanac becomes pay-to-collect power and inflates the closed economy.
- **Generation-counter UX:** does a player understand they keep their whole closet across generations? Risk of perceived loss at retirement — needs the torch-passing dispatch copy to make "collection persists, only the pig retires" explicit.

Questions:
1. Should the Hog Line retirement be **mandatory** at season end (forced torch-pass) or **opt-in** (a player can keep the same pig forever)? MVP assumes opt-in.
2. Should the heirloom be a single nominated item, or a small **2–3 item bundle**, to make lineage feel richer?
3. Do recurring sets reuse the `daily_shop()` `hashtext` seed to *rotate which set returns* each season, keeping the moving target deterministic and cron-free?
4. Should friends viewing your Herd on Visit be able to leave a canned "honor the ancestor" gesture (read-only, Sounder-only, no free-text), or stay purely view-only to avoid any moderation surface?