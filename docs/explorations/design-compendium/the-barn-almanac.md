# The Barn Almanac
> A weekly hog-mystery, told page by page by Old Saffron — and the whole sounder writes the next page just by being generous or greedy.

**Tier:** Long-term · **Effort:** L (writing-bound, not code-bound) · **Mode:** async, narrator-driven serialized prose layered on a shared world-state gauge · **Depends on:** **The Schism Front** (the `world_tide` singleton + nightly/weekly settle crons). The Almanac is the *narrative skin* on that gauge, not a separate build. If the Front isn't shipped, the Almanac's MVP carries the same two-line accumulation hook into `shift_alignment` as its own seed.

## The fantasy
You are a reader of a living book that the whole barn is writing without meaning to. Every Sunday Old Saffron — the oldest, saltiest sow in the pasture — adds a chapter to *The Barn Almanac*, and which version of the chapter you get depends on whether the sounder has been drifting Generous or Greedy on the same gauge that decides Judgement Day. You don't *vote* on the story; you *are* the story, and the mystery of what's haunting the barn unspools a little further each week you keep tickling. The feeling is curling up with a serialized mystery whose ending you're collectively, slowly, deciding.

## Player loop
- **Daily (unchanged, optional):** the player tickles, blesses, curses, trades, visits — every act already calls `shift_alignment` and (under the Front) bumps `world_tide`. Nothing new becomes daily-mandatory. The Almanac just gives that act a *story reason*: "your blessing nudged the Tide toward the Givers, and Old Saffron is watching."
- **Mid-week peek:** the player opens the **Almanac** surface (a book on the Barn Exterior shelf) and re-reads the current open chapter. The chapter's *prose* is fixed for the week, but its **world-state-branched storylets** render the version matching the current Tide band, so a reader who checks Wednesday vs Saturday may catch the page reading differently as the community drifts.
- **Weekly (the heartbeat):** Sunday's `settle_schism_week()` settle (already in the Front) also resolves the Almanac: it locks in which branch of this week's chapter became canon, writes Old Saffron's hand-authored dispatch as the chapter's epigraph, and INLINEs a personal "Old Saffron turned a page" announcement. **A new chapter opens** if either (a) enough real time has passed (one chapter/week) OR (b) the community crossed a gauge threshold that unlocks a chapter early.
- **Seasonal (the climax):** at Judgement Day (`finalize_season`), the mystery's finite arc resolves into one of the world-fates. The *ending* the season earned is recorded permanently and **becomes the opening letter of next season's Almanac** — cross-season legacy. The player returns next season to find Old Saffron's first page references the world they left behind.

## Mechanics
**The gauge is shared, not new.** The Almanac reads the exact same `world_tide` singleton the Schism Front moves. Tide % = the net of all `shift_alignment` deltas this season, mapped onto a Generous◄──►Greedy bar (mirrors the existing `alignment_label(score int)` band logic, but at the community level). No new axis, no new faction column.

**Chapters open by time AND by threshold (whichever first):**
- **Time gate:** one chapter unlocks per real week, on the Sunday `settle_schism_week()` tick. A season of ~13 weeks (the Season-1 window: start → `SEASON_1_END` 2026-07-15) = ~13 authored chapters.
- **Threshold gate:** each chapter row carries an optional `unlock_tide int` (signed, like the `±25` schism crossing in `20260521020000_schism.sql`). If the community Tide crosses that threshold *before* the time gate, the chapter opens early and the *next* Sunday's time-gated chapter is skipped (the book stays finite — thresholds pull chapters *forward*, never mint extra ones). This produces the "the community read ahead" drama.

**World-state-branched storylets (one authored week reads 2–3 ways):**
- Each chapter has 1–3 **branches**, keyed to Tide bands at settle time: `generous` (Tide ≥ +T), `greedy` (Tide ≤ −T), `contested` (between). The author writes one chapter with 2–3 short branch variants of the *pivotal* storylet (not the whole chapter — only the load-bearing paragraph forks). Threshold `T` reuses the Front's territory threshold convention.
- **Canon lock at settle:** when `settle_schism_week()` fires, the chapter's branch is chosen by the *settled* Tide band and frozen into `almanac_chapters.canon_branch`. Before settle, the surface renders the *live* branch (so it can visibly shift); after settle it renders canon. This is the discovery-as-content seam: the world-state literally rewrites which version is true.

**Caps / cooldowns / edge cases:**
- No per-player cooldown — reading is free and unlimited; the *content* is rate-limited by the weekly authoring cadence.
- **Missing weeks never punish.** The Almanac is a community total, not a personal streak. A player who logs in after 3 weeks away sees all opened chapters (with their settled canon branches) and one "while you were away, Old Saffron wrote 3 chapters" announcement.
- **No author content for a week → graceful degradation:** if a chapter row has no hand-written epigraph by Sunday, the settle falls back to a templated dispatch keyed to the Tide band (same ~30-template pool the Front already needs). The book never stalls.
- **Idempotency:** chapter open + canon-lock is idempotent per `(season_key, chapter_no)` via an `ON CONFLICT DO NOTHING` guard, mirroring `season_finales` and `finalize_season`'s re-run safety.

## Schema sketch
Migration prefix **≥ 20260624000000** (must sort after `20260623000000`).

```
-- Authored content, one row per chapter. The dev's weekly labor lives here.
almanac_chapters(
  season_key      text    NOT NULL,
  chapter_no      int     NOT NULL,
  title           text    NOT NULL,
  unlock_tide     int,                 -- NULL = time-gate only; else early-open threshold (cf ±25 schism crossing)
  body_generous   text,                -- branch variants of the pivotal storylet
  body_greedy     text,
  body_contested  text    NOT NULL,    -- the default/always-present branch
  epigraph        text,                -- Old Saffron's hand-written dispatch; NULL → templated fallback
  opened_at       timestamptz,         -- set when chapter unlocks (time OR threshold)
  canon_branch    text CHECK (canon_branch IN ('generous','greedy','contested')),  -- frozen at settle
  settled_at      timestamptz,
  PRIMARY KEY (season_key, chapter_no)
)

-- Cross-season legacy: last season's ending seeds next season's opening letter.
almanac_legacy(
  season_key   text PRIMARY KEY,        -- the season that JUST ended
  fate         text CHECK (fate IN ('golden_age','reckoning','knifes_edge')),  -- mirrors schism_seasons.fate
  opening_letter text NOT NULL,         -- becomes chapter 0 of the NEXT season
  recorded_at  timestamptz NOT NULL DEFAULT now()
)

-- Per-player read tracking (so "new chapter" badges + while-away counts work). No content here.
almanac_reads(
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  season_key  text NOT NULL,
  chapter_no  int  NOT NULL,
  read_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, season_key, chapter_no)
)
```

RPCs (grounded in real TTP patterns):
- `almanac_status() -> jsonb` — STABLE, SECURITY DEFINER, GRANT authenticated. Returns: current open chapters (with the branch matching live-or-canon Tide band), the live Tide % (read from `world_tide`, same source as `world_front_status()`), the caller's unread count, and the carried-forward opening letter from `almanac_legacy`. **Clones the shape of `world_front_status()` / `my_finale_result()`.**
- `mark_chapter_read(p_chapter_no int) -> jsonb` — GRANT authenticated. Upserts `almanac_reads`. **Clones `mark_finale_seen` / `mark_announcement_seen`.**
- `settle_almanac_week(p_season_key text) -> void` — SECURITY DEFINER, **NOT granted to authenticated** (called *from inside* `settle_schism_week()`, wrapped in its own BEGIN/EXCEPTION so an Almanac failure can never roll back the Front's Tide settle). Reads `world_tide`, opens the next chapter (time OR threshold), freezes `canon_branch`, and **INLINEs the system_announcements INSERT** (never `send_system_announcement` — admin-gated, would silently roll back for the cron's non-admin context).
- `seed_almanac_legacy(p_season_key text) -> void` — SECURITY DEFINER, called *from inside* `finalize_season()` (right after the Front's `settle_schism_season()`, in its own BEGIN/EXCEPTION), reading the just-recorded `schism_seasons.fate` to compose next season's `opening_letter`. **No new seasonal cron** — rides the existing `cron.schedule('judgement-day', …, finalize_season('season_1'))`.

Primitives cloned: `system_announcements` INLINE INSERT idiom (the dispatch); `season_finales`/`finalize_season` idempotency + per-season PK + `ON CONFLICT DO NOTHING`; the `daily_shop` `current_date || hashtext` seed idiom is **not** needed (chapters are authored, not procedurally drawn); the `world_tide` read shape from `world_front_status()`.

## Economy
- **Zero new mint, zero inflation surface.** The Almanac touches no currency on the write path. Reading is free; chapters are authored prose; canon-lock is a state write. It cannot inflate the closed economy because it never calls `counter` (snouts) or mints tickles on any reader-driven path.
- **Optional faucet (bounded, over-cap-safe):** a once-per-chapter "you witnessed the turning of the page" consolation can call `grant_tickles(uid, n)` with a banded **~5/10** — the *only* over-cap-safe faucet, and trivially small vs the home tickling loop. Because it's the first-class faucet, it pays down display-debt via the `GREATEST(...)` settle the bank already uses (`settle_tickles`). Strictly optional; the MVP ships with no faucet at all.
- **Cosmetic reward (ships once per season, cost 0, non-purchasable):** a dated **"Almanac Reader 2026"** title (or a recolor tied to the season's fate) granted via `INSERT … user_titles … ON CONFLICT DO NOTHING`, exactly like the finale titles in `20260526000000_finale.sql`. No tradable market, so no Neopets inflation trap.
- **Snout sink (only if wired to the Oracle):** the Almanac itself is a reputation/story layer, not an economy. Any betting on "which branch will be canon Sunday?" routes through the Front's existing pari-mutuel Oracle (counter→counter, zero-sum), not through the Almanac.

## Anti-abuse / cheat model
- **No vote, no farm.** The Almanac never reads a player-submitted choice — canon is decided purely by the *aggregate* `world_tide`, which is the sum of `shift_alignment` deltas the server already validates at its single chokepoint. There is no per-player lever to game the story directly; you can only move the gauge the way you already could (bless = +1, curse = −1, trade = ±2, capped by the existing daily ritual limits in `20260534000000_one_ritual_per_day.sql` and the blessing cap of 3 in `20260614000000_blessing_cap_three.sql`).
- **Collusion is the point, de-fanged.** A clique pushing the Tide toward "Greedy" to unlock a darker branch is *exactly* the emergent drama the design wants — and it's bounded by per-day ritual caps and the Front's redemption asymmetry (+3 climb-out / +2 fall-in), so no small clique can swing a server-scale gauge. This sits at the **lowest cheat tier** (cosmetic/narrative outcome, no currency at stake) — the worst a bad actor achieves is reading a story branch slightly sooner.
- **Read-spam is inert.** `mark_chapter_read` is idempotent per `(user_id, season_key, chapter_no)`; re-calling grants nothing. If the optional faucet is enabled, it's gated to once-per-chapter via the same PK, so it can't be milked.
- **Cron-context safety:** settle RPCs are SECURITY DEFINER and *not* granted to authenticated, so a client can't force a chapter open or re-roll canon. The INLINE announcement INSERT sidesteps the `send_system_announcement` admin gate (the documented footgun).

## Feel
Hits the `evoke-online-game-feel` lenses the Front most needed reinforced, in the cozy register:
- **Wonder** — a book that writes itself; you don't know which version of the chapter you'll get until the sounder settles.
- **Discovery-as-content** — the *primary* lens. The same authored week reads 2–3 ways; players discover that "the Tide rewrote chapter 7" and spread that as folk knowledge. The content is the players + the clock, exactly as the synthesis demands.
- **Slow Time** — one chapter a week, a finite ~13-chapter arc, an ending that seeds next season. You cannot binge it; you return to turn the page.
- **Persistent-world FOMO** — chapters opened by community thresholds happen whether you logged in or not; you come back to find the story moved.
- **Belonging** — "our barn earned the Golden-Age ending" is a collective memory.
- **Cozy guardrail:** Old Saffron's voice stays playful/mythic, never vicious (the r/place-2022 hostility trap the synthesis warns against). Even the Greedy/Reckoning branches are *spooky-cozy* — a mystery's shadow, not cruelty. Loss is a story (a dated "Survived the Reckoning's Almanac" reader title), never a punishment.

## How it composes
- **It IS the Schism Front's narrator layer.** The Front gives the world a *meter and a fate*; the Almanac gives that meter a *plot*. They share `world_tide`, the weekly `settle_schism_week()` heartbeat, and the seasonal `finalize_season()` climax. The Almanac's chapter-branch is the human-readable face of the same number the Front's tug-of-war bar shows.
- **Feeds the meta-frame, doesn't compete.** The Oracle can resolve bets on "which branch goes canon Sunday?" by reading the settled `world_tide` band — a front-resolvable resolver_key, pure snout sink. A Pageant/Showdown win that injects a one-time Tide bonus now *also* visibly tilts the week's chapter. Mud-Off-as-armies tipping the Tide tips the story. Every short mode stops being a cosmetic vending machine and becomes "a page in the barn's mystery."
- **Cross-season legacy is the unique seam:** `almanac_legacy` carries the finale's `fate` into next season's opening letter, so the Hall of Schisms (the Front's permanent ledger) and the Almanac's chapter 0 reference the same recorded history — "reset the score, never the record," told as prose.

## MVP
Smallest shippable seed — proves "the shared gauge has a plot" with one migration, one RPC, one component, and no faucet/no cosmetic/no branching-cron yet:
1. **One migration** (prefix ≥ `20260624000000`) adding `almanac_chapters` + seeding chapter 0 (the opening letter) and chapter 1 (one chapter, all three branch bodies authored, `contested` as default).
2. **`almanac_status()`** — reads the live `world_tide` % (or, pre-Front, the same two-line accumulation hook into `shift_alignment`), returns chapter 1 rendered in the branch matching the *live* Tide band. Clones `world_front_status()`.
3. **One Barn-Exterior component** — an "Almanac" book on the shelf; tapping it opens a cream-card chapter reader (reuse the WhileAway announcement card styling), epigraph at top, branch body below, a "the Tide is X% Generous" line tying it to the same bar the Front strip shows.

That alone delivers **Wonder + Discovery-as-Content**: the same chapter visibly reads differently as the community drifts, with zero new cron. **Increment 1:** chain `settle_almanac_week()` into the Front's Sunday tick (canon-lock + dispatch). **Increment 2:** add `unlock_tide` early-open thresholds + the full ~13-chapter season arc. **Increment 3:** chain `seed_almanac_legacy()` into `finalize_season()` for the cross-season opening letter + the dated reader cosmetic.

## Risks & open questions
- **The weekly-prose cadence is the real cost, and it's honest.** This is *writing-bound*, not code-bound: ~13 chapters × 2–3 branch variants of the pivotal storylet = ~30–40 short authored fragments per season, plus one Old Saffron epigraph per week. For a solo dev that's a standing weekly obligation the Front itself doesn't impose. **Mitigation:** the templated-dispatch fallback (the same ~30-template pool the Front needs) means a missed week degrades gracefully to a band-keyed auto-epigraph; only the *branch bodies* are truly hand-authored, and they can be batch-written ahead of the season.
- **Branching multiplies the labor 2–3×.** Each forked chapter is 2–3× the words. Keep branches to the *pivotal paragraph* only, not the whole chapter, or the cost compounds.
- **Threshold-pull vs time-gate interaction** can desync the finite arc if mis-implemented (thresholds must pull chapters *forward*, never mint extras). Needs the idempotent `(season_key, chapter_no)` guard to be airtight.
- **Couples to the Front.** If the Front isn't built, the Almanac must carry its own `world_tide` seed — doable, but then you're building the gauge anyway, which argues for building the Front first (per the synthesis's recommended sequence) and treating the Almanac as increment.

Open questions:
1. Commit to the authored-arc from the start, or ship the Front as pure systems first and add the Almanac as a skin later (synthesis Open Question #1)? The cadence cost says: ship the Front MVP first, layer the Almanac when there's appetite for the weekly writing.
2. Branch on the *live* Tide pre-settle (story visibly shifts mid-week) or only reveal canon at Sunday settle (cleaner, less whiplash)? Live is more wondrous but risks confusing readers who screenshot a branch that later changes.
3. How many branches per chapter — strictly the `contested` default + one alternate, or the full generous/greedy/contested trichotomy? Trichotomy is richer but ~50% more words.
4. Should the cross-season opening letter be auto-composed from `schism_seasons.fate` (cheap, templated) or hand-written each season (warmer, but one more standing obligation)?