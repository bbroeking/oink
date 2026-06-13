# The Homestead
> Build a little self-tending farm out of snouts, let it cook overnight, and once a season burn it all down for permanent Rich Soil — while every harvest you tithe to the village Granary pushes the whole sounder toward the Givers.

**Tier:** Long-term · **Effort:** L (sprite-bound; ~10–14 structure sprites) · **Mode:** async, server-authoritative idle/incremental (NO client idle compute) · **Depends on:** alignment axis + `shift_alignment` (shipped); the Schism Front MVP (`world_tide`) as the Granary's sink target — degrades gracefully to a per-player sink if the Front isn't live yet.

## The fantasy
You are a homesteader on the edge of the pasture, coaxing a cozy little farm into existence one structure at a time — a Compost Heap, a Truffle Grove, a Mushroom Cellar — each one quietly working while you're away. You are not grinding; you are *tending*. The deepest satisfaction is the long arc: the once-a-season Harvest Festival where you give the whole farm back to the soil and start over richer, and the daily quiet choice of whether to hoard your harvest or tithe it to the village Granary so the world tilts a little kinder.

## Player loop
- **Daily (the quiet tend, ~30s):** Open the Homestead (a panel reached from the Barn Exterior, beside the Garden). Each built structure has filled up its **capped yield bucket** since you last looked — exactly the shipped capped-regen pattern that drives the tickle bank. You **Collect** the accrued snouts (server settles the bucket on collect; the client never computes idle gains — same trust model as `settle_tickles`). You spend collected snouts to **build the next structure** on the dependency tree, or to **upgrade** an existing one (raising its cap and yield rate).
- **The daily fork (the alignment pump):** On collect you choose a **tithe split** — keep the harvest in your own snout counter, or divert a slice to the **communal Granary**. Diverted snouts are burned from your counter and converted into a **Giver push** on the world meter (`world_tide`), once per day, capped. This is the daily Giver pump the synthesis doc calls for: "diverting harvests to a communal Granary feeds the alignment world-state."
- **Weekly (the heartbeat):** Your structures' caps mean a fully-idle farm tops out in ~18–24h, so the *real* weekly move is upgrading the tree deep enough that the next tier unlocks. The Sunday Schism Tally (from the Front) now also reads your week's Granary tithes as part of the Givers' net movement — your farm is a front in the war.
- **Seasonal (the climax):** Once per season you may hold the **Harvest Festival** — a prestige reset. Every structure is razed, the farm returns to bare soil, but you bank permanent **Rich Soil** proportional to the total snouts the farm produced that season. Rich Soil is a permanent global multiplier on all future yields. You rebuild faster and richer each season — the slow-time mastery arc. Score resets, the soil never does (the doc's "reset the score, never the record" rule applied to a farm).

## Mechanics
**Structures (the dependency tree).** ~10–14 structures, each a sprite. Each structure is a **capped-regen bucket**, server-authoritative, modeled exactly on the tickle bank (`tickle_info` / `settle_tickles`): it has a `yield_per_hour`, a `cap`, and a `last_collected_at`. Accrued = `LEAST(cap, yield_per_hour * hours_since_collect * rich_soil_mult * happiness_mult)`. Caps exist precisely so the farm cannot run away while idle — a fully-grown structure stops accruing once full, exactly like tickles overflow into "wasted." Seed tree (build cost in snouts, each gated on a prerequisite):

| Tier | Structure | Prereq | Build cost | Base yield/hr | Cap |
|---|---|---|---|---|---|
| 1 | Compost Heap | none | 50 | 4 | 24 |
| 1 | Hen House | none | 80 | 6 | 36 |
| 2 | Mushroom Cellar | Compost Heap | 200 | 10 | 72 |
| 2 | Truffle Grove | Hen House | 250 | 12 | 84 |
| 3 | Orchard | Mushroom Cellar | 600 | 22 | 180 |
| 3 | Apiary | Truffle Grove | 700 | 26 | 200 |
| 4 | Mill | Orchard + Apiary | 1,500 | 45 | 360 |
| 5 | Granary Wing | Mill | 3,000 | (tithe multiplier, not yield) | — |

(Remaining 4–6 sprites are cosmetic/upgrade variants of the above — a "gilded" Mill, a "wildflower" Apiary — so art cost stays at the ~10–14 the seed budgets.)

**Upgrades.** Each structure upgrades through 3 levels; each level multiplies that structure's `yield_per_hour` ×1.6 and its `cap` ×1.5. Upgrade cost = `floor(base_cost * 2.2^level)`. Geometric costs make the tree a genuine deep sink without ever inflating supply (you spend snouts that already exist).

**Collect & tithe.** `collect_homestead()` settles every structure's bucket FOR UPDATE (depleting-pot atomicity borrowed from `dig_truffle`), credits the total to `profiles.counter`, and stamps `last_collected_at = now()`. The **tithe** is a separate explicit act with a **daily cap**: you may divert up to `homestead_tithe_cap` snouts/day (default 40) to the Granary. Tithed snouts are **subtracted from counter** and fed to the Giver world-state as `+floor(tithed / 8)` alignment-equivalent push (one push/day, banded so a whale can't swing the Tide). This caps the Giver pump at parity with a few blessings — it nudges, never dominates.

**Harvest Festival (prestige).** `harvest_festival()` is gated to **once per season_key** (idempotent via a `(user_id, season_key)` unique row, cloning `season_finale` records). It reads `season_total_yield` (a running tally the farm accumulates), razes all structures (deletes the rows), and banks `rich_soil += sqrt(season_total_yield / 1000)` rounded. Rich Soil applies a global multiplier `rich_soil_mult = 1 + rich_soil * 0.05` to all future yields. The square-root makes prestige worthwhile but sharply diminishing — you can't snowball to infinity.

**Edge cases.** Collect on an empty/just-collected farm is a no-op returning 0 (idempotent). Tithe past the daily cap clamps. Harvest Festival on a farm with zero structures is rejected (`nothing_to_harvest`). Concurrent collect races serialize on the FOR UPDATE row lock. Happiness multiplier reuses the existing happiness band so a sad pig's farm yields slower (ties the idle loop to the core care loop — the structures are the *pig's* farm).

## Schema sketch
```
-- clones the tickle-bank capped-regen shape (settle_tickles / tickle_info)
homestead_structures(
  user_id uuid REFERENCES auth.users, slug text,        -- 'compost','hen','grove'…
  level int NOT NULL DEFAULT 1,
  last_collected_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, slug))
-- one row per player; the prestige ledger + daily-tithe accounting
homestead_state(
  user_id uuid PRIMARY KEY REFERENCES auth.users,
  rich_soil int NOT NULL DEFAULT 0,                      -- permanent, survives prestige
  season_total_yield bigint NOT NULL DEFAULT 0,
  tithed_today int NOT NULL DEFAULT 0,
  tithe_day date NOT NULL DEFAULT current_date)
-- idempotent prestige record, clones season_finale's (user_id, season_key) PK
homestead_harvests(
  user_id uuid, season_key text, total_yield bigint,
  rich_soil_gained int, harvested_at timestamptz,
  PRIMARY KEY (user_id, season_key))
```
RPCs (all `SECURITY DEFINER SET search_path TO 'public'`, GRANT authenticated except where noted):
- `homestead_status() -> jsonb` — per-structure accrued/cap/yield, rich_soil, season_total, tithe-remaining-today, next unlock. STABLE. Clones the `home_stats()`/`tickle_info()` read shape.
- `build_structure(slug text) -> jsonb` — validates prereq + funds, debits `counter`, inserts row. Clones `open_item_drive`'s funds-check.
- `upgrade_structure(slug text) -> jsonb` — geometric-cost debit + level++.
- `collect_homestead() -> jsonb` — settle-on-read of every bucket FOR UPDATE; credits counter; bumps `season_total_yield`. Clones `settle_tickles` + `dig_truffle` row-lock.
- `tithe_to_granary(snouts int) -> jsonb` — daily-capped counter→world burn; **INLINES the system_announcements INSERT** for the "you fed the Granary" notify (never `send_system_announcement`); calls the Front's accumulation (`UPDATE world_tide SET net_today=net_today+push …`). Clones the `donate_to_drive` debit + the truffle Giver-credit (`shift_alignment(caller,+1)`).
- `harvest_festival() -> jsonb` — once-per-season prestige; idempotent `ON CONFLICT (user_id, season_key) DO NOTHING`. Clones `finalize_season`'s per-key idempotency. NOT cron-gated; player-initiated.

No new cron. The farm settles lazily on collect (no `pg_cron` idle tick), exactly like the tickle bank — this is what keeps it server-authoritative with zero background compute.

## Economy
- **Snout sink (the deepest in the game, by design).** Build + upgrade costs are geometric and uncapped at the top of the tree — there is always a more expensive next thing. This is the doc's "deepest SNOUT SINK." Snouts spent on structures are *destroyed* (debited from `counter`, never transferred), which is net-deflationary.
- **Tickle faucet (bounded, over-cap-safe).** The Homestead grants **no tickles** directly. Its only faucet touchpoint is a small weekly "you tended your farm" consolation paid exclusively through `grant_tickles()` (the only over-cap-safe faucet), banded ~5/15/30 by structures-built — a rounding error vs the home loop. **This is plausibly the first over-cap grant in the game's idle surface, so it ships the `GREATEST(...)` display-debt fix on `home_stats` + `admin_tickle_overview`** per the standing footgun.
- **Why it can't inflate.** The farm's *output* is snouts (a counter→counter quantity that already exists in the closed economy — collecting a bucket is the same as earning by tickling, just time-gated and capped). Critically, **structures cost more than they ever pay back within a season** once you account for the prestige razing: you build it, it yields, then the Festival *destroys* it. Net, the Homestead removes more snouts from circulation than it adds, because prestige resets the productive base every season while Rich Soil only multiplies a farm you must re-fund from scratch.
- **Cosmetic rewards.** Prestige tiers unlock dated "Homesteader" cosmetics via `user_hats ON CONFLICT DO NOTHING` (cost 0, non-purchasable) — a Straw Hat at 1st Festival, a Golden Scythe at 5th. Recur annually, never miss-it-forever.

## Anti-abuse / cheat model
- **No client idle compute (Tier-1 trust).** All accrual is computed server-side on collect from `last_collected_at`; the client cannot claim a bucket value. Clock-spoofing the device does nothing — the server uses `now()`. This is the same trust posture as the tickle bank and is the core reason the seed insists on server-authority.
- **Concurrent-collect / double-spend (Tier-2).** Collect locks structure rows FOR UPDATE and stamps `last_collected_at` atomically (the `dig_truffle` depleting-pot pattern), so a double-tapped Collect can't credit twice.
- **Tithe-gaming the Tide (Tier-2 collusion).** The per-day tithe cap (40 snouts → max ~+5 Giver push/day) is banded and capped so no individual or ring can swing `world_tide` materially — the Front already absorbs ~15 honest call sites; the Granary is one more bounded contributor, not a firehose. The push is `floor(tithed/8)` so micro-tithing to farm fractional pushes rounds to zero.
- **Prestige farming (Tier-2).** Harvest Festival is once-per-`season_key` (idempotent unique row), so you can't loop prestige to stack Rich Soil. `season_total_yield` is server-tallied on every collect, never client-supplied.
- **Snouts are never minted** — every Homestead snout is a settled capped-regen bucket identical in trust to tickling; there is no path to fabricate counter value.

## Feel
- **Slow Time** — capped buckets that top out in ~a day plus a once-a-season prestige make this the slowest clock in the game; you literally cannot rush it, you can only return to it.
- **Earned Mastery** — the dependency tree + geometric upgrades + compounding Rich Soil give the "I'm visibly better at this than I was three seasons ago" arc.
- **Discovery-as-content** — each unlocked prereq reveals the next structure sprite, a small wonder beat without authored narrative.
- **Belonging** — the Granary tithe is a *visible contribution to the sounder's side of the Schism*, so tending your private farm is also fighting the shared war.
- **Cozy guardrail (the explicit risk in the seed: "spreadsheet-cold tone").** Mitigations baked in: the readout is **sprites filling a cozy farm scene, never a number grid** (mirrors the Garden/Mood rule that the *visual is the readout*); Rosie reacts to the farm; the language is "tend / coax / give back to the soil," never "DPS / production rate." Numbers live behind a long-press detail, not the main face.

## How it composes
The Homestead is **framed by the Schism Front meta-frame**: its Granary tithe is the doc's explicit *"daily Giver pump"* into `world_tide`, making the farm one of the modes that "can all push the Tide." Where the Oracle bets *on* the war and the Pageant injects a one-time Tide bonus, the Homestead is the steady, opt-in **Giver-side conveyor** — the cozy, productive counterweight to the greedy hoard. It composes with the **core care loop** via the happiness yield multiplier (a sad pig's farm is sluggish, pulling you back to daily tickling). It deliberately sits *beside* the Trough and Buried Truffle rather than on top of them: those are **social** sinks (friend-funded drives, visit-gated digs), while the Homestead is a **solo, time-gated** sink — addressing the seed's cannibalization risk by occupying a different axis (private/idle vs social/active) rather than competing for the same act.

## MVP
Smallest shippable seed proving "snouts → self-tending capped buckets → deep sink," with NO prestige, NO Granary, NO tree — just one structure:
1. **One migration** (prefix ≥ `20260624000000`): `homestead_structures` + `homestead_state`, seed one structure (Compost Heap), `build_structure`, `collect_homestead` (single-bucket settle-on-read cloning `settle_tickles`), `homestead_status`.
2. **One component:** a Barn-Exterior panel beside the Garden showing the Compost Heap sprite with a fill state and a Collect button (clone the tickle-bucket fill UI).
That alone delivers Slow Time + a working snout sink. **Increment 1:** the full dependency tree + upgrades. **Increment 2:** `tithe_to_granary` wired into `world_tide` (the Giver pump) — *gated on the Schism Front existing*; until then tithing degrades to a pure local snout burn + `shift_alignment(caller,+1)`. **Increment 3:** `harvest_festival()` prestige + Rich Soil + dated cosmetics + the Homestead Almanac record.

## Risks & open questions
- **Sprite cadence is the real cost.** 10–14 structure sprites × 3 upgrade visual states is the binding constraint for a solo dev; the seed's "~10–14 structure sprites" likely means *base* sprites, so upgrade levels may need to be palette/accent recolors rather than new art. Confirm before committing to the tree depth.
- **Sink cannibalization (seed-flagged).** If the Homestead is the deepest sink, does it starve the Trough and Buried Truffle of snouts? Mitigation is the private/idle vs social/active axis split — but needs live-economy watching after launch.
- **Tone drift to spreadsheet.** The cozy guardrail (sprite-as-readout, no number grid) is load-bearing; if numbers leak to the main face it reads as an idle-game cash grab, against TTP's voice.
- **Front dependency for the headline feature.** The Granary Giver-pump — the thing that makes this matter to the meta-frame — only works once `world_tide` ships. Sequencing question: ship the Homestead as a standalone sink first and bolt the Granary on when the Front lands, or hold it until the Front exists?

Questions:
1. Are the ~10–14 sprites *base* structures (upgrades = recolors) or do upgrade levels each need fresh art? This sets the achievable tree depth.
2. Confirm the Homestead ships its weekly consolation as the **first over-cap `grant_tickles` on the idle surface**, carrying the `GREATEST(...)` display-debt fix into `home_stats` + `admin_tickle_overview`?
3. Should Harvest Festival reset be **player-initiated anytime once/season**, or auto-fire at Judgement Day alongside `finalize_season`? (Player-initiated gives agency; auto-fire guarantees everyone prestiges.)
4. Tithe cap of 40 snouts/day (~+5 Giver push) — is that the right band to nudge `world_tide` without letting a dedicated farmer out-push the honest ~15 `shift_alignment` call sites?
5. Does the happiness yield multiplier risk double-punishing a neglected pig (slow tickles *and* slow farm), and is that the intended pull-back-in pressure or too harsh?