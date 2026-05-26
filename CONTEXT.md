# Project context

Anchors for the codebase's architectural vocabulary. Started during the architecture review that produced `hooks/useActiveEffects.ts` — kept short so it stays load-bearing rather than aspirational. Append rather than rewrite; remove only when a term genuinely no longer maps to the code.

## Domain

- **Tickle the Pig (TTP)** — cozy mobile game built on Expo 52 + Supabase. Daily blessings/curses and trades change a player's alignment (Greedy ◄──► Giver); Season 1 builds toward a Judgement Day finale.
- **Ritual** — the *sender-side* act of casting a blessing or curse on another player. Lives in `utils/rituals.ts` (metadata, daily rotation).
- **Active effect** — the *receiver-side* counterpart: a blessing or curse currently in force on the caller, surfaced by the `my_active_effects` RPC.
- **Hoofprints** — the player-facing display name for active effects ("Hoofprints on you"). Internal code uses the technical name; the term *Hoofprints* belongs to UI surfaces (sheet titles, section headers).
- **Sounder** — the player-facing name for the friends graph ("Your Sounder").

## Seams

- **Receiver-side effects layer** — `hooks/useActiveEffects.ts` + `utils/activeEffects.ts`. Single owner of the read path (fetch, focus refresh, realtime subscription on blessings + curses) and the cleanse mutation (optimistic + RPC). Render surfaces are pure consumers: `components/ActiveEffects.tsx` (Inbox panel), `components/BarnActiveEffectsStrip.tsx` (Barn chips), `components/HoofprintsSheet.tsx` (Barn bottom sheet). `components/CleanseModal.tsx` is pure UI behind `onConfirm`.
