# Polish findings — Season area, incl. the dig (2026-10-04)

45 findings: P1 7 · P2 21 · P3 17. Fixed 42, asked 2, deferred 1. Gates at finish: tsc clean in these files; eslint 0 errors on 24 files; the 16 Season/dig/drum suites green (208 tests, 23 new or updated); scorecard `{}`. Layout reasoned with font metrics and layout arithmetic.

## Fixed (highlights)
- **S-01** the verb strip's sun now means "this panel is open" (as on the tab bar and `SegmentedControl`); "act now" is the pass track's rose "!" badge, spoken too. S-02 a hairline edge appears once content scrolls under the pinned strip; S-03 above `CHROME_TYPE_CAP` the title row and strip scroll with the panel; S-04 strip values capped, the drawn cell reads "Drawn"; S-05 the pass head wraps.
- **S-06 (P1)** the whole-ladder sheet showed "Coming soon" above a "Join" that did nothing: one Slop Club ask that follows `IAP_ENABLED`; S-07 never two; S-09 one ready tier claims from its own row (the bar only for two or more).
- S-10 the drum shows a countdown ("the drum turns in 8h 43m"), not "Monday 00:00 UTC"; S-11 no orphan word; S-13 the Feed meter says truffles, not finds; S-14 the stage meter collapses to one line when labels can't fit.
- **S-18/S-19/S-20 (P1)** the guide's × read "To the patch"; its button only closed; a destructive "leave your Sounder" door sat in the help card although the page holds no Sounder: Close named, "Back to the season", door and wiring removed. S-21/S-22 two wrong facts in the guide fixed; S-23 the Hungerer drawn as the crowned pig, not a red ogre.
- **S-24 (P1, routed)** the guide/story/tale cards' × sat inside the scroller and scrolled away: the scaffold's frame is now the card (`components/season1/seasonCard.ts`) with a pinned close (tested). S-26 the tale's sound chip no longer covers the caption; S-28 one honest CTA label.
- S-30 the tickle receipt gives swaps, trades and the Trader three different marks.
- Dig: **S-31 (P1)** Tie / Dig deeper pinned below the scroller (never off-screen on an SE); **S-32 (P1)** the shut gate's spoken label matches what's drawn; S-34/S-35 "+0" muted and a zero tally gets a quiet card; **S-37 (P1)** the uncrewed receipt's join goes to Friends ▸ Sounder after the dig closes.
- Every × in the area is named "Close"; failed quest claims toast; dead code removed.

## Primitive asks
1. `ActionSheet`: drop the trailing "Close" button (the sheet's × is the close) (049).
2. `PageHeader` tab variant: an optional type cap for a pinned title row (Friends, Shop, Me share the large-text problem).
3. A shared scroll-edge treatment for pinned headers and sheet headers (Season draws its own hairline for now).
4. A sanctioned sticker-card frame on `AdaptiveModalScaffold` (so `seasonCard.ts` folds into it), and an `accessibilityHint` on `DialogCloseRow`.

## Asked / deferred
S-12 the Draw panel's empty lower half: three lines and one act is the 2026-09-21 ruling; adding a purse table is a product call. S-29 the tale video's end frame reads "JULY 11": needs a re-cut.

## Outside this area (for the lead)
`app/_layout.tsx` login tale button says "To the season" while landing on the Barn · `hooks/useDigEntry.ts:30` still sends uncrewed classic-patch diggers to the Season tab (no herd door there since 2026-09-21) · quests say "fresh ones Monday" but reset at Monday UTC (Sunday evening in the Americas): needs a server reset time.

## Proposed taste-log lines
On the Season verb strip, sun means "this panel is open" and act-now is the rose "!" badge (amends the 2026-09-16 Almanac spec). A centred Season card is the scaffold's frame, and its × is pinned.
