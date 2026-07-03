---
title: "Clans — client build-out audit (what a player can and can't do today)"
type: memo
date: 2026-07-03
tags: [mud-wars, clans, sounder, audit, season-2, ui]
status: draft
---

# Clans ("Sounder") — build-out audit

What the clan surface actually supports end-to-end today (behind `mud_wars`, `hooks/useFeatureFlags.tsx:29`), and the concrete gaps to call clans "built out". Code-grounded, 2026-07-03.

## Lifecycle coverage

| Step | Where | Status |
|---|---|---|
| Launch nudge | `SounderLaunchModal` (`app/_layout.tsx:717-731`); `GreatHungerIntroModal` CTA (`components/GreatHungerIntroModal.tsx:118-119`) | DONE |
| Hub entry | Friends tab "Sounder" segment → `SounderCard` (`app/(tabs)/friends.tsx:47,144`) | DONE |
| Create + name (≤24 chars) | `SounderCard.tsx:119-143` → `create_crew` (`utils/mudWars.ts:245`) | DONE (name set at create only) |
| Invite friends (are_friends-gated) | `SounderCard.tsx:189-214`; `hooks/useCrew.ts:121` | DONE |
| See/accept/decline invite | `SounderCard.tsx:96-117`; realtime `useCrew.ts:77-86` | DONE (invisible outside the segment — gap #4) |
| Roster | `SounderCard.tsx:146-172`; war pips `app/mud-war.tsx:564-568` | DONE |
| Leave | `SounderCard.tsx:227-231` → `leave_crew` | DONE |
| Disband / transfer leader | implicit via `leave_crew` (auto-delete when empty, auto-promote oldest) | MISSING explicit UI |
| Rename crew / kick member | — (no UI **and no RPC**) | MISSING |
| Crew profile screen | — (crew exists only as a card / name string) | MISSING |

War lifecycle is fully present: challenge house/crew (`app/mud-war.tsx:262-286`), accept/decline (`:320-347`), ladder (`app/clan-ladder.tsx`).

## Gaps ranked by player impact

1. **Redeploy picker missing (dead RPC path).** Full stack exists — `redeploy_member` RPC (`20260667`), `utils/mudWars.ts:323-333`, `useMudWar.redeploy` (`hooks/useMudWar.ts:276-287`) — but `app/mud-war.tsx:75` never destructures `redeploy` and `FrontBoard` only renders the token status text (`components/mudwar/FrontBoard.tsx:128-130`; self-documented gap `:13-14`). A misplaced member cannot be moved by anyone.
2. **No war/crew push deep-links, server AND client.** `utils/notificationRouting.ts:12-18` knows only `trade/friends/achievements/account/season`; no migration emits a war screen. A 5–7-day async war has zero re-engagement push ("line under attack", "war resolved", "crew invite").
3. **No leader controls at all** — rename/kick/transfer RPCs don't exist. Bad names are permanent; griefers can't be removed; leadership moves only by the leader quitting.
4. **Crew invites invisible outside Friends→Sounder.** `components/Inbox.tsx` has no crew handling; the hub badge counts only friend requests + trades (`app/(tabs)/friends.tsx:67-80`).
5. **No crew identity beyond a name.** `crews` = `id, name, leader_id, is_bot, created_at (+next_war_at)` (`20260647…:33-40`); no emblem/color/motto/tag; no profile screen. The only "identity" item is the *personal* `crew_pennant` hat (`20260650…:32`). Path: `set_crew_name` RPC + leader-gated edit; `emblem_key`/`color` columns + a picker cloned from the titles/closet selection UI; a crew profile screen hosting name + emblem + `crew_leaderboard` rating (`utils/mudWars.ts:157-164`).
6. Minor: `resolveWar` wrapper uncalled (lazy server resolve — fine); legacy `sling` path superseded by the throw minigame; siege modifier display-only by design (`constants/mudFights.ts:93`).

## The "Sounder" rename landmine

**"Sounder" is overloaded across THREE features — a naive find/replace to "Drove" breaks two of them** (`constants/featureFlags.ts:14-15` documents the collision):

1. **War crew (clan)** — the actual rename target: **29 UI strings across 7 files** — `app/(tabs)/friends.tsx:47,97`; `app/clan-ladder.tsx:50,61,63,69`; `app/mud-war.tsx:233,235,247,249,273,311,313,335,623`; `components/SounderCard.tsx:121,123,128,141,229,243,247,257,259`; `components/SounderLaunchModal.tsx:70,79`; `components/GreatHungerIntroModal.tsx:118,119`; `components/mudwar/FrontBoard.tsx:244`.
2. **Referral network** ("your Sounder" = pigs you referred) — `app/sounder.tsx`, `app/sounder-progress.tsx`, `components/Account.tsx:526,543,837`, `components/TroughSection.tsx:64,152,352` (live group-buy copy), `components/ItemPreviewModal.tsx:357,383`, `components/ReferralCodeEntry.tsx:137-138`, `utils/referrals.ts:67,79`, `constants/release_notes.ts:39`, `app/_layout.tsx:554`.
3. **Community flavor** ("the sounder" = the herd) — `AlignmentSchismModal`, `ActiveEffects.tsx:39`, `UserSheet.tsx:621`, `BountyCard.tsx:62`.

Open sub-question: post-rename, does the Friends-hub header "Your Sounder" (`friends.tsx:97`) stay referral-flavored or become the Drove hub? Route `/sounder` is the referral leaderboard, further muddying naming.

## Connects to
- [[mudwar-whats-next-2026-07]] — rollout preconditions this feeds (rename = precondition #1)
- [[mudwar-challenge-options-2026-07]] — the mechanic decision memo
- [[mudwar-consolidated-brief-2026-07]]
