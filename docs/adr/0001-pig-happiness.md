# Pig happiness as a regen multiplier

Adopting a happiness mechanic (medium-term care state per pig) that multiplies tickle regen rate, in the 0.7×–1.30× range, raised by friend-acts + daily login, decaying −10/day toward a floor of 30. Inspired by WoW hunter-pet happiness, but deliberately *floored* (no zero-state) and *positive-only* (curses don't lower it) to avoid the maintenance-resentment that led Blizzard to remove their version.

## Considered options

Each fork below was an explicit alternative we rejected.

**Decay model — pure WoW (decay to zero) vs decay-but-floored vs no decay vs season-reset.** Picked **decay-but-floored**. Pure-decay punishes lonely players too hard (the WoW lesson). No-decay collapses to "everyone at 100" within a week — no maintenance loop. Season-reset confuses the rhythm with an already-volatile season-end moment.

**Magnitude — subtle (0.9×–1.03×) vs felt (0.7×–1.13×) vs heavy (0.5×–1.25×).** Picked **felt**. Subtle is invisible — players don't connect cause to effect. Heavy compounded with `warm_tea` (already 0.5×) reaches 0.25× regen, a 4× burst that warps the snout economy and creates an unbridgeable have/have-nots split.

**Inputs — pure external (friend-only) vs external + small internal vs symmetric vs visit-only.** Picked **external + small internal**. Pure external means a player without friends is permanently floored — visibly punished. Symmetric removes the social hook entirely. Visit-only is the cleanest but doesn't reward the other social acts we want to reinforce (blessings, visiting, daily engagement).

**Display — visible 0–100 number vs hidden vs qualitative mood vs reveal-on-change.** Picked **qualitative mood** (Thriving / Happy / Content / Lonely). TTP's UI doesn't expose raw numbers anywhere else (tickle bank is a heart counter, alignment is a label) — a "Happiness: 78" badge breaks the aesthetic. Hidden is unteachable; reveal-on-change is mid-ground but doesn't reinforce the social hook between sessions. Mood is discoverable through play and makes "Jen's pig looks lonely" a more compelling pull than a number.

**Curses lowering happiness — yes vs no.** Picked **no**. Curses are short-term debuffs with their own UX surface (Hoofprints). Letting them touch happiness mixes two ledgers and opens a griefing surface — an anti-friend could keep your medium-term care state floored forever. Block + report already cover harassment.

## Consequences

- The mechanic is **invisible to anyone reading `regen_secs_for(uid)` in isolation.** The multiplier looks unmotivated without this ADR. *Surprise factor is the primary reason this decision warrants recording.*
- Solo players are not unaffected — they sit at floor (1.13× regen, ~13% slower). Feature #2 (active-user regen boost) is the deliberate counterweight available to them and lives on a separate multiplier axis.
- The visit mechanic (feature #4) is now load-bearing for happiness. Visit cannot be shipped as a flavor feature later — it has to ship simultaneously with (or before) happiness, otherwise the social input lane is starved.
- Reversal cost is meaningful: once shipped, removing happiness *slows down* all pigs (since the 0.7× side disappears for active social users). Public-facing nerf. Worth bracing for if we ever do remove it.
