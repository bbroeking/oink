# Shop — pass 3: one store, one catalog, one try-on bar (2026-09-17)

Founder, after the hero fitting room (A2·V1) shipped: *"The shop is still way too messy and the
flow between the different tabs and sections is completely broken."* This pass is the spec for the build.
**Status 2026-09-17: the founder chose A · The Counter on the canvas (Round 2); §2–§7 below match the Round 2 boards exactly.** Evidence is the live dev build on the 17 Pro (`img/`), read against `app/(tabs)/shop.tsx`,
`components/ClosetView.tsx`, `components/shop/*` and the 09-16 / 09-17 rulings in `SKILL.md` and
`docs/design/taste-standard.md`.

Prior rounds: `../claude-design/shop-2026-09-16/` (the Storefront), `../claude-design/shop-2026-09-17/`
(one aisle → A2·V1 flanked).

## 1 · What is actually broken (seen, not guessed)

| # | Symptom | Where | Why it reads as mess |
| --- | --- | --- | --- |
| 1 | **The shop is below the fold.** The first screen is the paper doll + Title chip; nothing for sale is visible until you scroll. | `img/01` | A tab called Shop opens on a wardrobe. The chalkboard, signs and first shelf all start under the fold. |
| 2 | **The folded strip is an overlay, not a header.** It is `position: absolute` with no layout height, so it sits on top of the first shelf's coasters, on the "after the shelves" kicker, and on the top row of closet tiles. | `img/02`, `img/03`, `img/04`; `FittingStrip.tsx` `wrap` | Content is hidden under chrome at three different scroll positions. The strip also keeps offering a `Closet · 13` door while you are already inside the closet. |
| 3 | **An empty counter still draws.** With no crewmate buys today the wooden counter face and lip render as ~130pt of blank wood. | `img/02`; `Counter.tsx` (`scene`/`face` always render) | Ruling 2 (09-16) says a friend who bought nothing is absent. The furniture stayed. |
| 4 | **Two grammars for one item.** Shelf coaster: price / `Wear` / `Wearing`, gold lock = members. Closet tile: `Owned` / `Not owned` / `Wearing`, no price, a lock on *every* unowned item. | `img/04`; `ClosetView.tsx` tile foot vs `Shelf.tsx` | The same Wizard Hat is a price on the shelf and a padlock in the grid. The lock means "members" upstairs and "not yours" downstairs. |
| 5 | **"Your closet" is the whole catalog.** The crown says 13 owned; the section under it lists ~127 items (Hats: 4 owned · 17 missing) behind a 5-chip filter row. | `img/03` | The closet is the old Browse room renamed. The Closet sign's number and the section's contents disagree. |
| 6 | **One row of signs, three behaviours.** Closet = scroll down this page; Pen = swap the whole page for a room; Furnish = push another screen. In the Pen the row changes to Store · Closet · Furnish and the chalkboard disappears. | `img/01`, `img/05` | Identical-looking doors do different things, and the doorway is not the same doorway once you walk through one. |
| 7 | **Instructional slop.** A dashed sticker: *"Owned items dress Rosie. Unowned items open a preview."* | `img/03` | The taste standard's own rule: a control that needs a caption is the wrong control. |
| 8 | **The Title chip jumps to the bottom of the world.** Tapping it `scrollToEnd`s past every catalog tile to the Titles footer. | `ClosetView.tsx` `scrollToTitles` | A ~3,000pt jump for a nameplate. |
| 9 | **Header carries an unrelated chip.** The Golden Ticket scanner sits beside the balance on every scroll of the shop. | `img/01` | Redemption is a Me thing. |
| 10 | Furnish lands in a screen with a different language (segmented control, search field, blue info card). | `img/06` | Out of scope here, but the seam is felt. Ruled 09-17: Furnish is a door out. Keep it that way; fix that screen on its own. |

Root cause, in one line: **the page stacks three surfaces (fitting room, store, catalog) and then
adds a fourth (the folded strip) to stitch them, and the doorway row mixes scroll, swap and push.**

## 2 · Information architecture (Round 2 · A · The Counter)

The Shop tab is **a store with your pig pinned above it**. One screen, one scroll, no in-tab rooms.
Board names are the canvas's (`../claude-design/shop-scratch-2026-09-17/`, page "Round 2 · The Counter").

```
Shop (tab)  · board Main                          ← one FlatList; nothing swaps the page
├─ Header: ★ the shop · Shop · [snout pocket]      ← Golden Ticket chip leaves for Me
├─ Try-on bar (STICKY, real layout height)        ← replaces BOTH the hero and the folded strip
│    row 1: [her window 56pt] · "wearing 8 of 8" + "Mud Baron Rosie" · [Fitting room chip]
│    row 2: 8 pegs (hat bow face neck held tickles aura bg), each with a ✕
│    her window AND the chip open the Fitting Room sheet
├─ Doorway: chalkboard (★ back at sunrise · 3h 46m) · signs: Pen · Furnish   ← both PUSH
├─ Today's drop        3 planks × 3 coasters
├─ Slop Club shelf     gold band; its sign pushes /pen; gold lock for non-members
├─ At the counter      only when buys.length > 0 (the whole scene absent otherwise)
└─ Everything          · boards A_Everything (Owned) and A_All (All)
     crown: kicker "the whole rack" · title "Everything" · right = the segment's count
     segment: Owned (13) · All (127) · Members       ← default Owned = your closet
     category chips: Hats · Bows · Face · Neck · Held · Aura · Tickles · BG (scroll-to)
     sections per category, collapsible, "4 of 21" (All adds "· 2 on the shelf")
     ONE card grammar (tile and coaster alike):
       sun price   = on the shelf today, buyable
       grey price  = not today (the sheet says when it comes back)
       Wear        = yours, not worn      Wearing (sage, check) = yours, worn
       gold lock   = members only, you are not a member
       Season pass = cost 0, earned

Fitting Room (sheet)  · board A_FittingRoom        ← from the bar's window or chip
├─ kicker "★ the fitting room" · title "Mud Baron Rosie" · right "wearing 8 of 8"
├─ paper doll: 4 slot tiles a side, her window 160×184 between, ✕ takes off
├─ Title ROW (one row, never a chip pile): crown glyph · "title · before her name" / "Mud Baron" · "14 earned ›"
└─ Done (gold)

Titles picker (sheet over the sheet) · board A_Titles   ← from the title row
├─ kicker "★ earned, never sold" · title "Titles" · right "14 of 41"
├─ search field ("Search your titles")
├─ segment: Earned · N   |   Not yet · M
├─ row "No title · just Rosie"
└─ one row per title: crown avatar · name · "<placement> · <how it was earned>" · Wearing on the current

Item sheet  · board A_ItemSheet                   ← a tap on an unowned coaster/tile
├─ the item on its rarity panel ("new today" tape when in the drop) · her window "on Rosie"
├─ name · rarity tag · hand lines: what it is / which slot it swaps out / "on the shelf until sunrise · 3h 46m"
├─ TicketButton: stub = price, face = "Buy it · 349 in the pocket"
└─ ghost hand link: "or open a Trough and let the herd chip in ›"

Pen  · board A_Pen (pushed route /pen)            ← "‹ back to the shop"; Account and the paywall deep-link here
Furnish (pushed route /barn-collection)          ← unchanged
```

What this keeps from the rulings: one scroll (09-17 r.1), Closet is a section not a room (r.2),
Furnish is a door out (09-17 product r.1), owned = one-tap wear (taste 09-17), the Pen keeps a room
(product r.2), the storefront's shelves / counter / chalkboard (09-16).

What it amends (decided by the founder on the canvas, 2026-09-17 — logged in `SKILL.md`):
- **The hero fitting room becomes a sheet; the try-on bar is the page's pig.** The folding
  mechanism, which produced defects 1, 2 and 8, goes.
- **The Pen is a pushed route, not a view state.** `?view=pen` redirects to `/pen`.
- **The Closet and Store signs retire.** "Your closet" is the Owned segment; the bar is what the
  Closet sign counted.
- **Titles are a picker, not chips.** Founder: *"we can have a lot of titles"* — one row in the
  fitting room, a searchable list behind it.

## 3 · Menu structure (what shows, in what order)

Order is *use-frequency down the page*: what she is wearing (always visible), what is new today
(the reason to open the tab), what your herd did, then the long tail.

1. **Header** — kicker `★ the shop`, title `Shop`, right: the snout pocket only.
2. **Try-on bar** (sticky) — row 1: her window (56pt, the real `PigStage` scaled, equipped
   items on), kicker `wearing 8 of 8`, hand line with the title and her name (`Mud Baron
   Rosie`; just `Rosie` when no title), a `Fitting room` chip with the closet glyph. Row 2: eight
   30pt pegs with the worn item's thumb and a ✕; an empty peg is a dashed ring. Two rows, ~96pt.
3. **Doorway** — chalkboard left, two signs right: `Pen`, `Furnish`. Same two signs everywhere.
4. **Today's drop** — three planks, three coasters each; the chalkboard is the band's header.
   Sold-out / loading states unchanged.
5. **Slop Club shelf** — gold band, `Slop Club` sign pushes `/pen`; locks for non-members.
6. **At the counter today** — the counter with figures; the whole scene is absent when empty.
7. **Everything** — crown, then one `SegmentedControl`: **Owned · All · Members**. Then the
   category chips (horizontal, scroll-to, the current one peach). Then the category sections,
   3-col tiles, one grammar (§2). Under the All grid one hand line: *a grey price is not on the
   shelf today · the sheet says when it comes back*.
8. **Footer** — tab spacer only. No Titles section on the page.

## 4 · Interaction rules

**Navigation, three verbs, three looks.**
- A **hanging sign** always *leaves* the page (push). Pen, Furnish, Slop Club. Nothing else hangs.
- A **chip / segment** always *stays* on the page: filters or scrolls. Category chips scroll; the
  segment filters; neither changes the page's shape.
- A **card / coaster / peg** always *acts on an item*: owned → wear / take off; unowned → the item
  sheet; long-press → the sheet for an owned item. `cardTapAction` applies to the tiles too, and
  to the pegs (a filled peg's ✕ takes it off; tapping the peg itself scrolls to that category
  with Owned selected).

**The try-on bar.**
- Sticky under the header via `stickyHeaderIndices` on the one list, with its own height in
  layout. It never covers content. Present at scroll 0 too: no fold state, no `onFoldChange`,
  no `closetScrollInset`.
- Her window and the `Fitting room` chip both open the Fitting Room sheet. Wear / take off inside
  the sheet updates the bar behind it live.
- The title line is the only place the title shows on the page. No "tap to pick" prompt.

**The Fitting Room sheet and the Titles picker.**
- The sheet is the current paper doll, unchanged, plus one **title row** (current title, its
  placement, the earned count). The row opens the **Titles picker** as a second sheet.
- The picker: search (filters the list as you type), `Earned · N` / `Not yet · M` segments, a
  `No title` row first, then one row per title sorted worn-first then A–Z; each row shows the
  placement and one hand line for how it was earned; tapping a row wears it and closes the
  picker (the sheet's heading and the bar's line update). `Not yet` rows are silhouettes with
  the how-line, never a price (titles are earned, never sold — 20260677).
- `TitlesSection` is retired from the page; its query moves behind the picker.

**The item sheet.**
- Leads with the thing and her wearing it; the price is a numeral on a `TicketButton` stub, the
  verb on its face; the Trough is a hand link under it, never a second button. A members' item
  for a non-member shows the lock and the ticket reads `Join the Slop Club`, pushing `/pen`.

**State that persists.**
- Segment, category collapse state and scroll offset survive tab switches and a Pen or Furnish
  round-trip (the list is never unmounted by a view swap; keep the segment in a module store).
- Deep links (`utils/shopNav.ts`): `view=wardrobe|browse` → segment Owned + scroll to Everything;
  `filter=prestige` → segment Owned + prestige chip on + scroll; `view=pen` → `router.replace('/pen')`;
  `view=daily|trough` → scroll 0. Params consumed once, as today.

**Empty and gated states.**
- Counter empty → absent. Drop empty → the existing sold-out `EmptyState` on the shelf band.
- Owned segment with 0 owned → `EmptyState` "Nothing on the rack yet" with a `Today's drop ›`
  hand link that scrolls up.
- Members-only + non-member: gold lock on the coaster/tile, price muted, tap → sheet with the
  Pen ticket. The lock means *members* and only that; an unowned non-member item wears no badge.
- Reduce Motion / VoiceOver: bar stays (a list header, met once); shelves → the 2-col grid.

**After a buy.** The sheet's success state offers `Wear it` as the primary and `Keep shopping` as
the ghost; the bar updates if worn. The card flips to `Wear` in place, no refetch wait.

## 5 · Quick wins (do first, in this order)

Each is small, independent, and removes a visible defect without waiting on the structural change.

1. **Counter returns `null` when `buys` is empty.** One early return in `Counter.tsx`.
2. **Stop the strip covering content.** Hide the strip once the "Your closet" crown is on screen
   and drop its Closet chip. The real fix is the sticky bar.
3. **One card grammar.** Closet tile foot → the shelf's `Tag`: sun price (in the drop, affordable),
   grey price (not in the drop, or unaffordable), `Wear` / `Wearing` for owned, `Season pass` for
   cost 0. Lock badge only when `members_only && !isVip`. Delete `Owned` / `Not owned`.
4. **Delete the hint sticker** in `ClosetView.tsx`.
5. **Default the catalog to Owned**, segment set Owned · All · Members (`CLOSET_FILTERS` → three
   entries, default `owned`); the crown's right slot shows the active segment's count.
6. **Title chip → the Titles picker sheet** (search, Earned / Not yet, how-earned line) instead of
   `scrollToEnd`; remove the Titles footer from the page.
7. **Golden Ticket chip → Me.** Remove from the shop header.
8. **Pen as a route.** `app/pen.tsx` renders `PigPenView` under a `PageHeader` with `‹ back to the
   shop`; the Pen sign and the Slop Club sign `router.push('/pen')`; `resolveShopParams` maps
   `view=pen` to a redirect; delete the `view` state and the Store sign branch from `shop.tsx`.

Then the structural change, one PR: **the sticky try-on bar replaces the hero + strip**, the paper
doll moves into the Fitting Room sheet with the title row, and the item sheet takes the ticket.
Everything in §5 stays valid after it.

## 6 · Decided (founder, 2026-09-17, on the canvas)

1. Hero → sheet, strip → sticky bar. **Yes** (A · The Counter chosen over B · The Mirror and C · The Rack).
2. Pen as a pushed route. **Yes.**
3. Titles leave the page: one row in the Fitting Room, a searchable picker behind it. **Yes** — "we can have a lot of titles".
4. Golden Ticket to Me. **Yes** (drawn on every Round 2 board).
5. Segment set Owned · All · Members. **Yes.**

## 7 · Build brief (hand this to the implementer)

> Implement Round 2 · A · The Counter for the Shop tab, boards on
> https://claude.ai/artifact/PkPQzpBECiqAARHqExFmZU (files in
> `docs/design/claude-design/shop-scratch-2026-09-17/`). Spec: `docs/design/shop-ia-2026-09-17/README.md`
> §2–§4. Two PRs. **PR 1 — quick wins §5 items 1–8**, each its own commit, no new components except
> `app/pen.tsx` and the Titles picker sheet. **PR 2 — the bar and the sheets**: a `TryOnBar`
> (`components/shop/TryOnBar.tsx`) rendered as the one list's sticky header with layout height
> (`stickyHeaderIndices`), the `PigStage` at 56pt with the live equipped slots, eight pegs from
> `SLOT_ORDER`, the title line from the profile; delete `FittingStrip.tsx`, the fold plumbing
> (`onFoldChange`, `closetScrollInset`, `folded`, `stripBottom`) and the hero branch in
> `ClosetView`'s header; a `FittingRoomSheet` that hosts the paper doll and the title row; the
> `TitlesPicker` sheet (search, Earned / Not yet, how-earned line); `ItemPreviewModal` gains the
> `TicketButton` commit and the Trough as a hand link. Tokens only (`constants/theme.ts`); shared
> primitives (`Sticker`, `Tag`, `Chip`, `SegmentedControl`, `SectionHeader`, `EmptyState`,
> `Glyph`); no emoji, no inline hex. `resolveShopParams` keeps every old link working (§4). Tests:
> extend `__tests__/shopShelves.test.ts` for the one grammar and `utils/shopNav` for `view=pen`;
> screenshot the store, Everything · Owned, Everything · All, the Fitting Room, the Titles picker,
> the item sheet and the Pen on the 17 Pro before the changelog.

## Canvas (same day)

Three from-scratch directions drawn on `../claude-design/shop-scratch-2026-09-17/` →
https://claude.ai/artifact/PkPQzpBECiqAARHqExFmZU. Round 1: A · The Counter, B · The Mirror,
C · The Rack. **Round 2 (page 1): A chosen and iterated** — the store, Everything · Owned,
Everything · All, the Pen, the Fitting Room sheet with the title row, the Titles picker, the item sheet.
