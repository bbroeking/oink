# Season 2 proposal: three concepts, one switch, one pick (2026-10-29)

> Status: proposal, written in a 45-minute research box on 2026-10-29 ~12:30 EDT. Nothing here is built, pushed or applied. The migration outlines are sketches for an engineer, not files to run. Every fact below was read from the repo this session; where I could not verify something from the repo it is marked **[unverified]**.

The founder wants a new season after The Great Hunger, with a reset, built into today's binary and shipped dark so the server can flip it once players have updated. Today's build packages ~18:30 EDT; one Opus engineer has ~3 hours from ~13:45. There is no OTA. New art is the scarcest resource.

## 0. What the research found (the facts every concept rests on)

### 0.1 The season machinery, as it is

| Thing | Where | What it does |
| --- | --- | --- |
| `seasons` row | `20260502010000_battle_pass.sql` | `id, name, starts_at, ends_at, total_tiers (30), xp_per_tier (100), premium_price_cents (299), premium_plus_price_cents (999)`. No theme column; the client keys fiction on nothing but the `world_boss` flag today. |
| `active_season()` | latest def `20260709000000_season_renumber.sql` | Date window, `ORDER BY starts_at DESC LIMIT 1`. **One hard pin**: a caller whose `profiles.feature_overrides.world_boss` is true always gets `snout_season_1`, regardless of dates. The founder's account carries that override. |
| `season_state()` | base `20260769000000`, wrapped by `20260779000000` | `{active:false}` when no season; otherwise the row, its `season_tiers`, lap-local xp, tier, premium, wallow fields. Entirely data-driven: **no season id is hardcoded anywhere in `app/`, `components/`, `hooks/`, `utils/`, `constants/`** (grep, this session). |
| Per-season tables | `user_season_progress`, `user_tier_claims`, `user_wallow_tier_claims` | All keyed by `season_id`. A new season row means a fresh row per player: xp 0, tier 1, `premium_unlocked` false, season-local `wallow_count` 0, no claims. **The pass resets itself.** |
| `profiles.wallow_count` | `20260769000000` | The permanent public rank. Survives rollover by design (CONTEXT.md, Wallow gifts). |
| The drum | `20260921150000_drum_draw.sql` (pushed 2026-09-21) | Keyed by `(user_id, iso_week)`; reads `rooting_receipts` by Monday-anchored week. **Never reads the season.** Nothing to reset; a flip on a Monday 00:00 UTC boundary loses no balls. |
| The Hungerer meter | `hunger_meter()`, latest `20260714000000_coop_dig_rebuild.sql` | All-time `hunger_drain.total` against constant thresholds `[600,1800,3600,6000,9000]`; six stage ids `gorged … famished`. The client (`hooks/useHungerMeter.ts`) indexes copy by those six strings. |
| The Board | `components/Leaderboard.tsx` + `hooks/useLeaderboard.ts` | Reads `profiles.tickles_earned` directly, cursor-paginated on that column. Season 0's "graduation" (`20260726000000`) archived the column to `season0_tickle_standings` and hard-zeroed it. Since 2026-09-13 the Exterior's EarnedStamp calls `tickles_earned` "the permanent number" (CONTEXT.md, Exterior). |
| Season 1 finale | `20260739100000_season1_finale_reward.sql` | `grant_season1_finale()` is **manual**: Hungerer's Crown + "Starver of the Hunger" to pigs with 10+ credited finds. Nothing fires it on `ends_at`. |
| The reserved premium track | `20260792000000_season2_premium_cosmetics_only.sql`, `20260916150000_season2_premium_pass_exclusive.sql` | Nine members' cosmetics (ganache_truffle_crown, slop_pail_topper, truffle_medal_held, drip_glaze_aura, spa_wallow_bg, cocoa_sheen_specs, caramel_drip_bow, corn_on_the_cob, slop_club_signet_crown) are already `pass_exclusive = true`, fenced off the shop, with tier UPDATEs written for `snout_season_2` that matched nothing because the row does not exist. The repo has already decided what Season 2's premium track is; the art has been in every binary since 2026-06-29 (`constants/membersImages.generated.ts`). |
| The dark-launch pattern | `20260706500000_flag_dark_new_season.sql`, `20260706300000_extend_season1_to_flip.sql` | The S0→S1 playbook: seed the next season at a far-future placeholder window (`2027-01-01`), extend the live season **exactly to the flip instant**, then one UPDATE of both rows hands over cleanly through `ORDER BY starts_at DESC`. |
| Halloween | `docs/design/halloween-2026/content.json`, `20261014180000`, `20261014200000` | 40 wearables + 9 backgrounds + 49 unlock cards; the card set `halloween_2026_v1` and the login-gift campaign are seeded inactive. Costume art landed in `assets/images/costumes/` **today**; costumes are "pending native wardrobe" (preflight doc), so they are not pass-safe. |

### 0.2 What "reset" can mean here

| Bucket | Items | How it resets |
| --- | --- | --- |
| **Resets by itself** (keyed by season id) | pass XP, current tier, `premium_unlocked` (the pass is a consumable, re-bought per season; Slop Club keeps premium via `is_vip`), season-local Wallow lap, tier claims, Wallow-tier claims | A new `seasons` row. Zero server work beyond seeding. |
| **Weekly already** | drum balls, Monday purse, weekly quests, the perfect-feeding week | Untouched. The last S1 week's purse stays drawable in S2's first week (unlike the race in September, nothing is left unpaid). |
| **Needs a one-time server act at the flip** | the Hungerer meter (all-time total), the Board (`tickles_earned`) if it is to be season-scoped | Baseline, not zero: store the meter total at flip and read `total - baseline`; for the Board, a `season_tickles_earned` column maintained by trigger and zeroed at flip, so the lifetime stamp keeps its promise. |
| **Must never reset** | owned cosmetics (`user_hats`), titles, Barn furnishings and keepsakes, `profiles.wallow_count`, Motes, Golden Truffles, the tickle bank (`user_items.item_count`), snouts (`profiles.counter`), the Satchel, Find discovery, Burrow Book discovery, achievements, Slop Club, Streak, happiness, friends and Sounders, referral state, the Hungerer's Crown once granted | Not touched by any concept below. |

### 0.3 Old binaries at the flip (the live App Store build is 1.2, build 143, mid-July)

- **No crash, no blank.** `season_state()` is the only contract and it is data-driven; the "No season running" empty state fires only on `active:false`, which the bridge prevents. Build 143 will load Season 2's row, its day count and its tiers, and claims work (claiming is server-side).
- **Fiction mismatch.** With `world_boss` true (it must stay true: nine client surfaces and five RPCs read it as "the dig exists"), `app/(tabs)/season.tsx:1520-1530` prints the literal title "The Great Hunger" and the kicker "the Hungerer is <stage>" over whatever season is active. An old binary will show Season 2's tiers under Season 1's name.
- **Art.** Reward ids without bundled art draw the missing-item star (`utils/rewardArt.ts`, the 20260685 orphan path), not a crash. Build 143 has the nine reserved premium items (art added 2026-06-29) but not `hungerers_crown` (2026-07-14), none of the Halloween items, and does not know `reward_type = 'habitat'` (2026-09-16).
- **Stage names are a contract.** `HUNGER_STAGE_LINE` is a `Record<HungerStage,string>`; an unknown stage id from the server renders an empty line in old binaries. Any concept that re-skins the meter must keep the six string ids and change copy client-side only.
- **No minimum-version or force-update gate exists** (grep for `min_build`, `force_update`, `expo-updates`, `nativeBuildVersion`: nothing). The only version surface is the "What's new" modal (`constants/release_notes.ts`), which is local.
- **The founder's own pin.** The `world_boss` per-user override pins `active_season()` to `snout_season_1` forever. Left alone, the founder's account would stay in Season 1 after the flip. The carried `active_season()` must replace that pin with an explicit `season_preview` override.

**Conclusion:** the flip is *safe* on day one for every binary; it is *coherent* only on binaries that carry today's client work. The switch should wait for adoption, and today's binary should carry a soft "there's a new build" nudge so this is the last flip that has to wait blind.

## 1. Three concepts

All three keep the Truffle Patch, the drum, the pass, the Wallow and the Almanac exactly as built. Each adds one small mechanic and a fiction. Dates below assume the flip on Monday 2026-11-16 00:00 UTC (see §2 for the alternative Monday).

### A. The Feast

**Fantasy.** The herd starved him. The Great Hungerer slunk off over the ridge with his belly empty and the valley's tickles came back up out of the mud, fat and warm. So the pigs did what pigs do when the lean year ends: they set a long table. Every truffle dug this winter goes into the larder, the larder fills by the week, and at the end of it the whole valley sits down to eat. Rosie has never been so happy, and it shows.

**Pillar fit.** *Collect* first: the nine reserved premium cosmetics (the spa, the ganache crown, the cocoa specs, corn on the cob) finally get handed out, and they read as feast-and-rest after hunger. *Contend*: the drum, with its one new ball. *Connect*: the larder is everyone's dig, cooperative in fiction, never a Sounder on the page (the 2026-09-21 ruling holds). Fair by construction: the new mechanic is per-pig and printed before Monday.

**The one new mechanic: Leftovers.** A Monday that pays below rare leaves one ball in your drum for next week. Visible on the Draw panel as `7 balls (+1 leftover)`, counted in the odds line, capped at one. It is the pity floor the drum spec explicitly shaped and deferred ("a rare-less Monday adds one ball to next week", `docs/design/2026-09-21-season-page-rewrite.md` §2): a ball, never a multiplier, no other pig in the formula.

**Reset scope.** Resets: pass XP, tier, premium, claims, season Wallow lap (by season id); the meter, re-read as the Larder (baseline at flip, same six stage ids, filling instead of starving); the Board, season-scoped via `season_tickles_earned` (optional, §3 cut list). Carries: everything in §0.2's "never" bucket, plus the Hungerer's Crown, which must be granted before the flip.

**Pass track (30 tiers, reusing art already in the binary).**
- Free: tickles (the same ladder S1 used), six new titles (text only: *Trencherman*, *Of the Long Table*, *Larder Keeper*, *Second Helpings*, *The Well-Rested*, *Feast-Bringer*), `pumpkin_treat_pail` (held, uncommon), `harvest_moon_cornfield_bg`, `lantern_porch_bg` (these three need their `hats` rows to exist; the seasonal card migration seeds the set inactive and "without card mappings", so **check that the item rows are seeded** before pinning them), one Barn furnishing at tier 22 (`reward_type 'habitat'`, as S1 did).
- Premium: the nine reserved items at the tiers `20260792` already names (2, 5, 8, 12, 14, 16, 21, 27, 29), plus `candy_lantern_trail_bg` at 10, `ghostlight_lantern` at 20, and the tier-30 finale `festival_night_bg`-class background from S1's pool if unused, else a title + 500 tickles like S1's free finale.
- No costumes in the pass (wardrobe is pending).

**Length and dates.** Eight weeks: Monday 2026-11-16 00:00 UTC to Monday 2027-01-11 00:00 UTC. At 20 XP per dig, three feedings a day, 30 tiers (3000 XP) take ~50 days; eight weeks leaves room for the holidays and the Wallow lap.

**Client work in today's binary (~2h50, detail in §3).** A `seasonTheme` table keyed by `season.id`; the Season tab's title, kicker, story, guide and info read it; the Feed panel's hero (Rosie `happy` instead of the Hungerer chip) and meter copy read it; the Draw panel prints the leftover; the soft-update nudge.

**Server work (one migration, not applied).** Seed the row dark, titles, tiers (the nine premium UPDATEs rewritten as INSERTs), carry `active_season()` with a `season_preview` override, carry `hunger_meter()` with a baseline, carry `monday_draw_state()` / `draw_monday_purse()` with the leftover, the `flip_season_2()` function, the `min_build` setting, the bridge extension.

**Risks.** The meter's fiction flips direction (starving → filling) while the stage ids stay `gorged … famished`: old binaries will say "the Hungerer is gorged" over the Feast, a cosmetic wrongness, not a bug. The three Halloween backgrounds need live `hats` rows. If the premium nine's art has drifted since June (placements), the Closet is where it shows; verify once on device.

### B. The Long Night

**Fantasy.** The nights got long. Not scary, just long, the kind where you light a lantern on the porch so a friend can find the gate. Every Barn in the valley hangs one this winter, and a visit lights it. By midwinter the whole hillside is dotted with little flames, and the pig whose lantern never went out gets to keep it.

**Pillar fit.** *Connect* first: the season's exclusive is earned only by visiting other pigs' Barns, which is the warmest thing the game has. *Collect*: the fifteen-or-so Halloween items that are not strictly spooky (lanterns, candles, headwraps, straw hat and bow, crystal ball, cornfield and porch and trail backgrounds) get a second, longer life. *Contend*: the drum, unchanged.

**The one new mechanic: Lanterns lit.** A server grant by rule, exactly the shape of `grant_season1_finale()`: distinct hosts in `barn_visits` within the season window. 30 lanterns lit grants the season exclusive (Ghostlight Lantern, held) and a title; the Season guide prints `12 of 30 lanterns lit`, from one new field on `season_state()`.

**Reset scope.** Same as A for the pass; the meter stays the Hungerer's (dormant, hidden behind the theme) or is simply not drawn; the Board as in A.

**Pass track.** Free: tickles, six titles, `lantern_porch_bg`, `linen_knot_headwrap`, `straw_bow`. Premium: `pip_candle`, `scarab_lantern`, `patched_straw_hat`, `star_headwrap`, `spark_goggles`, `bubbling_flask`, `moon_charm`, `candy_lantern_trail_bg`, `harvest_moon_cornfield_bg`, `crystal_ball` at 30. The nine reserved spa items stay in the drawer for a later season.

**Length and dates.** Nine weeks, Nov 16 to Jan 18, so it crosses the actual longest night.

**Client work (~3h15, over budget).** Everything in A minus the leftover line, plus: hiding the meter, the lantern count line, and a lantern mark on the Visit screen's host pig (`PigStage` chrome, the costly part). Cut the Visit mark and it fits.

**Server work.** As A, minus the leftover, plus `grant_long_night_lanterns()` and the `lanterns_lit` field on `season_state()`.

**Risks.** Every item in this track has art only in **today's** binary; old binaries draw stars for the whole pass, which argues harder for waiting on adoption. The Halloween `hats` rows must exist live (same check as A). The fiction leans on the Visit screen, which is the surface most constrained by art.

### C. The Second Hunger

**Fantasy.** He came back. Thinner, meaner, hungrier. The herd starved him once and he remembers; this time he feeds at dusk, when the lanterns are low and the pigs are tired. Dig at nightfall and you dig against him directly. Starve him twice and nobody in the valley will ever go hungry again.

**Pillar fit.** *Contend*, mostly: the meter re-arms, the drum keeps turning. *Collect*: the reserved nine on the premium track, as in A. *Connect*: no new reason to think of a friend, which is the honest weakness.

**The one new mechanic: Nightfall feeding.** The last feeding window of the pig's own local day drops **two** balls instead of one. Server-only: `user_draw_week_feeding_windows` already knows the pig's zone and windows, so the ball count is `digs + nightfall_digs`. Per-pig, printed before Monday, no other pig in the formula. The Feed panel says `tonight's feeding counts double`.

**Reset scope.** As A; the meter baselines and keeps its starving direction and copy, so **no client copy changes at all** are strictly required.

**Pass track.** As A's, with the Halloween items swapped for S1 leftovers if any are unclaimed in the catalog [unverified: which S1 items went unclaimed by everyone].

**Length and dates.** Six weeks, Nov 16 to Dec 28; a sequel should be shorter than the original.

**Client work (~1h30).** The theme table and title/kicker (to say "The Second Hunger"), the nightfall line on the Feed panel, the soft-update nudge. The cheapest by an hour.

**Server work.** As A minus the leftover, plus the nightfall ball in `_monday_draw` ball counting and a retuned threshold array.

**Risks.** "Same season again" is a real retention risk; the intro cinematic cannot be reused without lying (the S1 intro ends with the Hunger beginning). Doubling a specific window favours pigs whose evening is free, which is a fairness-by-construction smell the charter asks about.

## 2. The switch (shared by all three)

**How it ships dark.** The S0→S1 playbook, with one fix:
1. `INSERT INTO seasons ('snout_season_2', <name>, '2027-01-01', '2027-02-01', 30, 100, 299, 999)`. The row exists, its tiers exist, nothing is active. Seeding `season_tiers` is invisible (unlike `achievements`, nothing lists them before the season is active).
2. **Bridge:** extend `snout_season_1.ends_at` from `2026-11-12 00:20:10.715+00` to **`2026-11-30 00:00:00+00`** (a Monday) with the `WHERE ends_at < …` guard `20261013000000` used. That covers both candidate flip Mondays (Nov 16, Nov 23) and leaves a week's slack; if the flip slips past Nov 30, extend again by dated migration, never let it lapse (the 2026-10-12 lapse read as "the season stopped").
3. Carry `active_season()`: keep the date window; replace the `world_boss → snout_season_1` pin with `feature_overrides ->> 'season_preview'` (a season id) so the founder's account sees Season 2 before the flip and falls back to dates after it. Set `season_preview = 'snout_season_2'` on the founder's row in the same migration.
4. `world_boss` stays true, globally and forever. It means "the dig exists".
5. Seed `app_settings.min_build = {"build": 0, "title": "", "body": ""}` (inert until the flip).

**The exact flip procedure** (one service-role function, `flip_season_2(p_at timestamptz DEFAULT now())`, guarded by `app_config.season2_flipped`):
1. The day before: `SELECT public.grant_season1_finale();` after checking the eligible count. The S1 crown is manual and nothing else will fire it.
2. At the instant (a Monday 00:00 UTC, the drum's week boundary): in one transaction, `UPDATE seasons SET ends_at = p_at WHERE id='snout_season_1'; UPDATE seasons SET starts_at = p_at, ends_at = p_at + interval '8 weeks' WHERE id='snout_season_2';` both rows match for one instant and `ORDER BY starts_at DESC` hands over, exactly as `20260706300000` did.
3. Write the meter baseline (`app_settings.season_meter = {season_id, baseline: hunger_drain.total}`), snapshot the S1 Board into `season1_tickle_standings` (the `season0_tickle_standings` shape), zero `season_tickles_earned` if the column shipped. Set `season2_flipped = true`.
4. `UPDATE app_settings SET value = jsonb_build_object('build', <today's build>, 'title', 'A new season rolled in', 'body', 'Update to see it properly.') WHERE key = 'min_build'`.
5. Verify as a non-test user with the `set_config('request.jwt.claims', …)` harness (project memory): `SELECT id, name FROM active_season()`; `SELECT season_state()->>'active'`.
6. Announce with an inline `system_announcements` INSERT (never `send_system_announcement()` from a user path).

**Old-binary behaviour at the flip.** Works, claims work, draws work; title and Hungerer kicker read Season 1's copy; reward art falls back to the star for ids the binary lacks (§0.3). No path crashes and no path blanks because the bridge never lets `active_season()` go empty.

**Soft-update prompt in today's binary: yes.** Reasoning: there is no OTA and the tail of old binaries is weeks long; the flip needs coherence more than safety; the prompt costs ~35 minutes, is server-driven through the existing `configCell` / `app_setting` RPC path (`utils/configCell.ts`), and is inert until the `min_build` row is raised. Never blocking: a `Sticker` on Home with one line and a Button to the canonical App Store listing (`utils/redemption.ts` already owns that URL). It helps nobody on build 143, which is why this flip still waits for adoption, and why every flip after this one will not.

**The reset's server mechanics.** Archive, never zero, except the one column that is defined as season-local. The pass resets by key (nothing to undo). The meter and Board are *baselined* (a stored number subtracted at read), so the raw ledgers stay intact and the reset is reversible by deleting the baseline. `flip_season_2()` is idempotent through the `season2_flipped` guard and reversible through `unflip_season_2()`: restore S1's `ends_at` to the bridge date, S2's `starts_at` to `2027-01-01`, delete the baseline, clear the guard. Season 2 progress rows written during a reversed flip are harmless (they key on the S2 id and reappear when it flips again).

## 3. Recommendation: The Feast, with a 3-hour brief

**Why A.** The repo already chose its premium track and fenced the art for exactly this (`20260792`, `20260916150000`), so the Collect spine costs nothing and renders on every binary back to June. The fiction is the sequel's true emotional beat: the herd won, now it eats. The only client surfaces that change are copy, one hero sprite swap and one line on the Draw panel; the one new mechanic is the drum spec's own deferred idea, server-side and per-pig. C is cheaper but asks players to run the same season again; B is the better Connect story but puts every reward behind art only today's binary has, and over budget.

### 3.1 Files (client, in order; times are estimates for one Opus engineer)

| # | File | Change | Est. |
| --- | --- | --- | --- |
| 1 | `utils/seasonTheme.ts` (new) | `seasonTheme(id)`: `{ title, kicker(day,total,stage), story: 3 beats, guide steps, meterLine(lastDay), stageCopy: Record<HungerStage,string>, heroArt }` for `snout_season_1` and `snout_season_2`; unknown ids fall back to S1's theme so a future S3 never blanks. Pure, tested. | 30m |
| 2 | `app/(tabs)/season.tsx` ~1514-1535 | Title and kicker from `seasonTheme(season.id)` instead of the `s1 ? "The Great Hunger"` literal; pass the theme to `SeasonStory`, `SeasonGuideModal`, `SeasonInfoModal`. Keep `s1` for the structural branches. | 20m |
| 3 | `components/season1/SeasonStory.tsx`, `SeasonGuideModal.tsx`, `SeasonInfoModal.tsx` | Read beats and steps from the theme prop (S2 beats: the table, the larder, the feast; art: `assets/images/sprites/rosie/happy_*.png`, the Hungerer chip walking off). | 30m |
| 4 | `components/season1/almanac/FeedPanel.tsx`, `StageMeter.tsx`, `hooks/useHungerMeter.ts` | `HUNGER_STAGE_LINE` becomes the S1 entry of `stageCopy`; the panel reads the theme's `meterLine` and `heroArt`. Stage ids unchanged. | 25m |
| 5 | `utils/mondayDraw.ts`, `components/season1/almanac/DrawPanel.tsx` | Parse optional `leftover_balls` (0 when absent, the defensive parser already fail-softs) and print `+1 leftover` next to the ball count; `oddsOneIn(balls + leftover)`. | 20m |
| 6 | `hooks/useMinBuild.ts` (new), `components/UpdateNudge.tsx` (new), mounted on Home | Read `app_settings.min_build` through `configCell`; compare to the native build number (`expo-application` if present, else `Constants.expoConfig.ios.buildNumber`); when lower, a `Sticker` with the server's title/body and a Button to the App Store URL from `utils/redemption.ts`. Dismissable per launch. | 35m |
| 7 | `components/GreatHungerIntroModal.tsx` | Gate on `seasonTheme(season.id).hasIntroCinematic` so a new player in the Feast is not shown the Hunger beginning. | 10m |
| 8 | Tests | `__tests__/seasonTheme.test.ts` (both ids, the unknown-id fallback, stage ids complete); extend `__tests__/drawPanel.test.tsx` (leftover absent / present); `__tests__/useMinBuild.test.ts` (missing row, lower, equal). | 20m |

Total ≈ 3h10. **Cut order if short:** 7 first (one `__DEV__`-free guard, can ride the next build), then 4's hero art swap (keep the Hungerer chip, change only the copy), then 5 (the server can hold the leftover until the next build; the ball still counts, it just is not labelled). Never cut 1, 2 or 6.

Tokens and primitives only (`docs/design/taste-standard.md`): the nudge is a `Sticker` + `Button`, copy through `T` roles, no raw hex, no emoji.

### 3.2 Migration outline (NOT applied; filename after the newest applied, verify with `supabase migration list --linked` first per project memory)

`supabase/migrations/20261029180000_season_2_the_feast_dark.sql`
1. Seasons row `snout_season_2`, 'The Feast', `2027-01-01` to `2027-02-01` placeholder, 30, 100, 299, 999. `ON CONFLICT DO NOTHING`.
2. Six titles, `source='season'`, `for_sale=false`, ids by `title_id_from_name`.
3. `season_tiers` for `snout_season_2`: the free ladder (tickles mirror S1's amounts), the three Halloween backgrounds/held item **only after** confirming their `hats` rows exist on prod, one `habitat` tier; the premium nine as INSERTs at `20260792`'s tiers, plus `candy_lantern_trail_bg` (10), `ghostlight_lantern` (20), and the tier-30 finale.
4. Carry `active_season()` from `20260709000000`: `season_preview` override replaces the `world_boss` pin. Set the founder's `feature_overrides.season_preview`.
5. Carry `hunger_meter()` from `20260714000000`: `total := hunger_drain.total - COALESCE((app_settings.season_meter->>'baseline')::bigint, 0)`; thresholds retuned from the S1 total at flip (the S1 arc reached which stage by day 56 [unverified: read `hunger_drain.total` with `db query --linked`]); stage ids unchanged.
6. Leftovers: `monday_draw_leftovers(user_id, from_iso_week, to_iso_week, PRIMARY KEY (user_id, to_iso_week))`; `draw_monday_purse()` carried from `20260921150000` inserts one row when the paid tier is `common` or `good`; the ball-count helper adds `1` for a row keyed to the week being counted; `monday_draw_state()` adds `leftover_balls` to both the running and drawable week; `_monday_draw_odds_one_in` is called with `balls + leftover`.
7. Bridge: `UPDATE seasons SET ends_at = '2026-11-30 00:00:00+00' WHERE id = 'snout_season_1' AND ends_at < '2026-11-30 00:00:00+00'`, with the `RAISE EXCEPTION` check from `20261013000000`.
8. `profiles.season_tickles_earned bigint NOT NULL DEFAULT 0` + a BEFORE UPDATE trigger adding the positive delta of `tickles_earned`; `season1_tickle_standings` archive table. (Pairs with a 6-line change in `hooks/useLeaderboard.ts` to sort on the new column; the first cut if the day runs short, in which case the Board stays lifetime for Season 2 and the column waits.)
9. `app_config.season2_flipped = false`; `app_settings.min_build` inert; `flip_season_2(timestamptz)` and `unflip_season_2()`, service-role only, `REVOKE … FROM PUBLIC, anon, authenticated`.
10. Validate in the stubbed plain-Postgres Docker harness (project memory: local `db reset` dies at pg_cron). Do not touch `world_boss`, `snout_deep`, `multiplayer`, the Halloween campaign rows.

### 3.3 Tests to add
- `seasonTheme`: both ids resolve; an unknown id returns the S1 theme; every `HungerStage` has copy in every theme (the old-binary contract, now a test).
- `drawPanel`: ball line with and without `leftover_balls`; odds use the sum.
- `useMinBuild`: no row → hidden; `build` lower than native → shown; equal or higher → hidden; malformed row → hidden.
- Harness SQL (in the migration's own `DO` block, as the repo does): `flip_season_2()` twice is a no-op the second time; `unflip_season_2()` restores both rows; `active_season()` for a `season_preview` user returns S2 while dates still say S1.

## 4. Open questions for the founder

1. **The Board.** Season-scope it through a new `season_tickles_earned` column (lifetime stamp keeps its promise), hard-zero `tickles_earned` as Season 0 did, or leave the Board lifetime for Season 2?
2. **Which Monday.** Nov 16 (ten days of adoption after review) or Nov 23? What adoption share of today's build is "enough" to flip, and is Sentry release adoption the measure?
3. **Money.** The Season Pass consumable is re-sold for Season 2 at the same $4.99, and Slop Club keeps including the premium track (`is_vip`)? Nothing in the premium nine is a boost or tickles, so the 2026-09-16 ruling holds.
4. **The crown.** `grant_season1_finale()` fires the day before the flip regardless of the Hungerer's final stage? (The grant is manual; today's binary cannot show the Crown to build-143 players, who lack its art.)
5. **Halloween in the pass.** Confirm costumes stay out (wardrobe pending) and that three to five modular Halloween items may be pinned to tiers, which requires their `hats` rows live before the flip; otherwise the pass uses only the reserved nine and S1's unused pool.
