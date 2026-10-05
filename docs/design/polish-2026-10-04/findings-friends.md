# Polish findings — Friends area (2026-10-04)

45 findings: P1 8 · P2 19 · P3 17 · 1 not a defect. Fixed 34, asked 5, deferred 5. Gates at finish: eslint 0 errors on touched files; jest 28 suites / 335 tests green (updated `friendRitualDoors`, `pairRankingsNavigation`; added `__tests__/friendsPolishCopy.test.ts`); scorecard `{}`.

## Fixed (highlights)
- F-01 (022, P1) Inbox printed the raw ritual id ("warm_tea"): `ritualFeedLine` shows the name, or nothing for an unknown kind.
- F-02 (035, P1) Enemies and Global/Friends kept the previous list's scroll: `key` per list.
- F-03 (032, P1) Rankings kicker now matches the board (all-time tickles / bonds / curses).
- F-04 (034, P1) "(you)" marks your own name in a pair (`PairNames`).
- F-05 (021, P1) "Account" → "Me tab"; "Discriminators" dropped from copy.
- F-06 every sheet X is a button named "Close"; F-08 `CHROME_TYPE_CAP` on the hub's fixed controls.
- F-09 profile sheet counts rituals in the list's words (`allowanceLine` in `hooks/useRitualDoor.ts`, shared by three surfaces); F-10 profile sheet keeps its height across segments; F-25 Ask hint drops the Season 0 "greedy" line.
- Rankings: F-13 leader card no longer truncates; F-14 new pinned "your rank" row on Global (one count query; none for hidden/test accounts; the demo account is hidden, so check with a ranked account); F-15 the Bonds/Enemies switch scrolls with the list and "Pairs" sub-option renamed "Bonds"; F-16 edges at `PAGE_PAD`; F-29 fixed-width avatar slot.
- Sounder: F-17 one gold CTA ("Recruit any snout" is lilac); F-18 "Festival Pennants" wraps; F-19 duplicate gold "Done" buttons removed.
- Inbox: F-20 "you gave … and took …"; F-21 band spacing; F-22/F-23 outcomes and failures are toasts.
- Small: dangling "•" on wrap, typed ♥ removed, "(you)" consistent, milestone wraps on SE, enemy hint once on the poster, dev preview curse styling.

## Primitive asks (all landed and adopted: F-08, F-11, F-12, F-24, F-27, F-28, F-30 now fixed; each scroll edge lives on the list that scrolls under the crown, so it resets per segment and ranking)
A-1 `SegmentedControl`: the 4-up uppercase hub nav still breaks mid-word at 1.3× (needs ~1.2× on 402 pt, 1.1× on 375 pt); change the label role. A-2 `Sheet`: scroll area clips full-width shadows; bleed by `LIST_BLEED`. A-3 `ProfileIdentity`: space before `#code`; one consistent title line in rows; one casing rule; two-line names instead of "…". A-4 a scroll-edge crease under fixed controls (Friends, Season, Shop, Barn all need it).

## Deferred
F-07 visit "Leave" reads as static text (source is a labelled Button pinned by a test; check on device). F-31 Confetti Aura art is faint (needs an art regen). F-43 "Friends" three times at the top of the hub (nav-above-title order was ruled 2026-09-14; founder call).

## Server copy
None from the database. Question: `chorus_glow` in `utils/rituals.ts` still says "Regen runs double", but rituals have been cosmetic since 2026-09-14.

## Play together door
`Friends`/`FriendsList` take a `top` slot rendered first in the list header (above the ritual line, and above empty/loading/error states; not on Add). Insertion is one line in `app/(tabs)/friends.tsx`: `<Friends userId={userId} top={<PlayDoor />} />` (import `PlayDoor` from `@/components/play/PlayDoor`).
