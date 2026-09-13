# The reveal family — one sheet for everything the game hands you (spec)

> **Status:** proposed 2026-09-13; **structure chosen the same day — the Ledger**
> (canvas: *The Reveal Sheet*, direction A, over the Postcard and the Pinboard).
> Covers the eight passive popups that present something to the player (a gift,
> a badge, a hat, a window, a recap, a tale, a guide). Grew out of the
> `HabitatGiftReveal` inset bug (`b7ea4fa`) and the recap's clipped rows
> (`420ce8f`). Nothing else here is built.

## The sentence

**"Everything the game hands you is written on one ledger — one left edge, one
rule, one line per thing — and leaves the same way."**

## Scope

The **reveal family** — every popup that is not user-initiated and not a
verdict. In queue order (`constants/popupPriorities.ts`):

| slot | file | band | receipt today |
| --- | --- | --- | --- |
| `hungerIntro` | `components/GreatHungerIntroModal.tsx` | ceremony | `s2_intro_seen:{uid}` (AsyncStorage) |
| `rituals` ("while you were away") | `components/WhileAwayModal.tsx` | event | away-seen marker, written on dismiss |
| `achievements` | `components/AchievementDigestModal.tsx` | housekeeping | `achievements.seen` (server) |
| `habitatExpansionDiscovery` | `components/habitat/HabitatExpansionDiscovery.tsx` | housekeeping | expansion ack (server + pending-ack AsyncStorage) |
| `habitat-gifts:{uid}` | `components/habitat/HabitatGiftReveal.tsx` | housekeeping | `habitat_grant_receipts.presented` (server) |
| `mysteryHat` | `components/MysteryHatReveal.tsx` | flourish | none — the claim RPC's return payload |
| `luckyPig` | `components/LuckyPigModal.tsx` | flourish | `useLuckyPig` state (AsyncStorage) |
| season guide | `components/season1/SeasonGuideModal.tsx` | on-demand + once | `GUIDE_EVERY_VISIT` dev flag; no receipt |

**Out of scope:** verdicts (`AlignmentSchismModal`, `JudgementDayModal`,
`SeasonEndModal`), user-opened sheets (`BuryTruffleSheet`, `TickleBreakdownSheet`,
`UserSheet`), and `PigFriendsLaunchModal` (a one-shot launch ceremony, retired
after launch). They keep their scaffolds; only the copy budgets (§4) apply.

## 1. The pattern — the Ledger

The family stops being a stack of centred capsules. A reveal is a **ledger
page**: everything starts on one left edge, the things you are handed are
**lines**, not cards, and two solid rules bracket the body the way a receipt
brackets its sum. Why this over the alternatives (canvas, 2026-09-13): the
mirror is gone by construction (nothing is centred, the × is the only thing on
the right), it is the `Receipt` grammar the game already speaks, and it costs
no new art. What it gives up is named in §4a.

Anatomy, top → bottom, every member:

1. **Heading row** — kicker + title on the left, × on the right, sharing one
   row (`DialogCloseRow`'s header slot, shipped in `420ce8f`).
2. **Count line** (optional) — one hand line under the title: *five things
   landed · today* / *new · yours to keep*.
3. **Top rule** — `BORDER.ink` solid, full inner width.
4. **The body** — either
   - **lines** (`LedgerRow`): a 3-column grid — a 26pt **mark** · the words
     (title + hand sub) · a right-aligned hand **value** (a time, `+6
     tickles`, `8 h`) — separated by **dashed hairlines**, no fill, no
     border, no tilt, no shadow; or
   - **one line with art** (`LedgerLine`): the object's picture in a 120pt
     left column, the words beside it — the same grammar at hero scale.
5. **Bottom rule** — `BORDER.ink` solid.
6. **Primary** — gold, full width.
7. **Secondary** (optional) — a left-aligned hand link with a chevron:
   *later ›*, *keep it for later ›*. Left, never centred.

## 1a. The primitive — `RevealSheet` + `LedgerRow` + `LedgerLine`

```ts
// components/ui/RevealSheet.tsx
export interface RevealSheetProps {
  visible: boolean;
  /** Tints the sheet; the frame is the scaffold's paper frame, never a second border. */
  tone?: "paper" | "sun" | "lilac";
  /** Lowercase hand kicker. The primitive draws the ★; never type one. */
  kicker: string;
  title: string;
  /** `pageTitle` for reveals and ceremonies, `sectionTitle` for housekeeping. */
  titleRole?: "pageTitle" | "sectionTitle";
  /** The hand line under the title. */
  count?: string;
  /** The body between the rules: LedgerRows, one LedgerLine, or a ceremony hero. */
  children: ReactNode;
  /** Lines scroll inside the rules at this height; the rules and the primary never scroll. */
  listMaxHeight?: number;
  primary: { label: string; onPress: () => void; loading?: boolean; hint: string };
  /** Left-aligned hand link with a chevron, under the primary. The only second control. */
  secondary?: { label: string; onPress: () => void; hint: string };
  /** Names the outcome of ×: "Keep gifts for later", "Skip the tale". */
  closeLabel: string;
  onClose: () => void;
  error?: string | null;
  testID?: string;
}

// components/ui/LedgerRow.tsx — one line of a ledger
export interface LedgerRowProps {
  /** The mark: a Glyph, Icon or art, drawn on a 26pt disc tinted by `kind`. */
  mark: ReactNode;
  /** Tints the mark's disc — the kind is legible without a card fill. */
  kind?: "paper" | "sun" | "sage" | "rose" | "lilac";
  title: string;
  sub?: string;
  /** Right column, hand, tabular: a time, a value, a duration. Omit to leave the column empty. */
  value?: string;
  /** Tappable rows draw a hand chevron after `value` and announce as buttons. */
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

// components/ui/LedgerLine.tsx — one line at hero scale
export interface LedgerLineProps {
  /** The picture, in the left column (120pt; 96pt under 360pt screens). */
  art: ReactNode;
  title?: string;          // usually omitted — the sheet's title names the thing
  status: string;          // body: "New · yours to keep"
  sub?: string;            // hand: "a shelf keepsake. try it in your Barn now, or later."
  /** A rarity or count tag rendered under the status, left-aligned. */
  tag?: ReactNode;
}
```

- **Frame.** `AdaptiveModalScaffold` with `showCloseButton`, `closeRowContent`
  (the heading row), `maxWidth REVEAL_MAX_W = 390`, `presentation "native"`,
  `dismissOnBackdrop false`. Never `bare`. `tone` sets the frame's
  `backgroundColor` via `frameStyle`; border, radius (`RADII.xxl`) and
  `STICKER_SHADOW` are the scaffold's.
- **Inset.** `contentContainerStyle = { paddingHorizontal: SPACE.xl,
  paddingBottom: SPACE.xl }`. The top inset is the heading row. No member
  passes padding of its own. **No bleed gutter**: ledger lines have no
  overhang, so the list clips cleanly at the rules (`LIST_BLEED` stays in the
  theme for sticker lists elsewhere; the family does not use it).
- **Rules.** The top and bottom rules are the primitive's (`BORDER.ink`,
  `UI_COLORS.border`); rows draw their own dashed separator on the top edge
  (`BORDER.hair`, `UI_COLORS.uiMuted`, `borderStyle "dashed"`), first row
  excepted. Rules are full inner width — they touch the 24pt inset on both
  sides, never the frame.
- **Controls.** Primary is `<Button variant="gold" size="md" full>` under the
  bottom rule with `SPACE.card` above it; secondary is `<Button
  variant="handLink" size="sm">` **left-aligned** (`alignSelf: flex-start`)
  with a trailing ` ›`. No `ghost`, `link`, `dark`, `purple` or `primary`
  variants in the family. No side-by-side buttons. `loading` on the primary
  is the only busy state.
- **Motion.** The sheet enters with `popIn`; leaves on the scaffold's fade.
  Members add motion only inside a `LedgerLine`'s `art` or a ceremony hero.
- **Text.** Every word through a `T` role; every line **left-aligned** — the
  family has no `align="center"`. Title `numberOfLines={2}`, sub
  `numberOfLines={2}`, value `numberOfLines={1}`.

## 2. Layout rules

1. **One width.** `REVEAL_MAX_W = 390`. Retire `CARD_MAX_W` ×2, `DIGEST_MAX_W`,
   the `400`s and the scaffold default for this family.
2. **One inset, one left edge.** 24pt sides and bottom; the kicker, the title,
   the count line, every mark, every rule's left end, the primary's left
   edge and the secondary all start at that edge. Inner width floor on a
   320pt screen: 320 − 16 − 48 = **256pt**.
3. **One close.** The scaffold's rail as the heading row (`closeRowContent`),
   44pt, labelled with the outcome, in flow. No inner `DialogCloseRow`, no
   negative margins.
4. **Lines, not cards.** Inside the rules nothing has a fill, a border, a
   radius, a tilt or a shadow. Kind is carried by the **mark's disc**
   (`kind` → sun / sage / rose / lilac / paper), value by the right column.
   The grid: `26pt · minmax(0, 1fr) · auto`, `columnGap SPACE.sm`,
   `paddingVertical SPACE.sm + SPACE.xxs` (10) per row, dashed hairline on
   the top of every row but the first.
5. **The value column is tabular.** `font-variant-numeric: tabular-nums`,
   right-aligned, hand 14, `numberOfLines 1`, `maxWidth 88pt`; times as
   `7:40`, values as `+6 tickles`, durations as `8 h`. When no row in the
   list has a value the column collapses (`auto` → 0).
6. **Lines scroll inside the rules.** `children` sits in a `ScrollView` with
   `maxHeight = listMaxHeight` (default `REVEAL_LIST_MAX_H = 240`),
   `bounces false`; the rules, the count line and the primary never move.
   ≤ 4 lines visible, the rest reachable. No bleed (lines have no overhang).
7. **The object line.** `LedgerLine` puts the art in a 120pt column
   (`96pt` under 360pt screens) beside the words, vertically centred, with
   `columnGap SPACE.lg`. Under 340pt of inner width it **stacks** — art
   above words, both on the left edge — rather than squeezing the copy.
8. **Ceremony heroes are the exception.** The tale's 9:16 video sits
   full-width *between* the rules as the body; its caption is the count
   line. It is the only full-width picture in the family.
9. **Nothing under the primary but the secondary**, and the secondary is
   left-aligned hand with a chevron. The hand note that explained a control
   is gone from the grammar: what a control does is its label; what a thing
   is, is its sub line.

## 3. Interaction rules

1. **The primary dismisses and does its verb.** Never a primary that only
   closes when a verb is available ("Wear it" beats "Oink!").
2. **The secondary is "later".** It keeps the thing and closes. Its label
   says so: `Keep it for later`, `Later`, `Maybe later`.
3. **× = the secondary's outcome.** `closeLabel` names it. Android back and
   `onAccessibilityEscape` route to the same handler.
4. **Backdrop does nothing.** `dismissOnBackdrop false` for the whole family;
   a tap outside a reveal is not a decision.
5. **Every dismiss path writes the same receipt** (§5). No path may close
   without stamping; no path may stamp before the sheet was visible.
6. **Double-tap guard.** The primary and secondary share one `busy` latch,
   set before the first await and released after teardown
   (`POPUP_TEARDOWN_MS`), as `HabitatGiftReveal` does today.
7. **Hand-off.** A primary that navigates calls `releasePopupThenNavigate`
   (`components/ui/PopupQueue.tsx`) so the route push happens after the
   sheet's fade, never over it.
8. **Reduce Motion.** `popIn` crossfades; hero motion rests at its first
   frame via `useMotionPolicy` / `startDecorativeLoop`. A wobble, a burst, a
   video autoplay each obey it.
9. **VoiceOver.** The title carries `accessibilityRole="header"`; the rail is
   the first focusable; the primary's `accessibilityHint` says what happens;
   `accessibilityViewIsModal` is the scaffold's.

## 4. Copy rules

Budgets are characters that fit **two lines at the inner-width floor (256pt)**
in the role's face; the row grid narrows the words column, so lines carry
their own budgets. Exceeding a budget is a lint failure (§8), not a judgement.

| role / slot | ≈ chars/line | 2-line budget | used for |
| --- | --- | --- | --- |
| kicker (hand 13) | — | **22** (one line) | the sentiment / the source |
| pageTitle (Caprasimo 26) | 15 | **28** | reveal + ceremony titles |
| sectionTitle (Caprasimo 22) | 18 | **34** | housekeeping titles |
| count line (hand 14) | 36 | **36** (one line) | *five things landed · today* |
| row title (body 15, words column ≈ 200pt on SE) | 26 | **26** (one line) | *Someone visited your Barn* |
| row sub (hand 14, same column) | 28 | **56** | *the piggler tickled your pig* |
| row value (hand 14, ≤ 88pt) | 12 | **12** (one line) | `7:40` · `+6 tickles` · `8 h` |
| object line status (body 15, ≈ 120pt beside art on SE / full when stacked) | 16 / 33 | **32** (one line) | *New · yours to keep* |
| object line sub (hand 14) | 17 / 36 | **52** | *a shelf keepsake. try it in your Barn now, or later.* |
| button label | — | **18** (one line) | primary / secondary |

- **Kicker** is lowercase hand, no punctuation, no ★ (the primitive draws it).
- **Title** names the thing when there is one (`Guestbook Keepsake`) and the
  moment when there is not (`Notes from the barn`). Dynamic titles are capped
  at the source (`utils/whileAway.ts`).
- **Row title** is a noun phrase, no trailing punctuation — the exclamation
  marks go (*Someone visited your Barn*, not *…Barn!*). **Row sub** is who and
  what, lowercase hand. **Value** is a number with a unit or a time; never a
  word alone.
- **Count line** is lowercase, `·`-separated, one line: *five things landed ·
  today* · *new · yours to keep* · *3 badges · all saved*.
- **Buttons** are sentence-case verbs, ≤ 18 chars; the secondary ends in ` ›`.
- No em-dash clauses, no "please", no "successfully".

## 4a. Trade-offs the Ledger accepts

- **Quieter.** Lines have no sticker identity; the scrapbook feel moves to the
  frame, the marks and the hand voice. Kind is a tinted 26pt disc, not a
  tinted card — legible, smaller.
- **A value column needs values.** The recap's events carry no timestamp
  today (`WhileAwayEvent` has none); the column is empty until
  `utils/whileAway.ts` and its RPC carry `at`. Until then the column shows
  the row's *value* where one exists (`+6 tickles`, `8 h`) and collapses
  otherwise — never a fake time.
- **The bleed gutter retires from the family.** Straight lines have no
  overhang; `LIST_BLEED` stays for sticker lists elsewhere (Friends rows).
- **Object dialogs lose the centred hero.** A mystery hat, a lucky pig, a
  furnishing sit in a 120pt left column, not a 160pt centrepiece; the
  unboxing beat becomes a tap on that column's art. Bigger art belongs in
  the destination (the Closet, the Barn), which the primary opens.
- **Ceremonies get one exception** (the tale's full-width video), stated in
  §2.8 so it cannot become two.
- **`Receipt` stays as it is.** `ReceiptRow` is a `ListRow` card today; it
  could adopt `LedgerRow` later, but that is the Season tab's decision.

## 5. Trigger and persistence rules

1. **A reveal is a function of a receipt.** Each slot's `want` reads one
   durable row with a `presented` (or `seen`) flag and nothing else:
   `habitat_grant_receipts.presented`, `achievements.seen`,
   `habitat_expansion_acknowledgments`, the away-seen marker, the intro
   stamp, and two new ones — `mystery_hat_reveals(user_id, claim_ref,
   payload, presented_at)` and `lucky_pig_windows(user_id, opened_at,
   presented_at)` — so a killed app never loses a hat or a lucky window and
   never shows one twice.
2. **Dismiss stamps.** `presented_at = now()` is written on the first dismiss
   path taken, idempotently (`ON CONFLICT DO NOTHING`), keyed by the receipt.
   AsyncStorage may cache the stamp for offline; the server row is the truth.
3. **A failed stamp keeps the sheet.** The primitive shows `error` ("Couldn't
   save that on this device. Try again.") and the controls stay enabled; the
   receipt stays unpresented; the next launch re-presents it.
4. **Account switch mid-reveal drops it.** Every stamp is keyed to the
   account that opened it (`currentAccount` ref); a stale completion is
   ignored, as `HabitatGiftReveal` does today. The sheet closes on
   `accountId` change without stamping.
5. **Forcing a reveal means seeding a receipt.** The only way to show one on
   demand — App Store screenshots, QA, a demo — is a dev-tools action
   (`components/dev/screens/reveal-seeder.tsx`, admin-gated) that inserts an
   unpresented receipt for the signed-in account through the same grant
   path a player would take (`grant_habitat_item(uid, item, 'dev_seed', ref)`,
   a real `achievements` unlock, a seeded `mystery_hat_reveals` row). No
   `forceVisible`, no `__DEV__ && true`, no `GUIDE_EVERY_VISIT`. A seeded
   reveal is indistinguishable from a real one because it *is* one.
6. **Re-present replays from the top.** When the queue churns a slot
   (dropped and re-requested in one commit), the sheet re-enters and any
   phased hero (the mystery box) resets to its first phase.

## 6. Queue rules

1. **Bands stay.** `POPUP_PRIORITIES` is unchanged in number and order.
2. **Launch cap.** New in `PopupQueueProvider`: a per-launch counter of
   *presented* housekeeping/flourish slots (priority ≥ 40). After **one**
   has presented, further requests in that band are held until the Barn
   tab's next `useFocusEffect` (a new `releaseHeld()` the Barn calls on
   focus). Ceremonies (`CEREMONY_SLOT_IDS`) and events (< 40) are never held.
   The `ceremonyGate` stays as is (a ceremony still suppresses the digest for
   the session).
3. **Badges ride the recap.** When `achievements` and `rituals` both want in
   the same launch, `WhileAwayModal` renders the badges as its last section
   (`badges` prop) and marks them seen on its dismiss; the digest slot drops
   for that launch. Alone, the digest presents as itself.
4. **First-login ceiling.** With 2 and 3, a first login shows at most: the
   tale (ceremony) → one of {recap + badges, expansion, mystery hat, lucky
   pig}. **Two taps to Rosie, never four.**
5. **User-initiated sheets** (priority 5) keep jumping the line; a held
   reveal never blocks them.

## 7. Per-file changes

### New

| file | what | size |
| --- | --- | --- |
| `components/ui/RevealSheet.tsx` | the sheet (§1a): heading row via `closeRowContent`, count line, top/bottom rules, scrolling body, gold primary, left hand secondary; exported from `components/ui/index.tsx` under *modals* | M |
| `components/ui/LedgerRow.tsx`, `components/ui/LedgerLine.tsx` | the line grammar (§1a): 26pt mark disc by `kind`, words, tabular value, dashed separator; the object line with the 120/96pt art column and the SE stack | M |
| `constants/theme.ts` | `REVEAL_MAX_W = 390`, `REVEAL_LIST_MAX_H = 240` | S |
| `utils/revealCopy.ts` | `REVEAL_BUDGETS` (§4 table) + `fitsBudget(role, text)`; used by the tests and the seeder | S |
| `components/dev/screens/reveal-seeder.tsx` | admin-gated seed actions, one per member (§5.5) | M |
| `supabase/migrations/20260916000000_reveal_receipts.sql` | `mystery_hat_reveals`, `lucky_pig_windows`, `mark_reveal_presented(kind, ref)`; `dev_seed_reveal(kind, ref)` admin-only | M |
| `tools/eslint-plugin-ttp` rule `reveal-through-sheet` | in the family's files, `AdaptiveModalScaffold` / `DialogCloseRow` / `bare` are errors; only `RevealSheet` | S |

### Changed

| file | change |
| --- | --- |
| `components/ui/PopupQueue.tsx` | launch cap + `releaseHeld()` (§6.2); `usePopupSlot` gains `band` derived from priority |
| `constants/popupPriorities.ts` | doc comment for the cap; `HOUSEKEEPING_FLOOR = 40` exported |
| `app/_layout.tsx` | `rituals` slot passes `badges` when both want; `achievements` slot drops in that case; Barn focus calls `releaseHeld()` |
| `components/habitat/HabitatGiftReveal.tsx` | → `RevealSheet` (`paper`, `pageTitle`); kicker `a little more home`; single gift: title = the item's name, count `new · yours to keep`, body = one `LedgerLine` (art 120, status `New · yours to keep`, sub `a shelf keepsake. try it in your Barn now, or later.`); batch: title `3 new furnishings`, body = one `LedgerRow` per gift (art as the mark, value `new`) each tappable to preview; primary `Preview in my Barn`; secondary `later ›`; × `Keep gifts for later` |
| `components/habitat/HabitatExpansionDiscovery.tsx` | → `RevealSheet` (`paper`, `sectionTitle`); kicker `a home for your pig`; count `four starter pieces · yours`; body = four `LedgerRow`s (the starter art as marks: `Warm Plank Barn` / `Rosie's sketch` / `Sunflower crock` / `Patchwork rug`, values `shell` / `wall` / `floor` / `rug`); the Friends/Decorate pair and the `80 designs …` line are cut (the Barn says it); primary `See my Barn`, secondary `shop furnishings ›`, × `Maybe later`; `loading` replaces `LoadingBeat` |
| `components/MysteryHatReveal.tsx` | → `RevealSheet` (`lilac`, `pageTitle`); kicker `mystery hat box`; box phase: title `Something's rattling`, body = `LedgerLine` with the wobbling box as `art` (tappable), status `Tap the box`, primary hidden; open phase: title = hat name, `LedgerLine` art = the hat on its rarity disc, status `Yours`, tag = rarity `Tag`, sub `wear it in the Closet`; primary `Wear it` (Closet, via `releasePopupThenNavigate`), secondary `keep it for later ›`; fallback: title `+150 snouts`, status `The box spilled snouts`, sub `you own every hat it could hold`, primary `Got it`; backdrop no longer opens; receipt = `mystery_hat_reveals` |
| `components/AchievementDigestModal.tsx` | → `RevealSheet` (`sun`, `pageTitle`); count `3 badges · all saved`; body = one `LedgerRow` per badge (badge art as the mark, sub = the reward, value = `L2` when levelled); primary `Got it`; exports `AchievementRows` (the mapped `LedgerRow`s) for the recap (§6.3) |
| `components/LuckyPigModal.tsx` | → `RevealSheet` (`sun`, `pageTitle`); kicker `lucky pig`; body = `LedgerLine` (art = the burst + pig at 120, status `Your next {n} tickles`, sub `{p}% chance each one is doubled`) plus, when a title unlocks, a second `LedgerRow` (mark = crown, title = the title's name, value `before` / `after`); primary gold two-state; secondary `keep for later ›`; receipt = `lucky_pig_windows` |
| `components/WhileAwayModal.tsx` | → `RevealSheet` (`paper`, `pageTitle`); count `{n} things landed · today`; body = one `LedgerRow` per event — mark by kind (visit ★ on sun, bless heart on sage, curse on lilac, trade heart on rose, sounder bell on paper), title = the event, sub = who and what, value = the time when `at` is present else the event's value; tappable rows keep `onNavigate`; `badges?` appends `AchievementRows` after a dashed rule; primary `Got it`; the pill `ListRow`s, `LIST_BLEED` and the foot note go |
| `utils/whileAway.ts` (+ its RPC) | events carry `at` (ISO) — `sent_at` for rituals, `created_at` for announcements/trades; `headline` capped at 28 chars; row titles drop their `!` |
| `components/GreatHungerIntroModal.tsx` | → `RevealSheet` (`paper`, `pageTitle`); kicker `season 1 · the tale`; count `the Great Hunger · 1 min`; body = the video frame between the rules (§2.8: the family's one full-width picture; 58 % cap, mute chip inside); primary `To the season` / `Rally your Sounder` (`size lg`, prop `primarySize`, the one size exception); × `Skip the tale` |
| `components/season1/SeasonGuideModal.tsx` | → `RevealSheet` (`paper`, `pageTitle`); count `five steps · the Hunger ladder`; body = five `LedgerRow`s (step art as marks, value = the step number) then a dashed rule and the ladder as `LedgerRow`s (level name, value = the credit number); the ladder foot becomes the count line's second sentence, cut to *every dig and blessing pries his tickles back*; primary `To the patch`; × `To the patch`; **remove** `leave your Sounder ›`; `GUIDE_EVERY_VISIT` deleted; once per user from `season_guide_seen` |
| `app/(tabs)/season.tsx` | drop the `GUIDE_EVERY_VISIT` effect; the once-per-user open reads the stamp |
| `components/ui/AdaptiveModalScaffold.tsx` | unchanged in behaviour; `frameStyle` already accepts the tone |
| `docs/design/taste-standard.md`, `SKILL.md` | decision-log entries (§10) |

### Deleted

`DIGEST_MAX_W`, both `CARD_MAX_W`s, `GUIDE_EVERY_VISIT`, the two inner
`DialogCloseRow` usages with negative margins, the `LoadingBeat` row in the
expansion sheet, the ★ in three kickers, every `align="center"` in the eight
files, every `Sticker`/`ListRow` inside a reveal body, the recap's
`LIST_BLEED` use (the token stays), the exclamation marks on row titles.

## 8. Tests

### New

- `__tests__/RevealSheet.test.tsx` — renders every slot in order (heading
  row with kicker + title + ×, count, top rule, body, bottom rule, error,
  primary, secondary); `closeLabel` is the rail's label; backdrop press does
  nothing; primary `loading` disables the secondary; `onAccessibilityEscape`
  calls `onClose`; `tone` sets the frame colour from `WHIMSY`; the kicker
  never contains `★` twice; the secondary is `alignSelf: "flex-start"` and
  its label ends in ` ›`; no descendant carries `textAlign: "center"`.
- `__tests__/LedgerRow.test.tsx` — the three-column grid; the mark disc's
  fill follows `kind`; no border/shadow/rotate on the row; the first row has
  no top separator and every later one does (dashed, `BORDER.hair`,
  `uiMuted`); `value` renders tabular and right-aligned; with no value on
  any row the column is absent; a row with `onPress` is a button carrying
  ` ›` after its value; row title clamps to one line, sub to two.
- `__tests__/LedgerLine.test.tsx` — art column 120 at 390pt, 96 under 360pt,
  stacked below 340pt of inner width; `tag` renders under `status`,
  left-aligned.
- `__tests__/revealCopy.test.ts` — the budget table; `fitsBudget` for each
  role; **every literal string passed to `RevealSheet` in the eight files fits
  its budget** (source-scan, the `barnTickleTotal` idiom); no member file
  contains `AdaptiveModalScaffold`, `DialogCloseRow`, `bare`, `variant="dark"`,
  `variant="purple"`, `variant="link"`, `variant="ghost"`, or a kicker string
  ending in `★`.
- `__tests__/PopupQueue.launchCap.test.tsx` — two housekeeping slots
  requested in one commit: exactly one presents; the second presents only
  after `releaseHeld()`; a ceremony is never held; a priority-5 slot jumps
  a held band; the cap resets per provider mount.
- `__tests__/whileAwayBadges.test.tsx` — with both `rituals` and
  `achievements` wanting, the recap renders the badge rows and the digest
  slot is not requested; dismiss marks both; alone, the digest presents.
- `__tests__/revealReceipts.test.ts` — source-scan: every slot's `want`
  derives from a receipt read (`presented` / `seen` / the stamp) and no file
  in the family reads a `forceVisible`-shaped prop or `__DEV__`.
- `__tests__/mysteryHatReceipt.test.tsx`, `__tests__/luckyPigReceipt.test.ts`
  — a reveal survives an unmount before dismiss (receipt still unpresented →
  re-presents), and never presents twice after a stamp.

### Updated

- `__tests__/HabitatGiftReveal.test.tsx` — mock `RevealSheet` instead of the
  scaffold/Body/Hand set; the four behavioural cases stay verbatim.
- `__tests__/HabitatExpansionDiscovery.test.tsx` — same mock swap; assert the
  × routes to the "maybe later" handler and there is exactly one gold primary.
- `__tests__/PopupQueue.test.tsx` — unchanged cases pass with the cap off
  (the cap only counts *presented* housekeeping slots).
- `__tests__/whileAway.test.ts` — headline budget cases; every event carries
  `at` when the RPC provides it and the value column falls back to the
  event's own value otherwise (never a fabricated time); row titles carry no
  `!`.
- `__tests__/popupPriorities.test.ts` — `HOUSEKEEPING_FLOOR` equals the first
  housekeeping priority.
- `__tests__/motionPolicy.test.tsx` — add `RevealSheet.tsx` to the files that
  must import the motion policy.
- Scorecard stays 0/213 (+1 file); `npx eslint --quiet` green including the
  new rule.

## 9. Acceptance criteria

Verified on the iPhone 17 Pro sim and at 320 × 568 (SE) in the web target.

1. Every member of the family renders through `RevealSheet`; `grep -l
   AdaptiveModalScaffold` over the eight files returns nothing.
2. Frame width is 390 on a Pro Max and `screen − 16` on an SE; the inset is
   24pt on both; no text touches a frame edge in any state (empty, one item,
   four items, error, loading).
3. No title, body or note wraps to a third line on the SE at the default
   Dynamic Type step; at the largest accessibility step they truncate at two
   lines with an ellipsis and the primary is still on screen.
4. The close rail is present on all eight, in flow, 44pt, labelled with the
   outcome; VoiceOver reads it first, then the title as a header.
5. Kicker, title, count, row title/sub/value, primary and secondary use
   exactly the roles in §1a on all eight; kickers show one ★; every text is
   left-aligned.
6. One gold full-width primary per sheet under the bottom rule; at most one
   left-aligned ` ›` secondary; nothing renders below it.
6a. Inside the rules nothing has a fill, border, radius, tilt or shadow —
   `grep -l "Sticker\|ListRow"` over the eight files' bodies returns nothing;
   marks are 26pt discs on one column; rules run the full inner width.
6b. The recap's rows have no clipped edge at any scroll position (there is
   nothing to clip); the rules and the primary hold still while the lines
   scroll.
7. A backdrop tap does nothing on all eight.
8. Every dismiss path (×, primary, secondary, Android back, VoiceOver
   escape) stamps the same receipt once; force-quitting before dismiss
   re-presents on the next launch; a failed stamp keeps the sheet with the
   error line and enabled controls.
9. A seeded receipt from the dev tools presents the identical sheet a player
   would see, on the same code path, and stamps the same way.
10. First login on a fresh account with a pending recap, badges, the
    expansion and a mystery hat: the tale, then **one** sheet, then Rosie.
    The rest arrive one per Barn focus.
11. The mystery box opens only on the box tap; `Wear it` lands on the Closet
    with the hat selected after the sheet has faded.
12. Reduce Motion: no wobble, burst, spring or autoplay; every sheet still
    arrives with a crossfade.
13. `GUIDE_EVERY_VISIT` and the guide's `leave your Sounder ›` are gone; the
    guide opens from `how it works ›` and once from its stamp.
14. `npm run scorecard` 0; `npx eslint --quiet` clean; the full jest suite
    green; `npx tsc --noEmit` clean.

## 10. Edge cases

- **Batch gifts** (several unpresented grants): one sheet, title `3 new
  furnishings`, one `LedgerRow` per gift (art as the mark, value `new`),
  each tappable to preview that one; the primary previews the first. Later
  stamps all.
- **Long row titles** (a crewmate's long name + crew name on a Sounder oink):
  the words column clamps the title to one line with an ellipsis and keeps
  the sub; the value column never shrinks below its content (`maxWidth 88`,
  `flexShrink 0`).
- **No values anywhere** (a batch of gifts without a time): the value column
  collapses to zero width so the words column takes the full inner width.
- **The object line on an SE** (256pt inner): art 96pt would leave 144pt
  for words — below the 160pt floor — so the line stacks: art above, words
  below, both on the left edge; budgets switch to the "full" figures in §4.
- **Zero-width receipts** (an item deleted from the catalog after grant): the
  member filters unknown ids before requesting the slot; a batch of only
  unknowns never presents and is stamped by a housekeeping sweep on launch.
- **Dynamic Type at the accessibility steps**: budgets are set at the default
  step; the two-line caps truncate, the list scrolls, the primary is fixed at
  the bottom of the sheet (the scaffold's scroll path already keeps it
  reachable). Verified in criterion 3.
- **Landscape / iPad**: `maxWidth 390` centres the sheet; heroes keep their
  frames; the tale's video is capped at 58 % of the *shorter* dimension.
- **Offline dismiss**: the stamp is cached in AsyncStorage under the receipt
  key and replayed on the next online launch (the expansion's pending-ack
  pattern, generalised into `utils/revealReceipts.ts`); until it replays, the
  cached stamp suppresses re-presentation locally.
- **Account switch** mid-sheet: close without stamping; the receipt belongs
  to the previous account and presents to them next time.
- **Queue churn**: a slot dropped and re-requested in one commit is a no-op
  (existing machine behaviour); a slot released and re-requested across
  commits re-enters from the top with its hero reset.
- **Ceremony + housekeeping in one launch**: the ceremony presents; the
  digest is suppressed for the session (gate); other housekeeping is held by
  the cap until the next Barn focus, then one presents.
- **Two flourishes** (mystery hat and lucky pig in one session): the cap
  holds the second until the next Barn focus; a lucky window opened by a
  tickle while a hat sheet is up is written to its receipt and presents
  later — the window's clock runs from `opened_at`, not from presentation.
- **Web target**: the same sheet; `Modal` is RN-web's; the close rail is the
  first tab stop; the MetaMask-style extension overlay is not ours.

## 11. Order of work

1. **Primitives + budgets** — `RevealSheet`, `LedgerRow`, `LedgerLine`,
   `REVEAL_*` tokens, `utils/revealCopy.ts`, the lint rule, the three
   primitive test files, `revealCopy.test.ts`. No member migrates yet. (M)
2. **Housekeeping trio** — `HabitatGiftReveal`, `HabitatExpansionDiscovery`,
   `AchievementDigestModal` onto the sheet; their tests updated. Screenshot
   pass on the 17 Pro and SE. (M)
3. **Recap + cap** — `WhileAwayModal` onto ledger rows with `badges` and
   `at` on its events (RPC + `utils/whileAway.ts`); the pill rows, the bleed
   and the foot note go; the launch cap in `PopupQueue` + `releaseHeld()`
   from the Barn; the two queue tests. (M)
4. **Flourishes + receipts** — migration (`mystery_hat_reveals`,
   `lucky_pig_windows`, `mark_reveal_presented`), `MysteryHatReveal` and
   `LuckyPigModal` onto the sheet and the receipts; local Docker harness
   validation; founder "go" before the push. (M/L)
5. **Ceremonies** — the tale and the guide onto the sheet; `GUIDE_EVERY_VISIT`
   deleted; the guide's stamp; `leave your Sounder ›` moved out (own PR). (M)
6. **Seeder** — `reveal-seeder.tsx` + `dev_seed_reveal`; used to run the
   acceptance pass; the screenshot-pipeline memory note updated to "seed a
   reveal" instead of "dismiss four". (S)
7. **Decision log** — `SKILL.md` (two taps to Rosie; a reveal is a receipt)
   and `taste-standard.md` (one sheet, one order, one gold primary; the copy
   budgets). (S)

Each step ships behind nothing — the sheet is a refactor with a screenshot
pass, the cap is one provider change, the receipts are additive.

## 12. Assumptions (defaults until the founder says otherwise)

1. **Gold is the family's one primary.** If reward ceremonies should stay
   `dark`, the rule becomes "gold for Barn, dark for rewards" and §1's control
   rule gains a `primaryVariant` limited to those two.
2. **`RevealSheet` is a `components/ui` primitive**, not a per-file pattern.
3. **Badges fold into the recap** when both want.
4. **The seeder targets only admin/founder/demo accounts** (`dev_seed_reveal`
   checks the admin claim; the grant still goes through the real path).
5. **The SE (320pt) is the width floor.** Dropping SE support loosens the
   budgets by ≈ 20 %.
6. **`leave your Sounder ›` leaves the guide** in this pass and lands on the
   Sounder card's menu in a follow-up.
7. **One structure for all eight** — list dialogs and object dialogs both
   use the Ledger (`LedgerRow` / `LedgerLine`); the tale's video is the only
   full-width body. If the object dialogs should keep a centred hero, say so
   and §2.7 becomes the Postcard's band for those four.
8. **The recap's RPC can return `sent_at` / `created_at`** without a schema
   change; if it cannot, the value column stays value-only (§4a).
