# Polish findings — Barn area (2026-10-04)

49 findings (+1 found while adopting): P1 4 · P2 26 · P3 20. Fixed 45 after the primitives landed (B-26/B-27 in the Button primitive, B-33 page-header edge plus the pinned set header's edge, B-34 `STACK_SCROLL_EDGES` + `useStackScrollPad()`, B-39 `SectionHeader size="sm"`, D-d a VoiceOver "Toss" action, D-f `TILE_TYPE_CAP`, and collection tiles regain their sticker shadow), asked 1 (B-32 server data), deferred 4 (D-a, D-b, D-c, D-e). Gates at finish: tsc clean; eslint 0 errors on 23 files; full jest 297 suites / 3,357 tests green (new `barnHomePolish.test.tsx`, `barnInteriorPolish.test.tsx`); scorecard `{}`.

## Fixed (highlights)
- **B-01 (P1)** the Barn button's "+" sat inside the face button, so VoiceOver could not reach the fan at all (Satchel, truffle, Trough, Trader): it is now its own 44 pt button, "More actions". B-02 each fan row is one accessible button whose label carries its line (verify with VoiceOver in the after round).
- **B-15 (P1)** raw error codes in Barn copy ("Barn error: invalid response", "network") → `habitatTroubleCopy`.
- B-03 the earned stamp is one accessible element; B-04/B-05 coin and home chrome capped at `CHROME_TYPE_CAP` (the "25" no longer spills at accessibility-large); B-06 on phones under 390 pt Rosie draws at 0.9 scale anchored at the hooves (SE crowding); B-07 the mound tag sits above the mound, off Rosie; B-08 mound touch area reaches 44 pt; B-09 the stamp shows "·" while loading instead of a public "0".
- Interior: B-11/B-12 item card has a title, sits out of Rosie's face (floor items at the top, wall items at the bottom), B-13 clears on Decorate, B-14 announces; B-16 the rug's tap target no longer steals taps meant for Rosie; B-17 decorate outlines only for empty and selected spots; B-18 rug control on the rug's front edge; B-19 centred "Editing" pill; B-21 "Start decorating" opens Decorate.
- Gift reveal: B-24 "A milestone worth remembering" unless every gift is a Wallow gift; B-25 singular copy; B-26 full-width CTA.
- Collection: B-27 tile buttons bottom-aligned; B-28 placed items offer no misleading "Place"; B-29 names wrap fully (capped); B-30 one "Rank N" tag per Wallow-gift row; B-33 ~33 pt of fixed header recovered (balance joins the title row as the Shop's sun pill); B-35 clearer set progress; B-36 rarity colours match the Shop.
- Satchel: B-38 catalog cells read properly to VoiceOver; copy fixes in the bury and buried sheets.

## Primitive asks
Sticker/Tag set `accessible` whenever a label is passed (a label on a non-accessible view does nothing on iOS) · gradient `Button` variants put `full`/`style` on the inner gradient, not the pressable · `StackPage` pads top/sides only; stack scrollers use `SPACE.xl` + inset at the bottom, not `TAB_SAFE` (B-34 hard clip 34 pt above the bottom) · `Sheet` header mask (B-37) and the close's role on device (B-40) · `SectionHeader` small size for use inside sheets (B-39) · a lower chrome cap or smaller role for 2-up tile names (D-f) · `HangingSignsTabBar` signs read as generic elements, not buttons.

## Server data
**B-32 (P1)**: in prod the six retired decor items (`dried_herb_garland`, `barn_bunting`, `muddy_paw_rug`, `reading_chair`, `tiny_radio`, `midnight_rafters`) still carry `habitat_items.prestige_rank`, so the Furnish list shows them as rank gifts. `20260922100000_endless_wallow.sql` §2 nulls them and appears unapplied (build 197's changelog already lists that push as pending). Pushing it on the founder's go fixes this; no new migration.

## Deferred (P3)
D-a VoiceOver can move behind the fan's scrim · D-b the Barn intro hard-codes "80 designs · 20 bonus" and says "No Motes needed" (test-pinned; founder call) · D-c the gift reveal has both an X and "Later" (an app-wide dialog decision) · D-d the Satchel's toss is long-press only, no VoiceOver action (needs a Sticker accessibility-action slot) · D-e overlapping outlines in an all-empty starter room (furniture-size ruling) · D-f "Cloudspotter's" still breaks mid-word at large text on 375 pt tiles.
