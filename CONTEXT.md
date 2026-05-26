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
- **RPC layer** — `utils/rpc.ts` exports a single generic `rpc<T>(name, params?)` that absorbs the supabase-rpc cast + null/error handling for every call site in the app (~67 sites). Errors flow through `log.error()` to Sentry; callers receive `T | null` and pattern-match on the result. Named typed wrappers per RPC grow organically alongside each feature's deepening (see `utils/activeEffects.ts`, `utils/friendships.ts`).
- **Friendships layer** — `utils/friendships.ts` owns the friendship contract: the `FriendshipStatus` type, `FRIEND_CAP_LIMIT`, the `friendActionMessage(reason, cap, name)` error-to-copy helper, and typed wrappers around the six friendship RPCs (`getFriendIds`, `sendFriendRequest`, `acceptFriendRequest`, `cancelFriendRequest`, `getSuggestedUsers`, `searchUsers`). Render surfaces (Friends, UserSheet, Leaderboard, Inbox) consume it. Moderation (block / report) stays outside — different domain.
- **Barn orchestrator** — `components/Barn.tsx` is the home-screen orchestrator. Four hooks own the data + logic subsystems it used to inline: `useHomeStats` (stats state + `home_stats` RPC + refresh), `useStipend` (Slop Club monthly claim), `usePassEvents` ("X just trotted past you" dedup + toast emission), `useLuckyPig` (trigger / window / double rolls + AsyncStorage persistence + burst-modal + title-unlock). Cross-hook coupling is explicit via callback props at the top of Barn — `onClaimed: homeStats.refresh`, `showToast: barnShowToast`. Pure roll math lives in `utils/luckyPig.ts` and is unit-tested. Toast queue, heart floats, alignment watcher, six-seven easter egg, release-notes modal, tickle handlers, and pig animations stay in Barn.
- **IAP adapter pair** — `utils/iap.ts` defines an `IAP` interface and two plain-object adapters: `realIAP` (wraps RevenueCat) and `noopIAP` (cancelled / empty for every method). Module-level `iap = IAP_ENABLED ? realIAP : noopIAP` picks one at load time; public re-exports (`isPro`, `presentPaywall`, etc.) delegate. Kill-switch decision concentrates at the seam instead of branching inside each function body. A future `mockIAP` for tests slots in as a third adapter with no call-site changes.
