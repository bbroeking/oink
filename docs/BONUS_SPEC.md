# Bonus System & Two-Resource Tickles — Spec

## Why this doc exists

Two changes that ship together:

1. **Tickles split into two resources** — earning tickles fills *both* a
   spendable balance (used for shop purchases) and a lifetime score (used
   for the leaderboard). Spending tickles in the shop no longer drops your
   leaderboard rank.
2. **Lucky-tickle bonus** — every day, 3 random "lucky" tickle numbers
   are rolled. There is one global counter for the whole game per day;
   when *anyone's* tickle bumps that counter onto a lucky number, that
   user wins +5 tickles. First-come-first-served. Visible on the Home
   screen.

Both stay "tickles" to the player — internally it's just a balance/lifetime
split. The bonus mechanic *also* awards earned-tickles, so winning bumps
both resources.

---

## Two-resource model

### Today

`profiles.counter`: single integer.
- `+1` on every tickle (`update_profile_and_item_count` RPC).
- `−cost` on every purchase (`buy_hat` RPC).
- Leaderboard ranks by this column.

Side effect: spending in the shop tanks your leaderboard position.
Unintended.

### After this change

| Field                   | Semantics                                                   |
|-------------------------|-------------------------------------------------------------|
| `profiles.counter`      | **Spendable balance.** +1 per tickle. −cost per purchase.  |
| `profiles.tickles_earned` | **Lifetime score.** +1 per tickle. Never decreases. Leaderboard ranks by this. |

Naming note: I'm leaving `counter` as-is rather than renaming to
`tickles_balance` because it's referenced in ~10 RPCs/screens and the
mass rename is risk for zero player-facing benefit. We can rename later
if it becomes confusing.

### Migration

```sql
-- 20260505xxxxxx_lifetime_tickles.sql
ALTER TABLE public.profiles
  ADD COLUMN tickles_earned bigint NOT NULL DEFAULT 0;

-- Backfill: the most accurate retroactive value is "counter + everything
-- they've ever spent". We don't track historical spend, so use counter
-- as a floor — every existing player has earned AT LEAST their current
-- counter. Players who've already bought items effectively get a small
-- "gift" of past spend going onto leaderboard, which is fine for a beta.
UPDATE public.profiles
   SET tickles_earned = counter
 WHERE tickles_earned = 0;

CREATE INDEX profiles_tickles_earned_idx
  ON public.profiles (tickles_earned DESC);
```

### RPC changes

- **`update_profile_and_item_count`** (the tickle RPC) — increment BOTH
  `counter` and `tickles_earned` by 1.
- **`buy_hat`** — only decrement `counter`. `tickles_earned` is never
  touched on purchase.
- **`leaderboard`** RPC — replace `ORDER BY counter` with
  `ORDER BY tickles_earned`. Display label stays "tickles".

### UI changes

None player-facing. Leaderboard already shows a number; that number now
means "lifetime tickles" instead of "current balance".

---

## Lucky-tickle bonus

### Mechanic

- One day = one UTC date.
- Each UTC midnight, the system rolls **3 lucky numbers** for the day.
- A single **global tickle counter** for the day starts at 0 and goes
  up by 1 with *every tickle from any player* (in addition to the
  player's personal counter).
- When a tickle pushes the global counter to *exactly* a lucky number,
  the player who did that tickle wins **+5 tickles** (both balance and
  lifetime). The number is "claimed" and can't be won again that day.
- The player who claimed it is recorded so the UI can show
  "claimed by @brian".
- 3 numbers/day × 5 tickles each = +15 lifetime tickles maximum awarded
  across all players per day. Capped, balanced.

### How the 3 numbers are picked

Numbers should feel **reachable but rare**: you want some chance of
hitting one, but not certainty. Scale to recent activity.

```
let avg_recent = AVG(global tickle volume over last 3 days, defaulting to 100 if no data)
let upper      = max(50, avg_recent)
pick 3 distinct random integers from [5, upper]
```

This gives you a low/mid/high distribution most days. As the game grows
and `avg_recent` rises, the lucky targets rise with it — so the rate of
"someone wins one" stays roughly constant rather than always being
claimed in the first 5 minutes.

Roll lazily: on the *first tickle of the day*, if no row exists in
`daily_lucky_state` for today, create one with rolled numbers and
counter=0. Cheap, no cron required.

### Claim atomicity

Race condition risk: two players tickling at the same instant could both
think they hit the same lucky number.

Fix: do the bump + check + claim in **one Postgres statement**.

```sql
-- Inside the tickle RPC, after personal counter update:
WITH bumped AS (
  INSERT INTO public.daily_lucky_state (d, global_counter, numbers)
       VALUES (CURRENT_DATE, 1, public.roll_lucky_numbers())
  ON CONFLICT (d) DO UPDATE
       SET global_counter = daily_lucky_state.global_counter + 1
    RETURNING d, global_counter, numbers
),
maybe_win AS (
  INSERT INTO public.daily_lucky_claims (d, number, user_id)
  SELECT b.d, b.global_counter, uid
    FROM bumped b
   WHERE b.global_counter = ANY(b.numbers)
   ON CONFLICT (d, number) DO NOTHING   -- already claimed → no-op
   RETURNING number
)
UPDATE public.profiles
   SET counter        = counter + 5,
       tickles_earned = tickles_earned + 5
 WHERE id = uid AND EXISTS (SELECT 1 FROM maybe_win);
```

The `ON CONFLICT (d, number) DO NOTHING` guarantees only the *first*
claim wins.

### Tables

```sql
CREATE TABLE public.daily_lucky_state (
  d              date PRIMARY KEY,
  global_counter bigint NOT NULL DEFAULT 0,
  numbers        integer[] NOT NULL
);

CREATE TABLE public.daily_lucky_claims (
  d          date NOT NULL,
  number     integer NOT NULL,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (d, number)
);

ALTER TABLE public.daily_lucky_state  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_lucky_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lucky state public"  ON public.daily_lucky_state  FOR SELECT USING (true);
CREATE POLICY "lucky claims public" ON public.daily_lucky_claims FOR SELECT USING (true);

GRANT SELECT ON public.daily_lucky_state, public.daily_lucky_claims TO authenticated, anon;
```

### Helper RPCs

- `roll_lucky_numbers() returns integer[]` — implementation of the
  pick-3 logic above. Called only on first tickle of the day from inside
  the lucky-state INSERT.
- `lucky_today()` — returns `{ numbers, global_counter, claims: [{number, username}] }`
  for the Barn UI.

### UI

#### Home (Barn)

New strip below the stat pills, above the swipe element:

```
┌──────────────────────────────────────────────┐
│  🍀  TODAY'S LUCKY TICKLES                    │
│   [ 12 ]   [ 72 ✓ @brian ]   [ 144 ]          │
│   global counter: 67                          │
└──────────────────────────────────────────────┘
```

- **Pills** show each lucky number.
- **Claimed pill**: greyed out + checkmark + claimer's username.
- **Unclaimed pill**: gold border + slight pulse animation.
- **Counter** tells you how close the global is to the next lucky.
- **Tap the strip** → info modal explaining the mechanic.

#### Win moment

When the user's tickle was the winning one, the existing `handleIncrement`
RPC response will include `lucky_won: 12` (or whatever number). On that:

- Big confetti + "🍀 LUCKY! +5 TICKLES" overlay (~2s).
- Haptics: `expo-haptics` notification feedback.
- Push the strip into "claimed" state immediately.

No notification to other players (would be spammy with 3+ winners/day
across many players). The claimed strip update on next refocus is enough.

#### Leaderboard

Already shown — just label tweak optional. Number column header changes
from "tickles" to "tickles" (no change). Internally, points to
`tickles_earned`.

---

## File-by-file change list

| File                                                                | Change                                                                 |
|---------------------------------------------------------------------|------------------------------------------------------------------------|
| `supabase/migrations/20260505xxxxxx_lifetime_tickles.sql`           | Add `tickles_earned` col + index, backfill from counter                |
| `supabase/migrations/20260505yyyyyy_lucky_tickles.sql`              | Tables, helper RPCs, modify tickle RPC, modify leaderboard RPC          |
| `components/Barn.tsx`                                               | Fetch `lucky_today()` on focus + tick. Render lucky strip. Win FX.       |
| `app/(tabs)/leaderboard.tsx`                                        | No-op (RPC swap is server-side)                                        |
| `app/(tabs)/shop.tsx`                                               | No-op (still spends `counter`)                                         |

## Open questions / non-goals

- **Push notification when someone wins** — out of scope for v1.
  Opt-in if we add it later.
- **Lucky-number hint** ("you're 3 away from 72!") — could add later
  but feels too gamey for v1.
- **Retroactive backfill of `tickles_earned`** — going with `= counter`
  for now (cheap and ~accurate). If we ever ingest spend logs we can
  re-derive.
- **Display name vs username on claim attribution** — using username
  (`profiles.username`) for now to match leaderboard.
- **Multiple wins by same player** — allowed. If you happen to be
  tickling and hit two of the day's 3 numbers, you get both rewards.
