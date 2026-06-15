---
title: "Mud War Co-op: Cover for a Crewmate"
type: plan
date: 2026-06-14
tags: [plan, mud-wars, sounder, co-op, pairwise, fairness, social, competitive]
status: draft
---

# Mud War Co-op: Cover for a Crewmate

> When a crewmate goes dark, another crew member can spend part of their own daily mud to **cover the empty slot** — a capped, anti-collusion-gated bonus so one absent member can't sink the Sounder, and showing up for a friend is rewarded instead of resented.

This is the concrete implementation of the team-clan plan's **Tension #1 / Decision D6** ("a capped cooperation-bonus layered on the flat base sling, honoring *advantages are EARNED only via in-war cooperation*" — [[team-clan-mud-wars-plan]]) and the **pairwise / asymmetric-help** axis of the research brief ([[coop-mechanics-research-2026-06]]): *"cover-for-the-absent via an NPC stand-in / fractional carry so a dead buddy never strands you."* It ships as a follow-on migration **after the latest applied migration** (`20260649000000_onboarding_checklist.sql` is the current tail; `20260647000000_mud_fights.sql` and `20260648`/`20260649` are queued ahead of it — see [[sounder-mud-fights]] and the team-clan plan's sequencing gate D), and stays dark behind `MUD_FIGHTS_VISIBLE` (`constants/featureFlags.ts`, currently `false`) until the war itself flips.

## How it plays (the co-op interaction, day-to-day)

The base war is unchanged: a flat **20 mud-slings/day** per member, use-or-lose, no buffs (`sling_mud`, `DAILY_ALLOTMENT=20` in `supabase/migrations/20260647000000_mud_fights.sql`). Cover is a *second verb* layered on top, available only inside an active war.

- **The trigger is legible absence, not guesswork.** A crewmate's slot shows as "behind" on the `/mud-war` roster (`app/mud-war.tsx`, fed by `war_side`) when they've slung **0 today** *and* the UTC day is ≥ ~12h old (so you can't cover someone who simply hasn't opened the app yet this morning). The roster already returns `username` + `slings` per member; we add a per-member `covered`/`coverable` flag.
- **Covering costs the helper their OWN effort — but from a separate cover pool, NOT their attendance slings.** Once you've slung ≥1 of your own daily 20 (the "show up first" gate), a "Cover [name]" action appears next to a behind crewmate. Tapping it spends from a **dedicated daily cover budget** (`COVER_DAILY_SPEND`, propose **10/day**), recorded in the new `mud_covers.spent` ledger — it does **not** mutate `mud_slings`. *(This is load-bearing: `mud_slings.slings` is the helper's own attendance count, it has a `CHECK (slings >= 0 AND slings <= 20)`, and `SUM(slings)` is the exact per-capita numerator `resolve_war` reads. Decrementing it would corrupt the helper's own score and double-count the cost — so cover spend lives in its own ledger, capped on its own clock.)* The spend converts into **cover mud credited to the absent slot at a discount** — the asymmetric-help shape from the research: the helper pays effort, the table benefits, the absent member's slot stops dragging the per-capita average toward zero. Cover mud counts toward the crew's score at a **reduced rate** (see Scoring), so it lifts the floor without ever beating real attendance.
- **It's a gift with a face, framed as gain-when-you-show — never loss-when-they-don't.** Copy is "You covered Rosie's slot — +N for the crew" (a present), echoing Duolingo's *from-your-friend* nudge and explicitly **not** Snapchat's loss-aversion streak (the documented dark pattern the brief warns against). The covered player is never punished, guilted, or notified with a debt; they get a warm "Mabel covered your slot while you were away" announcement on return.
- **The crew is never sunk by one no-show.** This is the Fall Guys *slacker-tanks-the-team* failure mode the brief calls out: today a 4-of-5 crew with one dead member can fail quorum or crater its per-capita average. Cover lets the four present members **buy that empty 5th slot up to a fractional floor**, so an absent member is a soft cost, not a loss.
- **Cadence fits the ~3-on / 1-off rhythm.** Cover resets on the same UTC `war_day` bucket as slings (`mud_slings.war_day`), so it's a per-day decision inside the multi-day window — fully async, local-clock-friendly, no synchronous siege moment (the brief's timezone-fairness rule).

## Scoring & fairness (capped crew war-points without reopening snowball/alt abuse)

The whole risk here is that a "help your crew" verb is exactly the shape an alt-farm wants. The design holds the anti-snowball spine and gates cover on **five** independent fairness rails, each citing the research:

1. **Per-capita-average stays the spine — cover changes the *numerator*, never the denominator.** `resolve_war` scores `SUM(mud) / COUNT(members WHERE mud>0)` (the brief's *explicit anti-snowball move*; [[sounder-mud-fights]]). Cover mud is added to the **covered (absent) member's** per-member sum, so it **does not add a new active head** — the covered member is still counted as inactive for the quorum/denominator. This is critical: if cover minted a fake active member, it would let 2 humans + 3 covered alts fake a 5-active crew. It does the opposite — it lifts a *known-empty* slot's contribution while leaving the active-count honest.
2. **Cover mud is discounted, so real attendance always wins.** Cover credits the slot at a **fraction** (`COVER_RATE`, propose **0.5**): 1 unit of the helper's spent mud → 0.5 covered mud on the absent slot. The brief's anti-dominance lesson is *make togetherness strictly better but never let the bonus dominate the base* — a covered slot can never out-score a member who actually showed up and slung their 20.
3. **Hard daily cap per absent slot — the breadth-forcing per-account cap.** An absent slot can receive at most `COVER_DAILY_CAP` covered mud per `war_day` (propose **10**, i.e. half a real day's output), no matter how many crewmates pile in. This is Clash Royale's *low, breadth-forcing per-account-per-window cap* — an extra alt slot is worth at most 10 discounted mud/day and **costs a real human's own allotment to fill**, so alts become a labor cost, not a cheat (the brief's alt-defense: *"per-account caps make alts a labor cost not a cheat"*).
4. **Cover is capped, discounted, and minted from a bounded daily pool — never free, never inflationary.** Cover mud is produced at the **0.5 rate** from a helper's `COVER_DAILY_SPEND`-bounded daily cover budget, and each absent slot is hard-capped at `COVER_DAILY_CAP`. So the *most* extra mud cover can ever add to a crew's total per day is `min(absent_slots × COVER_DAILY_CAP, present_members × floor(COVER_DAILY_SPEND × 0.5))` — strictly bounded, always discounted, and always below what a real member slinging 20 would have contributed. Cover can never push a crew past its real ceiling of *active* output, because a covered slot is capped at half a day's worth (10) and stays *inactive* for quorum. It strictly trades the helper's bounded extra effort for the absent slot's floor — the brief's *costless-carry* inverted into *costed-carry*: the helper sacrifices effort to lift the floor, which is the fairness guarantee. (Whether cover should also be net-zero against the helper's *own* score is moot here precisely because it draws from a separate pool — the helper's 20 attendance slings are untouched, so a helper never weakens their own contribution by covering.)
5. **Anti-collusion gate: you can only cover a *genuinely* absent, non-self slot, and pairings are bounded.** (a) **No self-cover** and no covering a member who already slung today. (b) The covered member must clear the **≥12h-stale + 0-slings** absence definition — you can't pre-emptively "cover" an active teammate to launder your surplus into their sum. (c) A **per-(helper, covered) daily limit** so two colluding accounts can't ping-pong cover to concentrate score — cover is spread, not stacked. (d) Cover is **disabled entirely in bot (house) wars** (`is_bot_war`), reusing the existing bot-farm neutralization (`resolve_war` already pays the house nothing for the bot side) so the fixed-pace Mudlarks can't be a cover-farm.

Net effect against the brief's two-front war: **dominance** can't grow (cover only redistributes a capped, discounted fraction of mud the crew already had), and **integrity** holds (an absent/alt slot stays uncounted for quorum, is capped at half a day, and costs a real human's own allotment to fill). The "don't play unless above average" trap the brief flags for average-scoring is *reduced* here, because a high-output player's surplus now has a pro-social home (cover the floor) instead of being wasted past 20.

## Already built ✅ (what TTP reuses)

- **The whole mud-fights stack.** Tables `crews` / `crew_members` / `mud_wars` / `mud_slings`, the cap-5 trigger, recursion-safe RLS via `is_crew_member` / `is_war_participant`, and the seeded bot crew — all in `supabase/migrations/20260647000000_mud_fights.sql`. Cover is a new RPC + one new table over this, not a rewrite.
- **`mud_slings` is already the per-(war, user, day) ledger** with the `UNIQUE (war_id, user_id, war_day)` shape, the `war_day` UTC bucket, and the `slings >= 0 AND slings <= 20` clamp — the exact rows cover reads to decide "behind today" and the exact denominator `resolve_war` already groups by.
- **`sling_mud`'s daily-cap + optimistic pattern** (`hooks/useMudWar.ts` `bumpMine`, `myRemainingToday`) is the template for the cover action's tap-juice and reconcile-on-failure.
- **`war_side` / `war_state` roster payload** already returns per-member `slings` and `quorumMet`; the client already renders the roster. Cover adds fields to this payload, not a new screen.
- **`resolve_war` grouping** (`SUM(slings) ... GROUP BY user_id`) is where cover mud folds in — we extend the per-member sum source, not the scoring math.
- **Inline `system_announcements` pattern** for the "you were covered" note — the migration already does savepoint-guarded INLINE inserts everywhere (never `send_system_announcement`, per [[notifications]] admin-gate footgun).
- **`constants/mudFights.ts`** is the established client mirror for the new `COVER_*` constants.
- **`MUD_FIGHTS_VISIBLE`** feature flag already gates every war surface — cover inherits it for free.

## What's needed 🔨

A follow-on migration `supabase/migrations/20260650000000_mudwar_cover.sql` (a **14-digit** `YYYYMMDDHHMMSS` prefix that sorts alphabetically *after* the current tail `20260649000000_onboarding_checklist.sql` — a 13-digit prefix like `2026065000000` would sort *before* `20260647` and collide/mis-order, the migration-ordering footgun in [[architecture-seams]]) plus a thin client layer.

### Data model

A **separate `mud_covers` ledger** (do NOT overload `mud_slings`, whose `slings <= 20` clamp and `UNIQUE(war_id,user_id,war_day)` model "my own attendance" — cover is a distinct verb with a helper *and* a target):

```sql
CREATE TABLE public.mud_covers (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    war_id      uuid        NOT NULL REFERENCES public.mud_wars(id)  ON DELETE CASCADE,
    crew_id     uuid        NOT NULL REFERENCES public.crews(id)     ON DELETE CASCADE,
    helper_id   uuid        NOT NULL REFERENCES auth.users(id)       ON DELETE CASCADE,
    covered_id  uuid        NOT NULL REFERENCES auth.users(id)       ON DELETE CASCADE,
    spent       int         NOT NULL CHECK (spent > 0),    -- from the helper's separate cover pool (NOT mud_slings)
    credited    int         NOT NULL CHECK (credited >= 0), -- floor(spent * COVER_RATE), to covered slot
    war_day     date        NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    CHECK (helper_id <> covered_id)
);
-- Fairness indexes (all caps enforced in-RPC under an advisory lock on (war_id, covered_id)):
--  • per-(covered slot, day) cap   → SUM(credited) keyed (war_id, covered_id, war_day)
--  • per-(helper, covered, day)    → SUM(spent)    keyed (war_id, helper_id, covered_id, war_day)  [collusion bound]
--  • per-(helper, day)             → SUM(spent)    keyed (war_id, helper_id, war_day)               [helper cover budget]
CREATE INDEX mud_covers_slot_day   ON public.mud_covers (war_id, covered_id, war_day);
CREATE INDEX mud_covers_pair_day   ON public.mud_covers (war_id, helper_id, covered_id, war_day);
CREATE INDEX mud_covers_helper_day ON public.mud_covers (war_id, helper_id, war_day);
```

RLS: SELECT gated on `is_war_participant(war_id, auth.uid())` (same shape as `mud_slings`); add to `supabase_realtime` publication (guarded `DO $$...$$`) so the opponent's bar and your own roster update live, exactly like `mud_slings` in `useMudWar`.

New constants in `constants/mudFights.ts` (mirrored as inlined RPC literals, per the existing drift convention already documented in the file's header comment — the deferred `mud_fight_const()` is the eventual single-source fix): `COVER_RATE = 0.5` (credited = floor(spent × rate)), `COVER_DAILY_SPEND = 10` (max total cover *spend* per helper per day — the helper's separate cover budget, **independent of the 20 attendance slings**), `COVER_DAILY_CAP = 10` (max *credited* per absent slot/day, summed across all helpers), `COVER_PAIR_CAP = 10` (max helper spend per (helper,covered)/day — the collusion bound), `COVER_ABSENCE_HOURS = 12` (covered slot must be 0-slings and the war-day at least this many hours old).

### RPC: `cover_crewmate(p_war uuid, p_covered uuid, p_units int)`

`SECURITY DEFINER`, `{ ok, reason }` shape (matches `rpcAction` in `utils/mudWars.ts`). Guards, in order:

1. auth; war exists, `status='active'`, `ends_at > now()` (else lazy-`resolve_war` + `war_over`, exactly like `sling_mud`).
2. caller is in a crew that is a participant (`my_crew IN (challenger, defender)`); **`NOT is_bot_war`** → `no_cover_vs_house`.
3. `p_covered` is in the **same crew**, `p_covered <> caller` (no self-cover).
4. covered slot is genuinely absent: **0 slings today** AND `now() - (today::timestamptz) >= COVER_ABSENCE_HOURS` → else `not_absent`.
5. **"Showed up first" gate:** caller has ≥1 of their own `mud_slings` today (covering can't *replace* slinging) → else `must_sling_first`. This reads `mud_slings` but **never writes it** — the helper's attendance count is untouched by covering.
6. **Helper daily cover-spend cap:** `SUM(spent) WHERE helper_id=caller AND war_day=today` (from `mud_covers`) + `p_units` ≤ `COVER_DAILY_SPEND` → else `cover_budget_spent`. This is the helper's separate 10/day cover pool — there is no `mud_slings` mutation, so cover spend is **costed against its own ledger**, not the attendance slings.
7. per-slot cap: `SUM(credited) WHERE covered_id=p_covered AND war_day=today` + `floor(p_units*COVER_RATE)` ≤ `COVER_DAILY_CAP` → else `slot_cap`.
8. per-pair cap: `SUM(spent) WHERE helper_id=caller AND covered_id=p_covered AND war_day=today` + `p_units` ≤ `COVER_PAIR_CAP` → else `pair_cap`.
9. INSERT `mud_covers` row with `spent = p_units`, `credited = floor(p_units * COVER_RATE)`, `war_day = today`, `crew_id = caller's crew`. Inline, savepoint-guarded `system_announcements` to the covered member ("Mabel covered your slot — show up tomorrow!"), using the `(user_id, kind, title, body, data)` insert shape (the exact columns every existing RPC uses).

Lock against the per-slot/per-pair caps with an **advisory lock on `(war_id, covered_id)`** (or `SELECT ... FOR UPDATE` of the war row) so concurrent covers on the same slot serialize against the cap, mirroring `enforce_crew_cap`'s `FOR UPDATE` pattern — without it, two helpers reading `SUM(credited)=8` simultaneously could both pass a cap-10 check and over-credit.

**Grant + REVOKE.** Add `GRANT EXECUTE ON FUNCTION public.cover_crewmate(uuid, uuid, int) TO authenticated;` to the migration's grants block (Postgres grants EXECUTE to PUBLIC by default, so any internal helper not meant to be callable — none here, but follow the `war_side` REVOKE precedent if one is added — must be explicitly revoked).

### `resolve_war` change (the one scoring touch)

The per-member sum that feeds both `ch_total/df_total` and the winner payout loop changes from `SUM(slings)` to **`SUM(slings) + COALESCE(cover credited TO this user, 0)`**. Concretely, the grouped subquery gains a `LEFT JOIN`/`UNION` against `mud_covers.credited` keyed on `covered_id`. **Crucially, the `COUNT(*) FILTER (WHERE own > 0)` active-count must keep counting only *real slings* — a slot lifted purely by cover stays inactive for quorum** (rail #1 above). So compute two sums per member: `real = SUM(slings)` (drives `active`/quorum) and `scored = real + covered_credit` (drives total/per-capita). Payout already distributes `own mud + share`; cover-credited mud flows into `own` for the covered member only if you choose to pay them — **propose: cover mud counts for the crew's *score* but the payout share goes to the helper, not the absentee** (you don't reward the no-show; you reward the helper). This is a small, localized change to the existing `FOR m IN ... LOOP`.

This is **carry-latest-def territory**: `resolve_war` must be `CREATE OR REPLACE`d from the **`20260647` body verbatim** plus this delta — re-deriving from an older copy would silently drop the bot-farm neutralization, the savepoint guards, and the title thresholds (the carry-latest-def footgun, [[architecture-seams]]). Same caution for `war_side` (add `covered`/`coverable` per-member flags) and `war_state` (surface `myCoverCreditsToday`, behind-slot list).

### Client changes

- `utils/mudWars.ts`: add `coverCrewmate(warId, coveredId, units)` via `rpcAction`; extend `WarSideMember` with `covered?: number` and `coverable?: boolean`, `WarState` with `myCoverRemainingToday`.
- `hooks/useMudWar.ts`: a `cover(coveredId, units)` callback mirroring `sling` — optimistic bump of the covered slot + helper's remaining, reconcile-on-failure via `refresh()`; the existing throttled `mud_slings` realtime subscription gains a parallel one on `mud_covers`.
- `app/mud-war.tsx`: a "Cover" affordance on behind crewmate rows (visible only after you've slung ≥1 of your own), the discounted-mud framing copy, and the "you were covered" inbound note (reuses the WhileAway/`system_announcements` path, [[notifications]]). **Render the cover, don't infer it** (the brief's *co-presence must be legible* rule): a covered slot shows a small "+N covered by Mabel" tag on the roster row and a soft fill on the tug-of-war bar, so the *act of holding the line for a crewmate* is visible to the whole crew in realtime — the same legibility lever that makes shared-goal bars motivating, applied to the asymmetric-help verb.

### Realtime / push

Reuse the existing inline `system_announcements` insert (durable backstop) for the "you were covered" message; the live roster updates ride the new `mud_covers` realtime subscription. No new push infrastructure — the announcement row + best-effort `pg_net` push already covers it ([[notifications]]).

## Rewards tie-in (war cosmetics + capped core payout)

Honoring the resolved design context (war-exclusive cosmetics + a capped, anti-collusion core payout; respect the cash-faucet lesson):

- **Cover never mints raw snouts directly.** It changes *who contributed to the winning score*, and the existing `resolve_war` payout (own mud → `counter + tickles_earned`, capped at the loser-pot share) already carries the snout faucet. Routing the **helper's** covered-slot contribution through the *existing* payout (not a new mint) keeps the war a single, capped faucet — and the team-clan plan's Section (B) war-token wall (replacing raw snouts with a redeemable war token) sits cleanly on top of this without a second faucet. Idempotency is inherited: payout fires once, under `resolve_war`'s `FOR UPDATE` + `resolved_at` guard.
- **A war-exclusive cosmetic for the cover behavior — the "Mudguard" / loyalty cosmetic.** A capped, war-only animated trim or hat granted when you cover for crewmates across a war (via the ChatGPT/icon-gen accessory pipeline — see [[shop-cosmetics-closet]] / the `icon-gen` skill), gated like the `mud_war` titles: server-authoritative, idempotent `INSERT ... ON CONFLICT DO NOTHING` in `resolve_war`, **real wars only** (no bot-war grant). Threshold should reward the *act of helping a real crewmate* (covered ≥K distinct genuinely-absent slots across the war), not a raw cover-count — the brief's FFXIV Mentor lesson: *reward helping a specific real person, not a clear-count proxy* an alt can farm.
- **Optional soft-recognition badge** ("Backbone of the Sounder") on the resolved recap — the brief's *gentle, positive per-member recognition*, the lowest-pressure anti-loafing lever and the most on-brand for cozy.

## Risks / open questions

- **Does cover mud count toward the crew score at all, or only "un-sink" the slot?** Two readings: (a) cover *adds discounted mud to the total* (lifts per-capita), or (b) cover only *prevents the slot from being counted as a 0-drag*. (a) is simpler and matches "earned via cooperation"; (b) is more conservative against any inflation. Recommend (a) with the 0.5 rate + caps; it can't beat real attendance.
- **Quorum interaction.** A crew with 2 real sling-ers + 3 covered slots is still **quorum-2 on real heads** (cover doesn't add active heads — by design). Confirm this is the intended floor: cover saves the *score*, not the *quorum*. If a crew can't field 2 real active members, cover should not rescue them (that's the alt-farm door).
- **Payout target of cover mud — helper or absentee?** Recommend the **helper** earns the snout/token credit for cover mud (you reward showing up for the crew, never the no-show). Needs a one-line decision; the loop in `resolve_war` makes it trivial either way.
- **Could cover *discourage* the absent member's return?** ("My crew's got it.") Mitigate with the warm return note + the fact that cover is *discounted and capped* — the crew always does strictly better with the real member back. The framing must stay "we held your spot," not "we don't need you."
- **Constant drift** (`constants/mudFights.ts` vs inlined RPC literals) — same standing risk as the base build; the deferred `mud_fight_const()` (P3) is the real fix.
- **Test gaps to close before any flip** — one pgTAP case per fairness rail, extending the base build's `supabase/tests/02_mud_fights.sql`:
  - rail #5a — cover a non-absent (slung-today) slot → `not_absent` (reject).
  - rail #5b — self-cover and cross-crew cover → `self`/`not_in_crew` (reject).
  - rail #5(showed-up) — cover with 0 own slings today → `must_sling_first` (reject).
  - rail #3 — per-slot cap: pile 3 helpers onto one absent slot, assert credited caps at `COVER_DAILY_CAP` (10).
  - rail #5(collusion) — per-pair cap: one helper covers one target repeatedly, assert spend caps at `COVER_PAIR_CAP`.
  - helper budget — one helper covers across multiple targets, assert total spend caps at `COVER_DAILY_SPEND` and `mud_slings` is **unchanged** (the no-decrement invariant).
  - rail #4(bot) — cover in a bot war → `no_cover_vs_house` (reject).
  - rail #1 — `resolve_war` real-vs-scored split: a crew with 2 real slingers + 1 cover-only slot stays quorum-2 on real heads (cover never adds an active head), and `scored` includes the credited cover while `active`/quorum does not.

## Effort (LOW–MEDIUM)

**LOW–MEDIUM**, and *additive* — no rewrite of the shipped stack. One table + one RPC + a localized `resolve_war` delta (the only scoring touch) + `war_side`/`war_state` payload fields + a thin client verb that clones the existing `sling`/`bumpMine` pattern. The hard parts are already solved (per-(war,user,day) ledger, lazy idempotent resolve, RLS helpers, realtime, optimistic taps, announcement backstop). The effort is concentrated in **getting the five fairness rails exactly right** (the caps, the discounted rate, the real-vs-scored split, the no-self/no-active/no-bot gates) — design care, not engineering volume. Ships dark behind `MUD_FIGHTS_VISIBLE` with the rest of the war, so there's no rollout risk separate from the war's own flip ([[team-clan-mud-wars-plan]] gate D).

## Connects to

- [[sounder-mud-fights]] — the system this layers on; all base tables/RPCs/flags live there. Cover is the deferred "cooperation-bonus mud" item made concrete.
- [[team-clan-mud-wars-plan]] — this *is* the resolution of that plan's Tension #1 / Decision D6 (capped cooperation-bonus over the flat sling) and the pairwise *cover-for-the-absent* item.
- [[coop-mechanics-research-2026-06]] — the pairwise/asymmetric-help axis (NPC stand-in / fractional carry; gain-when-both-show, never loss-when-one-doesn't) and the fairness/anti-abuse axis (per-account caps, per-capita spine, reward-the-real-person-not-the-proxy).
- [[snouts-economy]] — cover routes through the *existing* capped war payout, not a new faucet; respects the no-sink/cash-faucet lesson and the war-token wall.
- [[trough]] — `resolve_war`'s lazy first-reader resolution (cloned from `resolve_expired_drives`) is the idempotent payout engine cover folds into.
- [[regen]] / [[blessings-curses-effects]] — the `war_winner_regen` buff is the existing core payback; cover doesn't add a new one.
- [[notifications]] — the "you were covered" note is an INLINE `system_announcements` insert (never `send_system_announcement` — admin-gate footgun) surfaced via WhileAway.
- [[shop-cosmetics-closet]] — the war-exclusive "Mudguard" loyalty cosmetic via the ChatGPT/icon-gen accessory pipeline.
