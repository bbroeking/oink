# Product

## Register

product

## Platform

ios

## Users

Friends who play together. A player's context is a warm spare minute — a notification landed ("the race is run", "your pig looks sad"), and the game is a reason to reach out to someone they know. The job is small and social: check on your pig, dig the shared feeding, bless a friend, see where your herd stands. This is a React Native / Expo app shipped to iOS via TestFlight and the App Store — the design serves the game, it is not itself the product.

## Product Purpose

Tickle the Pig connects friends into herds, gives them things to collect, and gives the herd a race to run — together. **Connect · Collect · Contend.** Every player raises a pig (Rosie), joins a Sounder (their crew), and works through a seasonal cooperative arc — Season 1's Great Hunger, where every 8-hour feeding lets each pig dig the Truffle Patch, and finds starve a shared world-boss. Alongside the co-op dig runs a weekly herd-vs-herd spoils race. Success is a game that calls you at human intervals, gives you a warm reason to think about a friend, and never punishes the hours between. The deep charter lives in [SKILL.md](SKILL.md) — consult it before any product, content, or economy decision.

## Positioning

A cozy multiplayer game where competition exists to make cooperation urgent: you dig *together* or you place nowhere, and everything with status attached is earned through play, never bought — money buys expression, never advantage or accomplishment.

## Brand Personality

Cozy, hand-made, warm. The voice speaks in the game's own words — Sounder, snout, the bog, feeding, the Great Hunger — cozy names on screen, technical names in code. The interface feels like a paper-craft scrapbook someone who cares assembled by hand: ink-outlined stickers, hand-drawn tilt, warm cream paper. It shows feelings rather than stating them — a pig's mood is its sprite, a streak is a growing garden, never a meter or a number. The world responds *now* and speaks in pictures. Three words: **cozy, hand-made, warm**.

## Anti-references

- **Not a SaaS dashboard.** The usual "kill the cards, flatten the gradients, calm the motion, default to system fonts" advice is wrong here — the whimsy *is* the design. A perfectly-aligned, borderless, soft-shadow card reads as slop in this app.
- **No pay-to-win in any costume.** No status you can buy, no reward faucets without sinks, no advantage for money.
- **No shame states.** No drag-down averages, public zeros, rejection buttons, or "your herd let you down" framing. Losing keeps everything you earned.
- **No emoji in UI, ever.** An emoji character in a render is an automatic taste failure — use hand-drawn `Glyph` or SVG `Icon`.
- **Nothing that needs explaining twice.** A mechanic a player can't hold in one sentence is wrong; legibility beats depth.

## Design Principles

Derived from [SKILL.md](SKILL.md)'s decision lens and [docs/design/taste-standard.md](docs/design/taste-standard.md)'s craft lens — the two authoritative sources; consult them, don't duplicate them.

- **Legibility beats depth.** One legible loop, then earn each addition. Five clever layers compound into noise.
- **Craft is belief.** Tokens over inline values; the intentional system in `constants/theme.ts` is the single source of truth. "Slop" here is *governance erosion* — those tokens silently bypassed — not a generic look. Enforce the taste that already exists.
- **Show feelings, never state them.** Mood is a sprite, a streak is a garden. No meters, numbers, or labels for anything emotional — the heart counter is the only number that earns its place.
- **The world responds now, and speaks in pictures.** A cleansed curse vanishes immediately; a claim animates on tap; a find names itself the moment it surfaces. Latency-as-default is a failure even when it's "correct."
- **Earned over bought, fair by construction.** Fairness is designed in (participation-gated rewards, server-side minting, quorums), not patched on afterward.
- **Would a designer who knows *this game* make this exact choice?** A correct-but-generic screen still fails. Ask this together with "which pillar does this serve?"

## Accessibility & Inclusion

Reduced-motion friendliness matters given the springy, hand-wound motion vocabulary. The mood system leans on sprite state and color (Sad / Content / Happy) — pair color cues with sprite pose so the readout survives color-blindness rather than relying on hue alone. No formal WCAG target is set in the charter docs; treat legible contrast on the warm cream palette and honoring the OS reduced-motion setting as the working baseline.
