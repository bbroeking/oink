# Two Pigs at the Hedge — rules prototype

Pure JavaScript model for the isolated two-player Great Hungerer encounter. It is a test-rules experiment, not errata for the 88-card Rosie's Loadout catalog. In particular, **Energy is separate from canonical Rank**, Bog Frog is a one-shot Critter helper, and there is no persistent Gear, Training, Battle, or Trouble board.

Run verification:

```sh
node --test scripts/prototypes/coop-cards/test.mjs
```

Run synthetic policies over 500 deterministic seeds:

```sh
node scripts/prototypes/coop-cards/simulate.mjs 500
```

The simulator compares three scripted heuristics: attack-first, deliberately wasteful guard-first, and conditional-team. Conditional-team estimates uncovered incoming damage, avoids healing at full Cheer, and prioritizes only enough defense to answer the current Intent before attacking. Its output is useful for catching obvious tuning extremes; it is not evidence of human balance or cooperation quality.

The engine is immutable at its public command boundary. A round moves through `playerTurn → enemy → cleanup`: only `activeSeat` may play or pass, both pigs must pass before the enemy acts, and cleanup must finish before the next round starts. Draw effects create `pendingChoice` after the new cards are visible and block other commands until resolved. Played cards enter discard immediately; unplayed hands persist and may be reduced to four only during cleanup. Enemy damage packets resolve simultaneously, shared Guard may be split across them, tied lower-Cheer targeting requires an explicit leader choice, reaching 20 Progress wins before retaliation, either Legend at zero loses, and surviving round six below 20 Progress loses to the clock.

Victory is a terminal trigger cutoff: after a card's primary effect reaches 20 Progress, the encounter ends before any post-card Legend trigger. For example, a winning Snoot Boop does not start Rosie's draw-then-discard ability.
