# Friend row — per-row "…" actions menu (spec, 2026-09-14)

A kebab (`Icon name="more"`) on every friend row opens ONE anchored actions panel that
slides over that row's text column. Nothing navigates; the list never changes height.

> Approved 2026-09-14 (founder) and implemented in `components/Friends.tsx`; it
> replaces the same morning's action-bar card. Decision logged in `SKILL.md` and the
> taste standard. Working demo: `docs/design/demos/friend-row-actions-menu-demo.html`.
> The founder's one condition: the panel must never overflow — see "Overflow" below.

## 0. Overflow guarantee

The panel spans the row's content box minus the trigger's clearance. Its width, and
the width of each of the five cells, is a pure function of the tokens:
`actionPanelGeometry(windowWidth)` in `constants/layoutBreakpoints.ts`. A test asserts
`cellWidth ≥ TAP_MIN` at 375pt and 393pt, that the row's `minHeight` (70pt) clears the
cells' content, that the panel's insets are the tokens the function assumes, and that
the slide's travel is shorter than the trigger clearance. Labels are one
line and shrink to fit. No tier draws the state line (it pushed the row floor from 78pt
to 98pt); the copy stays in each cell's accessibility hint, and the armed curse flips its
label to "Again" beside the heavy border.

## 1. State model

One value, at the list level, never per row:

```ts
// FriendsList
const [openMenuFor, setOpenMenuFor] = useState<string | null>(null); // friend id
const toggleMenu = useCallback((id: string) =>
  setOpenMenuFor((cur) => (cur === id ? null : id)), []);
const closeMenu = useCallback(() => setOpenMenuFor(null), []);
```

- **Only one open** (req 1) falls out of the type: a single id or null.
- **Switching** (req 2) is `toggleMenu(otherId)` — the value changes from A to B; A's
  panel unmounts, B's mounts. No "close then open" two-step, no intermediate null.
- Rows get `menuOpen={openMenuFor === f.id}` and the two stable callbacks. `FriendRow`
  is `React.memo`; the FlatList gets `extraData={openMenuFor}` so visible rows re-run
  `renderItem`, and memo prunes every row whose `menuOpen` did not flip — exactly two
  rows re-render on a switch, one on open/close (req 6).
- The list already closes on reload (`useEffect(() => setOpenMenuFor(null), [friends])`
  — a re-sort under the thumb must not carry an open panel), on `onScrollBeginDrag`,
  on tab blur (`useFocusEffect` cleanup), and on Android back (`BackHandler`).

**Per-row action model** (req 5). The row builds its own list from its own props —
`friend`, `isFav`, `pairSpent`, `visitsSpent`, the two `useRitualDoor` views — and every
handler closes over `friend.id`; nothing reads a list-level "current friend":

```ts
type RowAction = {
  key: "visit" | "bless" | "curse" | "pin" | "profile";
  label: string;        // "Visit" · "Bless" · "Curse" · "Pin"/"Unpin" · "Profile"
  sub?: string;         // "3 left" · "Tap twice" · "Sent today" …
  art: React.ReactNode; // GameIcon / ritual art / Icon
  fill: StickerColor;   // sky · door fill · door fill · paper · paper
  disabled?: boolean;
  armed?: boolean;      // curse only — heavy border
  closesOnPress: boolean; // curse's FIRST tap keeps the panel open
  onPress: () => void;  // already bound to friend.id
  testID: string;       // `friend-menu-${key}-${friend.id}`
};
```

## 2. Components

```
FriendsList (owns openMenuFor)
└─ FriendRow (memo)  ──►  ListRow
     ├─ leading   PrestigeAvatar tile
     ├─ identity  name · #code · one meta line · herd line   (Pressable → profile)
     ├─ trailing  <RowMenuTrigger/>  +  <RowActionsPanel/>   ← panel rendered HERE
     └─ (no footer; the row's height is fixed)
```

- **`RowMenuTrigger`** — `IconButton name="more"`, 44pt frame, `accessibilityRole
  ="button"`, label `Actions for {name}` / `Hide actions for {name}`,
  `accessibilityState={{ expanded }}`, web extras `aria-haspopup="menu"`,
  `aria-controls={`friend-menu-${id}`}`, testID `friend-menu-trigger-${id}`.
  Pressed: the same icon (no glyph swap); "open" is the panel beside it.
- **`RowActionsPanel`** — an absolutely positioned `Sticker` (color `cream2`, `RADII.md`,
  `BORDER.ink`, `shadow="none"`) anchored `top/bottom: SPACE.xs, right: <trigger width +
  gap>`, width = the row's text column (avatar right edge → trigger left edge), so it
  covers the name/meta and nothing else. Inside: a horizontal row of `ActionCell`s
  (icon over label; `actionCellTier(width)` picks the type tier — narrow phones drop the
  state line into the hint). The row is `clipped` (ListRow does this when `overlay` is
  present — reuse that flag) so the slide is cut at the card edge.
  Roles: panel `accessibilityRole="menu"` (web `role="menu"`, `id=friend-menu-${id}`),
  cells `accessibilityRole="menuitem"`. Mounted only while `menuOpen`; unmounted after
  the exit animation so the accessibility tree never holds a hidden menu.

**Why the panel lives in `trailing`, after the trigger, not in `overlay`.** Focus order
is document order. `ListRow` draws identity → overlay → trailing, which would put the
cells *before* the trigger and break req 4. Rendering the panel as the trigger's next
sibling gives identity → trigger → cells, so Tab from the trigger enters the panel and
Shift+Tab from the first cell returns to the trigger. Absolute positioning keeps the
visual placement identical.

## 3. Event handling

| Event | Handling |
|---|---|
| Trigger press | `toggleMenu(friend.id)`. |
| Another row's trigger | Same call with the other id → the value switches (req 2). |
| Action press | `action.onPress()` then `if (action.closesOnPress) closeMenu()`. Visit, Profile, Pin, Bless close; Curse's first tap arms (panel stays, cell goes heavy-border, sub "Tap again"), second tap casts and closes. |
| Outside tap (req 3) | No full-screen scrim (a Fabric absolute layer eats every tap — build-99 lesson). Instead a capture-phase hit test on the list container: `onTouchStart` (native) / `pointerdown` document listener (web) reads the touch point, `measureInWindow`s the open panel + trigger, and calls `closeMenu()` when the point is outside both. The touch still propagates, so a tap on another row's trigger closes A and opens B in one gesture; a tap on the tab bar or hub above the list also closes because the listener is on the tab's root view. |
| Scroll | `onScrollBeginDrag={closeMenu}` — an anchored panel must not float off its row. |
| Reload / re-sort | The existing `[friends]` effect closes it. |
| Blur / back | `useFocusEffect` cleanup and Android `BackHandler` close it. |
| Escape (web + hardware keyboard) | `closeMenu()` and return focus to the trigger. |
| Arrow ← → (web) | Move focus between cells; Home/End first/last. Not required on iOS. |
| Reduce Motion | Panel appears/disappears instantly; the spring is skipped. |

**Focus management (req 4).** On open: focus the first cell (web `ref.focus()`; iOS
`AccessibilityInfo.setAccessibilityFocus(findNodeHandle(firstCell))`). On close: focus
returns to that row's trigger. Tab order per row: identity → trigger → [cells when
open]. Shift+Tab from a row's identity lands on the previous row's trigger (or its last
cell when its panel is open), which is the "cycling to the trigger" the requirement asks
for. No focus trap — Tab past the last cell continues to the next row.

## 4. Motion

Arrive from the trigger's side: `Animated.Value` translateX from
`ACTION_PANEL_TRAVEL` (32pt, `SPACE.xxl`) → 0 with opacity interpolated 0 → 1 over the
same value, on `MOTION_SPRING.settle` with `overshootClamping: true`, `useNativeDriver`.
Exit reverses, then unmount. Switching rows plays A's exit and B's entrance
concurrently. Under Reduce Motion (`useMotionPolicy`), `setValue` — no spring.
No `LayoutAnimation`, ever: nothing changes size.

Why short and clamped (verified on device 2026-09-14): the first cut slid the panel its
full width on the house spring. The spring's overshoot carried it past its rest and
back (a visible jiggle), and because a full-width slide crosses the trigger and the
card edge it needed a clip box, which cut the panel mid-motion. A 32pt travel is
shorter than the 60pt trigger clearance, so the panel is fully visible from the first
frame to the last with no clip anywhere; clamping removes the bounce; the fade makes
the short travel read as arriving rather than as a shutter.

## 5. Layout stability (req 6)

- Row height is fixed by the identity + avatar; the panel is `position: absolute` inside
  the row and never affects measurement. FlatList keeps its offsets; no
  `getItemLayout` invalidation, no re-layout of neighbours.
- `FriendRow` is `React.memo`; `toggleMenu`/`closeMenu` are stable `useCallback`s that
  take the id; per-row lambdas are created inside the row, not in `renderItem`.
- `extraData={openMenuFor}` is the only thing that changes on the list; `keyExtractor`
  stays `friend.id`; `removeClippedSubviews` stays on.

## 6. Test IDs and assertions

`friend-row-${id}` (identity), `friend-menu-trigger-${id}`, `friend-menu-${id}` (panel),
`friend-menu-visit-${id}` … `friend-menu-profile-${id}`. Tests to write in
`__tests__/friendRitualDoors.test.tsx`: opening f2's menu shows f2's cells only and
mounts no panel on f1; opening f1 while f2 is open switches (f2 panel gone, f1 present);
Visit on f2's panel calls `onVisit` with `{ id: "f2" }`; curse arms then casts on the
same row; an outside touch closes; a reload closes; `accessibilityState.expanded` tracks
the trigger; the panel's cells follow the trigger in the rendered tree order.
