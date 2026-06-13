# The Slop Cauldron
> Toss your snouts in the village cauldron — when the whole Sounder makes it boil over, everyone scoops a tickle reward and a fresh pot bubbles up.

**Tier:** Mini-game · **Effort:** S · **Mode:** async co-op communal fill bar (server-owned counter, no client simulation) · **Depends on:** `donate_to_drive` / `open_item_drive` (the `item_drives` schema + Sounder-scoped donate path), the `dig_truffle` FOR UPDATE depleting-pot + clamp-to-remaining pattern, `grant_tickles` / `settle_tickles` over-cap faucet, `daily_shop()` / `shop_resets_in_seconds()` date-seed helpers, the `TroughSection` bar UI + `my_drives` read shape, `shift_alignment`, `grant_season_xp` first-of-day XP, `are_friends()`, and the INLINE `system_announcements` notify idiom.

## The fantasy
You are one of many pigs gathered around a great communal slop cauldron, tipping in handfuls of snouts and watching the level creep up toward the rim. It is Cookie Clicker's "number goes up" feeling — except the number is everyone's, and the satisfying part is being the snout that tips it over the edge for the whole barn. When it boils over, the village shares the spoils and a new pot starts bubbling. Pure belonging: you showed up, you poured, the Sounder got there together.

## Player loop
- **The daily/twice-daily action.** Open the Cauldron card (lives in the Shop alongside the Trough, or on the Barn Exterior). It shows one active communal pot: a fill bar at `raised_snouts / target_snouts`, who has poured, your own total contribution, and a 12h cooldown timer. You tap a preset pour (10 / 25 / 50 snouts, clamped to your balance and to the remaining gap), confirm, and watch the bar tick up server-side. Then you are on a 12h cooldown.
- **Nesting into the week.** A single global Cauldron is alive at a time. It typically takes the active community a few days of pours to fill. The pour cadence (every 12h) means a regular returning player contributes ~once or twice a day across multiple sessions — the same heartbeat as `donate_to_drive`. There is no per-day reset of the *pot*; the pot resets only on boil-over, so the stakes are "will WE get there this week," not "did I hit today's quota."
- **The payoff moment.** When a pour pushes `raised_snouts >= target_snouts`, the cauldron boils over inside that same transaction: every distinct contributor is granted `floor(their_total_contribution / 10)` tickles via the over-cap faucet, an INLINE `system_announcements` row drops to each contributor ("The cauldron boiled over! Here's your scoop."), the pot is marked `status = 'boiled'`, and a fresh Cauldron is seeded immediately (so the bar is never empty/dead). The pourer who tipped it over gets a small "you made it boil" flourish in the response payload for a burst-modal.
- **Seasonal frame.** Each boil-over is a small communal win that feeds the Schism Front (see *How it composes*) — contributors nudge toward Giver alignment, so a community that pours together leans the world Generous over the season.

## Mechanics
**This is `donate_to_drive` with the item-grant swapped for a proportional tickle scoop and the opener replaced by a server-seeded global pot. There is NO client simulation — `raised_snouts` is a server-side integer incremented only inside a SECURITY DEFINER RPC.**

- **Pour amounts.** Presets 10 / 25 / 50 snouts (the `TroughSection` `PRESETS` array, reused verbatim). Server clamps every pour with `snouts := LEAST(snouts, target_snouts - raised_snouts)` (the donate-to-drive gap clamp) so a pour can never over-fill the pot, and bounces `snouts <= 0` as `bad_amount` / `already_boiled`.
- **Snout debit (cheat tier a, atomic).** Inside the RPC: `SELECT counter INTO bal FROM profiles WHERE id = caller FOR UPDATE;` then `UPDATE profiles SET counter = counter - snouts`. Insufficient balance returns `insufficient` with `have`/`need`. The pot row itself is locked `SELECT * INTO c FROM slop_cauldrons WHERE id = active FOR UPDATE` (the `dig_truffle` row-lock) so concurrent pours serialise — no lost updates, no double-tip-over.
- **12h cooldown.** `EXISTS (SELECT 1 FROM slop_cauldron_pours WHERE pourer_id = caller AND created_at > now() - interval '12 hours')` → `pour_cooldown`. Byte-for-byte the `donate_to_drive` donate cooldown.
- **Target / cap.** `target_snouts` per cauldron is a fixed seeded value — start at **500 snouts** (tunable). This is the cap; the gap clamp guarantees `raised_snouts` never exceeds it. (Optionally scale future targets up by boil-over count for a gentle "numbers go up" escalation — `target := 500 + 100 * prior_boils`, capped at e.g. 1500 to keep weekly cadence.)
- **Boil-over win condition.** `now_raised >= target_snouts` →
  - `UPDATE slop_cauldrons SET status = 'boiled', boiled_at = now()`;
  - for each `DISTINCT pourer_id`: `reward := floor(SUM(snouts) / 10)`; `PERFORM grant_tickles(pourer_id, reward)` (over-cap safe); INLINE announcement INSERT;
  - `PERFORM shift_alignment(pourer_id, 1)` per contributor (generous communal act → Giver nudge);
  - seed a fresh `slop_cauldrons` row with `status='open'`, `raised_snouts=0`.
- **Reward formula.** `floor(contribution / 10)` tickles — i.e. 2 snouts → roughly the trough's 1-tickle-per-10 rate, matching `TICKLES_PER = floor(snouts/10)` in `TroughSection`. A player who poured 80 snouts total scoops 8 tickles. Pours are pure cost until boil-over; if a cauldron is abandoned (see expiry), pours are refunded.
- **First-pour-of-day XP.** `IF first_today THEN PERFORM grant_season_xp(caller, 5); END IF;` — the exact engagement reward `donate_to_drive` ships in `20260622000000`.
- **Expiry / abandonment edge case.** A cauldron carries `closes_at = now() + interval '14 days'`. A lazy `resolve_stale_cauldrons()` (clone of `resolve_expired_drives`, `FOR UPDATE SKIP LOCKED`) refunds every pour `counter = counter + pour.snouts` on any `open` cauldron past `closes_at` that never boiled, marks it `expired`, and seeds a fresh one. Called opportunistically from the read path so no cron is needed. In practice an active barn boils long before 14 days; this just prevents a dead pot if the community goes quiet.
- **Scope.** v1 ships ONE global cauldron (everyone pours into the same pot — maximally communal, simplest). The Sounder-scoping hook (`are_friends`) is wired but defaulted off for the global pot; flipping to per-Sounder cauldrons later is a one-line predicate change inherited from `donate_to_drive`.
- **Idempotency.** Boil-over fires exactly once because it is gated on the `FOR UPDATE`-locked transition `status='open' -> 'boiled'`; a second pour racing in re-reads `status <> 'open'` and bounces `already_boiled`. This is the `dig_truffle` "depleting pot can't be double-claimed" guarantee.

## Schema sketch
Clones `item_drives` (the pot) + `item_drive_donations` (the per-pourer ledger). Concrete:

```sql
-- The communal pot. Clone of item_drives, minus the item/opener columns.
CREATE TABLE public.slop_cauldrons (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  target_snouts int         NOT NULL,
  raised_snouts int         NOT NULL DEFAULT 0,
  status        text        NOT NULL DEFAULT 'open',   -- open | boiled | expired
  opened_at     timestamptz NOT NULL DEFAULT now(),
  closes_at     timestamptz NOT NULL,                  -- now() + 14 days (abandonment refund)
  boiled_at     timestamptz,
  boil_seq      int         NOT NULL DEFAULT 0          -- nth cauldron, for escalation/Hall
);
-- At most one live pot at a time (the bury_truffle "one active per host" idiom,
-- here global). Partial unique index on a constant.
CREATE UNIQUE INDEX slop_cauldrons_one_open ON public.slop_cauldrons ((true)) WHERE status = 'open';

-- Per-pourer ledger. Clone of item_drive_donations. Sums give each pig's scoop.
CREATE TABLE public.slop_cauldron_pours (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cauldron_id uuid       NOT NULL REFERENCES public.slop_cauldrons(id) ON DELETE CASCADE,
  pourer_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snouts     int         NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX slop_cauldron_pours_cauldron_idx ON public.slop_cauldron_pours (cauldron_id);
CREATE INDEX slop_cauldron_pours_pourer_idx   ON public.slop_cauldron_pours (pourer_id, created_at DESC);
-- RLS on; reads go through SECURITY DEFINER RPCs only (same as item_drives).
```

RPC signatures (all `SECURITY DEFINER`, `SET search_path TO 'public'`, granted to `authenticated`):

- `pour_into_cauldron(snouts int) -> jsonb` — **clone of `donate_to_drive`.** Resolves stale pots first, finds the single `open` cauldron (`FOR UPDATE`), checks 12h cooldown, clamps `snouts` to the gap, debits `counter` (`FOR UPDATE`), inserts the pour, bumps `raised_snouts`. On `now_raised >= target`: marks `boiled`, scoops every distinct pourer via `grant_tickles`, INLINE announcement INSERTs, `shift_alignment(+1)` each, seeds the next cauldron. Returns `{ok, raised, target, boiled, reward_if_boiled, you_tipped_it, xp}`.
- `the_cauldron() -> jsonb` — **clone of `my_drives`.** Resolves stale pots, returns the active pot `{id, target, raised, status, closes_at, pourer_count, my_contribution, on_cooldown_until, recent_pourers:[username]}`. Read surface for the card.
- `resolve_stale_cauldrons() -> int` — **clone of `resolve_expired_drives`.** Refunds pours on `open` pots past `closes_at`, marks `expired`, seeds a fresh pot. Lazy-callable, cron-safe.

No `claim` RPC needed — unlike the Trough, the scoop is granted immediately at boil-over (the reward is small tickles, not an item, so there's no claim gate). This is a *simplification* of the Trough, not an addition.

## Economy
- **Snout sink (deflationary).** Every pour `UPDATE profiles SET counter = counter - snouts` permanently removes snouts from the closed economy. Snouts are earned by spending the tickle bank (tickling), so the Cauldron is a *secondary sink* that gives accumulated snouts a communal purpose — exactly the Trough's role.
- **Tickle faucet (capped, over-cap-safe).** The only thing minted is tickles, via `grant_tickles` — the ONE over-cap-safe faucet. Reward = `floor(contribution/10)`, so to scoop tickles a player must have *first burned* 10× that many snouts into the sink. The faucet is strictly smaller than the sink it sits behind, by a 10:1 ratio, so it cannot inflate.
- **Cosmetic rewards (optional, later).** A "Cauldron Stirrer" Barn habitat trinket or a per-season "Boiled Over N times" title could drop at milestone boil counts (`boil_seq`), granted via `user_hats` ON CONFLICT DO NOTHING. Not in MVP.
- **Why it can't inflate.** Snouts only move counter→0 (burned), never minted. Tickles minted are a floored fraction of snouts already destroyed. The `grant_tickles` call ships the over-cap `GREATEST(...)` semantics already live in `settle_tickles`. **Footgun carried:** if the Cauldron is the FIRST live over-cap grant in the build, it must also ship the `GREATEST(item_count, LEAST(cap, ...))` display-debt fix to `home_stats` + `admin_tickle_overview` (per the `20260580000000_settle_tickles` header note) so over-cap scoopers see their true balance. If the Trough already shipped that fix, the Cauldron inherits it for free.

## Anti-abuse / cheat model
**Cheat tier (a) — server owns the answer; there is no client simulation to fake.** The genre this reframes (idle/incremental) is normally the *most* cheat-prone shape: a client that computes production over wall-clock can be clock-spoofed or memory-edited. Here that surface is removed entirely — the "number goes up" is `slop_cauldrons.raised_snouts`, a server-side integer that only `pour_into_cauldron` can touch, and only by debiting real snouts atomically.

- **Atomic debit + clamp.** `counter` is locked `FOR UPDATE` and decremented; the cauldron row is locked `FOR UPDATE`; the pour is clamped `LEAST(snouts, gap)`. A client can submit any `snouts` it likes — the server validates balance, clamps to the remaining gap, and never lets `raised_snouts` exceed `target`. No way to inflate the bar without spending real snouts.
- **Cooldown gate.** 12h `EXISTS` check on the pour ledger stops a single account from farming the bar; pours are spread across the community.
- **No collusion payoff.** The reward is a *floored fraction of what you already burned* (`floor(contribution/10)`), so coordinated pouring just moves snouts from the closed economy into a smaller tickle trickle — there is no positive-sum exploit. Two accounts colluding to "win" the pot still each only scoop `floor(own_contribution/10)`; the pot doesn't pay out more than the ratio allows.
- **No vote/seed gaming.** There is no vote, no daily seed to brute-force, no submitted result to validate. `target_snouts` is server-seeded (or constant); `current_date`/`hashtext` is not even strictly needed (it can seed escalating targets if desired, à la `daily_shop()`).
- **Boil-over fires once.** Guaranteed by the `status='open' -> 'boiled'` transition under the row lock — the `dig_truffle` depleting-pot idempotency.
- **Notify footgun avoided.** All boil-over notifies INLINE the `system_announcements` INSERT; the SECURITY DEFINER transaction must NEVER call `send_system_announcement` (admin-gated `RAISE EXCEPTION 'admin_only'` silently rolls back the whole pour + scoop for non-admins — the exact bug `20260619000000` fixed in `donate_to_drive` at the funding moment).

## Feel
- **Belonging (primary).** The cauldron is *the whole barn's* pot. You poured, others poured, it boiled — the win is collective, not competitive. This is the cozy heart of the feature and the reason it's pure on-tone filler.
- **Hangout.** A low-stakes thing to check on and tap whenever you're idling in the Shop/Barn — "is the cauldron close yet?" The recent-pourers list ("Rosie, Jen, and 4 others poured") gives the ambient sense of other pigs being around without any realtime.
- **Persistent-world FOMO (gentle).** The bar is *right there* creeping toward the rim; you want to be one of the pigs who got it over the line, and the boil-over flourish ("you made it boil!") rewards the tipper. The 14-day pot means missing a cycle isn't punishing — cozy guardrail intact.
- **Quirky charm.** A bubbling slop cauldron, pigs tipping in handfuls, the "boiled over!" scoop. Rosie-flavored throughout.
- **Slow time.** A pot that fills over days, not seconds, is the un-idle-clicker: the satisfaction is patient and communal rather than a dopamine treadmill.
- **Cozy-tone guardrail:** no leaderboard ranking of who poured most (that would turn belonging into competition), no public shaming of low pourers, no loss state beyond a quiet refund. The only social signal is "we did it together."

## How it composes
- **Schism Front meta-frame.** Each pour's `shift_alignment(+1)` on boil-over means a community that pours together leans the world **Generous**. The Front's nightly accumulation sums these deltas, so the Cauldron becomes one of the small communal acts feeding the Generous↔Greedy Tide — a boil-over week visibly pushes the Schism bar. Optionally surface a milestone boil in the weekly Schism Tally dispatch ("the village kept the cauldron boiling — +N for the Givers").
- **Sits beside the Trough.** Lives in the same `TroughSection`-style Shop surface and reuses its card vocabulary. The Trough is *targeted* (a friend gets a specific item); the Cauldron is *ambient* (the whole barn gets a tickle scoop). Together they cover both the "help a named friend" and "show up for everyone" co-op fantasies on one shared backend shape.
- **Faucet ladder.** It reuses the `grant_tickles` over-cap faucet that the Trough and the planned Oracle/Slopword payouts also use — one consistent reward chokepoint. Ideal **low-risk filler to ship beside a bigger mode** (per the shortlist: "ship beside Sounder Stampede"), proving nothing new architecturally while adding on-tone belonging.

## MVP
The smallest shippable seed is essentially one migration + one card:
1. **One migration** (`>= 20260624000000`): `slop_cauldrons` + `slop_cauldron_pours` tables, and `pour_into_cauldron`, `the_cauldron`, `resolve_stale_cauldrons` RPCs — each a near-verbatim clone of `donate_to_drive` / `my_drives` / `resolve_expired_drives` with the item-grant branch replaced by the proportional `grant_tickles` scoop + fresh-pot seed. Seed the first cauldron in the migration (`INSERT ... target_snouts=500, closes_at=now()+'14 days'`). If this is the first live over-cap grant, ALSO patch `home_stats` + `admin_tickle_overview` with the `GREATEST(...)` clamp.
2. **One component** (`SlopCauldronCard.tsx`): clone of `TroughSection`'s card — the fill bar, preset pour buttons (10/25/50), cooldown timer, recent-pourers line, and a boil-over burst on `boiled=true`. Calls `the_cauldron()` on focus and `pour_into_cauldron(snouts)` on tap via the existing `rpc`/`rpcAction` helpers. Drop it into the Shop above/below the Trough section.
3. Wire `shift_alignment(+1)` and the first-pour-of-day `grant_season_xp(+5)` in the RPC, INLINE the boil-over `system_announcements` INSERTs.

Global single pot, fixed 500 target, immediate scoop on boil — no claim step, no Sounder-scoping, no escalation. Everything else is additive.

## Risks & open questions
- **Solo-dev content cadence.** Near-zero ongoing cost — there is no daily seed to author, no content rotation, no balance table. It runs itself; the only knob is `target_snouts`. This is its biggest virtue as filler.
- **Single global pot pacing.** With one global cauldron and a 500 target, a large active community might boil it several times a day (treadmill-y), while a tiny one might never fill (dead bar → 14-day refund). Mitigation: scale `target` by active-player count or by `boil_seq`, or shard to per-Sounder pots. Open question: tune `target_snouts` against actual DAU before launch.
- **Reward feels thin?** `floor(contribution/10)` tickles is deliberately small (it's a sink, not a payday). Risk that players don't bother pouring if the scoop is negligible. Mitigation: lean on the *belonging*/boil-over flourish as the real reward, not the tickles; consider a milestone cosmetic at `boil_seq` thresholds if engagement lags. Open question: is the scoop motivating enough on its own, or does it need a cosmetic capstone?
- **Over-cap display-debt ordering.** If the Cauldron ships before the Trough's first real over-cap grant, it owns the `GREATEST(...)` fix to `home_stats`/`admin_tickle_overview`. Must confirm which faucet ships first so the fix lands exactly once. (Question)
- **Schism wiring.** `shift_alignment(+1)` per contributor on every boil could over-feed the Generous side if boils are frequent. Open question: cap the alignment nudge per player per day, or only nudge the tipper? (Question)
- **No realtime "watch it fill."** Other pigs' pours only appear on your next `the_cauldron()` fetch (focus refresh), not live. This is fine for the cozy async ceiling but means the bar can "jump" between views. Acceptable; Supabase Realtime could cosmetically smooth it later (never source of truth).

### Open questions (collected)
1. What `target_snouts` value (and escalation, if any) gives the right ~few-days-per-boil cadence at expected DAU?
2. Is the `floor(contribution/10)` tickle scoop motivating enough alone, or does it need a milestone cosmetic capstone?
3. Does the Cauldron or the Trough ship the first live over-cap grant — i.e. who owns the `GREATEST(...)` `home_stats`/`admin_tickle_overview` fix?
4. Should the Generous nudge be per-contributor-per-boil, per-day-capped, or tipper-only, to avoid over-feeding the Schism Front?