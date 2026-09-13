# The reveal family — one sheet for everything the game hands you (spec)

> **Status:** proposed 2026-09-13. Covers the eight passive popups that present
> something to the player (a gift, a badge, a hat, a window, a recap, a tale, a
> guide). Grew out of the `HabitatGiftReveal` inset bug fixed the same day
> (`b7ea4fa`). Nothing else here is built. Companion audit: the family table in
> the session notes; the rules below supersede it.

## The sentence

**"Everything the game hands you arrives on the same sheet, in the same order,
and leaves the same way."**

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

## 1. The primitive — `RevealSheet`

One component owns the frame, the inset, the order and the controls. Every
member of the family renders *through* it; none renders a scaffold, a
`Sticker` frame or a `DialogCloseRow` of its own.

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
  /** A fixed-frame picture: art, a video, a burst. Sized by the caller. */
  hero?: ReactNode;
  /** One line under the hero. `handLg` for reveals, `body` for housekeeping. */
  body?: string;
  bodyRole?: "handLg" | "body";
  /** The optional list. Scrolls inside at `listMaxHeight`; never the sheet. */
  children?: ReactNode;
  listMaxHeight?: number;
  /** A hand note that explains the primary. Sits ABOVE the primary, always. */
  note?: string;
  primary: { label: string; onPress: () => void; loading?: boolean; hint: string };
  /** Centred handLink under the primary. The only allowed second control. */
  secondary?: { label: string; onPress: () => void; hint: string };
  /** Names the outcome of ×: "Keep gifts for later", "Skip the tale". */
  closeLabel: string;
  onClose: () => void;
  error?: string | null;
  testID?: string;
}
```

- **Frame.** `AdaptiveModalScaffold` with `showCloseButton`, `maxWidth
  REVEAL_MAX_W = 390`, `presentation "native"`, `dismissOnBackdrop false`.
  Never `bare`. `tone` sets the frame's `backgroundColor` via `frameStyle`
  (`WHIMSY.paper | sun | lilac`); the border, radius (`RADII.xxl`) and
  `STICKER_SHADOW` are the scaffold's.
- **Inset.** `contentContainerStyle = { paddingHorizontal: SPACE.xl,
  paddingBottom: SPACE.xl, gap: SPACE.md }`. The top inset is the close rail.
  No member passes padding of its own.
- **Order, top → bottom.** close rail → `Kicker` → title → hero → body →
  children → note → error → primary → secondary. A member may omit any
  optional slot; it may not reorder them.
- **Controls.** Primary is `<Button variant="gold" size="md" full>`; secondary
  is `<Button variant="handLink" size="sm">` centred. No `ghost`, `link`,
  `dark`, `purple` or `primary` variants in the family. No side-by-side
  buttons. `loading` on the primary is the only busy state (no `LoadingBeat`).
- **Motion.** The sheet enters with `popIn(scale, opacity, policy)`
  (`utils/motionRecipes.ts`) and leaves on the scaffold's fade. Members add
  motion only *inside* `hero`.
- **Text.** Every word through a `T` role. Kicker ≤ 22 chars. Title
  `numberOfLines={2}`, body `numberOfLines={2}`, note `numberOfLines={2}`; the
  budgets in §4 make the caps invisible — the caps exist so a locale or a
  Dynamic Type step degrades to a truncation, never a third line.

## 2. Layout rules

1. **One width.** `REVEAL_MAX_W = 390` in `constants/theme.ts` (next to
   `TAB_SAFE`). Retire `CARD_MAX_W` (MysteryHat, LuckyPig), `DIGEST_MAX_W`
   (360), the `400`s (tale, guide) and the scaffold default (430) for this
   family.
2. **One inset.** 24pt sides and bottom on every device; on a 320pt screen
   the scaffold's own gutter (`SPACE.sm` under 360) shrinks the *frame*, not
   the inset. Inner width floor: 320 − 16 − 48 = **256pt**.
3. **One close.** The scaffold's rail, top-right, 44pt, labelled with the
   outcome. It is in flow (never absolute) so a two-line title cannot slide
   under it. No inner `DialogCloseRow`, no negative margins.
4. **Heroes are pictures.** Fixed frames with their own named constants
   (`GIFT_ART`, `HERO`, `BURST_SIZE`, the tale's 9:16 frame capped at 58 % of
   screen height). A hero never sets the sheet's width.
5. **Lists scroll inside.** `children` sits in a `ScrollView` with
   `maxHeight = listMaxHeight` (default `REVEAL_LIST_MAX_H = 240`) and
   `bounces={false}`; the primary is always on screen without scrolling the
   sheet. Rule of thumb: ≤ 4 rows visible, the rest reachable.
6. **Nothing under the primary but the secondary.** The note explains the
   gold button, so it sits above it. A note that does not explain the primary
   is a `body tone="secondary"` line under the title, or it is cut.
7. **Card-in-card is a tone, not a border.** The sun/lilac Sticker inside a
   frame is retired; `tone` tints the one frame.

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
in the role's face. Exceeding a budget is a lint failure (§7), not a judgement.

| role | ≈ chars/line | 2-line budget | used for |
| --- | --- | --- | --- |
| kicker (hand 13) | — | **22** (one line) | the sentiment / the source |
| pageTitle (Caprasimo 26) | 15 | **28** | reveal + ceremony titles |
| sectionTitle (Caprasimo 22) | 18 | **34** | housekeeping titles |
| handLg (17) | 30 | **58** | reveal body |
| body (Nunito 15) | 33 | **66** | housekeeping body, list rows |
| hand (14) | 36 | **70** | notes |
| button label | — | **18** (one line) | primary / secondary |
| list row title (cardTitleSm) | 22 | **22** (one line) | badges, recap rows |

- **Kicker** is lowercase hand, no punctuation, no ★ (the primitive draws it):
  `a little more home` · `mystery hat box` · `achievements` · `lucky pig` ·
  `while you were away` · `season 1 · the tale` · `season 1 · how it works`.
- **Title** names the thing when there is one (`Guestbook Keepsake`, `The
  Tiny Crown`) and the moment when there is not (`A new badge is yours`).
  Dynamic titles are capped at the source (`utils/whileAway.ts` headline).
- **Body** is one sentence with one fact. Numbers are digits. No em-dash
  clauses, no "please", no "successfully".
- **Buttons** are sentence-case verbs, ≤ 18 chars, no exclamation marks.
- **Notes** are lowercase hand, no full stop, one clause.

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
| `components/ui/RevealSheet.tsx` | the primitive (§1); exported from `components/ui/index.tsx` under *modals* | M |
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
| `components/habitat/HabitatGiftReveal.tsx` | → `RevealSheet` (`tone paper`, `titleRole pageTitle`); kicker `a little more home`; title = the item's name (single gift) / `3 new furnishings` (batch, list of cards inside); body ≤ 58; primary `Preview in my Barn`, secondary `Later`; `closeLabel "Keep gifts for later"` |
| `components/habitat/HabitatExpansionDiscovery.tsx` | → `RevealSheet` (`paper`, `sectionTitle`); kicker `a home for your pig`; body `Four starter pieces are yours. The room starts empty — go decorate it.`; note `80 designs for Snouts · 20 more earned by collecting`; the Friends/Decorate pair as two `body` lines under the hero; primary `See my Barn`, secondary `Shop furnishings`, × = `Maybe later`; `loading` replaces `LoadingBeat` |
| `components/MysteryHatReveal.tsx` | → `RevealSheet` (`lilac`, `pageTitle`); kicker `mystery hat box`; box phase: hero is the tappable box, title `Something's rattling`, body `Tap the box to open it`, primary hidden until open; open phase: title = hat name, rarity `Tag` inside hero, body `It's yours — wear it in the Closet` → `Yours. Wear it in the Closet.`; primary `Wear it` (Closet, via `releasePopupThenNavigate`), secondary `Keep it for later`; fallback: title `+150 snouts`, body `You own every hat it could hold, so it spilled snouts.`, primary `Got it`; backdrop no longer opens; receipt = `mystery_hat_reveals` |
| `components/AchievementDigestModal.tsx` | → `RevealSheet` (`sun`, `pageTitle`); rows in `children` with `listMaxHeight`; primary `Got it` gold full; accepts `embedded` for the recap (§6.3) or exports `AchievementRows` for `WhileAwayModal` to reuse |
| `components/LuckyPigModal.tsx` | → `RevealSheet` (`sun`, `pageTitle`); kicker `lucky pig`; hero = burst + pig (unchanged); the bonus-title well loses its hairlines (a `body` pair); primary gold two-state; secondary `Keep for later`; receipt = `lucky_pig_windows` |
| `components/WhileAwayModal.tsx` | → `RevealSheet` (`paper`, `pageTitle`); rows in `children`; primary `Got it`; **delete** the foot note; `badges?: UnlockedAchievement[]` renders `AchievementRows` after the events; dismiss marks both the away marker and the badges seen |
| `utils/whileAway.ts` | `headline` capped at 28 chars (`fitsBudget("pageTitle")`); the fallback `While you were away` |
| `components/GreatHungerIntroModal.tsx` | → `RevealSheet` (`paper`, `pageTitle`, primary `size lg` is the one allowed exception, prop `primarySize`); kicker `season 1 · the tale`; hero = the video frame (unchanged, 58 % cap, mute chip inside); primary `To the season` / `Rally your Sounder`; × = `Skip the tale` |
| `components/season1/SeasonGuideModal.tsx` | → `RevealSheet` (`paper`, `pageTitle`); steps + ladder in `children` with `listMaxHeight`; ladder foot → `body tone="secondary"` `Every dig and blessing pries his tickles back. Starve him from Gorged to Famished.`; primary `To the patch`; × = `To the patch`; **remove** `leave your Sounder ›` (moves to the Sounder card's menu, separate change); `GUIDE_EVERY_VISIT` deleted; opens from `how it works ›` and once per user from a `season_guide_seen` stamp |
| `app/(tabs)/season.tsx` | drop the `GUIDE_EVERY_VISIT` effect; the once-per-user open reads the stamp |
| `components/ui/AdaptiveModalScaffold.tsx` | unchanged in behaviour; `frameStyle` already accepts the tone |
| `docs/design/taste-standard.md`, `SKILL.md` | decision-log entries (§10) |

### Deleted

`DIGEST_MAX_W`, both `CARD_MAX_W`s, `GUIDE_EVERY_VISIT`, the recap's foot
note, the two inner `DialogCloseRow` usages with negative margins, the
`LoadingBeat` row in the expansion sheet, the ★ in three kickers.

## 8. Tests

### New

- `__tests__/RevealSheet.test.tsx` — renders every slot in order (snapshot of
  the child sequence: rail, kicker, title, hero, body, children, note, error,
  primary, secondary); `closeLabel` is the rail's label; backdrop press does
  nothing; primary `loading` disables the secondary; `onAccessibilityEscape`
  calls `onClose`; `tone` sets the frame colour from `WHIMSY`; the kicker
  never contains `★` twice.
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
- `__tests__/whileAway.test.ts` — headline budget cases.
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
5. Kicker, title, body, note, primary and secondary use exactly the roles in
   §1 on all eight; kickers show one ★.
6. One gold full-width primary per sheet; at most one handLink secondary;
   nothing renders below the secondary.
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
  furnishings`, one card per gift in `children` (scrolling at four), the
  primary previews the *first* card's item unless another card's own button
  was tapped (each card keeps its `Preview` button; the sheet's primary reads
  `Preview in my Barn` and previews the top one). Later stamps all.
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

1. **Primitive + budgets** — `RevealSheet`, `REVEAL_*` tokens,
   `utils/revealCopy.ts`, the lint rule, `RevealSheet.test.tsx`,
   `revealCopy.test.ts`. No member migrates yet. (S/M)
2. **Housekeeping trio** — `HabitatGiftReveal`, `HabitatExpansionDiscovery`,
   `AchievementDigestModal` onto the sheet; their tests updated. Screenshot
   pass on the 17 Pro and SE. (M)
3. **Recap + cap** — `WhileAwayModal` onto the sheet with `badges`; the
   launch cap in `PopupQueue` + `releaseHeld()` from the Barn; the two queue
   tests. (M)
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
