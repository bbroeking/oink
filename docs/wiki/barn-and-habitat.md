---
title: Barn, Exterior, Interior & Habitat
aliases: [barn, exterior, interior, habitat, home-screen]
tags: [system, core-loop, home, orchestrator, draft]
status: draft
sources:
  - code: components/Barn.tsx
  - code: hooks/useHomeStats.ts
  - code: hooks/useStipend.ts
  - code: hooks/usePassEvents.ts
  - code: hooks/useLuckyPig.ts
  - code: hooks/useActiveEffects.ts
  - code: constants/slots.ts
  - doc: CONTEXT.md
last_compiled: 2026-06-13
---

# Barn, Exterior, Interior & Habitat

The **Barn** is the player's home — the first tab and the orchestrator for the tap loop, stats, and home-screen popups. The design splits it into an **Exterior** (outdoor scene + a clickable barn building) and an **Interior** (a decoratable **Habitat** of 6 typed slots), but only the Exterior-equivalent ships today.

## How it works

`components/Barn.tsx` is the home-screen orchestrator (`CONTEXT.md` "Barn orchestrator" seam). It renders Rosie over a `BarnOverlay` themed by alignment + blessed/cursed, the two paper stat tickets, the Hoofprints chip strip, the buried-truffle mound, the country flag, and the toast/popup machinery. The tickle handler (`handleIncrement`) spends from the tickle bank, plays a laugh, spawns heart floats, rolls the lucky pig, then commits via the `update_profile_and_item_count` RPC (`components/Barn.tsx:487`).

Barn owns **five hooks** that each own a subsystem it used to inline (`CONTEXT.md` Barn orchestrator seam; `components/Barn.tsx:44-53`):
- `useHomeStats` — `stats` (counter, balance/cap, regen, equipped cosmetics, season tier) via the single `home_stats` RPC, with a dev multi-query fallback (`hooks/useHomeStats.ts:117`).
- `useStipend` — Slop Club monthly claim, idempotent per UTC month (`hooks/useStipend.ts`).
- `usePassEvents` — "X just trotted past you" toasts, deduped (`hooks/usePassEvents.ts`).
- `useLuckyPig` — trigger/window/double rolls + AsyncStorage + burst/title modals (`hooks/useLuckyPig.ts`).
- `useActiveEffects` — derives `{blessed, cursed, sunBeam, phantomItch}` predicates that theme the overlay, boost lucky-pig, and gate the phantom-itch miss (`components/Barn.tsx:307-316`).

Cross-hook coupling is explicit via callbacks (`onClaimed: fetchStats`, `showToast`) (`components/Barn.tsx:336,410,415`).

**Exterior / Interior / Habitat** are the documented bifurcation (`CONTEXT.md` Barn/Exterior/Interior/Habitat entries): the outdoor scene with a clickable barn opening a door-swing Interior of 6 typed slots (back wall, ceiling hanging, floor-left/right, centerpiece, accent) plus an interior background. This is a **design spec, not yet built** — see Open questions.

## Key files
- `components/Barn.tsx` — home-screen orchestrator: render tree, tickle handlers, toasts, popup queue wiring.
- `hooks/useHomeStats.ts` — `stats` slice + `home_stats` RPC + `refresh()` other hooks call after mutations.
- `hooks/useStipend.ts`, `hooks/usePassEvents.ts`, `hooks/useLuckyPig.ts`, `hooks/useActiveEffects.ts` — the four supporting subsystem hooks.
- `constants/slots.ts` — the equipped-**cosmetic** slots worn on the pig (head/face/neck/aura/held/tickle/background/flag); distinct from Habitat slots.

## Connects to
- [[core-loop-and-tickle-trade]] — the tickle handler + bank spend live here.
- [[regen]] — `home_stats` supplies cap, `nextRegenSeconds`, and the true per-tickle `regenSeconds`.
- [[happiness-and-mood]] — `stats.happiness` drives Rosie's resting idle animation.
- [[alignment]] — `checkAlignment` hydrates the label that themes `BarnOverlay`.
- [[blessings-curses-effects]] — `useActiveEffects` predicates gate the loop + theme the scene.
- [[lucky-pig]] — `useLuckyPig` window/double rolls fire on each tap.
- [[trough]] — over-cap bank values (28/25) come from trough/event grants.
- [[shop-cosmetics-closet]] — equipped cosmetics in `stats` render on the pig; Habitat items would route to Interior slots.
- [[battle-pass-and-slop-club]] — `useStipend` claims the monthly Slop Club payout; season tier shows here.
- [[world-cup-allegiance]] — the bottom-left Barn flag opens the country picker.
- [[barn-visiting]] — friends visiting see your decorated Interior + mood.
- [[streak-and-garden]] — the Garden (streak readout) is slated for the Exterior ambient layer.
- [[seasons-and-judgement-day]] — season tier/`total_tiers` surface in `stats`.
- [[architecture-seams]] — the "Barn orchestrator" seam documents the five-hook split.

## Open questions / risks
- **Exterior/Interior/Habitat are unbuilt.** No `habitat` code exists; `constants/slots.ts` is cosmetic equip slots, not the 6 Habitat slots. The current Barn tab is the de-facto Exterior with no clickable-barn → Interior transition yet. Marked `status: draft` until shipped.
- **Two channels for active effects.** Barn's `useActiveEffects` and `BarnActiveEffectsStrip` subscribe independently — noted as "wasteful but cheap" (`components/Barn.tsx:304`).
- **Alignment is fetched twice.** `home_stats` omits `alignment_score`, so `checkAlignment` does a separate `profiles` read on every focus (`components/Barn.tsx:468`).
