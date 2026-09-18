# Shop · The Counter — PR 1 plan (quick wins), 2026-09-17

Source of truth: `docs/design/shop-ia-2026-09-17/README.md` §2–§7 (the Round 2 boards,
https://claude.ai/artifact/PkPQzpBECiqAARHqExFmZU). PR 1 is the eight quick wins of §5, one commit
each, in this order. PR 2 (the sticky try-on bar, the Fitting Room sheet, the ticket on the item
sheet) is not in this plan. Nothing here touches the database.

## Ground rules (the whole PR)

- **Tokens only.** No bare hex, size, radius or pad: `WHIMSY` / `UI_COLORS` / `RADII` / `SPACE` /
  `TYPE` / `BORDER` / `TILT` / `SHADOW_SM` from `constants/theme.ts`. Text through `T role=`.
  Primitives, never re-drawn: `Sticker`, `Tag`, `Chip`, `Button`, `SegmentedControl`, `SectionHeader`,
  `EmptyState`, `LoadingBeat`, `Sheet`, `PageHeader`, `Glyph` / `Icon`. No emoji anywhere.
- **One grammar, one function.** Every card state comes from `cardTapAction` (`utils/shopShelves.ts`)
  and one new pure `cardTag(...)` beside it; the shelf coaster, the fallback grid card and the closet
  tile all call it. Nothing decides a tag inline.
- **Technical names in code** (`TitlesPickerSheet`, `useJoinSlopClub`), player words in UI only.
- Keep the scorecard at 0 and `lint:web` green (2026-09 design system: `npm run scorecard`, `npm run lint`).
- Commit per item; message in the repo's voice (`fix(shop): …` / `feat(shop): …`), ending with the
  attribution line from the session reminder.

## The eight steps

### 1 · `fix(shop): the counter is absent when nobody bought today`
- **Edit** `components/shop/Counter.tsx`: `if (buys.length === 0) return null;` at the top of
  `Counter`. Drop the now-dead `buys.length > 0 ?` branch around the kicker.
- **Delete** nothing else. The "at the counter today" kicker stays for the non-empty case.
- **Test** `__tests__/shopCounter.test.ts`: add a render assertion (or a pure-helper assertion if the
  file is pure) that an empty `buys` renders nothing.

### 2 · `fix(shop): the folded strip stops covering the shelves and the closet`
- **Edit** `components/ClosetView.tsx` `handleScroll`: besides `onFoldChange`, emit
  `onClosetReached?.(y >= CONTENT_TOP + closetAnchorY.current - FOLD_BAND)` (new optional prop).
- **Edit** `app/(tabs)/shop.tsx`: `const [inCloset, setInCloset] = useState(false)`;
  `<FittingStrip visible={folded && !inCloset} …>`; pass `onClosetReached={setInCloset}`.
- **Edit** `components/shop/FittingStrip.tsx`: remove the `Closet · N` `Chip` and the
  `onPressCloset` / `ownedCount` props (the strip is a reminder only; the door is gone).
- **Edit** `shop.tsx`: drop the `onPressCloset` / `ownedCount` props at the call site.
- Leaves the strip as an overlay only while the shelves are on screen; PR 2 removes it.

### 3 · `fix(shop): one card grammar — the closet tile wears the shelf's tag`
- **Add** to `utils/shopShelves.ts`:
  ```ts
  export type CardTag =
    | { kind: "wearing" } | { kind: "wear" } | { kind: "seasonPass" }
    | { kind: "price"; cost: number; tone: "sun" | "muted" }
  export function cardTag(item: { cost: number; members_only?: boolean | null },
    s: { owned: boolean; active: boolean; inDrop: boolean; canAfford: boolean; locked: boolean }): CardTag
  ```
  Rules: active → `wearing`; owned → `wear`; `cost <= 0` → `seasonPass`; else `price` with
  `tone: inDrop && canAfford && !locked ? "sun" : "muted"`. Badge rule (separate, tiny):
  `cardBadge(s)` → `"check" | "lock" | null` — lock **only** when `locked` (members-only and not VIP).
- **Edit** `components/shop/Shelf.tsx` `ShelfItem` and `app/(tabs)/shop.tsx` `ShopCard`: replace the
  inline `owned ? … : item.cost <= 0 ? … : …` tag ladders with `cardTag`; pass `inDrop` from
  `buyableIds.has(item.id)`.
- **Edit** `components/ClosetView.tsx` tile: replace the `Owned` / `Not owned` / `Wearing` `T` with
  the same `Tag` (`tone` sun / sage / muted, `coin` for price); replace
  `name={owned ? "check" : "lock"}` with `cardBadge` (no badge on an unowned non-member item).
  `ClosetView` needs `buyableIds` and `counter` (balance) as props for `inDrop` / `canAfford`;
  `shop.tsx` passes them. **Delete** `styles.itemStatus`, `ownershipBadgeMissing` if unused.
- **Test** `__tests__/shopShelves.test.ts`: table test for `cardTag` and `cardBadge` covering
  wearing / owned / season pass / in-drop affordable (sun) / in-drop unaffordable (muted) /
  not-in-drop (muted) / members-only non-VIP (muted + lock) / members-only VIP (sun, no lock).

### 4 · `chore(shop): delete the closet hint sticker`
- **Delete** in `components/ClosetView.tsx` the `Sticker … styles.hint` block ("★ Owned items dress
  Rosie…") and `styles.hint`.

### 5 · `feat(shop): the catalog opens on Owned — Owned · All · Members`
- **Edit** `components/ClosetView.tsx`: `type ClosetFilter = "owned" | "all" | "member"`;
  `CLOSET_FILTERS` → three entries (labels `Owned`, `All`, `Members`); default `useState<ClosetFilter>("owned")`;
  `visibleItems` drops the `unowned` / `non-member` branches. Replace the horizontal `FlatList` of
  `Chip`s with `SegmentedControl` (`layout="row"`, `label="Catalog filter"`), and put the count in
  each option label (`Owned · 13`, `All · 127`, `Members · 12`).
- **Edit** the "Your closet" `SectionHeader`: `right` = the active segment's count, and the title
  becomes `Everything` with kicker `the whole rack` (the crown of §2). Rename `scrollToCloset` →
  keep the name (the handle is public) but the target is the same anchor.
- **Edit** the `ListEmptyComponent`: Owned with nothing owned → `EmptyState` title
  "Nothing on the rack yet", `Button variant="handLink"` "Today's drop ›" that scrolls to offset 0.
- `prestigeOnly` keeps forcing Owned (it already does: `owned && prestige_exclusive`).
- **Test** `__tests__/closetPrestigeFilter.test.ts` (or a new `closetFilters.test.ts`): the three
  filters over a fixture; default is `owned`; `member` = `members_only` regardless of ownership.
- **Deep links** (`utils/shopNav.ts`): unchanged in PR 1 — `scrollToCloset: true` still lands on the
  crown; `__tests__/shopNav.test.ts` must still pass untouched.

### 6 · `feat(shop): the title chip opens a Titles picker sheet`
- **Add** `components/TitlesPickerSheet.tsx`: `Sheet` (`components/ui/Sheet.tsx`) with kicker
  `★ earned, never sold`, title `Titles`, right count `N of M`; a `TextField` search (the one
  `Account.tsx` uses); `SegmentedControl` `Earned · N` / `Not yet · M`; a `No title` row first; then
  one row per title: crown `Glyph`, `T role="cardTitleSm"` name, `T role="hand" tone="secondary"`
  "`before her name` · `<description>`", `Tag tone="sage" icon="check" label="Wearing"` on the active
  one. Tap → `onChange(id)` and close. `Not yet` rows: `Glyph` silhouette (`opacity` via
  `OPACITY` token), the description line, no action. Data: move the `user_titles` query out of
  `TitlesSection.tsx` into `hooks/useTitles.ts` (owned rows + the full `titles` catalog for the
  Not-yet tab; the catalog select is `titles(id, name, placement, description)`).
- **Edit** `components/ClosetView.tsx`: the title chip's `onPress` opens the picker
  (`const [titlesOpen, setTitlesOpen] = useState(false)`); the chip's `accessibilityHint` becomes
  "Opens your titles". **Delete** `scrollToTitles`, the `TitlesSection` footer and its `styles.section`.
- **Delete** `components/TitlesSection.tsx` once nothing imports it (grep first; the Closet was its
  only host).
- **Test** a pure `sortTitles(rows, activeId)` in `hooks/useTitles.ts` (worn first, then A–Z) and
  `filterTitles(rows, query)` (case-insensitive, name only): new `__tests__/titlesPicker.test.ts`.

### 7 · `feat(me): the Golden Ticket lives in Me`
- **Add** to `components/Account.tsx`, beside the existing "Have a code?" referral section: a row
  `Sticker` with the `gift` `Glyph`, `T role="cardTitleSm"` "Redeem a Golden Ticket", hand sub-line
  "scan or type a code", `onPress={() => router.push("/scan-code")}`. Same section, one crown.
- **Delete** in `app/(tabs)/shop.tsx`: the ticket `Sticker` in `PageHeader right`, `styles.ticketBtn`,
  `TICKET_CHIP`, `TICKET_GLYPH`, the `Glyph` import if now unused.
- **Test** none new; `navigationClarity.test.ts` if it enumerates header actions — check and update.

### 8 · `feat(shop): the Pen is its own screen`
- **Add** `hooks/useJoinSlopClub.ts`: lift `handleJoinSlopClub` (and its toasts) out of `shop.tsx`
  verbatim; returns `joinSlopClub(pigId?)`. Depends on `useShopCatalog().refresh` only for the
  membership re-read → take a `refreshProfile` callback param so the Pen route can pass
  `usePigRoster().refresh` alone (the Pen does not load the shop catalog).
- **Add** `app/pen.tsx`: `SafeAreaView` → `PageHeader kicker="rosie’s place" title="The Pen"`
  with `left` = `‹ back to the shop` (`router.canGoBack() ? router.back() : router.replace("/(tabs)/shop")`,
  the `barn-collection.tsx` idiom) and the snout pocket on the right (balance from `home_stats`
  via `useHomeStats` or the profile select — whichever `PigPenView` already needs; if none, omit the
  pocket in PR 1) → `PigPenView` with `usePigRoster()` + `useJoinSlopClub()`. File-based route,
  no `Stack.Screen` registration needed (`barn-collection` has none).
- **Edit** `app/(tabs)/shop.tsx`: **delete** `view` state, `ShopView` import, the `view !== "daily"`
  branches, the `Store` sign, the `PigPenView` branch and its imports, `handleJoinSlopClub`,
  `joinSlopClubAndRecruit` / `recruitPig` / `pigDefinition` / `presentPaywall` imports if unused.
  Pen sign and `SlopClubShelf onPressSign` → `router.push("/pen")`. The doorway renders the
  chalkboard unconditionally. The plain-shelves `SectionHeader right` "join in the Pen" stays.
- **Edit** `utils/shopNav.ts`: `ShopView` collapses to `"daily"`; `resolveShopParams` returns a new
  `redirect?: "/pen"` for `view=pen` and `shop.tsx` does `router.replace("/pen")` on it.
  `ShopNavTarget.view` can go (one room) — keep the field only if the test relies on it.
- **Edit** the two callers to the new route: `app/_layout.tsx` (`router.replace("/shop?view=pen")` ×2
  → `"/pen"`), `components/Account.tsx` (`"/(tabs)/shop?view=pen"` → `"/pen"`). Keep `view=pen`
  resolving (old pushes / links).
- **Test** `__tests__/shopNav.test.ts`: `view=pen` → redirect `/pen`; `wardrobe` / `browse` /
  `filter=prestige` unchanged. `__tests__/notificationRouting.test.ts` guards the server emit list —
  run it; nothing should change.

## Run before opening the PR

```
npx tsc --noEmit
npx jest __tests__/shopShelves.test.ts __tests__/shopNav.test.ts __tests__/shopCounter.test.ts __tests__/closetPrestigeFilter.test.ts __tests__/titlesPicker.test.ts __tests__/notificationRouting.test.ts __tests__/navigationClarity.test.ts
npm run lint
npm run scorecard          # must stay 0
npm run lint:web
```

Then Metro restart (`NODE_OPTIONS="--max-old-space-size=16384" npx expo start`) — the watcher
goes stale on existing files — and confirm the entry bundle carries `TitlesPickerSheet` before
trusting a screenshot.

## Screenshots before the changelog (17 Pro simulator, demo account, one each)

| # | File | What must be true in it |
| --- | --- | --- |
| 1 | `docs/builds/img/shop-pr1-01-store.png` | Shop tab at scroll 0: no Golden Ticket chip in the header; chalkboard + Pen · Furnish (no Closet sign); shelves. |
| 2 | `…-02-shelves-no-strip-overlap.png` | Scrolled so the first shelf is under the header: the strip (if shown) does not cover a coaster; no blank counter wood when the demo account has no crewmate buys. |
| 3 | `…-03-everything-owned.png` | "Everything" crown with `13 owned`; segment Owned · All · Members with Owned on; no hint sticker; tiles wear `Wear` / `Wearing`, no `Owned` / `Not owned`. |
| 4 | `…-04-everything-all.png` | All on: sun price on today's items, grey price on the rest, gold lock only on members' pieces for a non-member. |
| 5 | `…-05-titles-picker.png` | The picker open from the title chip: search, Earned / Not yet, `Wearing` on the current title. |
| 6 | `…-06-pen-route.png` | `/pen` with `‹ back to the shop`, reached from the Pen sign. |
| 7 | `…-07-me-golden-ticket.png` | Me tab: the "Redeem a Golden Ticket" row beside "Have a code?". |
| 8 | `…-08-deeplink-view-pen.png` | `ticklethepig://shop?view=pen` lands on `/pen` (old link still works). |

Then `docs/builds/YYYY-MM-DD-build-N.md` (before the build, per the repo rule), listing the eight
commits and linking the eight screenshots.

## Done (2026-09-17, evening)

All eight steps implemented (Opus subagent), reviewed in Fable, screenshot on the 17 Pro as the
demo account. Three defects found on the first screenshot pass and fixed before the second:

1. The Titles sheet kicker read `★ ★ earned, never sold` — the `Sheet` draws the star itself;
   the kicker is now `earned, never sold`.
2. The Pen route drew two headers: the new `PageHeader` and `PigPenView`'s own `SectionHeader`.
   The view's header is gone (the route owns the crown).
3. Inside the Owned segment the category crown said `4 owned · 0 missing` (it counted the
   segment's slice). It now counts the whole category: `4 of 21`, on every segment.

Deviations from the plan the implementer took, kept on review: a shared `cardTagFace` (one place
says "sage means worn"), the picker owns the `equip_title` RPC, `PageHeader` gained `backLabel`,
`ownedCount` left `ClosetView`, the shop's `ShopView` type went with the `view` state.

Known and accepted until PR 2: the folded strip still overlays the first shelf's coasters while
the shelves are on screen (`img/shop-pr1-02`); it hides once the Everything crown is reached.

Screenshots: `docs/builds/img/shop-pr1-0{1..8}-*.png`. Checks: tsc clean; 7 suites green; eslint
0 errors on the touched files; scorecard 0 (254/254); lint:web green.
