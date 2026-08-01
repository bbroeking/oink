# Rosie's Ramble — expedition v0 (playable slice)

The idle-battler mode for Tickle the Pig, as a **fully playable, client-local, dev-gated slice**. No server, no migrations, no real currency — a pure TypeScript sim with AsyncStorage persistence, built to prove the loop and the UI before the real (server-authoritative) build.

**One sentence:** send your pig rambling down the road while you're away; dress her in gear that decides how she fights, and come home to the story of what happened.

## Play it

Dev builds only (`__DEV__`): navigate to **`/expedition`**. The loop end-to-end:

1. **Send-off** — equip 4 gear slots, draw 3 Tricks and tuck 1, give a send-off tickle (a real head start: charge carries into the first wall). The prediction sticker states the outcome in words before you commit.
2. **Away** — Rosie walks 1 segment/hour off real elapsed time (8h cap). The dev drawer (bark bar, bottom) warps +1h/+8h and resets.
3. **Postcard** — the return ceremony: itemized finds, the wall story, what the gear did, one comedy beat.
4. **Wall fight** — tickles charge Zoomies (shown as sparks and sprite energy, never a number); at full charge she bursts. Play the tucked card once per fight. She is never hurt — only stalled, warmly.
5. **Training / Bestiary** — tuck duplicate cards for permanent +1s; defeated enemies light their ink-silhouette pages.

The tickle jar refills +1 per 10 real minutes (cap 20), so the slice self-sustains in playtesting.

## Where the code lives

| Layer | Files |
|---|---|
| **Sim kernel** (pure, clockless, seeded-deterministic) | `utils/expedition.ts` — types, catalogs (6 gear · 8 Tricks · 4 enemies · the 12-segment chapter-1 road), `settle()`, `tickle()`, `playCard()`, `predictFight()`, `nextObstacle()`, ability-recipe interpreter |
| **State adapter** | `hooks/useExpedition.ts` — AsyncStorage (`expedition_v0`), settle-on-open, persist-per-action, dev warp |
| **Screen shell** | `app/expedition.tsx` — dev gate, journal|fight routing, dev drawer |
| **Components** (this directory) | `JournalHome` (send-off + road), `RoadMap`, `GearRack`, `CardHand`, `StatPips`, `PostcardModal`, `ScuffleView` (fight), `TrainingSheet`, `BestiaryShelf`, `RosiePose`/`RosieCharged`, `EnemySilhouette` (hand-drawn ink SVGs), `ZoomiesMeter` (spark art), `Ceremony` (shared spring+Tape entrance) |
| **Tests** | `__tests__/expedition.test.ts` — 50 tests: determinism, away cap, regen math, cushion gating, fight math, tuck lifecycle, refusals, prediction honesty, kernel purity guard |
| **Design docs** | `docs/expedition-idle-battler-plan.md` (master plan: charter check, genre research verdicts, server design, rollout phases, decision log) · `docs/expedition-v0-playable-spec.md` (this slice's contract) · `docs/idle-battler-genre-research.md` (the 12 load-bearing genre mechanics) |
| **Critique history** | `.impeccable/critique/*__components-expedition.md` (trend 22 → 27; P3 backlog lives there) |
| Tokens touched | `constants/theme.ts` — added `TYPE.cardTitleSm`, `TYPE.kickerPillSm` (additive only) |

The old throwaway prototype (`app/idle-battler-prototype.tsx`) is untouched, kept for comparison.

## Design laws this code is built around

- **Legibility:** predict a fight ±20% from the send-off screen; when wrong, see why in one glance (`predictFight` returns `{verdict, why}` — the law is the return type).
- **Honesty:** copy never promises what mechanics don't deliver — wasted spends are kernel-refused, advice is keepable, the postcard's claims are ledger-true.
- **No shame states:** absence never hurts; walls wait warmly; no pig HP.
- **Feelings shown, never numbered:** Zoomies is sprite energy + sparks; only progression numbers (HP, stats, jar) are digits.
- **Taste law:** tokens only, Sticker vocabulary, zero emoji, hard zero-blur shadows, all motion through `useMotionPolicy`.
- **Tuck lifecycle:** a tucked Trick rides the whole trip *including* the fight at its end, and comes home only when a trip completes on the open road.

## Verify

```
NODE_OPTIONS="--max-old-space-size=8192" npx jest __tests__/expedition.test.ts   # 50 tests
npx tsc --noEmit
```

## What this slice is NOT (yet)

Server RPCs/migrations, real tickle/snout integration, the Sounder Scuffle (co-op boss pooling — gates public launch), companion signature abilities, Critter cards, real art (gear borrows hat PNGs; enemies are placeholder-canonical ink silhouettes). The path from here is `docs/expedition-idle-battler-plan.md` §6: this kernel becomes the client parity mirror of the server settle, exactly like `utils/rooting.ts` ↔ `submit_rooting`.
