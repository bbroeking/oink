# Barn (Home) — design brief

Section 1 of `2026-09-12-ui-sections.md`. Feed this to Claude Design (or any mockup
pass) alongside `docs/design/taste-standard.md`. Directions live in
`docs/design/claude-design/barn/` — `receipt`, `plank`, `coin` — each drawn in the
steady state (nothing pending) and the busy state (bank empty · lucky pig · buried ·
bounty · patch open), because the steady state is what players see most.

## The one rule that shapes everything

**The Barn is a place, not a dashboard.** It is Rosie standing in front of her home on a
painted ground plane. Every control on this screen either *is* an object in that place
(the barn you tap to enter, the patch you tap to dig) or is a paper thing pinned over it
(a ticket, a note). The failure mode we are designing out is the top third of the screen
turning into a column of stickers that pushes Rosie down and argues with the painting.

## Surfaces covered

1. **The Exterior** (`components/Barn.tsx`) — the home tab proper.
2. The **notice objects** it hosts: `BarnBountyChip`, `TruffleButton` (bury /
   buried), `AdRefillOffer` (bank empty). (The guestbook placard was retired
   2026-09-12 — see `SKILL.md`'s decision log.)
3. The **counter**: the pair of `PaperTicket`s (tickles earned / ready to tickle) with
   the streak stamp and the Lucky-pig / Wallow ribbon.

Out of scope here: the Interior (section 2), the dig board itself (section 7), the
sheets (`BuryTruffleSheet`, `BuriedTruffleSheet`, `TickleBreakdownSheet`) — they are
reached from here but keep their own passes.

## Jobs, in priority order

1. **Tickle Rosie.** The core loop. She must be the largest thing on screen, centred,
   with clear air around her — hearts float, she squashes and springs. Nothing overlays her.
2. **Read the bank.** "How many tickles can I spend right now, out of how many?" — one
   glance. The earned lifetime total is secondary (a scrapbook number, not a live one).
   Decided 2026-09-13 (`claude-design/barn/barn-home.html`, the two-corner layout E of
   `coin.html`): the **coin** top-right is the bank, with the streak on its shoulder and
   the regen clock as one hand line under it; the **earned stamp** top-left (rose heart)
   is the lifetime total. The corners answer each other and the middle stays empty.
3. **Enter the barn.** Through the **Barn button** — one circle bottom-right whose face is the armed quick action; "Barn" arms itself by default whenever the patch is shut and the player has never picked (decided 2026-09-13: no barn sprite in the background, no gold button, no margin pills). The go-in transition options are in `claude-design/barn/door-motion.html`. The button's full interaction spec is below.
4. **Dig when the patch is open.** Before the player has picked, the Barn button arms the
   `Shovel` (sage fill, a slow dashed ring); after a pick the ring still breathes but the
   seat is the player's. The fan lists the armed action first and biggest.
5. **Bury a truffle** for a visiting friend (and see one is buried, with count).
6. **Claim a bounty** — a nudge to the Season tab, only when something is claimable.
7. **Refill when empty** — the rewarded-ad offer, only at bank = 0.

Jobs 5–7 are *notices*: intermittent and self-gating. With the guestbook gone the
steady state is just the counter and the scene; the remaining three are rare enough
that a shared "notice home" may be over-engineering — the directions should show the
steady state first and treat the notices as accessories.

## States

| State | What shows |
|---|---|
| Steady (bank > 0, nothing pending) | Counter, scene (barn + Rosie), nothing else |
| Bank empty | Counter reads 0 with the regen clock; the ad offer appears under it |
| Bank over cap (trough / event grant) | "banked" instead of "/ 25" — never an impossible fraction |
| Patch open | Dig control appears in the scene, right margin, roof-line height |
| Truffle buried | The mound stands in the yard, folded; the fan's truffle item reads "Your truffle · N snouts buried" |
| Bounty claimable | Bounty nudge appears; gone when claimed |
| Lucky pig window | Ribbon on the bank: "Lucky pig · N left" |
| Wallow rank ≥ 1 | Ribbon on the bank: "Wallow Rank N · +1 / 45:00" |
| Boot fetch failed | "lost the barn? tap to reload" sticker in the corner |

## Anatomy today (what each direction must account for)

- **Counter pair**: two tape-topped paper tickets, matched height. Left: heart chip ·
  big Caprasimo number · "TICKLES EARNED". Right: sparkle chip · number · "/ cap" ·
  "READY TO TICKLE" · streak flame stamp in the corner · optional hanging ribbon.
- **Notice column** (in flow, under the counter, PAGE_PAD gutter): truffle button row →
  bounty chip → (ad offer when empty).
- **Scene**: `PageBackground` (equippable art) · `BarnOverlay` (alignment tint / curse) ·
  barn sprite left on Rosie's ground plane · Rosie centre · dig sticker right.
- **Tab bar**: hanging wooden signs (kept; it is the app's crown).

## What "messy" means today (the fixes a direction should make)

- **Chrome eats the painting.** Counter + notices can stack three stickers deep before
  Rosie appears. Rosie should own ≥ 60 % of the height above the tab bar.
- **Two grammars for one kind of thing.** The truffle control (top-left, in-flow paper
  pill with a count) and the dig control (in-scene paper pill with a glyph) are both
  "a small round paper control that opens a thing" but sit in different systems.
- **The bank ticket is overloaded**: value, cap, label, chip, streak stamp, ribbon.
  Give the streak and the ribbon their own place or fold them into one accessory.
- **Notices are stacked cards.** Three independent stickers with three gating rules.
  Either give them one shared footprint or accept that the steady state has none.
- **Lifetime "earned" competes with live "ready."** They are set at the same weight;
  only one of them matters right now.
- **Copy drift**: "READY TO TICKLE" / "TICKLES EARNED" are UI labels. Game voice:
  "in the bank", "tickled so far", "one buried for a friend".

## The Barn button — interaction spec (2026-09-13)

**The face is a sticky quick action, chosen from the menu, fired from the page.**

The Barn button is the one control in the scene's bottom-right corner and the only place
the home's secondary actions live. It has two states:

1. **Armed.** The button's face shows one action — the door, the shovel, or the truffle —
   with its word beside it. One tap on the face fires that action. This is the state the
   player sees almost all the time.
2. **Choosing.** The `+` on the shoulder (or a long press) fans the full list over a scrim:
   `Dig` · `Barn` · `Bury a truffle` (or `Your truffle` once one is down). Tapping an item
   in the fan **does not fire it**. It arms it: the fan closes, the face flips to that
   action's mark, the word beside the button changes, and the player fires it from the
   page with a tap on the face. `×` closes the fan with nothing changed.

**Why.** The fan is a switch, not a launcher. Choosing from an expanded menu and then
acting from the main page means the player sets the button once and taps it many times —
the quick action sticks over time rather than being re-picked each visit. The obvious verb
is still one tap away; it's just the verb the player chose.

**Labels.**
- `Dig` — sub: the patch line (`+20 Pass XP · closes in 3h 25m`, or the next-open time
  when shut). Word beside the face: `dig`.
- `Barn` — no sub. Word: `barn`. (Was "Go in"; the button never says "go in".)
- `Bury a truffle` — sub: `for a visiting friend`. Word: `bury`. Once buried:
  `Your truffle` — sub: `N snouts buried`. Word: `truffle`.
- Fan order: the armed action first and biggest, then the rest in the fixed order
  Dig · Barn · truffle.

**Stickiness rules.**
- The armed action persists across taps, tab changes, and app launches (stored per
  installation under `barn_button_armed`).
- Before the player ever picks, the default arms itself: `Dig` while the patch is open,
  `Barn` otherwise. Once the player has picked, the button stops auto-flipping — the patch
  opening no longer overrides a chosen action. The live dashed ring still breathes on the
  button while the patch is open, whatever the face shows, so the open patch is announced
  without stealing the seat. The sage fill belongs to the shovel and the open patch
  together; a door or a truffle on the face stays on sun.
- If the armed action changes shape, the seat holds and the copy updates: the patch closes
  → `Dig` still arms and its tap surfaces the honest refusal with the next-open time; a
  truffle gets buried → `Bury a truffle` becomes `Your truffle` in place. If the armed
  action leaves the fan entirely (Dig retires for the rest of a dug feeding), the pick is
  kept, not overwritten — the face falls back to the default until the action returns.
  Nothing ever silently re-arms to a different action.
- Arming an item gives a light haptic and the face pops in (`POP_IN_SPRING`); the fan's
  spring-up / ease-down stays as is. Under Reduce Motion the swap is a fade.

**What a tap never does.**
- A tap on the face never opens a menu.
- A tap in the fan never fires an action, opens a sheet, or leaves the home.

**Accessibility.** The button's label is the armed action (`Truffle Patch` / `Your Barn` /
`Bury a truffle` / `Your truffle`); its hint says what one tap does. Each fan item's hint
reads "Sets the Barn button to …", not the action's own hint, and the armed item is
`selected`.

Ships in `components/BarnButton.tsx` (`Barn.tsx` builds the fan and keeps the pick); comp
in `claude-design/barn/action-button.html`.

## The buried truffle — interaction spec (2026-09-13)

**Folded by default; the tap says what's down there; the tag is the door.**

A buried truffle is a thing in the yard, so it shows as one: a mound of earth bottom-left
on Rosie's ground plane with the truffle's cap showing (`components/BuriedMound.tsx`).
The old always-on "one buried" tag is gone — the steady state is the mound alone.

1. **Folded.** Just the mound. It is a button; nothing reads under it.
2. **Unfolded.** Tap the mound and a paper tag springs out beside it (to the right, on
   the same ground line — the mound never moves): **`N snouts buried`** (`1 snout
   buried`), with `check on it ›` in the hand line. Tap the mound again and the tag folds.
3. **Checking on it.** Tapping the tag opens the buried-truffle sheet (add snouts / dig it
   back up). The mound itself never opens the sheet — one tap on it only ever unfolds.

The truffle is also an action item in the Barn button's fan — `Your truffle · N snouts
buried` — which is the other way in, and the one that arms the face (see the button spec).

**Wording.** "N snouts buried" everywhere the count appears (mound tag, fan item). Never
"snouts left" on the home; the sheet keeps its own "of N snouts left" ledger line.

**Motion.** Unfold is `POP_IN_SPRING` with a small slide out from the mound; fold is the state ease. Reduce
Motion: fade in place. The tag is only in the tree while shown, so a folded mound never
holds an invisible tap target over the yard.

**Accessibility.** Mound: label `Your buried truffle`, value `N snouts buried`, state
`expanded`, hint `Shows how many snouts are buried here` / `Folds the tag away`. Tag:
label `N snouts buried`, hint `Opens the buried-truffle sheet, where you can add snouts or
dig it back up`.

**The sheet.** `BuriedTruffleSheet` is a PopupQueue slot (`truffleSheet`, priority 5) and
passes `slotted` to `Sheet` so it never takes the unmanaged-modal latch — a slotted sheet
that latches holds the queue against itself and sits open-but-invisible (the 2026-09-13
dead tap). Expected states: tap → `open true · visible true`, slides up showing "of N
snouts left"; close → `visible false` the same frame (`release()`), `open false` a
`POPUP_TEARDOWN_MS` beat later. Regression test: `__tests__/SheetSlotted.test.tsx`.

## Tokens (non-negotiable)

WHIMSY palette only; Caprasimo headlines / Fredoka buttons / Nunito body / PatrickHand
kickers+links; Sticker with 2–3px ink border, ±0.5–1.5° tilt, hard shadows (4,4 or
2,2); `RADII`/`SPACE`/`TYPE` roles; `Glyph`/`Icon`, no emoji. The `bark` family is
allowed for a single dark storyteller panel; no other new dark surfaces. Mood is Rosie's
sprite only — no mood number, no mood bar. Streak and bank are progression and may show
numbers.
