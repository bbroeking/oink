# Happiness is self-driven consistency, not social care

**Supersedes [ADR 0001](./0001-pig-happiness.md).** 0001 was a design-only doc
(never implemented). We are building happiness, but inverting its core: a pig's
happiness is driven primarily by **the owner's own tickling consistency**, on a
**20–80** band that can fall to genuinely **sad**, and it **multiplies tickle
regen symmetrically** (faster when happy, slower when sad). Friend-acts help but
are only **25% as effective** as self-tickling. The pig's **sprite is the entire
readout** — no number, no meter, no label fill.

## Why invert 0001

0001 made happiness a *social* care state (raised only by friend-acts, floored
at 30, positive-only, "Lonely" as the saddest state). The problem: most players
can't move a social-only number — a friendless player is permanently floored and
visibly punished, and there's no legible loop for the solo majority. Self-driven
happiness gives *every* player a loop they own: tickle your pig regularly → it's
happy → regen is faster; neglect it → it gets sad → regen slows → you tickle to
climb back. The pig's face becomes a daily-return hook.

## Considered options (the forks we walked)

- **Input — friend-acts only (0001) vs self-driven vs symmetric.** Picked
  **self-driven primary, friends at 25%.** Friend-only strands solo players;
  fully symmetric removes the "your consistency" identity. 25% lets a well-
  friended player get a gentle assist without coasting — their own consistency
  still has to carry it.
- **Floor — floored at 30, never sad (0001) vs sad-capable 20–80.** Picked
  **20–80, sad-capable.** A genuine sad state is the whole point of the visual
  hook; a floor that never reaches sad has nothing to teach or pull on.
- **Regen mapping — bonus-only vs symmetric.** Picked **symmetric, ~0.85×–1.15×.**
  Sad must have teeth (slower regen) or neglect costs nothing but a face.
  Magnitude kept gentle so the worst-case stack (0.85 × `warm_tea` 0.5) is
  ~0.42×, not the 0.25× / 4× burst 0001 rejected.
- **Gain shape — per-tickle uncapped vs window-capped.** Picked **window-capped.**
  Spreading tickles out must beat dumping them; a one-time binge recovers ~one
  mood band but can't buy Happy. Consistency, not volume, is the driver.
- **Display — qualitative label vs sprite-only.** Picked **sprite-only.** No
  number, no meter — the pig's idle animation (`sad`/`idle`/`happy`) *is* the
  readout, everywhere Rosie renders. Even tighter than 0001's qualitative label.
- **Visit cap — abstract window cap vs in-fiction "tired".** Picked **tired.**
  A visit is a tap-session on a friend's pig; after a random **3–7** tickles both
  pigs play a new `tired` animation, a line pops, and it returns home. The
  tiredness *is* the visit's governor — finite, charming, unfarmable.

## Consequences

- **Invisible in `regen_secs_for(uid)` in isolation** — the happiness multiplier
  joins VIP / `warm_tea` / `sluggish_snout` / alignment with no local
  motivation. This ADR is its motivation. (Same surprise-factor caveat as 0001.)
- **Reversal slows pigs** — removing it deletes the 0.85× happy side, a public
  nerf. Bracing cost is real.
- **Couples to barn visiting** — the visit tap-session + `tired` end-state is now
  load-bearing for the friend lane. The single-button visit tickle must become a
  multi-tap session.
- **New art dependency** — a `tired` sprite set must be generated (idle Rosie
  baseline) before the visit end-state ships.
- **Streak (ADR 0002) is now redundant** — self-tickling consistency *is* the
  loyalty axis 0002 described. 0002 should be retired or folded in; don't build
  it as a second parallel system.
