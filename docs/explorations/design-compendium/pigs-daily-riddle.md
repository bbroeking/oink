# Pig's Daily Riddle (Slopword)
> One hidden farm word a day, six tries, green-amber-grey — solve it, brag the emoji-snout grid to your Sounder, and let the barn tell you how clever your snout is.

**Tier:** Core mode · **Effort:** M · **Mode:** async-authoritative daily puzzle (shared date-seed, server owns the answer) · **Depends on:** nothing — standalone. Pairs naturally with Snout Oracle (ships the same entry/resolve/idempotent-claim spine) but does not require it.

## The fantasy
You are the clever pig who cracks the day's riddle before the rest of the Sounder. Every morning the barn whispers one secret word, and you have six muddy guesses to root it out. Solving in two feels like a tiny triumph you *have* to show off; the spoiler-safe emoji-snout grid is the brag, and watching a friend's grid trickle into the feed is the reason you come back tomorrow. It is the cozy daily ritual — small, repeatable, social, and just hard enough to feel earned.

## Player loop
**Daily action (the ritual):**
1. Open the Riddle card on the Barn (or a Riddle tab). It shows a fresh 6x5 board, today's UTC date, and your remaining-tries state restored from the server if you started earlier.
2. (Optional entry cost.) MVP is **free** — entry is the hook, not a sink. A tiny snout fee (`profiles.counter`, burned via the `bury_truffle` debit idiom) is a v2 toggle, not the launch state.
3. Type a 5-letter guess from a client-packaged allow-list (instant UX validation, no round-trip to reject typos). Submit.
4. `submit_daily_guess(p_guess)` runs server-side, recomputes the color pattern against the secret, persists the guess into your attempt row, increments a **server-side guess counter**, and returns **only** the color pattern (green/amber/grey) — never the answer, never the remaining letters.
5. Repeat up to 6 guesses or until solved. On solve-or-exhaust, the client calls (or the last `submit` auto-triggers) `finalize_daily_puzzle()`, which grants tickles as a pure function of the server-counted guesses, writes a spoiler-safe emoji-snout `share_grid`, and INLINEs a personal `riddle_result` announcement.
6. Tap **Share to the Sounder** — the emoji-snout grid drops into the feed (rides `system_announcements`, zero new feed infra). Friends see "Rosie solved today's riddle in 3 🟩🟩🟨..." with squares only, no letters.

**Nesting into bigger stakes:** UTC rollover resets the puzzle (one per day, enforced by the PK). A visible streak (\"days riddled\") and a friends-only fewest-guesses-today micro-leaderboard turn the one-off into a habit. Seasonally, riddle participation can feed `grant_season_xp` (+5 first-of-day, mirroring the social-action XP shipped in `20260613000000`) so the daily ritual quietly advances the Season 1 / Judgement Day spine without being a separate grind.

## Mechanics

**The board.** Wordle-faithful: a hidden 5-letter lowercase word, up to **6 guesses**, three feedback colors per tile.
- 🟩 GREEN = right letter, right position.
- 🟨 AMBER = right letter, wrong position (with correct duplicate-letter accounting — see edge cases).
- ⬜ GREY = letter not in the word.

**The secret (server-owned, never sent).** The word is derived inside a SECURITY DEFINER helper from the date-seed, exactly the `daily_shop()` idiom verified at `20260584000000` line 24 (`abs(hashtext(h.id || current_date::text))`):
```
word_of_day := (
  SELECT word FROM puzzle_words
  WHERE enabled
  ORDER BY abs(hashtext(word || (SELECT salt FROM puzzle_config WHERE id=1) || current_date::text))
  LIMIT 1)
```
A rotating `salt` in `puzzle_config` lets you void a leaked day by bumping the salt (the whole horizon reshuffles). The secret lives only inside `riddle_secret()` (SECURITY DEFINER, **not granted to clients**, same posture as `grant_tickles`) — `submit_daily_guess` and `finalize_daily_puzzle` call it internally and return only colors.

**Scoring feedback (server is authority).** The client may score optimistically for snappy UX, but `submit_daily_guess` RECOMPUTES the pattern against the secret server-side and returns the authoritative array of 5 enum values. The client renders what the server returns; any client tampering is overwritten on the next authoritative response, and the answer never crosses the wire.

**Payout = pure function of server-counted guesses** (via `grant_tickles` — **this is where the GREATEST over-cap display-debt fix lands**, since it is the first real over-cap faucet to ship):

| Guesses to solve | Tickles |
|---|---|
| 1 | 20 |
| 2 | 16 |
| 3 | 12 |
| 4 | 8 |
| 5 | 6 |
| 6 | 4 |
| fail (6 used, unsolved) | 0 (MVP) — small \"pity\" of 1-2 a v2 knob |

Max **20 tickles per player per UTC day** — deliberately **under one non-VIP bank (25)**, so a perfect day grants less than a single bank's worth and cannot flood the closed economy. Bands and constants live in the RPC body (`RIDDLE_BANDS = {1:20,2:16,3:12,4:8,5:6,6:4}`).

**Cooldown / one-per-day.** `PRIMARY KEY (player_id, puzzle_date)` on `daily_riddle_attempts` where `puzzle_date = (now() AT TIME ZONE 'UTC')::date` **IS** the 24h gate — the same per-period-PK idiom as `truffle_digs` and `oracle_picks`. UTC rollover is the reset; no cron needed to \"open\" a puzzle (all clients agree on the seed). A second start on the same day re-reads the existing row (resume), never a fresh board.

**Win condition.** Solving = all 5 GREEN within 6 guesses. There is no \"lose state\" beyond earning 0 tickles and a grey-heavy grid; the cozy framing keeps a miss gentle (\"the barn kept this one to itself — try again tomorrow\").

**Edge cases (all server-resolved):**
- **Duplicate letters.** Standard Wordle two-pass: first pass marks GREENs and consumes those letter-counts from the secret; second pass marks AMBER only while an unconsumed instance of that letter remains, else GREY. Implemented as a deterministic loop inside the scoring helper so it can never drift from client guesses.
- **Invalid guess.** Server rejects anything not 5 lowercase a-z or not in the `puzzle_words`-class dictionary → returns `{ok:false, error:'not_a_word'}` and does **not** consume a guess or increment the counter. (Client allow-list catches most before submit.)
- **Replay / double-submit.** Guesses append to the attempt row; `guess_count` is server-incremented; a re-submit of an already-finalized day returns the stored result idempotently (nullable `finalized_at` is the latch, mirroring `claimed_at` ledgers).
- **Mid-day device switch.** State is server-side (`guesses text[]`, `guess_count`, `solved`), so the board restores on any device.
- **Clock spoofing.** `puzzle_date` is computed server-side from `now()`; a client cannot fast-forward to a future day or replay yesterday for a fresh payout.
- **Leaked answer.** Bump `puzzle_config.salt`; the seed reshuffles the whole list and the leaked day is void going forward.

## Schema sketch
All filenames must sort **after** `20260623000000` (i.e. `>= 20260624000000`) to avoid a `schema_migrations.version` PK collision.

```sql
-- migration 20260624000000_pigs_daily_riddle.sql  (single migration ships MVP)

CREATE TABLE public.puzzle_config (
  id   int  PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  salt text NOT NULL DEFAULT 'slopword-v1');
INSERT INTO public.puzzle_config (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE public.puzzle_words (              -- ~180-200 cozy-farm-flavored 5-letter words
  word    text PRIMARY KEY CHECK (char_length(word) = 5 AND word = lower(word)),
  enabled boolean NOT NULL DEFAULT true);
-- Pig flavor lives in the UI, NOT forced into answers: a general 5-letter list
-- lightly weighted to cozy/farm words that ARE real (barns, acorn, muddy, graze,
-- snout, oinks). ~6mo no-repeat horizon at 1/day.

CREATE TABLE public.daily_riddle_attempts (
  player_id      uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  puzzle_date    date    NOT NULL,
  guesses        text[]  NOT NULL DEFAULT '{}',     -- server-appended, authoritative
  guess_count    int     NOT NULL DEFAULT 0,        -- THE payout input
  solved         boolean NOT NULL DEFAULT false,
  finalized_at   timestamptz,                       -- nullable latch (claimed_at idiom)
  reward_tickles int     NOT NULL DEFAULT 0,
  share_grid     text,                              -- spoiler-safe emoji grid, server-built
  started_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, puzzle_date));            -- THE 24h cooldown

ALTER TABLE public.daily_riddle_attempts ENABLE ROW LEVEL SECURITY;
-- RLS: a player reads/writes only their own row. Friends never read raw rows; the
-- shared brag flows through system_announcements, so no cross-player RLS here.
CREATE POLICY riddle_own ON public.daily_riddle_attempts
  USING (player_id = auth.uid()) WITH CHECK (player_id = auth.uid());
```

**RPC signatures** (all `SECURITY DEFINER SET search_path TO 'public'`):
- `riddle_secret(p_date date) -> text` — STABLE; the date-seeded word lookup above. **NOT granted to clients** (server-side reward plumbing, exactly the `grant_tickles` posture). Clones the `daily_shop()` `abs(hashtext(... || current_date::text))` seed.
- `start_daily_puzzle() -> jsonb` — upserts today's attempt row (`INSERT ... ON CONFLICT DO NOTHING`), returns current board state (guesses + their recomputed color patterns + `solved` + remaining). Resume-safe. (v2: debits a snout fee here via the `bury_truffle` atomic `UPDATE profiles SET counter = counter - cost WHERE id = caller AND counter >= cost RETURNING counter`, catching `unique_violation` first.)
- `submit_daily_guess(p_guess text) -> jsonb` — validates word; recomputes the 5-color pattern against `riddle_secret(today)`; appends to `guesses`; increments `guess_count`; sets `solved` if all-green; returns `{ok, pattern int[5], solved, guess_count, remaining}`. **Never returns the secret.** Rejects on >6 / already-finalized / invalid word.
- `finalize_daily_puzzle() -> jsonb` — idempotent on `finalized_at`; computes `reward_tickles = RIDDLE_BANDS[guess_count]` (0 if unsolved); calls `grant_tickles(auth.uid(), reward_tickles)`; builds `share_grid` (server-side emoji string from stored patterns); INLINEs `INSERT INTO public.system_announcements (user_id, kind, title, body, data)` with `kind='riddle_result'`; optionally `grant_season_xp(auth.uid(), 5)` first-of-day. Returns `{tickles, solved, guess_count, share_grid}`.
- `riddle_friends_today() -> TABLE(username text, guess_count int, solved boolean)` — read-only friends-scoped micro-leaderboard, gated by `friend_ids()` / `are_friends()`. Returns guess counts only, never letters. (v2 polish.)

**Cloned primitives:** `daily_shop()` date-seed (`20260584000000`); per-period-PK ledger + nullable-latch idempotency (`truffle_digs` / `oracle_picks`); `grant_tickles` over-cap faucet + the GREATEST display-debt fix (`20260580000000`); INLINE `system_announcements` notify (`20260619000000`); optional `bury_truffle` atomic debit for the v2 fee (`20260594000000`); `grant_season_xp` (`20260613000000`); `friend_ids()` / `are_friends()` for the leaderboard.

**The GREATEST display-debt fix (carried in THIS migration — first over-cap faucet):** per the `20260580000000` header (lines 19-21), the inline-recompute display RPCs `home_stats` and `admin_tickle_overview` still clamp with `LEAST(cap, item_count + regen)` and must be changed to `GREATEST(item_count, LEAST(cap, item_count + regen))` — the exact shape already live in `tickle_balance` / `tickle_info` / `grant_tickles`. Bundle that change into the riddle migration so an over-cap riddle winner sees their real balance instead of a clamped one. All later faucets inherit the corrected display.

## Economy
- **Faucet (bounded):** `grant_tickles` pays the 4-20 band, hard-capped at **20 tickles/player/UTC-day** — strictly under one non-VIP bank (25). The over-cap-safe grant settles first, then adds without clamping, banking any cap overflow into `tickles_wasted_total` (so it never silently vanishes and never inflates spendable balance).
- **Sink (v2, optional):** a tiny snout entry fee burned (`profiles.counter` debit, not transferred) is the deflationary counterweight. MVP ships free because the ritual hook matters more than the sink at launch.
- **Cosmetic rewards:** none minted as currency. A \"Riddle streak\" title or a dated trophy-wall badge (granted via `user_hats ON CONFLICT DO NOTHING`, cost 0) is the non-inflationary flex — a worn cosmetic, not snouts.
- **Why it can't inflate:** snouts are never minted (the only snout movement would be a v2 *burn*); the only mint is tickles, bounded to <1 bank/day, and over-cap overflow is wasted, not banked as spendable. The closed `counter -> counter` economy is untouched by the Riddle entirely in MVP.

## Anti-abuse / cheat model
**Cheat tier: (a) server-owns-the-answer — cheat-proof by construction** (with a (b) shared-seed substrate underneath; the answer is never derivable client-side).
- **Modded board / memory edit (the only real attack):** dies to server recomputation. `submit_daily_guess` recomputes the color pattern against the secret and returns the authoritative array; a client showing fake greens earns nothing because the *server's* `guess_count` and `solved` are what `finalize_daily_puzzle` pays on. The answer is never in any response, so a player cannot pre-solve in one guess.
- **Replay / multi-claim:** `PK(player_id, puzzle_date)` + nullable `finalized_at` latch make payout exactly-once per day per player. Clock spoofing fails because `puzzle_date` is computed from server `now()`.
- **Dictionary brute-force:** capped at 6 guesses; invalid words are rejected without consuming a guess or incrementing the counter, so you cannot probe the dictionary for free.
- **Answer leak / collusion:** everyone shares the same daily word (it is the *point* — the social brag depends on a shared board), so \"collusion\" just spoils the fun for the colluder; payout is per-player and bounded. A genuinely leaked answer is voided forward by bumping `puzzle_config.salt`.
- **Farming:** bounded to 20 tickles/day; alts each need their own grind for a sub-bank payout — economically inert, not worth automating.
- **Share-grid spoofing:** the `share_grid` is built server-side from stored patterns inside `finalize_daily_puzzle`, so a feed brag cannot claim a better solve than the server recorded.

## Feel
- **Quirky charm / cozy ritual (primary):** one small word a day, pig-flavored copy, a gentle miss state. Hits the cozy-tone guardrail squarely — no timers, no streaks-you-lose-by-the-hour, no punishment, just a daily nibble.
- **Earned mastery:** solving in 2 or 3 is a real, legible skill flex; the guess-count band makes mastery *visible* and *payable*.
- **Belonging / hangout:** the emoji-snout grid in the Sounder feed is asynchronous bragging — the exact social hook that made the genre viral — scoped to friends so it feels like a barn full of pals comparing grids, not a global anonymous ladder.
- **Slow time:** the UTC rollover paces it to once a day; you cannot binge it, which is the cozy anti-pattern-avoidance.
- **Persistent-world FOMO (gentle):** miss a day and your \"days riddled\" streak lapses and your grid is absent from the feed — a soft pull back, never a harsh loss.
- **Discovery-as-content:** the cozy-farm wordlist means some answers are little barn vocabulary discoveries; pig flavor stays in the UI chrome (Rosie's reactions, copy) and is never forced into the answer, keeping the words fair.

## How it composes
- **Schism Front / Mud-Off meta-frame:** Riddle participation can quietly feed faction muck or season XP — a daily on-ramp that nudges players toward the team meta without being a separate obligation. The fewest-guesses leaderboard could be cut by faction in a v2 to give the Schism a daily skirmish surface.
- **Snout Oracle:** shares the exact spine (date-seed, lazy/idempotent claim, INLINE announce, bounded payout). Shipping the Riddle right after the Oracle means the second build is almost entirely UI — the RPC patterns are identical. The pinned build order (`docs/explorations/2026-06-08-pinned-design-teams-pageant-minigames.md` §5 and the miniclip shortlist #2) places Slopword as the **v1.1 viral hook that pays the GREATEST display-debt** — this spec honors that exactly.
- **Pageant / Showdown:** the Riddle's date-seeded daily-content engine and `system_announcements` brag pattern are the same primitives those modes reuse; the Riddle is the cheapest, lowest-risk place to prove that daily-ritual + feed-brag loop before the heavier style-scoring modes land.

## MVP
**One migration (`20260624000000_pigs_daily_riddle.sql`), three RPCs, one component.**
- Tables: `puzzle_config`, `puzzle_words` (seed ~180-200 words in the same migration), `daily_riddle_attempts`.
- RPCs: `riddle_secret` (internal, ungranted), `submit_daily_guess` (recompute + return colors), `finalize_daily_puzzle` (band grant via `grant_tickles` + `share_grid` + INLINE `riddle_result` announcement). `start_daily_puzzle` can be folded into the first `submit` (lazy row create) to hit exactly three granted RPCs if you want the absolute minimum.
- **Bundle the GREATEST display-debt fix** to `home_stats` and `admin_tickle_overview` in this same migration (first over-cap faucet).
- One `RiddleCard` / Riddle screen: 6x5 board, on-screen keyboard with color state, share button that posts the server-built grid. Free entry, no leaderboard, no cosmetic — pure daily ritual + feed brag.

**Cut from MVP (v2+):** snout entry fee (sink), pity payout for fails, `riddle_friends_today()` leaderboard, dated trophy/title cosmetic, paid retries (a clean future sink), faction-split leaderboard, season-XP wiring.

## Risks & open questions
- **Wordlist authoring is the real solo-dev cost.** ~180-200 vetted, real, mild-difficulty 5-letter words that are fair (no proper nouns, no obscurities) is hand-curation work — the cozy-farm flavoring must not tilt the list toward unguessable barn jargon. Budget an afternoon to draft + spell-check + difficulty-sanity the list.
- **Client allow-list vs server dictionary.** MVP can validate guesses only against `puzzle_words` (the answer set), which feels restrictive (you can only guess potential answers). A larger client-packaged *allowed-guesses* list (Wordle ships ~13k) is better UX but more payload.
- **Difficulty calibration.** 1-in-6 solve rates and payout bands are guesses until live data; the bands are RPC constants and trivially tunable, but watch the first week's solve distribution.
- **No-cron correctness.** UTC rollover is the reset and there is no cron, which is correct, but the *displayed* \"resets in HH:MM\" countdown must compute from UTC midnight (clone `shop_resets_in_seconds()`), or players in some timezones think the puzzle is stuck.
- **Feed spam.** If everyone shares daily, the Sounder feed could flood; dedupe to one riddle announcement per player per day.
- **Streak scope creep.** A \"days riddled\" streak is tempting but risks colliding with the existing Devotion/Garden streak fiction.

**Open questions:**
1. Wordlist: LLM-draft + hand-reject the unfair ones, or fully hand-pick? (Lean: LLM draft, hand-reject.)
2. Guess validation: answer-set-only for MVP, or pay the payload cost for a wider allowed-guesses dictionary now? (Lean: answer-set-only MVP, wider dictionary v2.)
3. Sharing: auto-share on solve, or share only on explicit tap? (Lean: explicit tap.)
4. Riddle streak: a separate cozy counter, or fold into the existing Garden/Devotion streak? (Lean: separate lightweight counter, no Garden coupling.)
5. Entry: keep free indefinitely, or introduce the snout sink in v2 once the ritual is sticky? (Lean: free MVP, evaluate the sink after retention data.)