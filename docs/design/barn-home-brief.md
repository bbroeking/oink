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
3. **Enter the barn.** Through the **Barn button** — one circle bottom-right whose face is the default action; "Go in" is the default whenever the patch is shut (decided 2026-09-13: no barn sprite in the background, no gold button, no margin pills). The go-in transition options are in `claude-design/barn/door-motion.html`.
4. **Dig when the patch is open.** The Barn button's face flips to the `Shovel` (sage fill, a
   slow dashed ring) and Dig becomes the default; the fan lists it first and biggest.
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
| Truffle buried | Bury control flips to "buried · N" state |
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

## Tokens (non-negotiable)

WHIMSY palette only; Caprasimo headlines / Fredoka buttons / Nunito body / PatrickHand
kickers+links; Sticker with 2–3px ink border, ±0.5–1.5° tilt, hard shadows (4,4 or
2,2); `RADII`/`SPACE`/`TYPE` roles; `Glyph`/`Icon`, no emoji. The `bark` family is
allowed for a single dark storyteller panel; no other new dark surfaces. Mood is Rosie's
sprite only — no mood number, no mood bar. Streak and bank are progression and may show
numbers.
