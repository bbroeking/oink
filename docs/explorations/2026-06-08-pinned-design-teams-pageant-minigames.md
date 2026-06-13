# Tickle the Pig — New Modes: Pinned Design

> Synthesized from four resolver passes + a deterministic denominator simulation, grounded against the live codebase. This is the document to review when you're back. Every cited RPC/table/migration was verified against `supabase/migrations/` on `main`.

---

## 0. DECIDED vs STILL-NEEDS-YOUR-TASTE

### Now DECIDED (resolved by the sim and/or by reusing shipped primitives — build against these)
- **Mud-Off win metric:** ACTIVE-THIS-CYCLE per-capita average **with a quorum floor** (the sim's R5). NOT your initial all-time-members pick (R1). NOT total (R3). See §4 for the simulation evidence that settles this.
- **Active-this-cycle signal:** `tickles_earned` monotonic delta (the bounty/wallow live-delta pattern) + capped donation muck. **NOT** `profiles.last_active_date` (session-writable, date-coarse — would let a logged-in zero-contributor inflate the denominator).
- **Faction model:** two fixed factions on a `profiles.faction` enum, player CHOICE, lock-once per cycle — a clone of the verified `choose_allegiance` lock-once skeleton.
- **Names:** Hilltoppers vs Valleyfolk; the contest is the Mud-Off.
- **Payout primitives (all modes):** snout prizes = `counter -> counter` TRANSFER (pari-mutuel, zero-sum, clone `item_drives` escrow/refund); tickle prizes = `grant_tickles` (the only over-cap-safe faucet, server-only). **No fresh snout mint, ever.**
- **Notify path (all modes):** INLINE `INSERT INTO system_announcements` inside the SECURITY DEFINER RPC. **NEVER** `send_system_announcement()`.
- **Pageant scoring:** 100% server-re-read (the equip path is a raw client UPDATE gated only by RLS — a client look can never be trusted). Solo-pageant MVP is pure style (no voting); peer voting is a v2 add with a hard 60% automated floor.
- **Mini-games:** Snout Oracle (pari-mutuel, cheat-proof by construction) ships first; live realtime multiplayer is OUT OF SCOPE.

### Still needs YOUR taste (genuine forks — see the tight list at the end)
1. Is the faction column actually committed to ship, and when? (Strategy fork — the brief says LOCKED, the codebase says it doesn't exist.)
2. Winning-faction cosmetic art budget (per-cycle unique vs fixed recoloring set vs title-only).
3. Snout->muck exchange feel (5:1 vs 3:1 vs 10:1).
4. Style-vector tagging method (LLM vs hand vs hybrid).
5. Oracle cadence + Riddle wordlist theme-tightness.
6. Ribbons as a real worn slot vs trophy-wall-only.

---

## 1. CARRIED-FORWARD CODEBASE FOOTGUNS (verified — apply in every settlement RPC)

These are not advice; they are load-bearing constraints confirmed by reading the migrations.

### 1.1 INLINE `system_announcements`, never `send_system_announcement()`
- `send_system_announcement()` **RAISES `admin_only`** for non-admins (unless `caller.is_test`). Because each RPC is one transaction, that exception **silently rolls back the entire payout**.
- Verified in `20260619000000_fix_donate_to_drive_announcement.sql` (header lines 5-6 describe the wrapper as admin-gated; lines 100-115 show the corrected INLINE `INSERT INTO public.system_announcements (user_id, kind, title, body, data)` loop). Same bug was patched for dig_truffle in `20260618000000`.
- **Every** resolve/claim RPC in this design (`resolve_mud_off`, `resolve_showdown_day`, `resolve_pageant`, `claim_oracle_payout`, `finalize_daily_puzzle`) INLINEs the INSERT.

### 1.2 First over-cap `grant_tickles` MUST ship the `GREATEST(...)` display-debt fix
- `20260580000000_settle_tickles.sql` header (lines 18-21, verified verbatim): *"display RPCs that recompute the balance inline (home_stats, admin_tickle_overview) still clamp with LEAST — they should get the same GREATEST fix when the first over-cap grant ships."*
- The fix: change those two RPCs' balance calc from `LEAST(cap, item_count+regen)` to `GREATEST(item_count, LEAST(cap, item_count+regen))` (the exact shape already live in `tickle_balance`/`tickle_info`, verified at lines 39-43, 143, 250 of that migration).
- `grant_tickles(uid,n)` (verified at line 269) settles first then adds `n` **without clamping**; banks overflow into `tickles_wasted_total`. It is the only over-cap-safe grant; not granted to clients (line 290).
- **Which migration carries the fix:** whichever over-cap faucet ships first. In the recommended order that is the Daily Riddle (or the Oracle if its payout converts to tickles). Bundle it there; later modes inherit the corrected display.

### 1.3 Snouts are a TRANSFER, never minted
- `profiles.counter` is the snout balance. The atomic debit idiom (verified in `20260594000000_bury_truffle_atomic.sql`, lines 28-36): `UPDATE profiles SET counter = counter - cost WHERE id = caller_id AND counter >= cost RETURNING counter` — catch `unique_violation -> already_buried` BEFORE charging.
- Every snout prize is a `counter -> counter` move (pari-mutuel). The only currency *minted* by these modes is tickles, via `grant_tickles`, and only as a small bounded faucet.

---

## 2. PER-MODE PINNED DESIGN

### 2.1 MUD-OFF (Teams) — effort L, clone-heavy

**Locked decisions**
| Decision | Value |
|---|---|
| Win metric + denominator | PER-CAPITA `SUM(contrib) / COUNT(members WHERE contrib>0)`, quorum floor Q (below-quorum factions ineligible, avg=0). Sim's R5. `is_test` excluded from numerator AND denominator. |
| Active-this-cycle signal | `contrib>0` from the `tickles_earned` delta + capped donation muck. NOT `last_active_date`. |
| Factions | Two fixed, `profiles.faction` enum CHECK IN ('hilltoppers','valleyfolk'), player choice, lock-once per cycle (clone `choose_allegiance`). |
| Contribution | HYBRID: passive tickle base (delta over a lazy per-(cycle,user) `season_base` snapshot) + optional snout-donation boost, per-member-per-cycle capped. |
| Notify | INLINE `system_announcements`. |
| Payouts | Pari-mutuel snout TRANSFER from the pit (clone `item_drives`) + `grant_tickles` consolation + dated cosmetic. No mint. |

**Resolved knobs (each with one-line rationale)**
- **Combine formula:** `combined_muck = tickle_muck + donation_muck`, where `tickle_muck = GREATEST(0, tickles_earned - season_base)` (1 tickle = 1 muck, self-explanatory) and `donation_muck = floor(donated_snouts/5)` capped at `DONATION_MUCK_CAP = 200` (= 1000 snouts). *One unit so standings never show two bars; 5:1 is deliberately worse than the Trough's rates so donating boosts, never buys.*
- **Where donated snouts go:** a per-(cycle,faction) PIT POT, REDISTRIBUTED (not burned) — the combined pit pays out to the WINNING faction split proportional to each winner's `combined_muck`. *Self-funding pari-mutuel keeps the economy closed and makes donating feel like investing.*
- **Tickle faucet:** ONLY a small effort-ladder consolation (banded 5/15/30 by personal muck), once/cycle, PK-idempotent, paid to EVERY participant regardless of side. *Bounded (max 30 tickles/player/~2wk), gated by real grind, and pays down the display-debt — inflationary footprint is a rounding error vs the home loop.*
- **Cadence:** BI-WEEKLY (14-day), fixed UTC boundary, one `pg_cron` tick (clone judgement-day). Lock-once WITHIN a cycle; FREE RE-PICK each new cycle (faction choice carries `faction_cycle_id`). `season_base` re-snapshots lazily each cycle. *Weekly is too much live-ops/cosmetic authoring; 4-week leaves dead stretches.*
- **Prize structure (3 layers):** (1) winning-faction exclusive dated cosmetic via `user_hats ON CONFLICT DO NOTHING`, gated on `contrib>0`; (2) pari-mutuel pit split proportional to personal muck among winning active members; (3) the effort ladder (BOTH sides) — the PRIMARY reward by design (effort > placement). *Proportional split makes alt-padding pay nearly nothing.*
- **Quorum value:** ship `QUORUM = 8` as a named SQL constant with a one-line override path; watch the first 2-3 settlements. *Sim is explicit Q is the single knob to tune to live base.*
- **Both-below-quorum:** NO winner, pit REFUNDS pro-rata to donors (clone `resolve_expired_drives` refund), cosmetic rolls to next cycle, everyone still claims the ladder.
- **Tiebreak chain:** `avg_per_active DESC, active_members DESC (anti-cabal), total_muck DESC, earliest faction-join`; on a true dead-heat, grant the cosmetic + split the pit to BOTH (rare shared victory) rather than coin-flipping.
- **donation_muck storage:** per-(cycle,user) row, cap enforced at write; debit via the bury_truffle idiom, clamp overflow BEFORE debit so you never charge for muck that won't count.

**schemaSketch**
```sql
-- migration prefix must be >= 20260624000000
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS faction          text CHECK (faction IN ('hilltoppers','valleyfolk')),
  ADD COLUMN IF NOT EXISTS faction_cycle_id bigint,
  ADD COLUMN IF NOT EXISTS faction_chosen_at timestamptz;

CREATE TABLE public.mud_off_cycles (
  id bigserial PRIMARY KEY,
  starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','settling','settled')),
  winning_faction text,                 -- null+settled = no winner (both <Q) or dead-heat
  pit_hill bigint NOT NULL DEFAULT 0, pit_valley bigint NOT NULL DEFAULT 0,
  settled_at timestamptz);

CREATE TABLE public.mud_off_base (        -- lazy season_base snapshot (wallow_user_base shape)
  cycle_id bigint NOT NULL REFERENCES public.mud_off_cycles(id) ON DELETE CASCADE,
  user_id  uuid   NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  base_earned bigint NOT NULL,
  PRIMARY KEY (cycle_id, user_id));

CREATE TABLE public.mud_off_donations (   -- drove_donations shape; cap enforced here
  cycle_id bigint NOT NULL REFERENCES public.mud_off_cycles(id) ON DELETE CASCADE,
  user_id  uuid   NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snouts_donated int NOT NULL DEFAULT 0,
  donation_muck  int NOT NULL DEFAULT 0,   -- floor(snouts/5), capped 200
  PRIMARY KEY (cycle_id, user_id));

CREATE TABLE public.mud_off_claims (      -- idempotent ladder + cosmetic claim
  cycle_id bigint NOT NULL REFERENCES public.mud_off_cycles(id) ON DELETE CASCADE,
  user_id  uuid   NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  muck int NOT NULL, faction text NOT NULL, won boolean NOT NULL,
  tickles_paid int NOT NULL DEFAULT 0, snouts_paid int NOT NULL DEFAULT 0,
  cosmetic_id text, claimed_at timestamptz NOT NULL DEFAULT now(), seen_at timestamptz,
  PRIMARY KEY (cycle_id, user_id));        -- INSERT ... ON CONFLICT DO NOTHING; IF NOT FOUND -> already

-- Constants in RPC bodies: DONATION_MUCK_CAP=200, SNOUT_PER_MUCK=5, QUORUM=8, LADDER 5/15/30.

-- THE settlement/standings CTE (the sim's exact shape):
WITH muck AS (
  SELECT p.id, p.faction,
         GREATEST(0, p.tickles_earned - COALESCE(b.base_earned, p.tickles_earned))
           + COALESCE(d.donation_muck, 0) AS contrib
  FROM profiles p
  LEFT JOIN mud_off_base b      ON b.user_id=p.id AND b.cycle_id=:cur
  LEFT JOIN mud_off_donations d ON d.user_id=p.id AND d.cycle_id=:cur
  WHERE p.faction IS NOT NULL AND p.faction_cycle_id=:cur AND COALESCE(p.is_test,false)=false)
SELECT faction,
       SUM(contrib)                              AS total_muck,
       COUNT(*) FILTER (WHERE contrib > 0)        AS active_members,        -- THE DENOMINATOR
       CASE WHEN COUNT(*) FILTER (WHERE contrib > 0) >= :quorum
            THEN SUM(contrib)::numeric / NULLIF(COUNT(*) FILTER (WHERE contrib>0),0)
            ELSE 0 END                            AS avg_per_active         -- 0 => below quorum => ineligible
FROM muck GROUP BY faction
ORDER BY avg_per_active DESC, active_members DESC, total_muck DESC;
```
RPCs: `choose_faction(p_faction)`, `donate_to_pit(p_snouts)`, `mud_off_standings()` (read), `resolve_mud_off(p_cycle_id)` (pg_cron), `claim_mud_off_reward()`. The `pg_cron` line clones `judgement-day-season-1` (verified `cron.schedule(...)` at `20260579000000`).

**Anti-abuse** (sim-verified): per-capita makes alts self-defeating (4a/4b: below-average alts DRAG the average down); quorum closes the ghost-town+whale hole (scenario 2); `DONATION_MUCK_CAP` is the load-bearing anti-whale lever (the boost-sweep showed one 600-muck donation flips a tie); `is_test` excluded both sides; periodic anomaly query for above-average alt detection (v2). Residual: join-the-smallest meta (scenario 5) is a size self-balancer (feature), its only risk (snowballing elite squad) contained by quorum + donation cap.

**Reward loop:** free entry -> tickle while you play (passive muck) -> optionally toss snouts in the pit -> bi-weekly settle -> EVERY participant claims the effort ladder; winners also split the pit + get the dated cosmetic.

**MVP -> v2 cut line:** MVP = the 4 tables + `choose_faction`/`donate_to_pit`/`mud_off_standings` (headcount + avg + caller muck + pit totals)/`resolve_mud_off`/`claim_mud_off_reward` + the display-debt fix + a MudOff card + launch-modal verdict, with Q=8, 5:1 cap-200, one recolorable cosmetic pair + dated title. **v2:** faction+Sounder NAMED top-contributor rows (biggest anti-loafing polish, not blocking), the 'you haven't tossed in' nudge, richer pull-modal, admin Q/cap config row, anomaly query, presence flourish. **Defer indefinitely:** third faction, mid-cycle switching, wasted-tickle->muck conversion.

---

### 2.2 PAGEANT (solo) — effort M (MVP) / L (with voting), the shared-model unlock

**Resolved knobs**
- **Style axes:** 5 TTP-native — GLAM/CHARM/SHARP/CLEVER/RUGGED — as `smallint NOT NULL DEFAULT 0` columns on `public.hats`. *Trivial additive ALTER; 5 maps cleanly onto a date-seeded daily theme.*
- **Scored slots:** the 6 live visible worn slots from `SLOT_COLUMN` (verified `constants/slots.ts` lines 33-40): head/eyes/face/aura/held/background. EXCLUDE neck (`scarf/cape/necklace` are in `HIDDEN_CATEGORIES`, verified `constants/hats.ts` line 220). Flag = scored-optional. *Scoring only fillable slots stops gaming via hidden items and keeps the coherence math honest.*
- **Items to tag:** ~85-90 live worn rows; the 30 hidden neck items and tickle_particles need NO tags.
- **`style_score(p_user, p_theme)`:** SECURITY DEFINER STABLE; SELECTs the caller's own `active_*_id` columns (NEVER a client payload); on-theme axis full weight + 0.5 off-theme; mild rarity potency (1.0..1.6 from `hats.rarity`); +15% coherence if 3+ slots share the on-theme axis; diminishing cap `round(120*(1-exp(-raw/120)))`. *Server re-read is non-negotiable given RLS-only equip; the exp() cap is the anti-whale lever.*
- **Theme mechanic:** date-seeded like `daily_shop()` (verified `abs(hashtext(h.id || current_date::text))` idiom at `20260584000000` line 24): `theme = axes[(abs(hashtext(d::text||'pageant_theme')) % 5)+1]` via a STABLE SQL `pageant_theme(d)` helper. Daily UTC cadence. *No cron to OPEN; all clients agree.*
- **Scoring blend (v2 voting):** `final = 0.60*styleNorm + 0.40*voteNorm`, normalized within the day's cohort; **pure-style fallback at ~0 votes**. *Inverts Pokemon on purpose: the VOTE half is the gameable half, so the uncheatable server-recomputed style half gets majority weight and caps any bloc at ~40% swing.*
- **Voting UX (v2):** BLIND absolute-entry (no usernames, render via `public_pig_look`), small daily vote budget; server-side: reject self-votes, EXCLUDE friend votes from ranking (`friend_ids()`), trust-weight by season XP + account age (capped), per-(date,voter,entry) PK, batch anomaly query, admin void kill-switch. Pairwise Snout-or-Snout Elo held for v3 if brigading observed.
- **Rewards:** dated non-purchasable Ribbon (`user_hats ON CONFLICT DO NOTHING`, cost=0); bounded tickle bands (1st 30 / 2nd 15 / 3rd 5) via `grant_tickles`; voter participation tiny `grant_tickles(2)` + `grant_season_xp(5)` (verified RPC at `20260613000000`). *All payouts are grants/transfers — zero minting.*
- **`public_pig_look(p_user)`:** clone `alignment_leaderboard` (verified two-sided UNION ALL + ROW_NUMBER at `20260525000000`), windowed — only returns a full look for users with an OPEN entry today (entering = consent to be seen). *Avoids a privacy regression over today's hat-only cross-player exposure.*

**schemaSketch** (abbrev — full RPC bodies in the resolver):
```sql
ALTER TABLE public.hats
  ADD COLUMN style_glam smallint NOT NULL DEFAULT 0, ADD COLUMN style_charm  smallint NOT NULL DEFAULT 0,
  ADD COLUMN style_sharp smallint NOT NULL DEFAULT 0, ADD COLUMN style_clever smallint NOT NULL DEFAULT 0,
  ADD COLUMN style_rugged smallint NOT NULL DEFAULT 0;
CREATE TABLE public.pageant_events  (event_date date PRIMARY KEY, theme text NOT NULL, closes_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','voided')));
CREATE TABLE public.pageant_entries (event_date date, user_id uuid, look jsonb, theme text, style_score int,
  vote_weight numeric DEFAULT 0, final_score numeric, placement int, entered_at timestamptz DEFAULT now(),
  PRIMARY KEY (event_date, user_id));
CREATE TABLE public.pageant_votes   (event_date date, voter_id uuid, entry_user_id uuid, weight numeric,
  created_at timestamptz DEFAULT now(), PRIMARY KEY (event_date, voter_id, entry_user_id));  -- v2
CREATE TABLE public.pageant_vote_claims (event_date date, voter_id uuid, claimed_at timestamptz DEFAULT now(),
  PRIMARY KEY (event_date, voter_id));
-- enter_pageant / cast_pageant_vote (v2) / resolve_pageant (lazy, resolve_expired_drives pattern) /
-- claim_vote_reward / void_pageant. resolve INLINEs system_announcements; first over-cap grant ships GREATEST fix.
```

**Anti-abuse:** server re-read = cheat-proof; 60% floor caps vote blocs; blind voting kills targeting; friend exclusion + standing-weight = Sybil resistance; void kill-switch.

**Reward loop:** dress up -> enter (free) -> (v2: vote on blind rivals for a small reward) -> daily resolve -> Ribbon + bounded tickles for placers, participation tickles for voters.

**MVP -> v2 cut line:** **MVP (M, automated-only, zero voting/collusion risk):** style columns + the ~85-90-item tagging migration + `pageant_theme()` + `style_score()` + `public_pig_look()` + events/entries + `enter_pageant` + lazy `resolve_pageant` (pure style) + grant_tickles bands + dated trophy-wall Ribbon + INLINE announcement + the GREATEST fix on the first over-cap grant. **v2 (+M):** votes + claims tables, blind absolute-entry `cast_pageant_vote` (budget, friend exclude, standing weight), flip resolver to 0.60/0.40 with pure-style fallback, `void_pageant`, anomaly query; promote Ribbon to a worn slot. **v3 (defer until brigading observed):** pairwise Elo; THEN harvest the model into Showdown, Pick'em, Runway Duel — zero new scoring code.

---

### 2.3 SOUNDER SHOWDOWN (Hybrid: team-vs-team pageant) — effort L *given both prereqs*

**Locked identity:** per-faction daily Style Score = per-active-member AVERAGE of entrants' server-computed scores. **No peer voting.** Dodges BOTH hard problems by construction: no voting = no brigade surface (Pageant's problem); per-capita average = stacking alts dilutes (Teams' problem).

**Honest dependency order (verified against the repo):** the brief calls the faction column LOCKED, but `grep` confirms `profiles.faction`, Hilltoppers/Valleyfolk, and the `style_*` columns appear **only** in the exploration doc — never in any migration. So Showdown is an L recombination **only after** (1) the faction column ships+locks and (2) the style model ships and is validated by the solo pageant. Build Showdown before either and you are really building that prereq + Showdown — re-scope as XL.

**Resolved knobs**
- **Per-capita math:** `pen_score = AVG(style_score) * participation_factor`, where `participation_factor = 0.5 + 0.5*LEAST(1, entrants/eligible)`. *Pure AVG lets a 1-entrant pen spike; the blend lets a small passionate pen beat a big lazy one without auto-winning on one godroll. Keep avg/sqrt(N) in the back pocket if tiny pens spike in playtest.* 'Active member' = one row in `showdown_entries` today, so dormant sign-ups never dilute.
- **Faction count:** inherit the 2 the faction column ships (Hilltoppers/Valleyfolk). *2 = denser daily brackets on a small base; `alignment_leaderboard` two-sided UNION ALL renders it near-verbatim.*
- **Entry fee:** free v1 (turnout is the whole game); snout grooming-fee sink later.
- **Scored slots:** same 6-7 live slots as the Pageant; exclude dead neck.
- **Ribbon:** worn cosmetic that feeds future Style Score (virtuous closet loop) — but this is a v3 taste fork (see open forks); trophy-wall for MVP.
- **Display-debt:** Showdown's first `grant_tickles` win can push over cap, so bundle the GREATEST fix here if the Oracle/Riddle didn't already pay it.

**schemaSketch** (the thin recombination layer; prereqs above it):
```sql
CREATE TABLE public.showdown_days (
  contest_date date PRIMARY KEY,
  theme text NOT NULL, status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  winning_faction text, resolved_at timestamptz);
CREATE TABLE public.showdown_entries (
  contest_date date NOT NULL REFERENCES public.showdown_days(contest_date),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  faction text NOT NULL, style_score int NOT NULL,
  placed_in_winning_faction boolean NOT NULL DEFAULT false,
  PRIMARY KEY (contest_date, user_id));
CREATE TABLE public.showdown_ladder_claims (   -- placement-independent effort ladder
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  band text NOT NULL CHECK (band IN ('bronze','silver','gold')),
  tickles_paid int NOT NULL, claimed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, band));
-- theme date-seeded (daily_shop idiom). enter_showdown() server-re-reads the look, computes style_score,
--   INSERT ... ON CONFLICT DO UPDATE; pays the effort ladder by lifetime-entry band (idempotent).
-- showdown_standings(p_date): AVG(style_score)*participation per faction, UNION ALL / GROUP BY.
-- resolve_showdown_day(): pg_cron daily; per-capita winner; grant_tickles + grant_season_xp + dated Ribbon
--   ON CONFLICT DO NOTHING; INLINE system_announcements. Lazy-callable fallback from the read path.
```

**Anti-abuse:** per-capita (dilution) + server-computed style (no fake looks) + diminishing cap + one entry/day (PK) + effort ladder > placement (alt army buys almost nothing) + lock-once membership.

**Reward loop:** lock your look -> server scores it -> effort ladder pays you for entering regardless of placement -> daily resolve -> winning pen gets modest tickles + season XP + dated Ribbon.

**Critical UI rule (the named #1 risk):** per-capita is harder to explain than a total. **Never render a shared SUM bar** (a loafer must not look like dead weight). Render the AVERAGE as a "Pen Polish" gauge + the personal score separately. Copy: *"Every pen is judged on its average look, not its size. A small tidy pen can out-style a big messy one — turnout beats headcount."* On loss: *"{Valleyfolk} edged the catwalk today, but your strut still earned you {tickles}."*

**MVP -> v2 cut line:** **MVP:** both prereqs land first; then days/entries/ladder + `enter_showdown` + `showdown_standings` (2-faction UNION ALL) + `resolve_showdown_day` (one cron tick, lazy fallback) + bounded grants + dated Ribbon + effort ladder + the average-not-sum UI. **v2:** season-champion pen cosmetic gated on min participation; Pig Pick'em (S) over the outcome (deflationary sink); Runway Duel reusing `style_score`; switch to avg/sqrt(N) only if tiny pens spike. **Defer:** Slop Raid, County Fair capstone, live realtime.

---

### 2.4 MINI-GAMES — Snout Oracle (S) + Daily Riddle (M)

**Locked decisions**
- **Snout Oracle = pure zero-sum pari-mutuel snout TRANSFER, never a mint.** Entry debits `counter` (bury_truffle idiom); losers' stakes are the ONLY source of winner payouts; pot splits `counter->counter`. No `grant_tickles` in the Oracle settle path -> `SUM(counter)` conserved per round (modulo floor() dust left in the void). Cheapest cheat-proof loop.
- **Daily Riddle = snouts-IN (sink) -> tickles-OUT (faucet via `grant_tickles`).** Fee burned (deflationary counterweight).
- **Server alone holds every answer.** Oracle: outcome computed INSIDE `resolve_oracle_round()` from existing tables AFTER `lock_at`. Riddle: secret recomputed inside `submit_daily_guess()` from the date-seed, never returned. Cheat-proof by construction — the only Oracle attack (late entry) dies to a `lock_at>now()` check; the only Riddle attack (modded board) dies to server recomputation.
- **Date-seed via `abs(hashtext(...))` in SQL, never JS float RNG** (the verified `daily_shop` idiom).
- **Idempotency = per-period PK ledger + nullable `claimed_at`.** `oracle_picks PK(round_id,player_id)` IS the cooldown; `daily_riddle_attempts PK(player_id, puzzle_date)` IS the 24h gate.
- **Lazy resolution default; pg_cron optional polish only** (clone `resolve_expired_drives` `FOR UPDATE SKIP LOCKED`, verified at `20260583000000`). Repo has zero standing recurring cron today.
- **INLINE `system_announcements`.** **First over-cap `grant_tickles` ships the GREATEST fix.** **Live realtime OUT OF SCOPE** (Realtime presence is the only allowed flourish, AFTER the async core, never authoritative).

**Resolved knobs**
- **Oracle questions:** server-resolvable iff a deterministic function of rows the server holds by `lock_at`. 10 grounded examples (blessings-vs-curses count, lucky-counter cross, trough-funded EXISTS, alignment lead, truffles dug, daily_shop trivia, and a `seeded_coin` filler that's always available). ROUND GENERATION: a curated `oracle_question_catalog` of ~20-30 templates tagged with a `resolver_key` enum + `param`; rounds minted by date-seed; `resolve_oracle_round()` is a CASE on `resolver_key`. *New questions are data rows, not code — curation without heavy ops.*
- **Oracle pool math:** after resolve, `loser_pot = SUM(stake) where pick<>outcome`; each winner gets `stake + floor(loser_pot*stake/winners_stake)`. If nobody right OR no losers -> refund all (never strand snouts). Floor() dust burned.
- **Oracle cooldown:** one bet/round via PK; second attempt hits PK -> `already_bet` (no charge), mirroring `already_buried`.
- **Riddle wordlist:** cozy-farm-flavored general 5-letter list, ~180-200 words (~6mo no-repeat horizon at 1/day), in `puzzle_words`; secret via the date-seed `ORDER BY abs(hashtext(word || salt || date)) LIMIT 1`; rotating salt voids a leaked day. Client-packaged allow-list for guess UX + server scoring as authority.
- **Riddle cheat model + bands:** client scores feedback optimistically; `submit_daily_guess()` RECOMPUTES against the secret and returns the authoritative pattern; secret NEVER in any response. Payout bands 1g=20 ... 6g=4, fail=0/pity, via `grant_tickles`. *Max 20 tickles/player/UTC-day < one non-VIP bank (25) — a perfect day grants under a bank's worth, so it never floods the economy.*
- **Riddle cooldown:** `PK(player_id, puzzle_date)` where `puzzle_date = (now() AT TIME ZONE 'UTC')::date`; UTC rollover IS the reset. One/day MVP; paid retries a v2 sink.
- **Share hook:** `finalize_daily_puzzle` returns a spoiler-safe emoji `share_grid` (squares, no letters) computed server-side; INLINE a personal `riddle_result` announcement. Rides `system_announcements` — zero new feed infra.

**schemaSketch** (abbrev):
```sql
CREATE TABLE public.oracle_question_catalog (id bigserial PRIMARY KEY, prompt text, options text[],
  resolver_key text, param jsonb DEFAULT '{}', enabled boolean DEFAULT true);
CREATE TABLE public.oracle_rounds (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), catalog_id bigint,
  prompt text, options text[], resolver_key text, param jsonb DEFAULT '{}',
  opens_at timestamptz, lock_at timestamptz, resolved_at timestamptz, outcome int,
  status text DEFAULT 'open' CHECK (status IN ('open','resolved','voided')));
CREATE TABLE public.oracle_picks (round_id uuid, player_id uuid, pick int, stake int CHECK (stake>0),
  payout int, claimed_at timestamptz, created_at timestamptz DEFAULT now(),
  PRIMARY KEY (round_id, player_id));   -- one bet/round = the cooldown
CREATE TABLE public.puzzle_config (id int PRIMARY KEY DEFAULT 1 CHECK (id=1), salt text NOT NULL DEFAULT 'oink-v1');
CREATE TABLE public.puzzle_words (word text PRIMARY KEY CHECK (char_length(word)=5 AND word=lower(word)),
  enabled boolean DEFAULT true);
CREATE TABLE public.daily_riddle_attempts (player_id uuid, puzzle_date date, guesses text[] DEFAULT '{}',
  guess_count int DEFAULT 0, solved boolean DEFAULT false, finalized_at timestamptz, reward_tickles int,
  started_at timestamptz DEFAULT now(), PRIMARY KEY (player_id, puzzle_date));
-- place_oracle_bet (lock check then debit), resolve_oracle_round (lazy CASE on resolver_key, refund-on-no-winner),
--   claim_oracle_payout (idempotent, INLINE announce), oracle_status, void_oracle_round.
-- riddle_secret (SECURITY DEFINER, never granted to clients), start_daily_puzzle (fee/sink),
--   submit_daily_guess (server recompute), finalize_daily_puzzle (band grant + share grid + GREATEST fix).
```

**MVP -> v2 cut line:** **MVP = Snout Oracle ALONE** (catalog incl. seeded_coin filler, rounds, picks, the 4 RPCs, one OracleCard) — exercises the entire entry-fee/pool/lazy-resolve/idempotent-claim/transfer spine at effort S, cheat-proof, economically inert. **v1.1 = Daily Riddle** (words list + 4 RPCs + board UI + share grid) — pays the GREATEST display-debt on the first real over-cap faucet + adds the viral hook. **v2:** paid Oracle cron, paid Riddle retries, public cross-Sounder leaderboard, server guess dictionary. **Out of scope:** live realtime (Realtime presence cosmetic only, after the async core, with `removeChannel`-on-unmount).

---

## 3. ECONOMY INVARIANTS (apply across all modes)
1. **Snouts move only as `counter -> counter` transfers** (pari-mutuel pits/pools). Never minted by a mode.
2. **Tickles are the only minted reward, via `grant_tickles` only** — bounded, over-cap-safe, banks waste into `tickles_wasted_total`.
3. **Sinks:** Riddle fee (burned), Pick'em/duel forfeits, Mud-Off donation cap — deflationary counterweights to the home loop's daily mint.
4. **Per-capita (average-not-sum) is the structural anti-collusion lever** for every team mode — reusable.

---

## 4. THE PER-CAPITA DENOMINATOR DECISION — WITH SIMULATION EVIDENCE

**Question:** which denominator decides the Mud-Off winner — all-time members (R1, your initial pick), active-this-cycle (R2), total/no-per-capita (R3), or a trimmed/threshold variant?

**Method:** deterministic enumeration (no RNG) over 7 hand-specified scenarios with realistic rosters (whales/mids/casuals/long-tail/dormant/alts). Four base rules + R5 (R2 + quorum floor Q=8) + a snout-boost sweep. Grounded against real schema (`tickles_earned` monotonic delta, `counter`, `is_test`, `grant_tickles`, the bounty live-delta no-drift pattern, the bury_truffle debit idiom).

**Decision: ACTIVE-THIS-CYCLE per-capita WITH a quorum floor (R5).** `winner = argmax SUM(contrib) / COUNT(contrib>0)`; any faction below Q active members is ineligible (avg=0). Plus two denominator-independent guardrails: a per-member per-cycle snout-donation cap, and exclude `is_test`.

**Scorecard (PASS/fail on 5 intuitive-winner checks):** R1 **2/5**, R2 **4/5**, R4 **4/5**, R3 **5/5 but rejected**, **R5 5/5 — adopted.**

**Why each rejected rule loses, by scenario:**
- **R1 (your initial all-time pick) — REJECTED, 2/5.** Scenario 7 (recruiting drive): R1 makes Hill LOSE (27.6 vs 40.3) even though Hill made MORE muck — growing your faction LOWERS your score, anti-social in a friend-centric game. Scenario 3 (same active core, different dormancy): R1 makes Valley lose (38.0 vs 10.1) purely for an older roster. Scenario 2 (ghost town): R1 hands the win to a 1-whale dead faction (90.0 vs 19.7).
- **R3 (total, no per-capita) — mechanically abuse-proof but WRONG GAME, rejected.** Scenario 1 (lopsided sizes, equal engagement): every per-capita rule calls it an even TIE; only R3 hands it to Valleyfolk (778 vs 2,334) purely for being bigger. R3 turns the Mud-Off into a headcount/bandwagon race, defeating the entire per-capita anti-collusion rationale.
- **R2 (active per-capita ALONE) — 4/5, the hole R5 closes.** Scenario 2: R2 STILL hands the ghost-town+1-whale faction the win (900 avg vs a healthy community's 24). The quorum floor is the minimal cheap patch (one `COUNT(*) FILTER` comparison) that closes exactly that hole -> 5/5.

**The boost sweep (why the donation cap is mandatory, independent of denominator):** one 600-muck donation flips an even matchup; 2000 makes it a blowout. So snout-sourced muck MUST be capped per member per cycle — else the average reflects one wallet's spend, not participation.

**Alt-padding is self-limiting (4a/4b both rejected the attack):** zero-muck alts DILUTE the average (HURT the attacker); even alts pushed to 8 muck (just over a T=5 threshold) still drag the average DOWN. The attack only works if alts exceed the faction average — which costs real grind/capped snouts per alt and is economically self-limiting.

**Implementation (no per-tap ledger — reuse the shipped bounty live-delta):** lazily snapshot each player's `tickles_earned` into a per-(cycle,user) `season_base` row at first interaction; `contrib = GREATEST(0, tickles_earned - base) + capped donation_muck`; active iff `contrib>0`. ZERO new write-path on the tickle loop. See §2.1 for the exact CTE.

**Edge cases the design must handle (sim-named):** ghost-town (defeated ONLY by quorum — tune Q to live base, start 8); join-the-smallest meta (inherent to all per-capita; a size self-balancer, contained by quorum + cap); season_base correctness (snapshot lazily with `COALESCE(base, tickles_earned)` so missing base = 0 contrib, never recompute mid-cycle); ties (deterministic chain, shared victory on a dead heat); cross-cycle decay (re-snapshot each season = no permanent incumbent, but the bar MUST read 'this cycle' loudly).

---

## 5. RECOMMENDED BUILD ORDER (all modes)

1. **Snout Oracle (S)** — prove the entry-fee/pool/lazy-resolve/idempotent-claim/transfer spine; cheat-proof; pays the GREATEST display-debt on the first faucet. *Optionally: Daily Riddle (M)* for gameplay feel + viral hook.
2. **Style Score model + solo Pageant (M)** — pay the ~85-90-item tagging tax ONCE; validate `style_score()` with zero voting/collusion risk (pure-style MVP).
3. **Faction column + Mud-Off (L)** — ship `choose_faction` (clone `choose_allegiance`) as part of Mud-Off; per-capita+quorum settlement, pari-mutuel pit, one cron tick.
4. **Sounder Showdown (L)** — thin recombination consuming the faction column + style model; per-capita average; no voting; dodges both hard problems.
5. **Layer cheap wins:** Pig Pick'em (S, deflationary sink) over the team-mode outcome; Runway Duel (M) reusing `style_score`; v2 Pageant voting only if you want an audience layer.

**Defer indefinitely:** High-Score Gauntlet (deterministic replay), Pokemon-faithful 20-Ribbon ladder, County Fair capstone, live realtime, third faction, mid-cycle faction switching.

**Migration hygiene:** new files must sort after the latest applied `20260623000000` (i.e. `>= 20260624000000`); same-prefix collisions break on `schema_migrations.version` PK.

---

## 6. OPEN FORKS (your taste — none block starting the Oracle)
See the structured `decisionsStillNeedingYou` list. Summary: (1) commit the faction column as a standalone ship — *lean yes*; (2) cosmetic art budget — *lean fixed recoloring set + dated title*; (3) snout->muck rate — *lean keep 5:1 cap-200, tune from data*; (4) tagging method — *lean LLM draft + hand-tune legendaries*; (5) Oracle cadence/Riddle wordlist — *lean 6h + cozy-farm general list*; (6) Ribbon worn slot — *lean trophy-wall MVP, worn slot v3*.