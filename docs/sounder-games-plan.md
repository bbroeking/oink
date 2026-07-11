# Sounder games — master plan (mechanics, scoring flow, condensed UI)

> **SUPERSEDED 2026-07-06** by `docs/season1-coop-dig-spec.md` — the grill
> session this doc was drafted for concluded with removing the war/league
> stack entirely (see `SKILL.md` decision log; code archived at
> `archive/sounder-league-2026-07-06`). Kept for history only.

2026-07-06. Ground truth from code/migrations; companion to
docs/sounder-league-spec.md and the s2-game-loop workshop memo. Status:
draft for the grill session — decisions land back into this doc.

## The shared dig contract (games 1–3)

One server session per pig per 8h feeding: `open_rooting(p_war)` returns a
**seed**; the client builds the identical 6×5 board (`utils/rooting.ts
generateBoard` — Minstd PRNG parity with `rooting_finds(seed)` in
`20260704100000` + depth update `20260706200000`). Board contents: a 2-cell
long truffle (`truffle_l`), a dark truffle (`truffle_d`), a 50%-chance
`shimmer`, one junk item, stones (inert). `submit_rooting(p_war, p_finds
text[], p_actions)` re-validates finds against the seed and pays:

- **Mud**: +1 per truffle, ≤2/window, cross-window daily cap 6 (8 when a
  crewmate dug the same feeding) → an INSERT into `mud_slings` → the rope.
- **Golden Truffles**: first truffle +1; crew echo +1 (2+ diggers same
  window, retro-credited); blessed dig +1.
- **Season XP**: +20 per submitted dig.
- Which game renders is `feedingGameIndex(windowIndex)` — rotation, not
  choice. Practice fallback runs the same board locally, mints nothing.
- **Payload hardening (2026-07-06)**: `useRooting.submit` is the single
  chokepoint — `normalizePouch` + `claimableFinds` guarantee p_finds is a
  real array of seed-valid ids (22P02 "shimmer" regression, tested).

### Game 1 — Truffle Patch (rotation 0)
Scratch-to-dig against a stir meter: quiet rub (+1 stir) or loud shove
(+3), budget 20 (`STIR_BUDGET`), uncovering cells until the meter fills.
No fail state; everything uncovered is kept. The founder-validated
original (bake-off winner). Actions = stir spent.

### Game 2 — Deep Root (rotation 1)
Progressive root-pull (wind/crank verb) revealing cells along the root
line; shares stir-family costs (`windRef` actions). Weakest identity of
the three — reads as "Truffle Patch with a different gesture."

### Game 3 — Snout Hook (rotation 2)
A hook sweeps the sky lane; timed drops (3 per session, `ACTIONS_PER_DROP`
actions each) sink to the shallowest unhauled lump in the column. Rebuilt
2026-07-06 to sibling visual parity (plunging hook rig, Hungerer flinch,
find art). Skill = timing; depth = column memory.

## Game 4 — Rhythm Hold ("Songs of the Bog")
Only in a rhythm war's HOLD phase (days 3–7): `submit_run(p_war, p_bands)`,
≤3 scored notes per run classified client-side whiff/weak/good/perfect →
server band map 0/1/2/3 mud, `RUNS_PER_DAY = 2` (+1 per barn-visit access
token). Feeds the same daily skill cap (21) as throws. Defends your areas
against the opponent's deployed wave (FrontBoard difficulty).

## Game 5 — Slop Toss (throw_mud) — RETIRED FROM RENDER
Imported but not rendered on the war page since scuffles became dig-offs;
server budget (7 throws × ≤3) still live. ReclaimSlam wired for parity if
revived. **Decision needed: kill or revive.**

## How points flow (one diagram, all games)

game action → mud (mud_slings) → daily rope fold (score_mud_war_days)
→ rope_pos → fixture result (term_fixtures, no draws) → league table
→ **Prize Ribbons** (apply_crew_elo, rope-margin-scaled) — while EVERY
unit of mud from EITHER herd also sums into the Hungerer drain
(hunger_meter), truffles bank personally, digs/wins pay season XP, and
wins pay tickles ∝ personal participation (slings + 3×digs, cap 20).

## Condensed war-page UI (founder ask: much more compact)

Today each surface is a huge always-expanded card. Proposal — **play
chips**: a single horizontal row under the scoreboard, one chip per verb:

- `[ Dig — Snout Hook · ready ]` / `· dug — 2h 10m` (rotation game name +
  window state; FeedingStrip already opens a full-screen modal — keep it
  as the expanded state).
- `[ Hold the line · 2 runs ]` — rhythm runs move INTO the same modal
  pattern instead of inline; disabled state shows the reason line.
- `[ The bog · fronts ]` — FrontBoard collapses behind a chip entirely
  (deep-dive surface, not homepage).

Chip anatomy: 56px sticker chip, Glyph + verb + one hand-font state line;
tap → full-screen game modal; the ONLY always-expanded content on the war
page stays the who/rope/what-now scoreboard. Estimated reclaim: ~70% of
current scroll height.

## Known issues ledger
- Deep Root identity overlap (see grill Q).
- Rotation removes player choice (see grill Q).
- Rhythm Hold is invisible outside Hold phase — players forget it exists.
- Slop Toss limbo (retired render, live server budget).
- Fronts jargon fixed 2026-07-06 but the board still dominates scroll.
