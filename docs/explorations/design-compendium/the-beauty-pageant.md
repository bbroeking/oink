# The Beauty Pageant (Style Score)
> Dress Rosie to the day's theme and strut the catwalk — the server reads your worn look, scores it, and crowns a dated best-dressed Ribbon no snout can ever buy.

**Tier:** Core mode · **Effort:** M (automated-only MVP) / L (with peer voting) · **Mode:** async, date-seeded daily contest with lazy server resolution (no live realtime, no game server) · **Depends on:** the hats catalog (`public.hats` + `category`/`rarity`), the equip-slot columns on `profiles` (`active_hat_id`, `active_glasses_id`, `active_mask_id`, `active_aura_id`, `active_held_id`, `active_background_id` — see `constants/slots.ts`), `grant_tickles` (the only over-cap-safe faucet), the `daily_shop()` date-seed idiom, `user_hats` + `ON CONFLICT DO NOTHING`, inline `system_announcements`, the `resolve_expired_drives` lazy-resolution pattern, the `alignment_leaderboard` UNION ALL shape (for `public_pig_look`). Voting v2 additionally needs `friend_ids()` and `grant_season_xp`.

## The fantasy
You are a doting owner walking your pig down the catwalk at the County Fair. Each morning a new theme is announced — today the judges want **GLAM**, tomorrow they want **RUGGED** — and you raid your closet to assemble the most on-theme strut Rosie has ever worn. The thrill is the reveal: you lock your look, the judges deliberate overnight, and you wake to find out whether your pig took the dated Ribbon. It is identity expression with a daily verdict — your taste, scored.

## Player loop
**Daily (the atomic action):**
1. Open the Pageant card on the Barn. It shows **today's theme** (one of GLAM / CHARM / SHARP / CLEVER / RUGGED) and a short flavor line ("The judges are feeling *Glam* today — bring the sparkle").
2. Tap through to the Closet (the existing equip surface). Swap worn items across the 6 scored slots to chase the theme. A live "Style preview" gauge gives an **estimate** (client-side, advisory only — the server owns the real number).
3. Tap **Enter the Pageant**. The server re-reads your *live worn slots*, computes your authoritative `style_score`, snapshots your look, and locks your entry for the day. Free to enter; you may re-enter (re-dress) any number of times until `closes_at` — only your latest look counts.
4. **(v2 only)** Spend a small daily vote budget rating blind rival entries on the catwalk.
5. The contest resolves at the daily UTC boundary (lazy on first read after `closes_at`, optional cron polish). You get an inline announcement: your placement, your Ribbon if you placed, and any bounded tickle reward.

**Weekly / seasonal nesting:** every Ribbon is **dated and non-purchasable** — a permanent trophy-wall record of *that day's* win. Over a season the wall becomes a visible résumé of your taste ("7 Ribbons, 2 GLAM days"). This is the shared Style-Score data model that later unlocks the team variant (**Sounder Showdown**), a head-to-head **Runway Duel**, and a **Pig Pick'em** over the catwalk outcome — all reusing `style_score()` with zero new scoring code.

## Mechanics
**Scored slots (6).** Only the *live visible worn slots* are scored, read from `SLOT_COLUMN` (`constants/slots.ts`): **head** (`active_hat_id`), **eyes** (`active_glasses_id`), **face** (`active_mask_id`), **aura** (`active_aura_id`), **held** (`active_held_id`), **background** (`active_background_id`). The **neck** slot is excluded — `scarf`/`cape`/`necklace` live in `HIDDEN_CATEGORIES` (`constants/hats.ts` line 220), so scoring them would reward hidden, un-rendered items. `flag` and `tickle_particle` are not scored (flag is a world-cup affordance; tickle_particle is the tap animation, not a worn slot).

**Style vectors.** Each catalog row in `public.hats` gets 5 `smallint NOT NULL DEFAULT 0` columns: `style_glam`, `style_charm`, `style_sharp`, `style_clever`, `style_rugged`. ~85–90 live worn rows are tagged once; the ~30 hidden neck items and tickle_particles need no tags (untagged = all-zero = scores nothing).

**Daily theme (date-seeded, no cron to open).** A STABLE SQL helper picks the theme deterministically from the date, mirroring the verified `daily_shop()` idiom (`abs(hashtext(h.id || current_date::text))`, `20260584000000` line 24):
```
theme_index = (abs(hashtext(d::text || 'pageant_theme')) % 5)   -- 0..4 -> glam/charm/sharp/clever/rugged
```
All clients agree on the theme without any cron tick; the row in `pageant_events` is created lazily by the first `enter_pageant` call of the day (UPSERT).

**`style_score(p_theme)` — the authoritative computation.** SECURITY DEFINER, STABLE, reads the *caller's own* `active_*_id` columns from `profiles` (NEVER a client-supplied look payload — the equip path is a raw client `UPDATE` gated only by RLS, so a client-sent look can never be trusted). Per scored slot, joins to `public.hats` and sums style vectors:
- **On-theme axis full weight, off-theme axes 0.5 weight.** `slot_axis_value = theme_axis_value + 0.5 * (sum of the other four axes)`.
- **Mild rarity potency.** Multiply each slot's contribution by a factor derived from `hats.rarity` (`common,uncommon,rare,epic,legendary` — verified `20260502030000` line 8), banded **1.0 / 1.15 / 1.3 / 1.45 / 1.6**. Rarity is a gentle thumb on the scale, not a pay-to-win lever (cosmetics aren't cash-bought; snouts buy them and snouts are earned).
- **Coherence bonus.** If **3 or more** scored slots have their *largest* axis equal to the day's theme axis, add **+15%** to the raw total. Rewards a committed, themed outfit over a grab-bag.
- **Diminishing cap (the anti-whale lever).** `final = round(120 * (1 - exp(-raw / 120)))`. Caps a maxed-out legendary look around ~120 and makes the marginal value of one more godroll item shrink, so a thoughtful mid-rarity outfit competes with a legendary pile.

**Win condition (MVP, automated-only).** On resolve, rank all of today's entries by `style_score DESC`, tie-break by `entered_at ASC` (earliest committed wins ties — rewards decisiveness, deterministic). 1st/2nd/3rd place get the Ribbon + bounded tickles.

**Scoring blend (v2, with peer voting).** `final_score = 0.60 * styleNorm + 0.40 * voteNorm`, both normalized within the day's cohort (min-max to 0..1). **Pure-style fallback at ~0 votes** (turnout floor): if total votes for the day are below a quorum, ignore the vote term entirely and rank on style alone. The **60% automated floor is structural anti-collusion**: even a perfectly coordinated voting bloc can swing at most ~40% of the final, and the uncheatable server-recomputed half always dominates.

**Voting rules (v2).** Each voter gets a small daily vote budget (e.g. 10 votes). Entries are shown **blind** (no usernames — rendered via `public_pig_look`). Server-side: reject self-votes; **exclude friend votes from the ranking** (`friend_ids()` — friends can still look, their votes just don't count toward placement); trust-weight each vote by `LEAST(cap, f(season_xp, account_age))` so fresh/zero-XP accounts carry near-zero weight; one row per `(event_date, voter_id, entry_user_id)` PK; a nightly batch anomaly query flags suspicious vote clusters; an admin `void_pageant(event_date)` kill-switch re-resolves a brigaded day on pure style.

**Cooldowns / caps.** One entry per `(event_date, user_id)` (the PK *is* the daily cooldown; re-entry UPSERTs the same row). One resolution per day. Tickle rewards are bounded bands (below) — a perfect Pageant day grants well under one non-VIP bank (25), so it can't flood the economy.

**Edge cases.**
- **Naked pig / all-zero look:** `style_score = 0`, entry allowed (so the catwalk shows the floor), but never places.
- **Fewer than 3 entrants:** still resolve; award Ribbons down to the number of entrants (a 2-pig day has a 1st and 2nd, no 3rd).
- **No entrants:** mark the event `resolved` with no winners; no announcements.
- **Re-dress after entering:** allowed until `closes_at`; the resolve reads the *snapshotted* look stored at last entry, not the live look (so dressing down after entry doesn't matter, and the score is frozen at commit).
- **Ribbon already owned:** `INSERT INTO user_hats ... ON CONFLICT DO NOTHING` — but Ribbons are dated unique ids (`ribbon-2026-06-08`), so a player can win many distinct Ribbons over a season; only a literal double-resolve is idempotently no-op'd.

## Schema sketch
Migration prefix must sort after the latest applied `20260623000000` (i.e. `>= 20260624000000`).

```sql
-- 1. Style vectors on the catalog (trivial additive ALTER). Clones the
--    hats catalog 'category/rarity' extension pattern (20260502030000).
ALTER TABLE public.hats
  ADD COLUMN IF NOT EXISTS style_glam   smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS style_charm  smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS style_sharp  smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS style_clever smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS style_rugged smallint NOT NULL DEFAULT 0;

-- 2. One-time tagging migration: UPDATE public.hats SET style_* = ...
--    for the ~85-90 live worn rows. (LLM draft + hand-tune legendaries.)

-- 3. Event + entry tables.
CREATE TABLE public.pageant_events (
  event_date  date PRIMARY KEY,
  theme       text NOT NULL CHECK (theme IN ('glam','charm','sharp','clever','rugged')),
  closes_at   timestamptz NOT NULL,
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','voided')),
  resolved_at timestamptz);

CREATE TABLE public.pageant_entries (        -- clones daily ledger PK idempotency
  event_date  date NOT NULL REFERENCES public.pageant_events(event_date),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  look        jsonb,                          -- snapshot of the 6 scored active_*_id at commit
  theme       text NOT NULL,
  style_score int  NOT NULL,
  vote_weight numeric NOT NULL DEFAULT 0,     -- v2
  final_score numeric,                        -- v2 (= style_score in MVP)
  placement   int,                            -- 1/2/3 or null
  ribbon_id   text,                           -- the dated ribbon granted, or null
  tickles_paid int NOT NULL DEFAULT 0,
  entered_at  timestamptz NOT NULL DEFAULT now(),
  seen_at     timestamptz,                    -- result-announcement read receipt
  PRIMARY KEY (event_date, user_id));

-- 4. v2 voting tables.
CREATE TABLE public.pageant_votes (
  event_date    date NOT NULL,
  voter_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weight        numeric NOT NULL,             -- trust-weighted at write
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_date, voter_id, entry_user_id));
CREATE TABLE public.pageant_vote_claims (     -- voter participation reward, idempotent
  event_date date NOT NULL, voter_id uuid NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_date, voter_id));
```

**RPC signatures** (all SECURITY DEFINER, `SET search_path TO 'public'`):
- `pageant_theme(d date) -> text` — STABLE SQL helper; date-seed via `abs(hashtext(d::text || 'pageant_theme')) % 5`. *Clones the `daily_shop()` deterministic-seed idiom.*
- `style_score(p_theme text) -> int` — STABLE; SELECTs the caller's own `active_*_id`, joins `hats`, applies on/off-theme weighting + rarity band + coherence + `exp()` cap. *Clones nothing — new, but the "read own profile columns server-side" pattern matches every gated RPC.*
- `enter_pageant() -> jsonb` — UPSERTs today's `pageant_events` row (lazy open), computes theme + `style_score`, snapshots the look, `INSERT ... ON CONFLICT (event_date,user_id) DO UPDATE` the entry. Returns `{theme, style_score, closes_at}`.
- `public_pig_look(p_user uuid) -> jsonb` — STABLE; returns a full worn look **only** for users with an OPEN entry today (entering = consent to be seen on the catwalk). *Clones the `alignment_leaderboard` two-sided render-look pattern (`20260525000000`); avoids a privacy regression beyond today's hat-only cross-player exposure.*
- `resolve_pageant(p_date date) -> jsonb` — lazy-callable from the read path AND/OR a daily cron tick; ranks entries, assigns placements, grants the dated Ribbon (`INSERT INTO user_hats ... ON CONFLICT DO NOTHING`), grants bounded tickles via `grant_tickles`, and **INLINEs `INSERT INTO system_announcements`** for each placer. *Clones the `resolve_expired_drives` lazy `FOR UPDATE SKIP LOCKED` + status-flip pattern (`20260583000000`).*
- `cast_pageant_vote(p_entry_user uuid) -> jsonb` *(v2)* — checks budget, rejects self-vote, trust-weights, INSERTs the vote row.
- `claim_vote_reward() -> jsonb` *(v2)* — idempotent via `pageant_vote_claims` PK; `grant_tickles(caller, 2)` + `grant_season_xp(caller, 5)`.
- `void_pageant(p_date date) -> jsonb` *(v2, admin)* — re-resolves a flagged day on pure style.

**Cosmetic seeding.** Each dated Ribbon is a `public.hats` row inserted at resolve (or pre-seeded per day): `id = 'ribbon-2026-06-08'`, `category = 'ribbon'`, `cost = 0`, dated name. Trophy-wall only for MVP; promote to a worn slot in a later pass (open fork).

## Economy
**Faucets.** The only minted currency is **tickles**, via `grant_tickles` (the verified over-cap-safe faucet, `20260580000000` line 269). Placement bands: **1st 30 / 2nd 15 / 3rd 5** tickles. Voter participation (v2): `grant_tickles(2)` + `grant_season_xp(5)`. A maximal day (win 1st + vote) grants 32 tickles — **under one non-VIP bank (25 is a bank; 32 is barely over one**, and that's a 1st-place-only outcome), so the Pageant's daily faucet is a rounding error against the home tickling loop.

**Sinks.** MVP has none (free entry is the whole point — turnout drives the catwalk). A later **snout grooming fee** to enter, or a **Pig Pick'em** wager over the catwalk outcome, can add a `counter -> counter` pari-mutuel sink without minting.

**Why it can't inflate the closed economy.** No snouts are ever minted (`profiles.counter` only ever moves as a transfer, never created here). Cosmetics are non-purchasable dated Ribbons — they have *zero* snout price and can't be resold for snouts, so they add prestige supply, not currency supply. Tickle grants are bounded per day and over-cap-safe (overflow banks into `tickles_wasted_total` rather than exceeding the cap).

**The display-debt obligation.** If this is the **first over-cap `grant_tickles` faucet to ship**, this migration MUST carry the `GREATEST(...)` display fix: change `home_stats` and `admin_tickle_overview` balance calc from `LEAST(cap, item_count+regen)` to `GREATEST(item_count, LEAST(cap, item_count+regen))` (the shape already live in `tickle_balance`/`tickle_info`), so over-cap winners don't see a clamped-down balance. If the Snout Oracle or Daily Riddle shipped first, this is already paid and inherited.

## Anti-abuse / cheat model
**Cheat tier: server-owns-the-answer.** The equip path is a raw client `UPDATE` gated only by RLS, so a client could send any look it wants. The defense is total: `style_score` **re-reads the caller's own `active_*_id` columns server-side** and never accepts a client look payload. There is no client-trusted input in the scoring path, so a forged look is structurally impossible — you can only score the items you actually own and have actually equipped.

**Hidden-item gaming closed.** Only the 6 fillable visible slots are scored; the hidden neck categories can't be exploited because they contribute zero.

**Whale resistance.** The `exp()` diminishing cap flattens the top end so a wall of legendaries doesn't dominate; rarity is a mild 1.0–1.6 band, not a multiplier blowout.

**Voting collusion (v2) — defense in depth, none of which the MVP needs.** (1) The **60% automated floor** caps any bloc's reachable swing at ~40%. (2) **Blind entries** (no usernames) make targeted brigading hard — you can't reliably find your friend's entry to upvote it. (3) **Friend votes excluded from ranking** via `friend_ids()`. (4) **Trust-weighting** by season XP + account age starves Sybil farms (fresh alts carry near-zero weight). (5) **Per-(date,voter,entry) PK** prevents ballot stuffing. (6) Nightly **anomaly batch** + admin **`void_pageant`** kill-switch re-resolves a brigaded day on pure style. The MVP ships **zero voting**, so it carries **zero collusion surface** — the safest possible first step.

**Farming.** Rewards are bounded per day and gated on actually placing (style) or actually voting (participation), and alt entries can't place above a real, well-dressed pig because the score is owned-items-only — an alt with an empty closet scores 0.

## Feel
- **Identity expression** (primary): the entire mode is "your taste, scored." It turns the closet from a static wardrobe into a daily self-portrait with a verdict.
- **Earned mastery:** learning which items carry which axes, how coherence and rarity interact, and how to read a theme into a winning outfit is a skill that visibly compounds across a Ribbon wall.
- **Persistent-world FOMO:** today's theme + today's dated Ribbon exist *only today*. Miss GLAM day and that Ribbon is gone forever — a gentle, cozy FOMO (no loss, just a gap in the wall).
- **Discovery-as-content:** new themes recombine the same closet into fresh puzzles daily, and new hats reshape the meta — content cadence comes from recombination, not authoring.
- **Slow time / hangout (v2):** strolling the blind catwalk to vote is a low-stakes, browse-y ritual.
- **Quirky charm:** a pig in a tiara strutting a fairground catwalk is inherently cozy and funny — the Ribbon is earnest prestige with a wink.

**Cozy guardrail:** there is no losing, only placing. Non-placers still keep their look and lose nothing; the announcement copy is warm on a miss ("Rosie strutted beautifully today — the judges loved the {theme}. Try the catwalk again tomorrow!"). No public shaming, no rank-shaming, no streak to break.

## How it composes
The Style-Score model is the **shared data spine** the exploration doc flags as "this one data model unlocks 4 variants." Under the **Schism Front / faction meta-frame**, the solo Pageant validates `style_score()` with zero voting/collusion risk; once the `profiles.faction` column ships with the Mud-Off, the exact same scoring feeds **Sounder Showdown** (per-faction daily Style Score = per-active-member AVERAGE of entrants' scores — dodges both the voting-brigade problem and the alt-stacking problem by construction). The same RPC also drops straight into a head-to-head **Runway Duel** and a deflationary **Pig Pick'em** wager over the catwalk outcome — none requiring new scoring code. The Pageant is therefore the cheapest, lowest-risk way to pay the one-time item-tagging tax and prove the model before the team modes lean on it.

## MVP
**The smallest shippable seed — pure automated daily best-dressed, zero voting, zero collusion surface:**
- **One migration** (prefix `>= 20260624000000`) that: ALTERs the 5 `style_*` columns onto `public.hats`; UPDATEs the ~85–90 worn rows with style tags; creates `pageant_events` + `pageant_entries`; defines `pageant_theme()`, `style_score()`, `public_pig_look()`, `enter_pageant()`, and lazy `resolve_pageant()`; INLINEs `system_announcements`; and (if first over-cap faucet) carries the `GREATEST(...)` display-debt fix.
- **One RPC at the player's fingertips:** `enter_pageant()` (theme + score + commit in one call); resolve is lazy on the read path.
- **One component:** a `PageantCard` on the Barn showing today's theme + a live client-side style estimate + the Enter button, plus a result line in the existing announcement feed and a dated Ribbon on the trophy wall.

Ship with bands 30/15/5, theme date-seeded daily UTC, Ribbons trophy-wall-only.

## Risks & open questions
- **Solo-dev content-cadence cost:** the one-time tagging of ~85–90 items is real but bounded (do it once, lean on LLM draft + hand-tune legendaries). After that, content cadence is *free* — themes recombine the existing closet and new hats reshape the meta automatically. This is the mode's biggest strength for a solo dev.
- **Style-tag balance is taste-laden.** Mis-tagged items will create a degenerate "always-win" outfit. Mitigate by tagging conservatively, watching the first week's winners, and keeping `style_*` as cheap-to-tune UPDATEs.
- **Tagging method (open fork):** LLM-drafted vectors vs hand-authored vs hybrid. Lean: LLM draft, hand-tune legendaries.
- **Ribbon as worn slot vs trophy-wall (open fork):** trophy-wall is the safe MVP; promoting Ribbons to a worn slot creates a virtuous "Ribbons feed future Style Score" loop but needs a new slot + render work. Defer.
- **`public_pig_look` privacy:** entering consents to being shown on the catwalk, but the look is rendered blind in v2. Confirm this doesn't leak more than today's already-public hat exposure (it shouldn't — it's the same render path as `alignment_leaderboard`).
- **Voting is a v2 bet, not a given.** The 60% floor + blind + friend-exclusion design is sound, but voting adds an audience layer *and* a moderation surface. Only ship it if the solo catwalk proves people want to be seen; otherwise the automated-only mode is complete and self-sufficient on its own.
- **Low-turnout days** make a 1-entrant win trivial. Acceptable for a cozy daily (someone showed up and dressed up — let them have the Ribbon), but worth watching that it doesn't feel hollow on a dead day.