# Sounder Showdown (Team Pageant)
> Dress your pig, strut for your pen — a small tidy sounder can out-style a big messy one.

**Tier:** Mini-game (team-vs-team daily contest) · **Effort:** L *given both prereqs* (XL if either prereq is unbuilt) · **Mode:** Async, lazy-resolved daily settle with optional `pg_cron` polish · **Depends on:** the `profiles.faction` column (Hilltoppers/Valleyfolk, lock-once — clone of `choose_allegiance`) **AND** the Style Score model (`hats.style_*` columns + `style_score()` + `public_pig_look()`, shipped + validated by the solo Pageant). Neither exists in any migration today — both appear ONLY in the exploration doc. Build Showdown before either and you are really building that prereq plus Showdown; re-scope as XL.

## The fantasy
You are a proud member of a pen, and tonight is the catwalk. You dress your pig to today's theme, lock the look, and your fashion sense becomes a point of pride for your whole faction — not because you grinded harder than anyone, but because your *taste* lifted the pen's average. A handful of well-dressed Hilltoppers can shame a mob of careless Valleyfolk. It is belonging without grind: turnout and good taste, not headcount, win the day.

## Player loop
- **Daily (the act):** Open the Showdown card. See today's date-seeded style theme (e.g. "GLAM day"). Dress Rosie in your closet, then tap **Enter the Showdown**. The server re-reads your equipped look, computes your `style_score`, and writes one `showdown_entries` row for you under your locked faction. You immediately see your personal score, your pen's running **Pen Polish** average gauge, and the rival pen's gauge.
- **The effort ladder (placement-independent):** Entering at all advances your lifetime-entry band (bronze/silver/gold). The first time you cross each band you claim a small bounded tickle grant — you are paid for *showing up and dressing up*, win or lose. This is the primary reward by design.
- **Nightly (the stakes):** At the daily UTC boundary `resolve_showdown_day()` computes each pen's per-capita score, picks the winning faction, grants the winners modest tickles + season XP + a dated Ribbon, and INLINEs a personal dispatch ("The catwalk verdict is in…"). Resolution is lazy-callable from the read path as a fallback if cron hasn't fired.
- **Seasonal (the meta):** Showdown is one **front in the Schism Front war** (see *How it composes*). The pen's daily catwalk win nudges the Tide via a `shift_alignment`-style accumulation toward the faction's alignment side, so your strut tilts the season-ending Golden Age / Reckoning fate. The daily act nests up: one entry (today) → a daily pen win (nightly) → a banked Tide contribution (seasonal).

## Mechanics
- **Theme:** one of the 5 style axes, date-seeded with the verified `daily_shop()` idiom — `abs(hashtext(h.id || (SELECT d FROM today_seed)))` (`20260584000000_daily_shop_exclude_free.sql` line 24). A STABLE SQL helper `showdown_theme(d date)` returns `axes[(abs(hashtext(d::text||'showdown_theme')) % 5)+1]` from `{glam, charm, sharp, clever, rugged}`. No cron needed to *open* a day; all clients agree deterministically. Daily UTC cadence.
- **Style score (server re-read, never trusted from client):** `style_score(p_user, p_theme)` is the **shared** model from the solo Pageant — SECURITY DEFINER STABLE, SELECTs the caller's own `active_*_id` slot columns (per `SLOT_COLUMN`: `active_hat_id`, `active_glasses_id`, `active_mask_id`, `active_aura_id`, `active_held_id`, `active_background_id` — verified `constants/slots.ts` lines 32-39), **excludes the neck slot** (`scarf/cape/necklace` are in `HIDDEN_CATEGORIES`, `constants/hats.ts` line 220). On-theme axis at full weight + 0.5 off-theme; mild rarity potency (1.0..1.6 from `hats.rarity`); +15% coherence if 3+ scored slots share the on-theme axis; diminishing cap `round(120*(1-exp(-raw/120)))` as the anti-whale lever.
- **Per-capita win metric:** `pen_score = AVG(style_score) * participation_factor`, where `participation_factor = 0.5 + 0.5 * LEAST(1, entrants / eligible)`. Pure AVG lets a 1-entrant pen spike on a single godroll; the blend lets a small passionate pen beat a big lazy one without auto-winning on one look. **"Active member" = one row in `showdown_entries` today**, so dormant faction sign-ups never dilute the denominator. `is_test` profiles excluded from numerator AND denominator. Keep `avg / sqrt(N)` in the back pocket if tiny pens spike in playtest.
- **Win condition + tiebreak:** higher `pen_score` wins the day. Tiebreak chain: `pen_score DESC, entrants DESC, AVG(style_score) DESC`; on a true dead-heat, BOTH factions are marked winners for the day (rare shared victory) rather than coin-flip — every entrant on both sides claims the Ribbon + grants.
- **Caps / cooldowns:** one entry per player per UTC day, enforced by the `PRIMARY KEY (contest_date, user_id)` — re-entry is an `ON CONFLICT DO UPDATE` of your look (you may re-dress and re-lock until the day closes; you cannot stack entries). Effort-ladder grants are PK-idempotent per band (`PRIMARY KEY (user_id, band)`), so each band pays exactly once for life.
- **Tickle bands (the only mint):** winning-faction entrants get a bounded `grant_tickles` band; the placement-independent effort ladder pays `bronze 5 / silver 15 / gold 30` once each by lifetime entry count. A perfect run is well under one tickle bank — a rounding error vs the home loop's daily mint.
- **Edge cases:** (a) **empty contest** (zero entries one side) — the populated pen wins by default *only if it meets a participation floor* (`entrants >= 1` AND `participation_factor` computed against eligible); if both empty, no winner, day resolves with `winning_faction = null`, no grants, dispatch suppressed. (b) **late entry** — `showdown_days.status = 'open'` gate + the date PK; once `resolved`, `enter_showdown` returns `already_resolved` with no write. (c) **lazy double-resolve** — `resolve_showdown_day()` takes `FOR UPDATE SKIP LOCKED` on the day row (clone `resolve_expired_drives`, `20260583000000` line 21) and no-ops if already `resolved`. (d) **faction not chosen** — `enter_showdown` returns `no_faction`, prompting the lock-once picker first.

## Schema sketch
Migration prefix MUST sort after `20260623000000` (i.e. `>= 20260624000000`); same-prefix files collide on the `schema_migrations.version` PK. The faction column + style model land in their own earlier migrations (the prereqs); this is the thin recombination layer on top.

```sql
CREATE TABLE public.showdown_days (
  contest_date date PRIMARY KEY,
  theme text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  winning_faction text,                          -- null + resolved = no winner / both empty
  resolved_at timestamptz);

CREATE TABLE public.showdown_entries (           -- one entry/day = the cooldown
  contest_date date NOT NULL REFERENCES public.showdown_days(contest_date),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  faction text NOT NULL,
  style_score int NOT NULL,
  placed_in_winning_faction boolean NOT NULL DEFAULT false,
  entered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (contest_date, user_id));

CREATE TABLE public.showdown_ladder_claims (     -- placement-independent effort ladder
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  band text NOT NULL CHECK (band IN ('bronze','silver','gold')),
  tickles_paid int NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, band));                  -- idempotent: each band pays once for life
```

RPCs (grounded in TTP's real patterns):
- `showdown_theme(p_date date) -> text` — STABLE SQL helper; clones the `daily_shop()` `abs(hashtext(...))` date-seed. Clients agree without a cron.
- `enter_showdown() -> jsonb` — SECURITY DEFINER; reads caller's own `active_*_id` slots, calls `style_score(auth.uid(), theme)`, lazily inserts today's `showdown_days` row if missing, `INSERT INTO showdown_entries … ON CONFLICT (contest_date,user_id) DO UPDATE SET style_score=…`; then advances the effort ladder by lifetime-entry band (`INSERT INTO showdown_ladder_claims … ON CONFLICT DO NOTHING`, paying via `grant_tickles` only on first crossing). GRANT authenticated. Clones the `choose_allegiance` lock-skeleton + the bury_truffle idempotent-insert idiom.
- `showdown_standings(p_date date) -> table(faction text, entrants int, avg_style numeric, pen_score numeric, my_score int)` — STABLE read; two-sided per-faction aggregate via a `UNION ALL` / `GROUP BY` shaped near-verbatim on `alignment_leaderboard()` (`20260525000000` lines 10-48). Returns the AVERAGE + participation, never a SUM bar.
- `resolve_showdown_day(p_date date DEFAULT (now() AT TIME ZONE 'UTC')::date - 1) -> jsonb` — SECURITY DEFINER, **NOT** granted to authenticated (service-role/cron + a lazy fallback path); `FOR UPDATE SKIP LOCKED` on the day row; computes `pen_score` per faction, sets `winning_faction`, flips `placed_in_winning_faction`, pays winners via `grant_tickles` + `grant_season_xp` (verified RPC at `20260613000000` line 14), grants the dated Ribbon via `user_hats … ON CONFLICT DO NOTHING` (cost 0), and **INLINEs `INSERT INTO public.system_announcements`** (NEVER `send_system_announcement()` — admin-gated, silently rolls back; verified `20260618000000` / `20260619000000`). Optionally chains a `shift_alignment`-style Tide bonus to the winning side, wrapped in its own `BEGIN/EXCEPTION` so a Schism-Front bug can't roll back the verdict.
- **Cron (optional polish):** `cron.schedule('showdown-night','15 0 * * *', $$SELECT public.resolve_showdown_day()$$)` — clones the verified `judgement-day-season-1` schedule (`20260579000000` line 19). Lazy fallback from `showdown_standings()` means the contest resolves even with zero standing cron.

**Display-debt fix:** Showdown's first `grant_tickles` win can push a player over their tickle cap. If the Oracle/Riddle/Mud-Off hasn't already shipped the `GREATEST(...)` fix, bundle it here: change `home_stats` and `admin_tickle_overview` balance calc from `LEAST(cap, item_count+regen)` to `GREATEST(item_count, LEAST(cap, item_count+regen))` (the shape already live in `tickle_balance`/`tickle_info`, `20260580000000` lines 39-43). `grant_tickles(uid,n)` settles-then-adds without clamping; overflow banks into `tickles_wasted_total` (verified `20260580000000` line 269).

## Economy
- **Faucet (bounded):** the only minted currency is tickles, via `grant_tickles` only. Two faucets — the placement-independent effort ladder (`5/15/30`, once per band per lifetime) and a daily winners' band — both well under one bank's worth per day. It pays down the `GREATEST(...)` display-debt and is a rounding error vs the home tickling loop.
- **Sink:** v1 entry is free (turnout is the whole game). A snout **grooming fee** is the natural v2 sink — `counter` debited via the bury_truffle atomic idiom (`UPDATE profiles SET counter = counter - fee WHERE id = caller AND counter >= fee RETURNING counter`, `20260594000000` lines 28-36) — and **Pig Pick'em** over the outcome is a deflationary pari-mutuel `counter -> counter` transfer.
- **Cosmetic:** a dated, non-purchasable **Ribbon** via `user_hats … ON CONFLICT DO NOTHING` at cost 0; trophy-wall for MVP. The v3 fork promotes it to a worn slot that itself carries `style_*` tags, feeding future scores (a virtuous closet loop).
- **Why it can't inflate:** snouts are NEVER minted here — they move only as `counter -> counter` transfers (Pick'em pari-mutuel) or burn (grooming fee). Tickles are capped, over-cap-safe, and waste into `tickles_wasted_total`. Cosmetics are zero-cost and unpurchasable. The closed economy stays closed.

## Anti-abuse / cheat model
- **Server re-read = look-spoofing is impossible (the load-bearing one).** The equip path is a raw client `UPDATE` gated only by RLS, so a client-supplied score can never be trusted. `enter_showdown` reads the caller's own `active_*_id` columns server-side and computes `style_score` inside the SECURITY DEFINER RPC. This kills the only style-injection attack at the schema level.
- **Per-capita dilution defeats alt armies (cheat tier: account farming).** Because the metric is an AVERAGE, every alt that scores below the pen average *drags it down*. Padding only helps if each alt exceeds the faction average — which costs real closet-building per alt and is economically self-limiting (proven by the Mud-Off sim's 4a/4b alt-padding scenarios).
- **No peer voting = zero brigade surface (cheat tier: collusion / vote-gaming).** Showdown deliberately omits the Pageant's vote half. There is no social ranking input to brigade, no friend-bloc to weaponize, no Sybil vote farm. The hybrid dodges both hard problems by construction.
- **Diminishing `exp()` cap** bounds any single godroll look, so a whale's legendary stack can't single-handedly carry a pen.
- **One entry/day** (the PK) prevents stacking; `is_test` excluded both sides; `participation_factor` blunts the 1-entrant spike; lock-once faction membership prevents day-of side-hopping to the smaller pen.
- **Late/replay resistance:** `status='open'` gate + `FOR UPDATE SKIP LOCKED` idempotent resolve; double-claims of the ladder hit the band PK.

## Feel
- **BELONGING** — your good taste lifts your *pen*, not just you; the two factions become teams with a shared visible daily goal. The cozy guardrail holds because there is no peer voting and no PvP targeting — it is a strut, not a fight.
- **EARNED MASTERY** — understanding the theme + coherence bonus + rarity potency is a learnable skill; a clever closet beats a fat wallet.
- **PERSISTENT-WORLD FOMO** — the nightly verdict resolves whether you logged in or not ("the catwalk happened overnight"), and it feeds the season-long Tide.
- **EMERGENT DRAMA** — knife-edge per-capita finishes ("Valleyfolk edged it by 0.3 Polish") become retellable Sounder stories.
- **Cozy-tone guardrail copy:** loss is never a punishment — *"{Valleyfolk} edged the catwalk today, but your strut still earned you {tickles}."*

## How it composes
- **Schism Front meta-frame:** Showdown is one of the short modes the Front gives meaning to. Per §6 of the long-term synthesis, "winning a daily cosmetic contest injects a one-time Tide bonus to the winner's alignment side via a `shift_alignment`-style accumulation." The catwalk win is a *front in the war* — `resolve_showdown_day()` chains a guarded `UPDATE world_tide` for the winning faction, so a daily strut tilts the season-ending Golden Age / Reckoning fate.
- **Shared faction column with Mud-Off:** Showdown inherits the exact two factions Mud-Off ships (Hilltoppers/Valleyfolk) and the same `choose_allegiance`-cloned lock-once picker. Mud-Off is the *grind* front (per-capita muck); Showdown is the *taste* front (per-capita style) — two contests on one faction identity.
- **Shared scoring model with the solo Pageant:** Showdown is "zero new scoring code" — it reuses `style_score()`, `public_pig_look()`, the `style_*` tags, and the date-seeded theme already validated by the solo Pageant. Building the Pageant first pays the ~85-90-item tagging tax once.
- **Feeds Pig Pick'em (v2):** a deflationary pari-mutuel sink lets non-entrants bet on which pen takes the catwalk — extending the audience without adding a brigade surface.

## MVP
Both prereqs land first (faction column + lock-once picker; style model validated by the solo Pageant). Then the smallest shippable Showdown seed is **one migration + one component**:
- **One migration** (`>= 20260624000000`): the 3 tables (`showdown_days`, `showdown_entries`, `showdown_ladder_claims`) + `showdown_theme()` + `enter_showdown()` + `showdown_standings()` (2-faction `UNION ALL`) + `resolve_showdown_day()` with a lazy fallback (no standing cron required) + bounded `grant_tickles` bands + the dated Ribbon via `user_hats … ON CONFLICT DO NOTHING` + INLINE `system_announcements` + (if not already paid) the `GREATEST(...)` display-debt fix.
- **One component:** a `ShowdownCard` on the Barn showing today's theme, an **Enter** button, the personal score, and — the named #1 UI risk — the **Pen Polish AVERAGE gauge, never a shared SUM bar** (a loafer must not look like dead weight). Copy: *"Every pen is judged on its average look, not its size. A small tidy pen can out-style a big messy one — turnout beats headcount."*

## Risks & open questions
- **The "average not sum" explanation is the named #1 risk.** Per-capita is harder to read than a total; the UI must render the average as a Pen Polish gauge + the personal score separately and never show a SUM bar. If playtesters still read it as "my contribution is invisible," the fallback is a per-entrant "you lifted the pen +X" readout next to the global gauge.
- **Hard dependency on two unbuilt prereqs.** `grep` confirms `profiles.faction`, Hilltoppers/Valleyfolk, and `hats.style_*` live ONLY in the exploration doc — no migration. Ship Showdown before both and it is silently an XL.
- **Tiny-pen spike.** `participation_factor` may not fully tame a 1-2 entrant pen riding one godroll; watch the first settlements and have `avg / sqrt(N)` ready as a drop-in denominator swap.
- **Daily cadence vs the Front's anti-daily-FOMO stance.** The long-term doc warns daily blessings + curses + bounties already approach a chore-stack; a daily Showdown adds another optional daily appointment. Mitigate by keeping entry purely optional (your effort ladder carries across days) and letting the *weekly Schism Tally* hold the real stakes.
- **Solo-dev content cadence.** The Ribbon is a dated recolor + year-stamped title — author once, restamp annually (never a per-season authored treadmill). The theme rotation is fixed across the 5 axes (no per-day authoring). Recurring labor is near zero, but a season-champion pen cosmetic (v2) is the one place authored art creeps in — keep it to a recolor.
- **Open forks (carried from the pinned doc):** (1) Ribbon as a real worn slot vs trophy-wall-only — *lean trophy-wall MVP, worn slot v3*; (2) whether Showdown's Tide bonus should be flat or scale with margin of victory; (3) entry-fee sink timing (free v1 → grooming fee + Pick'em v2).