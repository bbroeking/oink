---
title: "Season 2 game loop — workshop decisions"
type: memo
date: 2026-07-05
tags: [season-2, game-loop, cadence, great-hunger, sounder-league, design]
status: proposed — awaiting founder reaction; append to SKILL.md log on blessing
---

# Season 2 game loop — the workshop, answered

Companion to [[mudwar-hunger-arc-cadence-2026-07]] (the heartbeat + arc) and
`docs/sounder-league-spec.md` (the weekly spine). The loop as shipped/built:
tickle (moment) → dig (8h, pure upside) → skill budget + blessing + visits
(daily) → the league fixture (weekly, named rival, term clock) → the
Hungerer's drain + pass + Exchange + table (season). Currencies stay
separated: snouts general, truffles war-only, XP pass-only, Spirit kindness.

Six gaps were identified; the calls below are the answers.

## 1. The session script — the season tab owns it

**Script: "Tickle your pig, dig while the Hungerer gorges, do one kind thing
for your herd."** Self → season → social, one sentence.

A **"today at the trough" strip** sits at the top of the season tab: three
states, each one tap deep — **Dig** (window open/done + "he gorges again in
2h 10m"), **Scuffle** (rope state + days left), **Kindness** (today's
blessing cast or not). Legibility only: no rewards for "completing" it, no
streaks, no checkmarks-as-pressure — chore-ification is the failure mode.
The **Barn stays clean** (the pig is a companion, not a dashboard); a purely
ambient Barn-side shimmer when a dig window is open + unspent is a
nice-to-have art beat, later, shown through the world rather than a chip.

## 2. Fixture pulse — live rope yes, nightly ping no

The **LeaguePlacard gains the live rope** ("vs The Mud Maulers · we lead
by 2 · 3 days left") — `my_league_state()` grows a `rope` field read from
the fixture war. Daily legibility with zero notification cost.

The nightly fold announcement is **rejected**: ~56 pushes a season is
Snapchat-streak territory (the cadence memo's gift-not-guilt line). Instead,
announce **only when the lead flips** — "The Loyalists pulled ahead
overnight" — bounded ≤1/day. Lead changes are the actual rally signal;
the heartbeat is noise.

## 3. Boss stages — earned "sloppy spells," not scheduled events

Stage-modifier weekends can't be scheduled (the meter is community-driven),
so invert it: **each stage crossing opens a 48-hour "sloppy spell"** — "he's
Peckish and sloppy — for two days, digs find one extra truffle." The
community *earns* the event by draining him; the meter becomes a lever
("we're close to Peckish — push") instead of wallpaper. Invites, never
punishes: missing a spell = normal digs. Economy impact is bounded (+a few
truffles per committed pig per spell, a handful of spells per season).
Implementation: a modifier read in `submit_rooting` keyed off the
`hunger_meter()` stage + stage-crossing timestamp. The ambient staging
theater (H3: dimming aura, tired waddle, hoard shrink) stays — the two
compose.

## 4. The Rally Horn — a narrower instrument than the Trough Board

**Build it.** Leader-only, **once per crew per day**, preset-only: "⟨Crew⟩
rallies at the trough tonight at ⟨hour⟩" — a small hour picker, rendered in
each member's local time, delivered through the existing announcement
primitive. No free text (no moderation surface), no replies, no attendance
tracking (no shame). The Chorus, the Echo, and same-window dig gilding are
the game's best co-op moments and are currently unschedulable — this is 90%
of clan chat's coordination value at 2% of its surface.

**This is the one call that bends a prior decision** (2026-07-05: no Trough
Board). The free-text cut stands untouched; the Horn is a bulletin, not a
conversation. Needs explicit blessing before build.

## 5. The Offering Trough — the terminal truffle sink IS the story

**Spec it.** When the Hungerer reaches **Hungry** (late arc), an offering
trough opens: tip Golden Truffles in → each drains his meter a little extra
→ contributor stamps at thresholds (earn-only cosmetic pins; nothing else
minted back). Ledgered spend (`reason 'offering'`), no purchase path
anywhere upstream, so offering wealth = play. Priced as sentiment, not
value — strictly worse "deal" than the Exchange, for surplus and generosity
(the core economy). The fiction closes perfectly: his cure is being fed
back into the sounder, and the season's economy literally ends by feeding
the lonely Hungerer. Offering totals feed the finale scene.

## 6. Finale — one ceremony, and what carries

Order of operations on the (unannounced) day, one cron:
1. **Meter check** — Famished → driven-off/cured ending; short → "he
   lumbers off to digest, vowing to return." No punishment either way.
2. **The Last Feast scene** consumes the offering totals ("the herd fed him
   4,812 truffles").
3. **The table settles at the feast** — `finalize_league_season` runs in the
   same beat; placement rewards read as *handed out at the feast*.
4. **The pass stops accruing** at the same timestamp; already-earned tiers
   stay claimable for a one-week grace (never burn earned rewards).

**Carries into S3:** final table order seeds divisions; **truffles carry**
(deleting earned currency fails "respects the player"; the trough gives
surplus a home; convert-then-grandfather if S3 changes war currency).

## Build order

- **Phase A (pre-flip, small):** trough strip on the season tab · rope on
  the placard (+`my_league_state.rope`) · lead-flip announcement in the
  nightly fold.
- **Phase B (rides the H3 meter work):** sloppy spells.
- **Phase C (mid-season content beats):** Rally Horn (post-blessing) ·
  Offering Trough (opens at Hungry anyway) · finale ceremony wiring.

## Connects to
- [[mudwar-hunger-arc-cadence-2026-07]] — the heartbeat this schedules around
- [[mudwar-rewards-spec-2026-07]] — truffle faucets the trough sinks
- [[world-boss-the-great-hunger-2026-07]] — the arc the offerings close
- `docs/sounder-league-spec.md` — the weekly spine (repo doc, not a wiki page)
