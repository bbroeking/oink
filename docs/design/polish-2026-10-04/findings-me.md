# Polish findings — Me area (2026-10-04)

54 findings: P0 0 · P1 5 · P2 15 · P3 34. Fixed 51 (after the primitives landed: ME-01 W1+ passport, ME-02/ME-11 the invite row's Share is a `NavRow action` reachable by VoiceOver, ME-53 two-line names; the Referral Rewards stopgap strip was removed and the Share sits on its empty state), founder decision 1 (M-12), on-device check 1 (M-11), deferred 1 (ME-54).

## Fixed (highlights)
- ME-01 (071, P1) Passport portrait drew only the hat: W0 now `PigAvatar mode="worn"` + ink border; W1+ keeps the ring (hat-only case asked as M-01).
- ME-02 (072, P1) Invite row Share unreachable by VoiceOver: stopgap code + Share strip on Referral Rewards (`components/ReferralShareButton.tsx`); real fix asked as M-02.
- ME-03 (082, P1) "Your Recruits" over a global board → "Top Recruiters" + hand line and Share.
- ME-04 (075, P1) Rank sheet mixed live (mood-slowed) and rank refill → rank clock everywhere.
- ME-06 (080, P1) Referral rung badges couldn't hold "1,000" → capsules, grouped numbers, `CHROME_TYPE_CAP`.
- ME-05 version: footer = app version (1.3); What's new shows the note's date; new 2026-09-22 note.
- Achievements error state with retry; lifetime sheet error state; Settings sub-flows return to Settings; recap folds repeated visits (`groupBarnVisits`, tested); curse row on `curseSurface`; dashed rules that never drew on iOS now use `DashedRule`/`Divider`; FREE RANGE is a status, not a pill; stats top-aligned; feedback chips show selection; Close labels unified; copy fixes.

## Primitive asks
M-01 PrestigeAvatar passes `mode` to PigAvatar · M-02 (P1) NavRow action slot outside the grouped button · M-03 NavRow label includes sub + badge · M-04 TextField code variant lighter placeholder · M-05 Button/NavRow icons scale with text (≤2×) · M-06 Tag flat (no shadow) for read-only status · M-08 ProfileIdentity two-line name · M-09 Ribbon owns its clip layer · M-10 EmptyState `flush` · M-11 on-device check: Settings rows/back link role · M-12 decision: confirm buttons purple or rose primary (all or none).

## Server copy (needs a migration)
S-01 "Fulfill 1000 trades." → "1,000" (and other 1000-tier achievements) · S-02 "full Dig-Off week" names a retired feature (achievement, title description, `20260829010000` announcement) · S-03 friend-count achievements say "sounder" (now the 8-pig crew): "Small/Full Sounder", "20 / 100 friends in your sounder" · S-04 scuffle achievements reward a retired mode · S-05 "Unearth The First Truffle." casing · S-06 optional: name the visitor in the `barn_visit` title.

## Deferred
ME-54 rank-sheet title "Wallow Rank N" (from `utils/wallow.ts`, shared with Season).

## Proposed taste-log lines
A status is printed on the card; a hard shadow means "press me". Anything opened from Settings goes back to Settings when closed without finishing. A sheet shows one number for one thing. A recap folds repeated notes into one row naming each pig once.
