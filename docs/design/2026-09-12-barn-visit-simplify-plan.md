# Barn Visit — simplify the visiting screen (plan)

Status: **plan, not yet built** (2026-09-12). Screen: `components/BarnVisitModal.tsx` (2203 lines) + `components/habitat/HabitatFriendRoom.tsx`. Founder ask: "clean and simple; remove clutter, reduce hierarchy noise, consolidate duplicated controls and copy; keep only the core actions and the minimum information; optimise for mobile readability."

Pillar: **Connect** (a visit is the game's warmest act; the screen should be the friend's barn, not a dashboard about it). Craft lens: every element must answer "would a designer who knows this game put this here?"

## 1. What is on the screen today (measured)

| Piece | Today | Problem |
| --- | --- | --- |
| Header stack before the scene | `STATUS_SAFE` 56 + title plaque ≈46 + visits chip ≈34 + hearts card ≈72 = **≈208pt** on a 390pt phone; +56 when "Sign the guestbook" appears; +66 for the "All tickled out!" bubble | A quarter of the screen is chrome; the barn is the point |
| Host's name | Rendered six times at once: title plaque, INSIDE plaque, INSIDE plaque a11y label, scoreboard label (uppercased), host pig nametag, dialog bodies | Repetition reads as noise |
| The visit counter | "N of N **visits** left" (chip) → "N of N **barns** visited" at zero; nap card says "N of N **barns** left this round" and "N/N barns visited this round" | One number, three vocabularies |
| Outside / Inside | Ghost `Button` whose label is the destination, plus a bordered "INSIDE <name>'s Barn" plaque over the room | Two controls' worth of chrome for one toggle |
| Tired state | A speech-bubble under the scoreboard ("All tickled out!" + sub) AND the Leave pill detours into a nap card AND the nap card has its own "Head home" | Three surfaces for one fact |
| Scoreboard | Two tallies with kicker labels YOU / <NAME> and a pulsing heart emblem | The labels repeat what the pigs already show |
| Guestbook / kindness / parting | Three `AdaptiveModalScaffold` cards, each with kicker + title + body + CTA + link | Right flows, heavy copy |

## 2. Revised layout (top → bottom, 390pt)

```
┌ status safe 56 ─────────────────────────────────┐
│ [★ FunnelWalker's Barn         ] [ Leave ✕ ]      │  row 1 · 44pt  (bark plaque, cardTitle; ghost pill)
│ [🐷 ♥ 1] [🐷 ♥ 11] [✦ 3 of 3 visits left]         │  row 2 · 28pt tags, gap SPACE.sm, marginTop SPACE.sm
├──────────────────────────────────────────────────┤  header total ≈ 136pt (was ≈208)
│                                                  │
│   [ Outside | Inside ]  ← SegmentedControl, 32pt, floats top-centre of the stage, only if habitat is on
│                                                  │
│            the scene (flex: 1)                   │  Outside diorama or the Inside room; pigs; "you" tag only
│   (shovel bottom-left, Outside only)             │
│                                                  │
├──────────────────────────────────────────────────┤
│ [ Leave a hoofprint ]  /  [ Head home ]           │  bottom bar · one gold pill, TAP_MIN, insets.bottom + SPACE.md
└──────────────────────────────────────────────────┘
```

Rules:

- **One name.** The host's name lives in the title plaque only. The scoreboard labels, the INSIDE plaque, and the host pig's nametag go. The visitor pig keeps its small "you" tag (it is the one thing a newcomer cannot tell apart). Screen-reader labels may still say the name (they are not visible copy).
- **One vocabulary.** The counter is always **visits**: "3 of 3 visits left", "0 visits left" (never "barns visited", never "round").
- **One status line.** Hearts and visits share one row of `Tag`s: your pig's avatar + `♥ 1`, the host's avatar + `♥ 11`, and the visits tag. Avatars replace the YOU / NAME kickers. The pulsing heart emblem goes; the `+1 ♥` float stays on the tag that gained it.
- **One toggle.** `SegmentedControl` (`Outside` | `Inside`) floating at the top of the stage, replacing both the ghost Button and the INSIDE plaque. Hidden when the habitat flag is off.
- **One secondary action, at the bottom.** After the first tickle the bottom bar shows **Leave a hoofprint** (opens the existing guestbook → kindness flow). Once a hoofprint is left and the pigs are tickled out, the same slot becomes **Head home** (exit). While no hoofprint has been left, the slot keeps offering it even after tiring out — the header's Leave is always the exit, and tiring out is when most players first think of the guestbook. Nothing about the guestbook lives in the header.
- **Tired is a toast, not a bubble.** "All tickled out — head home when you're ready." via the app `Toast`; the nap card only appears when a player arrives at a napping barn (rested/locked on arrival), not after their own last tap.
- **Leave never detours.** The header Leave pill exits (through the VIP parting card when that applies). The nap card's "Head home" is the only other exit and only in the arrival-napping state.

## 3. Exact copy changes

| Where | Old | New |
| --- | --- | --- |
| Title plaque kicker | `VISITING` | *(removed — the plaque star + name is enough)* |
| Title plaque | `{name}'s Barn` | `{name}'s Barn` *(unchanged, now the only name)* |
| Visits chip | `{n} of {cap} visits left` / at zero `{cap} of {cap} barns visited` | `{n} of {cap} visits left` / at zero `0 visits left` |
| Scoreboard labels | `YOU` / `{NAME}` | *(removed; avatars)* |
| Outside/Inside | ghost `Outside` / `Inside` | segmented `Outside` · `Inside` |
| INSIDE plaque | `INSIDE` + `{name}'s Barn` | *(removed)* |
| Host pig nametag | `{name}` | *(removed)*; visitor tag `you` stays |
| Tired bubble | `All tickled out!` + `go tickle another friend` / `tap Leave for your visit note` | toast: `All tickled out — head home when you're ready.` |
| Guestbook action | `Sign the guestbook` (header sticker) | bottom pill `Leave a hoofprint` |
| Guestbook card | kicker `BARN GUESTBOOK`; title `Leave a little hoofprint?`; body `One tap leaves a warm, permanent note. It never expires.`; link `Back to the Barn` | kicker *(removed)*; title `Leave a hoofprint`; body `One tap. It stays in their barn for good.`; link `Not this time` |
| Guestbook sent | `Your hoofprint is saved!` + `{name} can find it whenever they come home.` | `Hoofprint left.` + `They'll find it at home.` |
| Kindness card | title `Add a little warmth?`; body `Your hoofprint is saved. Add today's {blessing}, if you like.`; CTA `Add {blessing}`; link `The hoofprint says plenty` | title `Tuck in today's {blessing}?`; body *(removed)*; CTA `Add {blessing}`; link `Hoofprint's enough` |
| Kindness sent | `Your note is ready!` + `{name} will find the hoofprint and blessing together.` | `Left with the hoofprint.` |
| Nap card (arrival) | kicker `nap time`; titles `Still snoozing!` / `Pigs tucked in!`; four body variants; stats `+{gained} shared this visit`, `{until} until this barn wakes`, `{used}/{cap} barns visited this round`; CTA `Head home` | kicker *(removed)*; title `This barn is napping`; one body: `Wakes in {until}. You have {n} of {cap} visits left.`; stats *(removed — the header row already shows both numbers)*; CTA `Head home` |
| Parting card (VIP) | band `SLOP CLUB PARTING NOTE`; title `Leave {name} a little goodbye`; body `They'll find it in Notes from the barn.`; link `Head home without a note` | band stays (it is the perk's badge); title `Leave a goodbye?`; body *(removed)*; link `Just head home` |
| Room unavailable | `This room is unavailable right now. You're back outside.` | toast: `Their room isn't open right now.` |

## 4. Component changes

1. **`VisitHeader`** (new, `components/visit/VisitHeader.tsx`): the bark plaque (`Sticker color="bark"`, `T role="cardTitle" tone="onDark"`, star `Glyph`) and the Leave pill (`Button variant="ghost" size="sm"` with the ✕ icon — the primitive, not a hand-rolled Sticker). Props: `hostName`, `onLeave`.
2. **`VisitStatusRow`** (new): three `Tag`s — `Avatar size 24` + `♥ n` (you), `Avatar` + `♥ n` (host), `✦ n of cap visits left`. Owns the `+1 ♥` float per tally (reuse `HeartTally`'s float, drop its labels). Props: `youHearts`, `hostHearts`, `visitsLeft`, `visitBudget`, `youAvatar`, `hostAvatar`.
3. **Stage toggle**: `SegmentedControl` from `components/ui`, `size="sm"`, absolutely positioned top-centre of the stage with `pointerEvents` on the control only (Fabric overlay rule). Delete the `interiorHost` plaque and its styles; move its `accessibilityLabel` ("Visiting {name}'s Barn") onto the stage container.
4. **Nametags**: `TapPig` gains `tag?: "you" | null`; host pig passes `null`. Delete `nameTagFriend` and `NAMETAG_MAX_W` if unused.
5. **`VisitActionBar`** (new): bottom bar with one gold `Button` (`full`, `TAP_MIN`) whose label/handler is a pure function of `{tickled, tired, stampSent}` → `Leave a hoofprint` | `Head home` | hidden. Sits above `insets.bottom + SPACE.md`; the stage keeps `flex: 1` above it.
6. **Tired state**: delete the bubble JSX + `tired` styles; call `showToast` from `components/ui/Toast` once when `tired` flips true. The Leave pill stops detouring into the nap card (`requestExit` only branches on the VIP parting card).
7. **Nap card**: one variant (arrival-napping); remove the two `Stat`s and the four body variants; keep `AdaptiveModalScaffold` + `Button variant="gold"`.
8. **Guestbook / kindness / parting cards**: copy per §3; drop kickers/bodies as listed; no structural change.
9. **Outside `diorama` mounting**: unmount it while Inside (today it is `display:"none"` and keeps animating). `TapPig` elements are already shared; render them in whichever scene is live.
10. **Header comment** at the top of `BarnVisitModal.tsx` is stale (describes an energy bar and a "how visiting works" sheet that no longer exist) — rewrite it to describe this layout.
11. **Tests**: `barnVisitActions.test.ts` (strings: drop `barns visited`, `tap Leave for your visit note`, `barns visited this round`; assert `visits left` only), `BarnVisitHousing.test.tsx` (`Maple's Barn` text now appears once, in the header; the room carries the a11y label), `guestbookStamps.test.ts` (`visit-guestbook-open` testID moves to the bottom pill; keep the `setStampOffered` invariant), `motionPolicy.test.tsx` (still lists the file).

## 5. Spacing and typography rules

| Region | Rule |
| --- | --- |
| Header | `paddingTop: STATUS_SAFE`; row 1 height `TAP_MIN`; plaque `paddingHorizontal: SPACE.md`, `paddingVertical: SPACE.xs`, `RADII.md`, `BORDER.ink`; title `TYPE.cardTitle` (18/22) `tone="onDark"`, `numberOfLines={1}`, `maxFontSizeMultiplier` 1.3 |
| Status row | `marginTop: SPACE.sm`; `Tag`s at their own height (≈28), `gap: SPACE.sm`, `flexWrap: "wrap"` so a large-text setting wraps instead of clipping; numbers `TYPE.label`, never `sectionTitle` |
| Header total | ≈136pt to the scene (56 + 44 + 8 + 28); nothing else may be added above the scene |
| Stage | `flex: 1`; toggle `top: SPACE.md`, self-centred; shovel `left: PAGE_PAD, bottom: SPACE.lg` (Outside only) |
| Bottom bar | `paddingHorizontal: PAGE_PAD`, `paddingBottom: insets.bottom + SPACE.md`, one `Button` `full` at `TAP_MIN`; appears/disappears with a `MOTION_DURATION.state` fade, no layout push |
| Cards | `AdaptiveModalScaffold` unchanged; titles `TYPE.cardTitle`, bodies `TYPE.hand` (14/20), one CTA + one link; no kickers except the Slop Club band |
| Motion | every new animation through `useMotionPolicy`; Reduce Motion: fades only |
| Copy | sentence case, hand voice, ≤ 9 words per line; the host's name appears once on screen |

## 6. Build order

1. Header + status row + toggle (deletes ≈70pt of chrome and five name repeats) — the biggest visible win.
2. Bottom action bar + tired toast + Leave never detours.
3. Card copy pass + nap card single variant.
4. Diorama unmount + header comment + tests.

Verify on the 17 Pro simulator with DemoPig visiting FunnelWalker (friendship seeded 2026-09-12), at default and `accessibility-medium` text size.
