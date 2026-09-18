# Snout Deep — the wake meter, deterministic (rules v2)

Founder rulings, 2026-09-17, after a player's note on build 192 (*"no
progress bar on the guy waking up so it's just random luck?"*), amended
02:15 ET: **"change it to the deterministic version"** — the B2 mechanic of
`docs/design/2026-09-17-wake-meter.md` (that document holds the reasoning
and the simulation; this one is the build contract and wins on any
disagreement). The earlier roll-against-the-meter variant (01:30) is
superseded; `rules = 2` now means THIS rule.

Standing rulings kept from the night: the per-board sniff budget
(20260917150000, live); the descent gate (§4); deeper pays more (§3); the
receipt always says what went into the bag (§5); the herd line.

## 1. The rule (rules = 2)

- **Loudness** is the wake table as it already stands, unchanged:
  `wakeThreshold(layer, verb, coop, priorSniffsOnLayer)` — topsoil 0/1/10,
  mud 3/6/20, root 7/15/40, co-op halving the root's sniff and rub, sniffs
  free inside the per-board budget of five and +1 per extra sniff past it,
  capped at the layer's shove. There is no separate loudness table any more
  (`ATTENTION_LOUDNESS` goes away).
- **Attention** is an integer in 120ths. After every logged action:
  `attention += loudness(action)`.
- **His sleep depth `T`** is drawn from the wake stream when a board is
  ENTERED (see scope), uniformly over the tuning band `[lo, hi]`:
  `T = lo + floor(draw * (hi - lo + 1) / 120)` where `draw ∈ [0, 120)` is the
  next number of the seed's wake stream. The draw is CONSUMED — it advances
  the stream — so `wakeIndex` (client) and the server's draw index count
  board entries as well as actions: topsoil's `T` is draw 0 (taken in
  `initialState`), the first action reads draw 1, and so on.
- **He wakes** on the action that carries attention to `T` or past it:
  `woke = attention >= T`, evaluated after the add. No roll. Below `lo` is
  certain sleep; `hi` is a certain wake. The hazard the player sees inside
  the band is `loudness / (hi − attention)`, but that is a reading, not a
  rule.
- **Scope** (tuning): `"board"` — attention resets to 0 and `T` is redrawn
  on every descent (the doc's recommendation and the DEFAULT); `"dig"` —
  one `T` at open, attention carries all the way down (the founder's
  earlier "carry all of it down"; the doc's sim shows the mud never wakes
  him under it with today's table, so it ships as a switch, not the
  default). Both scopes are in the kernel and the server from day one.
- **Tuning row** `app_settings.snout_deep_wake_meter` =
  `{"lo": 50, "hi": 110, "scope": "board", "dig_root_gt": 0}`; compiled
  fallback `WAKE_METER` in `constants/dig.ts` (`{ lo, hi, scope, digRootGt }`).
  The row is STAMPED onto the dig at open (`war_rootings.wake_meter jsonb`)
  beside `rules`, returned by `open_rooting`, and the server replays each
  row under its own stamp — a tuning change never re-judges an open dig.
- **`dig_root`** (the +1 Golden Truffle for tying at the root with the mud's
  truffle banked) mints only when the stamp's `dig_root_gt` is 1. Default 0:
  under a per-board meter the descent is silent, so tying on arrival would
  be a free +1 for walking downstairs (the doc's §5.3). The client's
  `gtReasons` omits `dig_root` under the same stamp, so the tie button's
  "+N Golden Truffles" agrees with the server.

## 2. Rule versioning (unchanged in shape)

- `war_rootings.rules smallint NOT NULL DEFAULT 1` (CHECK 1|2) and
  `war_rootings.wake_meter jsonb` (NULL for rule-1 rows).
- `app_settings.snout_deep_rules` → `{"rules": 2}` (rollback `{"rules": 1}`).
- `open_rooting(p_rules smallint)` — the overload stamps
  `rules = LEAST(GREATEST(p_rules,1), config)` and, when that is 2, the
  wake-meter stamp from the tuning row; returns `'rules'` and `'wake_meter'`
  (the row's, also when already open). The zero-arg `open_rooting()` stays
  untouched: old clients open at rule 1.
- `_submit_rooting_deep_core` — CARRY-LATEST-DEF from
  `20260917150000_snout_deep_sniff_budget_per_board.sql` with the replay
  loop branching on `row_r.rules`: rules 1 = today's per-action roll; rules
  2 = the meter above (draw `T` on entry, add, compare). It needs
  `_snout_deep_wake_draws(seed, n + 3)` — three board entries at most. The
  `'attention'` (final meter) and `'sleep_depth'` (the last board's `T`)
  keys go on the receipt JSON. `dig_root` gated by the stamp.
- Client: `RootingSession.rules` and `RootingSession.wakeMeter`;
  `useRooting.open` sends `{ p_rules: SNOUT_DEEP_RULES_MAX }` and reads
  both. `initialState(board, { coop, uncrewed, rules, wakeMeter })`.
- Parity (`__tests__/snoutDeepServerParity.test.ts`): the tuning row's
  defaults against `WAKE_METER`; the `T` formula (a JS transcription of the
  SQL against the client's `sleepDepthFrom(draw, lo, hi)` over all 120
  draws for both bands); the draw-on-entry order (the entry draw is taken
  BEFORE the layer's first action draw); the compare-after-add; the scope
  reset; `dig_root` gated; the two cores differ only by the meter lines.
  Harness smoke `scripts/db-harness/99_snout_deep_wake_meter_smoke.sql`.

## 3. Deeper pays more (unchanged)

Tickles per find (server config `app_settings.dig_finds[kind].tickles`,
compiled fallback `DIG_FIND_TICKLES`): truffle_l 20, shimmer 10, acorn 15,
tea 10, scroll 12, relic 25, furnishing 30, bow 40, charm 20; topsoil
unchanged. Odds (client-compiled `DIG_FINDS`): root relic 1/2, furnishing
1/2, bow 1/8, charm 1/2; mud tea 1/2, scroll 1/2. Already in the tree.

## 4. The descent gate (unchanged)

`Dig deeper` is locked until every food find on the current board has
surfaced (`boardFoodFound`); the reducer's `descend` is a no-op while gated
except under `force` (replay / restore). The gated button reads **"Find the
truffle first"**. Under scope `"board"`, descending also resets attention
and redraws `T`; under `"dig"` it does neither.

## 5. What the player sees (rules = 2)

- **The meter** sits under the Hungerer's face: a bar whose full width is
  `hi`; the band `[lo, hi]` painted as a darker stretch at the right end;
  the fill's tip is attention. `ProgressTrack` if it can take a band
  overlay, else a small tokenized bar in `components/mudwar/`. His face is
  the meter's legend: `snoring` under `lo`, `stirring` in the band's first
  half, `oneeye` in its second; the tag under him reads *sound asleep* ·
  *stirring* · *one eye open* (the sniff-budget "noticing you" tag stays for
  that moment, on top). Under rules = 1 the patch is unchanged.
- **The cards** wear their loudness, not a percent: `+1` / `+10` in the
  numeral role — the meter's own 120ths, so the number says how far the
  verb moves the bar; the sniff card keeps its budget while it holds
  (`free · 5 left`, then `+3 · 2 left` below topsoil… and `+1` / `+2` past
  the budget). Bigger is louder, one denominator, no inversion. (A slice of
  bar at card scale was tried and dropped the same day: two points wide for
  a shove, nothing for a rub, it read as a stray tick beside the numeral.)
- **The whisper** speaks the meter on the first read of a board: *"he sleeps
  through the first 50 or so. past that, any action could be the one — and
  the fuller the bar, the likelier."* On entering the band: *"he could wake
  on any of these now."*
- **The woke receipt**: *"pushed the root on a rub at 84 — this was the
  one."* (rules 1 keeps "a 13% chance — this was the one.")
- **The help sheet**: the meter's row replaces the odds row under rules 2.
- **The bag beat** always shows (already in the tree).
- **Preview**: `ticklethepig://snout-deep-preview?rules=1|2&meter=50-110&scope=board|dig`.

## 6. Numbers to pin (from the doc's sim, nose bot, 2,000 seeds, band 50–110, scope board)

Topsoil wakes 0%; the greedy nose bot wakes him in about 59% of digs (7% at
the mud, 52% at the root) and reaches the root in ~93%; GT/dig with
`dig_root_gt` 0 about 1.86. Pin these loosely (±8 points, ±0.3 GT) in
`__tests__/snoutDeepSim.test.ts` under rules 2 and keep the rule-1 pins by
running those sims under rules 1. The other session's
`scripts/sim/wakeMeter.sim.test.ts` is reference only — do not edit it.

## 7. Tests to keep green

Every dig suite, the parity test, the harness (`scripts/db-harness/run.sh`
with the new migration + smoke chained), `npx tsc --noEmit -p .`, eslint 0
errors on changed files, `npm run -s scorecard` at 0.
