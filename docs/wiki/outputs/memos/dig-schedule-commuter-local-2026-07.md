# Dig schedule: commuter windows on the player's local clock

**Status:** proposal, pending founder approval (Brian).
**Author:** Cash. **Date:** 2026-07-30.
**Code:** branch `feat/dig-schedule-commuter-local` — migration
`20260740000000_dig_schedule_commuter_local.sql` + client mirror. No `db:push` run
(gated on your go).

---

## TL;DR

Three changes to *when* the Truffle Patch opens, bundled for one approval:

1. **Better hours.** The morning window moves to commuter time. Under the old
   UTC anchor the ET morning window was ~4–8am (misses the real morning). Now
   it's **6–10am**.
2. **Phone-local time.** The schedule is derived from each player's device UTC
   offset, so a West-Coast pig gets 6–10am on *their* clock, same as an
   East-Coast pig. No more one-size-fits-UTC.
3. **Non-uniform windows + overnight gorge.** Shorter, more frequent daytime
   windows; one long overnight gorge while people sleep. **Four windows/day**
   (was three uniform 8h windows).

### The schedule (all times phone-local)

| Window | Open (can dig) | Then gorges to |
|---|---|---|
| Morning | 6:00–10:00 am | 12:00 pm |
| Lunch | 12:00–2:00 pm | 5:00 pm |
| Evening | 5:00–8:00 pm | 9:00 pm |
| Wind-down | 9:00–11:00 pm | **6:00 am (overnight gorge)** |

Submit grace is unchanged in spirit: a dig opened in an open span stays
submittable until that window ends (the next one opens); a stale session past the
boundary refuses with `no_open_rooting`, exactly as today.

---

## Why this is low-risk (the co-op is safe)

The worry with "local time" is that it breaks the crew co-op. It doesn't, because
of two facts already true in the code:

- **Boards are already per-user.** The seed is
  `hashtext(win || ':' || caller_id)` — every pig digs its *own* board, not a
  shared crew board. Local windows just rotate each player's own board on their
  own clock.
- **The Great Hungerer meter is time-independent.** `hunger_drain.total` is a
  pure cumulative counter with no window logic. Every find still drains the one
  shared boss regardless of when or where it was dug.

So "hybrid — local hours, global patch" is essentially free: local *hours*,
per-user boards (unchanged), one global boss meter (unchanged).

## The one conscious tradeoff — cross-timezone echo

The co-op **echo** bonus (`dig_echo` + bigger stir budget when a crewmate also
dug "this window") keys on `(crew_id, window_index)`. With a local window index,
the echo now syncs crewmates who dig **in the same local window**:

- **Same-timezone crew (the common case — friend groups):** identical to today.
- **Cross-timezone crew:** their local windows don't line up, so they won't echo
  each other even when digging at the same instant.

I think this is acceptable (crews are usually regional friend groups), but it's
your call. If you'd rather keep echo global, the alternative is to key echo on
UTC `dig_day + crew` instead of `window_index` — a small follow-up, not in this
PR.

## Economy note — 4 digs/day vs 3

Four open windows means **up to 4 digs/day** per player, up from 3 → roughly
**+33% truffle mint + hunger drain rate** at full engagement. Intended (more
touchpoints), but flagging it so the meter thresholds / race pacing get a
conscious look. Nothing in the milestone tables was changed.

---

## What's in the PR

- **`supabase/migrations/20260740000000_dig_schedule_commuter_local.sql`** (sorts after the current latest, `20260739300000_friend_favorites`)
  - New schedule helpers: `patch_window_index(at, off)`,
    `patch_phase_open(at, off)` (2-arg overload; the 1-arg UTC form stays),
    `patch_phase_bounds(at, off)`, `_patch_local_min(at, off)`.
  - `open_rooting(int)` and `submit_rooting(text[], int, text[], int)` — **carried
    verbatim** from `20260730000000_patch_carryover` (carry-latest-def), changing
    ONLY: a `p_utc_offset_minutes` arg, `win` via `patch_window_index`, and the
    phase gate / `phase_ends_at` / `opens_at` via the local helpers. Every other
    line (crew gate, coop/crew_dug, carry-over, unique roll/claim, mint, drain,
    race attribution, milestones, refusal envelopes) is byte-for-byte identical.
  - Back-compat wrappers: `open_rooting()` → offset 0, and
    `submit_rooting(text[], int, text[])` → offset 0. Deployed builds keep working
    on a UTC-anchored view of the same commuter schedule until they update.
- **`constants/dig.ts`** — the old `ROOTING_WINDOW_SECS` / `PATCH_OPEN_SECS` pair
  is replaced by the schedule table (`DIG_DAY_ANCHOR_MIN`, `DIG_DAY_MIN`,
  `DIG_BUCKET_STARTS`, `DIG_BUCKET_OPEN_MINS`, `DIG_WINDOWS_PER_DAY`).
- **`utils/rooting.ts`** — the client mirror: all window/phase helpers recomputed
  against the local schedule (integer-identical to the SQL so a client-computed
  index equals the server's). New `localOffsetMin` + `patchWindowShape` helpers.
- **`hooks/useRooting.ts`** — passes `p_utc_offset_minutes` on open + submit.
- **`components/season1/WindowStrip.tsx`** — renders the current window's own
  open/gorge split (windows are non-uniform now).
- **`__tests__/rooting.test.ts`** — timing tests rewritten to the new schedule
  (UTC offset pinned to 0 for machine-independence). Full suite green
  (612 tests).

## Rollout

1. You review + approve the direction (and the echo tradeoff).
2. `db:push` the one migration `20260740000000` (it sorts last, after
   `20260739300000_friend_favorites`).
3. The client update ships in the next build; old builds keep working meanwhile.

No changelog/build entry yet — this is a proposal PR, not a build.
