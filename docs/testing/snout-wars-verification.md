# Snout Wars — client verification map

The Snout Wars client pipeline is **crew → invite/join → fixture → scuffle
(dig / throw / rhythm) → resolve → league**. This doc maps every stage to the
jest suite(s) that cover its **pure client logic** and to what a human still has
to feel on a device (minigame timing, sheet motion, deep links) — things a unit
test can't assert.

Server-side arithmetic (RPC results, elo, rope math, board seeds, fixture
pairing) is owned by Postgres and is covered separately by the **DB harness
suite (`scripts/db-harness/`)** — those rows below are marked accordingly and
are NOT re-tested here. The client tests pin the *mirrors* of that server logic
(band→points, PRNG parity, sort order) so client and server can't silently drift.

## Coverage map

| Pipeline stage | Client pure logic | Covering test file(s) | Server side |
| --- | --- | --- | --- |
| **Crew state machine** (crewless → invited → in-crew → in-war) | `sounderStepFor` / `sounderStepView` (`components/season1/stepState.ts`) | `__tests__/season1Steps.test.ts` | `crew_state`, RLS + cap trigger — DB harness |
| **Found / invite / join rules** | stale-invite detection, seat lines, one-Sounder messaging, create/join/accept failure copy (`components/sounder/inviteState.ts`, extracted from `SounderCard` + `JoinableSounders`) | `__tests__/inviteState.test.ts` | `create_crew`, `invite_to_crew`, `accept_crew_invite`, `join_crew`, one-Sounder invariant — DB harness |
| **useCrew hook** (fetch/optimistic/realtime) | pure decisions live in `stepState.ts` + `inviteState.ts`; the hook itself is stateful RN glue (not unit-tested) | (via `season1Steps` + `inviteState`) | realtime channels + RLS — DB harness |
| **Fixture** (league pairing + placard copy) | `leagueFixtureLine`, `ordinal`, `leagueDaysLeft` (`utils/mudWars.ts`, extracted from `LeaguePlacard`) | `__tests__/sounderLadder.test.ts` | `my_league_state`, term scheduling, pairing — DB harness |
| **Scuffle — DIG** (Truffle Patch board) | `Minstd` PRNG, `generateBoard`, feeding-window math, `practiceSeed`, stir cost (`utils/rooting.ts`); PRNG/find-set **parity** vs `rooting_finds()` | `__tests__/rooting.test.ts` | `open_rooting`, `submit_rooting`, seed issuance — DB harness |
| **Scuffle — THROW** (mud band → points) | `BAND_POINTS` mirror, `warActions` dig availability, `remainingToday`, `perCapita`, `ropePosition`, `formatCountdown` (`utils/mudWars.ts`, `components/mudwar/warCopy.ts`) | `__tests__/mudWars.test.ts`, `__tests__/warCopy.test.ts` | `throw_mud` band→points map + daily caps — DB harness |
| **Scuffle — RHYTHM (Hold)** | `isHoldPhase`, `warActions` hold/runs availability + spent copy (`components/mudwar/warCopy.ts`) | `__tests__/warCopy.test.ts` | `submit_run`, `set_deploy`, mirror fold — DB harness |
| **Standing copy** (rope / scoreboard / term) | `ropeState`, `scoreboardCopy`, `drainLine`, `siegeDay`, `termLine`, `warTotalDays`, `ropeLeanLine`, `warDay` | `__tests__/warCopy.test.ts`, `__tests__/season1Steps.test.ts` | rope/per-capita math — DB harness |
| **Dev war harness** (playtest override merge) | `applyWarOverride`, `mockWarState`, `endsAtForDay`, `splitUiOverride` (`components/mudwar/devWarState.ts`) | `__tests__/warCopy.test.ts` | n/a (dev-only) |
| **Resolve** (win / loss / draw copy) | `warOutcome`, `resolvedCopy` (`components/mudwar/warCopy.ts`); `fetchWarSpoils` result shape | `__tests__/warCopy.test.ts` | `resolve_war`, `grant_war_spoils_on_resolve`, elo apply — DB harness |
| **League table + Spirit board** (rank order + DEV padding) | `leagueSort` (ribbons → wins → diff → name), `spiritSort` (spirit → kindness), `padWithMocks` (`utils/mudWars.ts`, extracted from `app/clan-ladder.tsx`) | `__tests__/sounderLadder.test.ts` | `sounder_league_standings`, `sounder_standings`, `crew_leaderboard` authoritative order — DB harness |

## What a human still has to spot-check on device

Unit tests pin the *logic*; these need eyes and thumbs:

- **Dig minigame feel** — layer-peel taps, the 8h feeding-window countdown ticking to zero and the patch refilling, stir (rub/shove) noise budget, find-claim haptics.
- **Throw minigame feel** — the release-timing → band classification (whiff/weak/good/perfect) *actually maps to the flick a player makes*; the optimistic tally bump matching the server's award on the next refresh.
- **Rhythm (Hold) run** — goblin note timing, the run submitting the right band array, runs-remaining exhausting to "Held for today", leader deploy fog until the day folds.
- **Sheet / reveal animations** — UserSheet open, pass-the-crown sheet, `MudWarResolvedModal` win celebration, spoils cosmetic reveal, invite/stale row transitions.
- **Deep links** — `See the bog` / `Dig the patch` / `Hold the line` → `/mud-war?focus=…` scrolling to the right zone; `the Sounder League ›` → `/clan-ladder`; notification routing into a live war.
- **Realtime** — a fresh incoming invite appearing without a manual refresh; a crewmate join/leave updating the roster live; the one-Sounder note firing when you try to accept an invite while already in a crew.
- **DEV board padding** — mock Sounders only appear on a sparse `__DEV__` board and always rank below live crews of equal-or-greater standing (never ship-visible).
