# Alignment teeth — Generous/Greedy mechanical effects (Season 1)

> Status: **proposed, awaiting number sign-off.** Decided: teeth land in
> **Season 1 now**; lever = **economy AND social**; design **gentle** (light
> stick) with a **strong redemption path** so greedy players don't death-spiral
> mid-season. Breakpoints unchanged: Generous ≥ +25, Greedy ≤ −25, Pilgrim
> between (`utils/alignment.ts`).

## The three effects

### 1. Economy — gentle regen tilt
Tickle regen is already modified by warm_tea/sluggish via `regen_secs_for(uid)`
— alignment slots in as one more factor:

- **Generous:** regen ×**0.9** (≈10% faster tickles)
- **Greedy:** regen ×**1.1** (≈10% slower)
- **Pilgrim:** ×1.0

Small enough to never feel punishing, present enough to notice. Stacks
multiplicatively with the existing ritual factors; the 60s floor still applies.

### 2. Social — you become a SPECIALIST (the tradeoff) *(refined)*
Your nature makes you good at one ritual and bad at the other, scaling with how
far you've gone:

- **Generous** = a blesser: blessings **stronger**, curses **weaker**.
- **Greedy** = a curse-hurler: curses **stronger**, blessings **weaker**.

Applied as a duration multiplier at cast time, scaling continuously with score
(`s` = alignment_score, −100..+100):

- `blessing_factor = 1 + (s/100) * 0.5`  → +50% at +100 generous, −50% at −100 greedy
- `curse_factor    = 1 − (s/100) * 0.5`  → +50% at −100 greedy,   −50% at +100 generous

So at +50 generous: blessings ×1.25, curses ×0.75. At −50 greedy: blessings
×0.75, curses ×1.25. The deeper your conviction, the sharper the specialty.

### 3. Redemption — the climb out is faster than the fall in
The key to "gentle." Today a giving act shifts alignment **+2**
(`tickle_trades` trigger). New rule:

- While a player is **Greedy** (score < 0), each generous act shifts
  **+3** instead of +2 — so digging out is 50% faster than digging in.
- Optional one-time "turning over a new leaf" nudge: the first generous act
  after crossing into deep-greedy grants a small tickle bonus.

So greedy is a *temporary villain phase with a quick, rewarding way back*, not
a penalty box.

## Visibility — make the effects legible *(required)*
The effects are invisible math unless we surface them. Three readouts:

1. **"Your effects" panel** — on the alignment block (Account) and/or in the
   `AlignmentExplainerModal`, show the player's LIVE numbers derived from their
   score: *Tickle regen +10% · Blessings −25% · Curses +25%* (with the
   specialist framing). This is the "what's going on" the player can read.
2. **At cast time** — in the `RitualPicker`, show the modified duration ("your
   curse lasts 5h" with a ↑/↓ vs base) so the potency is felt where it's used.
3. **Pig aura + badge** — Generous = warm halo glow, Greedy = darker aura (hooks
   into the existing `BarnOverlay` alignment predicates); alignment emblem
   (`AlignmentBadge`) next to names on Leaderboard / UserSheet / Sounder.

## Build plan
1. **Migration:** alignment factor in `regen_secs_for`; duration modifier in
   the bless/curse cast fns; the +3 redemption shift in the trade trigger.
   (Touches live economy — additive, gentle, reversible.)
2. **Client:** pig-aura render by alignment; surface the badge consistently.

## Open / confirm
- The **±10% regen** and **±25% potency** and **+3 redemption** numbers — good
  starting values, or tune?
- Social: blessings-stronger / curses-weaker, or only one side?
