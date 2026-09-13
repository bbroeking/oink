# Streak systems

TTP has two explicit, non-purchasable streaks with different owners and
different qualifying actions.

## Personal Streak

The personal Streak belongs to one player and credits manual Home tickling.

- First manual Home tickle starts day one.
- Further manual tickles inside 24 hours do not double-credit.
- A manual tickle 24–36 hours after the prior credit extends the count.
- A later manual tickle restarts at one.
- Auto-Tickler, visits, blessings, curses, trades, grants, and other Tickles do
  not advance or preserve it.
- The regen benefit improves linearly through day 30 and then caps at 0.75×;
  the visible consecutive-day count continues past 30.
- Home shows the exact count with fire around the spendable Tickle-bank number.
  The Garden is retired.
- Sharing is owner-initiated through the system share sheet. The live/broken
  count is not public to visitors by default.

## Visit Streak

The Visit Streak belongs to one unordered pair of friends.

- Either friend's first qualifying Barn visit keeps the pair's flame alive.
- A reciprocal visit inside the same 24-hour credit window does not add a day.
- A visit 24–36 hours after the prior credit extends the shared count.
- A later visit rekindles at one while preserving the longest count.
- Friend rows show one explicit flame/count for the pair.
- A sleeping flame never identifies or blames the friend who did not visit.
- Blessings, curses, trades, and other pair actions do not count.

Visit Streaks replace Pair Flames and inherit their staged flame art plus the
day-30/day-90 matching-cosmetic direction. Those wearable assets are a content
follow-up, not part of the foundation migration.

## Server authority

`profiles.current_streak`, `profiles.longest_streak`, and
`profiles.last_streak_bump_at` own personal state. Only the manual Home-tickle
wrapper calls `_apply_manual_streak_bump`.

`visit_streaks` owns one `(user_low, user_high)` record. A trigger on successful
`barn_visits` inserts calls `_credit_visit_streak`; canonical pair ordering and
the 24/36-hour rules make repeated taps and reciprocal visits idempotent.

No client clock sets a credit. No paid freeze, restore, or warning timer exists.
