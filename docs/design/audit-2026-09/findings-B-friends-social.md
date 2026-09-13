# Findings — Area B · Friends / Social / Sounder

Auditor B. 26 files, ~8.7k lines. Audited from source, 2026-09-11.
Full ten prompts on the three largest: `components/UserSheet.tsx` (1349), `components/Friends.tsx` (1154),
`components/Inbox.tsx` (957). Every other file got P4 (token grep) + P5 (inventory) + targeted P6/P7/P10.

---

## 1 · Area summary

This is the app's whole social surface: the Friends hub (list · add · Inbox · Rankings · Sounder), the
UserSheet that every tappable pig in the app opens, the Sounder crew card and its five invite/handoff
sheets, the Porch Round scrapbook, and the shared identity primitives (`ProfileIdentity`, `PigAvatar`,
`PrestigeAvatar`, the three Alignment components) that every one of those surfaces renders.

**What's working is the newest layer.** The Sounder cluster — `CrewRow`/`CrewSheet` + the four sheets that
compose them (`FriendInvitePicker`, `PlayerInvitePicker`, `TransferLeadershipSheet`, `JoinableSounders`) —
is the best-governed code in the area and arguably in the app: `FriendInvitePicker` and `PlayerInvitePicker`
contain **zero** raw hex, fontSize, borderRadius or spacing literals between them, compose entirely from a
shared row grammar, and both wear `EmptyState`/`LoadingBeat`. `app/porch-round.tsx` and
`PorchRoundLaunchCard.tsx` are the same standard. The area's colour discipline is genuinely strong — only
**7 raw hex literals in 26 files**, against 381 `WHIMSY.*` references.

**The single biggest systemic gap is that the *older* social surfaces re-rolled the primitives instead of
composing them, and the duplicates are now the load-bearing UI.** Within this one area there are **four
bottom-sheet chromes** (`UserSheet`'s Modal, `CrewSheet`, `BlockedUsersModal`, `PigRosterPicker`) — none of
them the existing `SlideUpSheet`/`AdaptiveModalScaffold` — **three grabber pills** with three different
geometries, **three segmented controls** with three different looks, **eight hand-rolled button shapes**,
and **four confirmation grammars** for destructive actions (`ConfirmDialog`, a two-tap arm, a system
`Alert.alert`, and nothing at all). The duplication is what carries the type/radius/opacity drift: 103 bare
`fontSize` against 61 `TYPE.*`, 21 distinct bare `borderRadius` values, and 12 distinct raw opacities for
what are really three states (pressed / disabled / dimmed).

Two consequences deserve naming separately. First, **accessibility is absent wherever the old code lives**:
5 files carrying 20 `Pressable`s have not one accessibility prop between them, including `CrewRow` — the
shared row primitive feeding five Sounder surfaces. Second, **the highest-stakes actions in the area have
the weakest reassurance**: choosing a permanent pig companion opens a system `Alert`, while leaving your
Sounder and handing away your crown both fire on a single tap with no confirmation at all.

---

## 2 · Inventory table (P5)

| Element | File | Primitive or hand-rolled | States present | Duplicate elsewhere |
| --- | --- | --- | --- | --- |
| Hub page crown (kicker/title/rule) | `app/(tabs)/friends.tsx:179-181` | hand-rolled (`KICKER_PILL`+`TYPE.display`+`TITLE_RULE`) | default | `PageHeader` does exactly this |
| Hub nav cards ×4 | `app/(tabs)/friends.tsx:152-173` | hand-rolled | default · pressed · selected · badge | `SegmentedControl` |
| Inbox count badge | `app/(tabs)/friends.tsx:166-171` | hand-rolled | 1–9 · "9+" | — |
| Friends/Add tab pair | `Friends.tsx:336-350` | hand-rolled `TabBtn` | default · active | `SegmentedControl`; also `UserSheet.actionTabs` |
| Friend row | `Friends.tsx:484-623` | hand-rolled row in `FlatList` | default · pair-locked · globally-spent | `CrewRow`; `Inbox.passiveCardRow` |
| Favourite star | `Friends.tsx:564-582` | `Pressable`+`Icon` | default · pressed · on/off | — |
| Row visit door | `Friends.tsx:601-621` | hand-rolled circle | default · pressed · spent(disabled) | — |
| Visit-streak chip | `Friends.tsx:538-558` | hand-rolled pill | active · sleeping | — |
| Friends empty state | `Friends.tsx:424-435` | **hand-rolled** `Sticker`+`Text` | empty only | `EmptyState` (used 30× app-wide) |
| Search field | `Friends.tsx:706-720` | hand-rolled inside `Sticker` | default | `PlayerInvitePicker.search` |
| Search spinner | `Friends.tsx:723-728` | **`ActivityIndicator`** | loading | `LoadingBeat` |
| Add button (results/suggestions) | `Friends.tsx:744-754, 788-798` | hand-rolled | default · pressed · busy | 7 other button shapes in area |
| Sounder banner | `Friends.tsx:275-289` | hand-rolled | default | — |
| UserSheet chrome | `UserSheet.tsx:527-561` | **raw `Modal`** + own scrim/slide | loading · loaded | `CrewSheet`, `BlockedUsersModal`, `PigRosterPicker` |
| Grabber pill | `UserSheet.tsx:1068`, `CrewSheet.tsx:141`, `PigRosterPicker.tsx:234` | hand-rolled ×3 (44×4 muteSoft / 44×4 muteSoft / 42×5 ink@0.22) | static | — |
| Stats row (3 cols) | `UserSheet.tsx:607-627` | hand-rolled | value · null ("—") · tier chip | — |
| Ask/Bless/Curse tabs | `UserSheet.tsx:708-740` | hand-rolled | default · active | `SegmentedControl`; `Friends.TabBtn` |
| Ask amount pills 1–5 | `UserSheet.tsx:1000-1015` | hand-rolled | default · selected | — |
| Ask blocked panel | `UserSheet.tsx:972-993` | hand-rolled | pending · cooldown | — |
| Visit Barn CTA | `UserSheet.tsx:685-701` | hand-rolled | default · pressed · blocked | `Button` primitive |
| Action button (add/cancel/accept) | `UserSheet.tsx:934-953` | hand-rolled | primary · secondary · busy | `Button` primitive |
| Block/Report footer links | `UserSheet.tsx:805-821` | hand-rolled | default · pressed | `HandLink` (CrewRow) |
| Block/Report dialogs | `UserSheet.tsx:827-848` | **`ConfirmDialog`** ✓ | open · busy · destructive | — |
| Inbox actionable card | `Inbox.tsx:510-538` | hand-rolled | default · busy | — |
| Inbox trade pen card | `Inbox.tsx:548-599` | hand-rolled | affordable · short(locked) · busy | — |
| Inbox feed row | `Inbox.tsx:638-663` | hand-rolled | 6 kinds · first · last | `Friends.virtualFriendRow` |
| Inbox event bubble | `Inbox.tsx:646-660` | hand-rolled; **`Glyph` for 1 kind, raw `Text` glyph for 5** | 6 kinds | — |
| Inbox band headers | `Inbox.tsx:472, 507, 608` | **`SectionHeader`** ✓ | default | — |
| Inbox empty | `Inbox.tsx:461-465` | **`EmptyState`** ✓ | empty | — |
| Load more | `Inbox.tsx:668-673` | hand-rolled card | default | — |
| Blocked-users dialog | `BlockedUsersModal.tsx:76-150` | **raw `Modal`** + hand-rolled header | loading · empty · list · error · busy | `AdaptiveModalScaffold`/`DialogCloseRow` |
| Blocked empty state | `BlockedUsersModal.tsx:108-113` | hand-rolled (`Icon "check"` + 2 `Text`) | empty | `EmptyState` |
| Recruiter board rows | `app/sounder.tsx:111-135` | `Sticker` (non-interactive) | champ · row · self | `Leaderboard` rows (tappable) |
| Referral ladder rung | `sounder-progress.tsx:130-169` | hand-rolled | earned · next · locked | — |
| Referral progress bar | `sounder-progress.tsx:48-53` | hand-rolled | 0–100% | `AlignmentBar` |
| Sounder crew card | `SounderCard.tsx:335-482` | `Sticker` + hand-rolled internals | crewless · in-crew · leader | — |
| Slot pips | `SounderCard.tsx:344-364` | hand-rolled ×3 | filled · pending · open(+) | — |
| Found / Invite / Recruit / Oink CTAs | `SounderCard.tsx:635,704,718` | hand-rolled ×3 | default · busy(dim) | `Button` primitive |
| Rewards / Exchange chips | `SounderCard.tsx:747` | hand-rolled | default · pressed | — |
| Crew row | `CrewRow.tsx:92-139` | **`CrewRow` primitive** ✓ | default · dim · divider · pressable | — |
| Sun pill | `CrewRow.tsx:152-173` | **`SunPill` primitive** ✓ | default · pressed **= disabled** | — |
| Hand link | `CrewRow.tsx:191-227` | **`HandLink` primitive** ✓ | default · pressed = disabled · accent | `UserSheet.moderationLink` |
| Crew sheet chrome | `CrewSheet.tsx:91-112` | hand-rolled Modal+scrim+slide | open · closing | `UserSheet`, `PigRosterPicker` |
| Oink preset row | `SounderOinkSheet.tsx:103-128` | hand-rolled | ready · sent · unavailable · busy | — |
| Invite pickers | `FriendInvitePicker`, `PlayerInvitePicker` | **`CrewSheet`+`CrewRow`+`EmptyState`+`LoadingBeat`** ✓ | loading · empty · 4 row states | — |
| Pig roster chip + sheet | `PigRosterPicker.tsx:79-90, 93-190` | hand-rolled Modal; **`Alert.alert`** confirm | selected · owned · locked · recruitable · busy | — |
| Lounge HUD buttons ×5 | `app/lounge.tsx:726,734,755,771,783` | hand-rolled | default · pressed · on/off | — |
| Porch launch card | `PorchRoundLaunchCard.tsx:39-67` | hand-rolled, fully tokenized ✓ | default · pressed | — |
| Porch stop panel | `porch-round.tsx:24-36` | hand-rolled (non-interactive) | default | — |
| Porch welcome state | `porch-round.tsx:80-86` | hand-rolled | empty | `EmptyState` |
| Identity block | `ui/ProfileIdentity.tsx` | **primitive** ✓ (3 variants) | row · hero · profile | `Friends.rowName`+`rowDisc` |
| Pig avatar | `ui/PigAvatar.tsx` | primitive (raw-hex gradient) | pig · hat · bow · combined | — |
| Prestige avatar | `ui/PrestigeAvatar.tsx` | primitive | rank 0 · 1–5 · badge sm/lg | — |
| Alignment badge / bar / emblem | `ui/Alignment*.tsx` | primitives | sm·md·lg · compact · angel/neutral/goblin | — |

---

## 3 · Findings

### [P0] B-01 · A system `Alert.alert` gates the one permanent, irreversible choice in the feature

**Location** `components/PigRosterPicker.tsx:61-71`
**Prompt(s)** P2 (specificity), P7 (emotional journey), P10 (d/e/f)
**Evidence**
```
Alert.alert(
  `Choose ${pig.name} as Rosie's friend?`,
  "This is your one long-term companion choice. You can't change it right now.",
  [{ text: "Keep looking", style: "cancel" }, { text: `Choose ${pig.name}`, onPress: ... }],
);
```
**Expected standard** The severity scale in `00-evaluation-prompts.md` names "a system Alert in a spend
path" as an automatic P0. `components/ui/ConfirmDialog.tsx` exists and is used two files away
(`UserSheet.tsx:827-848`) for Block/Report, which are *less* permanent than this.
**Gap** The single highest-stakes, least-reversible decision on this surface — a permanent companion
selection a member makes once — leaves the cream paper world entirely and renders an iOS system sheet in
San Francisco on a grey scrim. It is also the only `Alert.alert` in the entire area.
**Recommendation** Replace with `ConfirmDialog` (`destructive` off, `confirmLabel={"Choose " + pig.name}`,
`cancelLabel="Keep looking"`). Then make the rule explicit in the taste standard: **no `Alert.alert` may
render in a player-facing path; `ConfirmDialog` is the only confirmation surface.** Add a lint rule for
`Alert.alert` under `app/` and `components/`.
**Pillar** Collect (the companion *is* the collectible) · craft/governance.

---

### [P1] B-02 · A failed profile fetch renders the loading beat forever; the error copy is written but never shown

**Location** `components/UserSheet.tsx:559` (the branch), `:314-320` (the error path)
**Prompt(s)** P1 (heuristics 1 · 9), P5 (state coverage), P7
**Evidence**
```
// :314    if (!data) { setFeedback("Couldn't load profile."); setStats(null); }  setLoading(false);
// :559    {loading || !stats ? ( <LoadingBeat label="peeking in" /> ) : ( … )}
// :799    {!!feedback && <Text style={styles.feedback}>{feedback}</Text>}   ← inside the `stats` branch
```
**Expected standard** Heuristic 1 (visibility of system status) and 9 (help users recover). Every other
loader in the area distinguishes loading from failure (`BlockedUsersModal.tsx:43,142-147` has both an
`error` state and a "Try again" button).
**Gap** On any RPC failure the sheet sets `stats = null`, `loading = false` — and line 559 re-enters the
loading branch because it tests `!stats`. The player watches "peeking in" indefinitely. The `feedback`
string that explains what happened is rendered at line 799, which is unreachable when `stats` is null.
The sheet opens from leaderboard rows, friend rows, and crew rows — it is the most-opened sheet in the app.
**Recommendation** Split the branch three ways and codify it: `LoadingBeat` while `loading`; a new
`EmptyState` variant with `retry?: () => void` when `!loading && !stats`; content otherwise. Make
`EmptyState` carry the retry affordance so "load failed" stops being hand-rolled per screen (it is also
missing in `sounder-progress.tsx:64-69` and `porch-round.tsx:44-48`, where a null fetch renders as "you
have nothing yet" — a lie).
**Pillar** Connect (the sheet is the door to every other player).

---

### [P1] B-03 · Leaving a Sounder and passing the crown are irreversible, one-tap, and unconfirmed

**Location** `components/SounderCard.tsx:551-553`; `components/TransferLeadershipSheet.tsx:87-89`
**Prompt(s)** P1 (heuristic 5 · error prevention), P7 (high-stakes reassurance), P10 (c)
**Evidence**
```
// SounderCard:551
<HandLink onPress={() => leave()} style={styles.leaveWrap}>
  leave your Sounder › no hard feelings
</HandLink>
// hooks/useCrew.ts:250 — const leave = useCallback(async () => { const r = await leaveRpc(); … })

// TransferLeadershipSheet:87
<SunPill onPress={() => crownThem(m.user_id)} disabled={busyId !== null}>Crown them</SunPill>
```
**Expected standard** The decision lens' question 4 ("does losing still feel warm?") and P7's requirement
that high-stakes moments carry reassurance and a cancel path. The same area already demonstrates the
pattern twice over: `Block` uses `ConfirmDialog` (`UserSheet.tsx:827`), `kick` uses a two-tap arm
(`SounderCard.tsx:419-421`, "kick" → "kick? sure ›").
**Gap** One tap on a hand-script link ends your membership of the herd — seat lost, and if the Sounder is
full you cannot get back in. One tap on a sun pill hands away leadership permanently ("the crown passes at
once"). Neither has a confirm, a busy lock on `leave`, or an undo. Meanwhile *blocking a stranger* — far
less costly — gets a full dialog. The area therefore ships **four** different confirmation grammars for
destructive acts: `ConfirmDialog`, two-tap arm, system `Alert`, and nothing.
**Recommendation** One rule, one component: **any action that cannot be undone by the same control that
performed it renders through `ConfirmDialog`.** Route `leave()`, `crownThem()`, `kick()` and the pig
recruit (B-01) through it; retire the two-tap arm. Give `ConfirmDialog` a `tone: "warm" | "destructive"`
so "leave your Sounder" can confirm without shame framing (charter: no rejection buttons, no shame states).
**Pillar** Contend (the herd is the competitive unit) · Connect.

---

### [P1] B-04 · 20 `Pressable`s across 5 files carry zero accessibility props — including the shared `CrewRow`

**Location** `components/Inbox.tsx` (6 pressables, 0 props), `components/SounderCard.tsx` (7, 0),
`components/CrewRow.tsx` (3, 0), `components/CrewSheet.tsx` (1, 0), `components/BlockedUsersModal.tsx` (3, 0)
**Prompt(s)** P6 (accessibility), P1 (heuristic 4)
**Evidence** Icon-only controls with no label at all: `Inbox.tsx:530-537` (the `✕` decline on a friend
request), `BlockedUsersModal.tsx:89-96` (dialog close), `SounderCard.tsx:353-361` (the `+` slot pip),
`app/lounge.tsx:771-781` (emote buttons). Value-bearing widgets with no value exposed:
`ui/AlignmentBar.tsx:62-68` (a −100..+100 position marker), `sounder-progress.tsx:49-51` (a 0–100 % bar).
Primary spend action with no state: `Inbox.tsx:573-590` (`Give N` / `Need N more`, `disabled` set but no
`accessibilityState`).
**Expected standard** The app baseline is 70 of 98 files with pressables carrying *some* a11y prop; this
area is 7 of 12. `Friends.tsx:564-582` and `:601-621` show the house pattern done correctly —
`accessibilityRole`, a composed `accessibilityLabel` naming the friend, and `accessibilityState={{disabled}}`.
**Gap** `CrewRow`, `SunPill` and `HandLink` are *primitives* consumed by five surfaces, so the gap
multiplies: every invite row, every join ask, every crown handoff and every kick is an unlabelled tap
target to VoiceOver. A blind player cannot tell "Invite" from "take it back".
**Recommendation** Push a11y into the primitives, not the call sites: `SunPill` and `HandLink` take
`accessibilityRole="button"` by default and require a `label` prop (default to `children` when it is a
string); `CrewRow` sets `accessibilityRole="button"` whenever `onPress` is passed and composes
`title + sub` into its label. Add `accessibilityRole="progressbar"` + `accessibilityValue` to `AlignmentBar`
and the referral bar. Then sweep the five files above.
**Pillar** Connect (a social surface nobody can navigate is not connecting anyone).

---

### [P1] B-05 · The shared identity primitives bypass the token layer, so the leak lands on every social screen at once

**Location** `components/ui/PigAvatar.tsx:38`; `components/ui/AlignmentBadge.tsx:71`;
`components/ui/PrestigeAvatar.tsx:68`; `components/ui/ProfileIdentity.tsx:65,74,75,76,77`
**Prompt(s)** P3 (colour contrast), P4 (token triage), P10 (i)
**Evidence**
```
PigAvatar:38        colors={["#FFD0DC", "#E8A7B9"]}          ← a soft gradient, 2 raw hex
AlignmentBadge:71   case "goblin":  return "#D5E4C9"; // moss tint
PrestigeAvatar:68   backgroundColor: "#D9A45D",
ProfileIdentity     profileName fontSize 24 · heroTitle 14 · profileTitle 15 · meta 12 · suffix 12
```
**Expected standard** Rule 1 of the taste standard ("never inline a raw hex / size / radius / pad"), and —
decisively — `constants/theme.ts`'s own comment on the `bless`/`curseGreen` pair: *"Five files hand-mixed
this pair off-palette (#C99B23 / #5E7E49 / **#D5E4C9** / #7BA266 / #5b8a4a); tokenized once so 'matches
Barn' is matched by token, not by copy-paste. (2026-07-12)"*
**Gap** `#D5E4C9` is a **survivor of a completed tokenization pass** — the decision log says it was folded
into WHIMSY, and it is still here. `PigAvatar`'s pink pair is a `LinearGradient` — a soft gradient behind
every pig on every friend row, crew row, roster row and sheet header, in a system whose DNA is hard edges
and flat pastel. `PrestigeAvatar`'s `#D9A45D` is a genuinely new semantic colour (Wallow-rank bronze)
introduced by leak rather than by token. `ProfileIdentity` is the app's *canonical* name-rendering
component and five of its seven text styles are bare `fontSize`, so every consumer inherits off-scale type.
**Gap (contrast)** `PigRosterPicker.tsx:160-166` paints the primary action with `definition.accent` from
`utils/pigs.ts:35,42` — `#646269` and `#4B4A50`. `TYPE.label` in `WHIMSY.ink` (#2a1f15) on `#4B4A50` is
≈ **1.9:1**; on `#646269` ≈ **2.9:1**. Both fail WCAG AA (4.5:1) for 12 px text, on the button that
performs the permanent choice.
**Recommendation** (a) Retire `#D5E4C9` for a `WHIMSY` goblin tint. (b) Replace `PigAvatar`'s gradient
with a flat `WHIMSY.rose` (or tokenize the pair as `WHIMSY.avatarWash` if the wash is wanted) — a soft
gradient is the one fill grammar the standard explicitly retires. (c) Add `WHIMSY.prestige` for `#D9A45D`.
(d) Migrate `ProfileIdentity` onto `TYPE` roles (`profileName` → new `TYPE.profileName` at 24/27;
`meta`/`suffix` → `TYPE.bodySm`). (e) Move the six pig accents in `utils/pigs.ts:21-56` into WHIMSY and
re-pick the two greys — `#F8A8B3` is *already* `WHIMSY.roseDeep` verbatim, and the two cool greys are
off-palette and fail contrast as button fills.
**Pillar** Collect (cosmetics and identity are the product) · craft/governance.

---

### [P1] B-06 · Four bottom sheets, three segmented controls, three grabbers, eight button shapes — in one area

**Location** Sheets: `UserSheet.tsx:527-561`, `CrewSheet.tsx:91-112`, `BlockedUsersModal.tsx:76-150`,
`PigRosterPicker.tsx:93-190`. Segmented: `app/(tabs)/friends.tsx:147-176`, `Friends.tsx:251-258`,
`UserSheet.tsx:708-740`. Grabbers: `UserSheet.tsx:1068-1075`, `CrewSheet.tsx:141-148`,
`PigRosterPicker.tsx:234-242`. Buttons: `UserSheet.actionBtn:1170`, `UserSheet.visitBtn:1324`,
`Friends.actionBtn:1101`, `Inbox.primaryBtn:800`, `Inbox.penBtn:835`, `SounderCard.foundBtn:635`,
`SounderCard.inviteCta:704`, `SounderCard.troveBtn:747`, `PigRosterPicker.close:374`.
**Prompt(s)** P5 (inventory), P8 (Jakob), P2 (specificity)
**Evidence** Three grabber pills, three geometries: `44×4 r2 muteSoft` / `44×4 r2 muteSoft` /
`42×5 RADII.pill ink@0.22`. Two slide-up animations with different timings: `UserSheet.tsx:268-273`
(320 ms `Easing.out(cubic)`, no exit tween) vs `CrewSheet.tsx:62-82` (240 ms in / 180 ms out). Two
segmented controls in the same *screen*: the hub's nav cards and `Friends`' Friends/Add tabs, plus a third
inside `UserSheet`. `SegmentedControl`, `SlideUpSheet` (7 files), `AdaptiveModalScaffold` (13 files) and
`Button` (16 files) all exist and are used elsewhere in the app.
**Gap** Nothing here is individually ugly — this is exactly the governance erosion the taste standard
names. The cost is that the Sounder sheet and the profile sheet *feel* different to open (one overshoots,
one does not; one animates closed, one snaps), and a player crossing Friends → UserSheet → Sounder → invite
picker meets four sheet grammars in four taps. It is also why the type/radius drift below is unfixable in
place: there is no one component to fix.
**Recommendation** Ship a `Sheet` primitive that owns the scrim, the slide (one duration, one easing, an
exit tween), the grabber, and an `AdaptiveModalScaffold`-compatible close — then migrate all four call
sites and delete `CrewSheet`'s chrome (keeping its title/sub slots as `Sheet` props). Migrate every button
above to `Button` with the variants they actually need (`primary` / `secondary` / `sun` / `locked` /
`chip`). Migrate all three segmented controls to `SegmentedControl` with an `icon-over-label` variant for
the hub nav. This is the area's highest-leverage single change.
**Pillar** craft/governance · Jakob (a phone sheet should behave one way).

---

### [P1] B-07 · The Inbox feed draws five of six event icons as raw text glyphs and the sixth as `Glyph`

**Location** `components/Inbox.tsx:627-659`
**Prompt(s)** P3 (learnability), P6 (icon-set consistency), P10 (d)
**Evidence**
```
const glyph = event.kind === "gifted"   ? "★"
            : event.kind === "friended" ? "+"
            : event.kind === "blessed"  ? "✦"
            : event.kind === "sounder"  ? "!"
            :                             "☁";
…
{event.kind === "answered" ? ( <Glyph name="heart" size={16} /> ) : ( <Text …>{glyph}</Text> )}
```
**Expected standard** The dingbat ruling (taste standard decision log, 2026-07-13): *"`✦` and `·` are
SANCTIONED as label typography … `✓`, `✕`, and `♥` are SEMANTIC — they carry meaning … and must scale and
color like the rest of the iconography, so they render through the `Icon`/`Glyph` primitives."* The ruling
draws the line by **what the mark does**, not what it is.
**Gap** Here `✦` is not a flourish on a label — it *is* the icon for "blessed", sitting in a 32 px
ink-bordered bubble beside `Glyph "heart"` doing the identical job for "answered". This is precisely the
"same concept drawn two ways in the same file" the ruling was written to kill. `☁` for "cursed" is the
worst of them — a cloud standing in for a curse, at Caprasimo's metrics, inside a bubble sized for art.
Separately, `passiveBubbleGifted` and `passiveBubbleSounder` are **both `WHIMSY.sun`** (`:924, :927`), so
two event kinds are distinguishable only by the text glyph — a Gestalt-similarity failure stacked on top.
**Gap (icon families)** The same file also renders `Image require(".../emoji/friend-request.png")` and
`emoji/pig.png` (`:512, :551`) — a third icon family beside `Icon` and `Glyph`, from a directory literally
named `emoji/`.
**Recommendation** Add `Glyph` entries for gifted · friended · blessed · cursed · sounder and render all
six bubbles through `Glyph`. Give each kind its own `WHIMSY` fill (no two kinds share one). Fold the two
`emoji/*.png` requires into `Glyph` and rename the asset directory. Extend the dingbat ruling with the
`›` case (B-13) so the line is drawn once.
**Pillar** craft/governance · Connect (the feed is where the friendship shows up).

---

### [P1] B-08 · Locked and disabled states dissolve the outline the standard says to keep — and two fail AA

**Location** `sounder-progress.tsx:250` · `UserSheet.tsx:1343-1347` · `CrewRow.tsx:333` ·
`SounderOinkSheet.tsx:158` · `PigRosterPicker.tsx:366` · `Friends.tsx:1030` (with a comment claiming the
opposite) · `SounderCard.tsx:648,699`
**Prompt(s)** P3 (colour contrast), P6, P10 (j)
**Evidence**
```
sounder-progress:250   rung: { …, borderWidth: 1.5, borderColor: WHIMSY.ink, opacity: 0.55 }
sounder-progress:267   rungLocked: { color: WHIMSY.mute }          // → mute @ 0.55 on paper ≈ 2.1:1
UserSheet:1343         visitBtnDisabled: { backgroundColor: cream2, borderColor: muteSoft, opacity: 0.7 }
CrewRow:166            style={[styles.pill, (disabled || pressed) && styles.pillDim]}   // one style, two states
Friends:1028           // "the taste standard's 'a button, asleep' — mute the fill, never dissolve the outline"
Friends:1030           rowVisitBtnSpent: { backgroundColor: cream2, opacity: 0.55 }     // …then dissolves it
```
**Expected standard** Taste-standard decision log, 2026-07-07: *"the muted fill/ink already say 'disabled';
dimming a bordered pill just erases the shape. Rule going forward: waiting/cooldown states keep the
control's shape — you mute the fill, you never dissolve the outline."*
**Gap** Every disabled/locked treatment in the area applies a blanket `opacity` crush on top of the muted
fill — the exact pattern the ruling retired for the `locked` Button variant, in one case under a comment
citing the ruling. Two of them fall below AA: the locked referral rungs render `WHIMSY.mute` text at 0.55
opacity on paper (≈ 2.1:1 against 4.5:1 required), so every rung's reward label is unreadable until
earned; `SounderOinkSheet`'s `opacity: 0.48` does the same to an Oink that is merely *not yet available*.
`CrewRow`'s `pillDim` also collapses **disabled and pressed into one style**, so a player cannot tell a
button they just tapped from one they cannot tap.
**Recommendation** Add the missing token family and make it the only way to express these states:
`OPACITY = { pressed: 0.7, dim: 0.55 }` for *decorative* dimming, plus a `DISABLED_FILL`
(`backgroundColor: WHIMSY.cream2, borderColor: WHIMSY.ink, color: WHIMSY.mute`, **no opacity**) that every
disabled control composes. Split `pillDim` into `pillPressed` and `pillDisabled`. Sweep the seven sites.
**Pillar** craft/hierarchy · P6 (contrast).

---

### [P1] B-09 · The Friends tab's empty state and search loader bypass `EmptyState`/`LoadingBeat`

**Location** `components/Friends.tsx:424-435` (empty), `:723-728` (searching), `:761-766` (no results)
**Prompt(s)** P1 (heuristic 1), P5, P10 (h)
**Evidence**
```
// :428
<Sticker color="paper" rotate={-0.5} radius={12} style={styles.empty}>
  <Text style={styles.emptyText}>No friends yet. Tap "Add" to send your first request.</Text>
</Sticker>
// :725
<ActivityIndicator size="small" color={WHIMSY.mute} />
<Text style={styles.searchingText}>searching…</Text>
```
**Expected standard** Taste-standard rule 4 and roadmap item 2, marked **✓ done**: *"`components/ui/
EmptyState.tsx` (`EmptyState` + `LoadingBeat`) … rolled across shop, season, achievements, sounder, inbox."*
`EmptyState` is used in 30 files; `Inbox.tsx:461` — the sibling segment of the *same hub* — uses it.
**Gap** The primary Friends tab — the default landing segment, and the first social screen a new player
sees — is one of the surfaces the rolled-out primitive missed. A brand-new player's very first view of the
game's social half is a bare grey sentence in a tilted card with no `Glyph`, and searching for their first
friend spins a naked platform `ActivityIndicator`. The taste standard names both patterns by name as the
thing that was fixed.
**Recommendation** `EmptyState glyph="friends" title="No friends yet" sub="Tap Add to send your first
request."` for the empty list; `LoadingBeat label="asking around"` for the search; `EmptyState
glyph="search"` for no-results, keeping the discriminator explainer as its `sub`. Then add a rule:
**`EmptyState`/`LoadingBeat` are the only empty and loading renderings; `ActivityIndicator` may not be
imported under `app/` or `components/`** (11 files still do app-wide; 2 are in this area).
**Pillar** Connect (this is the on-ramp) · craft.

---

### [P2] B-10 · `app/lounge.tsx` is 800 lines of unreachable UI behind an unconditional redirect

**Location** `app/lounge.tsx:808-810`
**Prompt(s)** P4, P5, P10 (f)
**Evidence** `export default function LoungeScreen() { return <Redirect href="/(tabs)/shop" />; }` — the
entire Skia lounge (walk, seesaw, presence, emotes, HUD) above it is never mounted. No route in the app
links to `/lounge` (only `lounge-prototype`), so user impact today is nil.
**Gap** The file still carries `COLORS.grass` (`:813`, the legacy palette the standard is retiring), two
raw `#4a3325` Skia tag colours (`:623, :662` — a near-duplicate of `WHIMSY.bark` #3a2c1e), five
hand-rolled HUD buttons with three of five unlabelled, and a **`practice pig on/off` developer toggle that
is not `__DEV__`-gated** (`:734-752`, while the adjacent perk-lab button at `:754` is). It contributes to
the app-wide literal counts while being unmaintainable, and if the redirect is ever lifted the debug
toggle and the unlabelled HUD ship with it.
**Recommendation** Decide the route: either delete `app/lounge.tsx` and keep the work in
`components/dev/screens/lounge-prototype`, or drop the redirect and fix it as a real screen. If it stays,
gate `practiceBtn` behind `__DEV__` and tokenize `#4a3325` → `WHIMSY.bark`, `COLORS.grass` → a new
`WHIMSY.grass`. A dead route that silently lands on the Shop is a Jakob violation waiting to be linked.
**Pillar** craft/governance.

---

### [P2] B-11 · Unblocking is a one-tap moderation action with no confirmation; blocking has a dialog

**Location** `components/BlockedUsersModal.tsx:124-136` vs `components/UserSheet.tsx:827-837`
**Prompt(s)** P7, P1 (heuristic 5)
**Evidence** `<Pressable onPress={() => void handleUnblock(user)} …><Text>Unblock</Text></Pressable>` —
no `ConfirmDialog`, no `accessibilityRole`, ~32 pt tall (`paddingVertical: 8` + 12 px text), and the row
disappears optimistically (`:72`) so there is no visible undo.
**Expected standard** Symmetry: the action that *creates* the safety boundary confirms; the action that
*removes* it should confirm at least as hard.
**Gap** A mis-tap in a scrolling list silently restores a blocked user's ability to interact. The dialog
text the player was shown when blocking ("prevents future interaction either way") is not echoed here.
**Recommendation** Route through `ConfirmDialog` (`destructive`, body naming the consequence); give the
button `Button` chrome with `minHeight: 44`. Same rule as B-03.
**Pillar** Connect (safety is a precondition for connecting).

---

### [P2] B-12 · Tap targets under 44 pt on primary actions

**Location** `Friends.tsx:1101-1106` (`actionBtn` ≈ 31 pt — the Add button, primary action of the Add
tab); `Inbox.tsx:835-842` (`penBtn` ≈ 35 pt — `Give N` / `Pass`, the spend path); `UserSheet.tsx:1295-1300`
(`actionTab` ≈ 29 pt); `Friends.tsx:856-862` (`tabBtn` ≈ 29 pt); `CrewRow.tsx:324-332` (`SunPill` ≈ 42 pt
with `hitSlop={6}` — the one button every Sounder surface acts through); `Inbox.tsx:668-673` (Load more
≈ 36 pt); `BlockedUsersModal.tsx:212-219` (Unblock ≈ 32 pt); `UserSheet.tsx:1109` (`breakdownLink` ≈ 34 pt
with `hitSlop={8}`).
**Prompt(s)** P6, P8 (Fitts)
**Expected standard** 44 pt minimum (Apple HIG; `00-evaluation-prompts.md` P6). The area proves it is
achievable: `UserSheet.askPill` sets `minHeight: 48` (`:1189`) and `Friends.rowVisitBtn` reaches 50 pt via
34 px + `hitSlop={8}`.
**Gap** Eight controls, including three primary actions and one spend action, sit under the threshold.
Fitts compounds it on the friend row, where the star (`:1007`, 30 px) and the visit door (`:1016`, 34 px)
sit 8 px apart on the right edge with overlapping hit slops — two different actions inside one thumb.
**Recommendation** Bake `minHeight: 44` into the `Button` primitive and `SunPill`; make `hitSlop` a prop
with a `44` default rather than per-site magic numbers. On the friend row, widen the gap between star and
visit door to `SPACE.md` or move the star to the leading edge.
**Pillar** Connect · accessibility.

---

### [P2] B-13 · `›` is used as a semantic navigation mark in raw `Text` across nine call sites

**Location** `UserSheet.tsx:653, 675, 1132`; `Friends.tsx:288, 622`; `SounderCard.tsx:318, 375, 421, 552`;
`JoinableSounders.tsx:103` (inside a button label); `app/lounge.tsx:730`; `PigRosterPicker.tsx:89` (`▾`);
`SounderCard.tsx:379` (`＋`, U+FF0B fullwidth plus, standing in for the `Icon "plus"` rendered in the pip)
**Prompt(s)** P6, P9, P3 (learnability)
**Evidence** `digStoryChev: { fontFamily: FONTS.whimsy, fontSize: 24, color: WHIMSY.mute }` (a 24 px
Caprasimo chevron) beside `<Glyph name="arrowRight" size={16} />` in `PorchRoundLaunchCard.tsx:66` doing
the identical job one card away in the same list.
**Expected standard** The 2026-07-13 dingbat ruling classifies by function: `✦`/`·` are flourish and stay
as `Text`; marks that carry meaning render through `Icon`/`Glyph`.
**Gap** `›` carries meaning (this row navigates) and the app already draws it as art (`Glyph "arrowRight"`,
`Icon`), so it falls on the semantic side — but the ruling does not name it, so nine sites use text. `▾`
and `＋` are the same case for disclosure and add.
**Recommendation** Extend the dingbat ruling to name `›`, `‹`, `▾` and `＋` as **semantic → `Icon`/`Glyph`**,
then sweep. Keep `★`, `✦`, `·` as sanctioned label typography — they are used correctly throughout this
area (`★ profile`, `★ this season`, `★ your Sounder`).
**Pillar** craft/governance.

---

### [P2] B-14 · The Inbox misaligns with its own hub; three "load failed" states render as "you have nothing"

**Location** `Inbox.tsx:682` (`paddingHorizontal: 14`) vs `Friends.tsx:822` (`paddingHorizontal: PAGE_PAD`
= 18) and `app/(tabs)/friends.tsx:220` (`PAGE_PAD`). Silent-failure states: `sounder-progress.tsx:64-69`,
`porch-round.tsx:44-48`, `Friends.tsx:761-766`.
**Prompt(s)** P1 (heuristics 4 · 9), P8 (Gestalt)
**Evidence** The hub header and the Friends segment sit at 18 pt; switching to Inbox shifts every card
4 pt outward with the header unchanged — a visible jog on a segment switch.
`sounder-progress:66` — `if (!cancelled && r?.ok) setSummary(r);` — a failed fetch leaves `summary` null,
which renders "No referrals yet". `porch-round:45` — `setStops(next ?? [])` — a failed fetch renders the
"your first page starts naturally" welcome. `Friends:761` — a failed search renders "No users found."
**Gap** Three separate surfaces tell the player a factual untruth about their own data when the network
fails. Heuristic 9 has no representation in this area outside `BlockedUsersModal`.
**Recommendation** Use `PAGE_PAD` in `Inbox.content`. Give `EmptyState` the `retry` variant from B-02 and
make the rule explicit: **a null/failed fetch never renders the empty state** — `null` means "unknown",
`[]` means "empty", and only `[]` gets `EmptyState`.
**Pillar** craft/comprehension.

---

### [P2] B-15 · `app/sounder.tsx` wears the player-facing word its own header comment says it cannot wear

**Location** `app/sounder.tsx:1-7, 56-60`
**Prompt(s)** P9 (naming), P8 (Jakob)
**Evidence** The file header: *"Header is titled 'Your Recruits' … NOT 'The Sounder' — the player-facing
word 'Sounder' was reclaimed for the war crew, so the referral downline surface can't wear it."* The route
is nonetheless `/sounder`, and `app/sounder-progress.tsx` is the referral ladder — while
`app/(tabs)/friends.tsx:59` uses `?seg=sounder` to mean the *crew* and `components/SounderCard.tsx` is the
crew card.
**Gap** Two different product concepts share the identifier `sounder` across routes, files and deep-link
params. Deep-linking `/sounder` lands on referrals; `?seg=sounder` lands on the crew. The team already made
this ruling for the UI and did not carry it into the code.
**Recommendation** Rename the routes to match the ruling: `app/recruits.tsx` and
`app/recruits-progress.tsx`, reserving `sounder` for the crew. Record it in `CONTEXT.md` as a
domain-language entry so future agents cannot re-collide the word.
**Pillar** craft (technical names in code, cozy names on screen) · legibility.

---

### [P2] B-16 · Rows that look like the app's tappable identity rows are inert

**Location** `app/sounder.tsx:111-135` (recruiter board rows); `app/porch-round.tsx:24-36` (stop panels)
**Prompt(s)** P6 (interactive vs non-interactive), P1 (heuristic 4)
**Evidence** `app/sounder.tsx` renders each recruit as a `Sticker` with tilt, rank, name and count —
visually indistinguishable from `Leaderboard` rows and `Friends` rows, both of which open `UserSheet` on
tap. `porch-round.tsx:27-33` renders `PrestigeAvatar` + name + date, the same composition `CrewRow` uses
as a tappable profile door.
**Gap** The app has taught the player that a pig's portrait-plus-name is a door. Two screens present that
exact composition and swallow the tap.
**Recommendation** One rule: **a composition of `PrestigeAvatar`/`PigAvatar` + username is a `UserSheet`
door, or it is visually differentiated** (no tilt, no sticker shadow, flat inline treatment). Prefer
wiring both to `UserSheet` — on the Porch Round it directly serves Connect.
**Pillar** Connect.

---

### [P2] B-17 · `SectionHeader` rule widths and sheet list heights are hand-tuned magic numbers

**Location** `Inbox.tsx:472, 507, 608` (`ruleWidth={88|70|96}`); `FriendInvitePicker.tsx:173`
(`maxHeight: 380`), `PlayerInvitePicker.tsx:198` (`360`), `SounderOinkSheet.tsx:143` (`390`),
`BlockedUsersModal.tsx:189` (`340`)
**Prompt(s)** P4, P5
**Gap** Three different rule widths under three titles in one file means the underline was eyeballed per
string; four different scroll heights across four sheets that share the same chrome means the sheet's
height is decided by whoever wrote it last, so the same sheet family settles at four different resting
heights.
**Recommendation** Make `SectionHeader` derive its rule width from the rendered title (`onLayout`) or drop
the prop and use a fixed proportion. Give the `Sheet` primitive from B-06 one `maxHeight` (e.g. `"70%"`)
and delete all four.
**Pillar** craft.

---

### [P2] B-18 · `Give N` spends tickles in one tap with no confirmation and no receipt in place

**Location** `components/Inbox.tsx:573-590`
**Prompt(s)** P7, P1 (heuristic 5)
**Evidence** `onPress={() => canAfford && giveTrade(t)}` → `fulfill_tickle_trade`. The only acknowledgement
is a `feedback` string (`:342`) and a row that later appears in the passive feed.
**Gap** This is the area's real spend path (the player gives away banked tickles). The affordance work is
genuinely good — `canAfford` pre-disables and relabels to `Need N more`, and `balanceHint`/`balanceHintShort`
pre-warn on the line above — but there is no moment of "are you sure" and no in-place receipt: the pen
card simply vanishes on a list reload.
**Recommendation** Not necessarily a dialog (a gift should feel easy), but the peak-end rule wants the
give to *land*: animate the pen card into the "you gifted X N tickles" feed row in place rather than
reloading the list, and keep the new balance visible. If a confirm is wanted, use `ConfirmDialog` with the
warm tone from B-03.
**Pillar** Connect (giving is the warmest act in the app; it should feel like something).

---

### [P3] B-19 · Dead styles and dead exports

**Location** `UserSheet.tsx:1083 avatarBubble · 1090 name · 1091 titleSub · 1164 tierNone · 1275
ritualToggle · 1312-1323 ritualToggleBtn/Active/Text/TextActive`; `Friends.tsx:873 list · 1116-1124
actionCancel/actionCancelText`; `Inbox.tsx:722 loadMoreRow · 809 declineText · 880 passiveRow`;
`PrestigeAvatar.tsx:78 badgeTextSmall` (identical values to `badgeText` — a no-op override);
`components/sounder/inviteState.ts:81-92 joinError` (referenced only by its own test — the walk-in join
path was replaced by the knock/ask path).
**Recommendation** Delete. Taste-standard roadmap item 4 already calls for "pruning the now-dead
per-screen header styles the `PageHeader` swap left behind" — this is the same debt in the sheet layer.

### [P3] B-20 · Spacing-scale arithmetic and off-ladder borders

**Location** `SPACE.xs + 1` (`app/(tabs)/friends.tsx:233`, `CrewRow.tsx:321`, `SounderCard.tsx:666,702`),
`SPACE.xs + 2` (`CrewRow.tsx:330`, `SounderCard.tsx:756`), `SPACE.sm + 2` (`CrewRow.tsx:346`,
`SounderCard.tsx:639`, `SounderOinkSheet.tsx:153`), `SPACE.md + 2` / `SPACE.md - 1`
(`SounderCard.tsx:657,713`). `borderWidth: 2.5` ×4 (`Friends.tsx:831`, `SounderCard.tsx:673,683,695`,
`PigAvatar.tsx:31`); `borderWidth: 3` ×2 (`CrewSheet.tsx:134`, `PigRosterPicker.tsx:276`);
`borderWidth: 1` ×5 (`AlignmentBadge.tsx:96`, `porch-round.tsx:168`, …).
**Gap** Arithmetic on the scale produces 5, 6, 10, 14, 11 — values the scale deliberately excludes — while
*looking* like compliance. `borderWidth` has no token at all, so the area ships five weights (2 · 1.5 · 1 ·
2.5 · 3) with no rule about which means what.
**Recommendation** Add `BORDER = { hairline: 1, thin: 1.5, base: 2, heavy: 2.5 }` and a meaning for each
(hairline = separator, thin = inner chip, base = sticker/control, heavy = emphasis). Ban arithmetic on
`SPACE` — if a value is needed, it goes in the scale.

### [P3] B-21 · Three pressed-feedback grammars

**Location** `opacity: 0.7|0.8|0.85` (most sites) · `transform: translateX/Y + shadowOpacity: 0`
(`app/(tabs)/friends.tsx:247-250`) · `transform: scale(0.985)` (`PorchRoundLaunchCard.tsx:84`) ·
`scale(0.97) + opacity 0.82` (`PigRosterPicker.tsx:212`)
**Recommendation** Pick one and put it on the `Button`/`Pressable` wrapper. The stamped-down
translate+shadow-drop in the hub nav is the most on-DNA of the three and the only one that reads as paper.

### [P3] B-22 · `LoadingBeat` labelled on some surfaces, bare on others

**Location** Labelled: `UserSheet.tsx:561` ("peeking in"), `Inbox.tsx:430` ("checking the yard"),
`BlockedUsersModal.tsx:106` ("checking the gate"), `sounder.tsx:67`, `porch-round.tsx:60`,
`SounderOinkSheet.tsx:93`. Bare: `FriendInvitePicker.tsx:102`, `PlayerInvitePicker.tsx:118`,
`SounderCard.tsx:222`.
**Recommendation** Make `label` required (rule 4: loading states are cozy, not utilitarian) — a bare beat
is the spinner in costume.

### [P3] B-23 · Capitalisation and copy inconsistencies for the same concept

**Location** `FriendInvitePicker.tsx:138` `<RowStatus>Sounder full</RowStatus>` vs
`PlayerInvitePicker.tsx:148` `<RowStatus>sounder full</RowStatus>` — same status, two capitalisations, in
two sheets one tap apart. `app/sounder.tsx:96-98` renders `{count === 1 ? "pig" : "pigs"} brought in` —
pluralised on a number the sentence never shows. `porch-round.tsx:81` uses a full sentence as an uppercase
kicker (`YOUR FIRST PAGE STARTS NATURALLY`) where every other kicker in the area is two to three words.
**Recommendation** Lowercase hand-script for every `RowStatus` (the component's voice); kickers are ≤ 4
words. Move the recruit count into the champion sentence or drop the pluralisation.

### [P3] B-24 · The referral footer names a destination it cannot navigate to

**Location** `Friends.tsx:810-815`
**Evidence** `★ share your code from <Text style={styles.referralFooterBold}>Account</Text> for 100 tickles`
— "Account" is bolded like a link and is inert.
**Recommendation** Make it a `Pressable` routing to the account screen, or drop the bold. A bolded
destination that does not navigate is a Jakob violation and a dead end on a growth path.

### [P3] B-25 · No Reduce Motion path for the sheet slides

**Location** `UserSheet.tsx:265-274`, `CrewSheet.tsx:62-82`, `app/lounge.tsx` (walk + seesaw sine)
**Recommendation** `AccessibilityInfo.isReduceMotionEnabled()` → crossfade instead of translate, read once
in the `Sheet` primitive from B-06 so every sheet inherits it.

### [P3] B-26 · `app/(tabs)/friends.tsx` re-rolls the `PageHeader` composition

**Location** `app/(tabs)/friends.tsx:179-181, 223-226`
**Evidence** `★ {kicker}` + `TYPE.display` + `TITLE_RULE` with a hand-set `width: 64` — the exact
composition `components/ui/PageHeader.tsx` owns (roadmap item 3, marked ✓ done for stack screens).
**Recommendation** Either extend `PageHeader` with a `variant="tab"` (no back arrow) and adopt it here, or
document that tabs deliberately compose the crown inline. Right now it is the third place the crown is
written out longhand.

---

## 4 · Heuristic scorecard (P1, 0–4)

| # | Heuristic | `UserSheet.tsx` | `Friends.tsx` | `Inbox.tsx` |
| --- | --- | --- | --- | --- |
| 1 | Visibility of system status | **1** — B-02 infinite loader; busy = "…" | 3 — optimistic star, live counts | 3 — realtime subscriptions, `LoadingBeat` |
| 2 | Match to the real world | 4 — "peeking in", "how'd they earn it?" | 4 — "all tickled out", "wears X" | 4 — "out to market", "the yard's quiet" |
| 3 | User control and freedom | 3 — backdrop tap + `onRequestClose` | 3 | 2 — B-18 no undo on a give; withdraw exists for outgoing only |
| 4 | Consistency and standards | 2 — B-06 third segmented control, own sheet chrome | 2 — B-06, B-09 | 2 — B-07 mixed icon families, B-14 padding jog |
| 5 | Error prevention | 3 — pre-disabled Visit, cooldown panel, `ConfirmDialog` for block | 3 — pair-lock pre-disables the door | 3 — `canAfford` pre-disable is exemplary; B-18 no confirm |
| 6 | Recognition over recall | 4 — every state named in place | 3 | 3 — kinds legible from copy, not from B-07's glyphs |
| 7 | Flexibility / efficiency | 3 — 3 tabs + row shortcuts | 4 — row visit door bypasses the sheet | 3 — Load more paging |
| 8 | Aesthetic and minimalist | 2 — 9 stacked blocks before the action area (P7) | 3 | 3 |
| 9 | Help users recover from errors | **1** — B-02, feedback unreachable | 2 — B-14 failed search reads as "no users" | 3 — reason-specific copy at `:325-339` is the app's best |
| 10 | Help and documentation | 3 — `askHint` explains the trade before commit | 3 — discriminator explainer | n/a |

**Weakest column:** `UserSheet` — the most-opened sheet in the app has the area's only broken error path.
**Strongest single behaviour:** `Inbox.doRpc`'s reason-specific failure copy (`:322-341`) — it tells the
player what to do instead of "try again", and `insufficient_bank` even re-syncs the balance. Replicate it.

### P7 · Cognitive load and emotional journey (three largest)

- **>4 options at a decision point:** `UserSheet`'s ask pills are 1–5 (`:1000`) — five options where the
  economic hint (`:1017`) has to explain the consequence of each. Consider 1 / 3 / 5.
- **Primary action not the most dominant element:** `UserSheet` stacks avatar → alignment bar → stats row →
  keepsake → breakdown link → digging-story card → Visit button → 3 tabs → panel → feedback → block/report
  before the player reaches what they came for. `Visit Barn` is correctly the only `STICKER_SHADOW` element
  (good Von Restorff), but it is the seventh block down.
- **Number stating a feeling:** none found. `AlignmentBar` shows `+42` but alignment is a progression, and
  mood is never numeric anywhere in the area. ✓
- **Peak and end:** the peak is `Inbox`'s pen card (the one `STICKER_SHADOW` + peach in the actionable
  band — correctly the loudest thing on screen). The *end* is weak everywhere: a give, an accept, a crown
  handoff and a leave all end with a list reload and a small accent string.

### P8 · Laws of UX

- **Fitts** — B-12; the star/visit pair on the friend row is the worst offender.
- **Hick** — the hub is 4 segments ✓; `UserSheet` is 3 tabs ✓; the ask pills are 5 ✗.
- **Gestalt** — proximity is good (`CrewRow` groups portrait·body·action with `SPACE.md`); *similarity*
  fails in the Inbox feed, where `gifted` and `sounder` share `WHIMSY.sun` (B-07).
- **Von Restorff** — done well and deliberately: exactly one `STICKER_SHADOW` element per screen
  (`UserSheet.visitBtn`, `Inbox.pen`, the Sounder `Sticker`). Keep this.
- **Jakob** — three grabber pills that look draggable and are not (`UserSheet.tsx:566-569` admits it in a
  comment); `/lounge` silently redirects (B-10).

### P9 · First two seconds

| Screen | What a new player thinks it is | The one thing to do | Verdict |
| --- | --- | --- | --- |
| Friends hub | "my social page" — four labelled sticker cards read instantly | pick a segment | ✓ strong |
| Friends list | "my pig pals, each with a barn door" | tap a friend | ✓ |
| Add tab | "search for a friend" | type | ✓ |
| Inbox | "stuff that happened" — but "Pen cards" as the *actionable* band title is opaque | answer the peach card | ✗ rename the band |
| UserSheet | "this pig's page" | not clear — seven blocks before the action | ✗ (P7) |
| Sounder (crewless) | "join or start a herd" | tap Join / Found the Sounder | ✓ exemplary |
| Sounder (in crew) | "my herd" | fill a slot | ✓ |
| `/sounder` (recruits) | "a leaderboard I can tap into" — but nothing taps (B-16) | none | ✗ |
| Porch Round | "a scrapbook of visits" | visit a friend | ✓ |

### P10 · Charter and taste-standard compliance

| | Check | Verdict |
| --- | --- | --- |
| a | Serves a named pillar | **PASS** — Connect throughout; Contend on the Sounder cluster |
| b | Survives the one-sentence test | **PASS** — every sheet states its rule in place (`askHint`, `oneSounderCopy`, `ASK_LIMIT_HINT`) |
| c | Losing / empty / locked states are warm, never shame | **PASS** — "not today", "let it go", "no hard feelings", "the herd moves fast"; no decline-shaming anywhere |
| d | No emoji character in any render | **PASS** for emoji characters; **PARTIAL** for the ruling's spirit — B-07 text glyphs, B-13 `›`/`▾`/`＋`, and an `assets/images/emoji/` directory |
| e | The world responds now | **PASS** — optimistic favourite toggle with revert (`Friends.tsx:107-134`), realtime Inbox subscriptions, haptics on every success |
| f | Cream / paper, no black wrapper | **PASS** except `app/lounge.tsx:813` (`COLORS.grass`, unreachable — B-10) |
| g | Stack screens wear `PageHeader`, sections wear `SectionHeader` | **PASS** — `sounder`, `sounder-progress`, `porch-round` all use `PageHeader`; `Inbox` uses `SectionHeader`. `CrewSectionKicker` is a sanctioned in-sheet variant |
| h | Empty / loading use `EmptyState`/`LoadingBeat` | **FAIL** — B-09 (Friends), B-11 (BlockedUsersModal `:108-113`), `porch-round.tsx:80` |
| i | Only the two hard shadow tiers | **PASS** — 0 soft shadows; `STICKER_SHADOW` and `SHADOW_SM` only, and used with restraint |
| j | Disabled controls keep their outline | **FAIL** — B-08, seven sites |

### P2 · Design-specificity verdict

**PASS, decisively.** No unrelated product could use this: `CrewPortrait` with a crown perched at −8°, the
dashed slot pips, "call a snout to your banner", the sun pill, hand-script status where a row does not act,
the `★ this season` kicker over a three-column stat row. The paper-craft DNA present: `Sticker` + tilt,
both hard shadow tiers, all four fonts working to type, hand kickers, `Glyph`/`Icon` art, the dashed rule.
Missing or faked: **one soft gradient** (`PigAvatar.tsx:38` — the only one in the area, and it is under
every pig), **one system Alert** (B-01), **raw text glyphs standing in for art** (B-07, B-13), and **one
sheet chrome that could belong to any app** (`BlockedUsersModal`'s centred fade-in card). Would a designer
who knows this game make these four choices? No — and each is a local regression against a pattern the same
codebase already gets right elsewhere.

---

## 5 · Token triage table (P4)

Area totals: **381** `WHIMSY.*` · **148** `SPACE.*` · **61** `TYPE.*` · **46** `RADII.*` against
**103** bare `fontSize` · **~175** bare padding/margin/gap · **~37** bare `borderRadius` (21 distinct
values) · **12** distinct raw opacities · **7** raw hex · **1** legacy `COLORS.*`.

| Cluster | Count · top values | Verdict | Action |
| --- | --- | --- | --- |
| Raw hex | 7 total: `#FFD0DC`+`#E8A7B9` (PigAvatar:38) · `#D5E4C9` (AlignmentBadge:71) · `#D9A45D` (PrestigeAvatar:68) · `#C8AD77`+`#EAD59E` (PigRosterPicker:283-284) · `#4a3325` ×2 (lounge:623,662) | **Missing tokens** — except `#D5E4C9`, a *regression* against the 2026-07-12 tokenization | B-05, B-10; add `WHIMSY.prestige`, `WHIMSY.tape`/`tapeEdge`; `#4a3325` → `WHIMSY.bark` |
| Legacy `COLORS.*` | 1: `COLORS.grass` (lounge:813) | Legacy palette | B-10 |
| `rgba(` | **0** | ✓ clean | keep |
| Bare `fontSize` | 103 sites: **13** ×38 · **12** ×18 · **11** ×17 · 16 ×7 · 14 ×7 · 22 ×6 · 24 ×4 · 15 ×3 · 18 · 17 | Existing tokens cover almost all: 13→`TYPE.bodySm`/`TYPE.kicker`, 12→`TYPE.label`, 11→`TYPE.kickerPill`, 15→`TYPE.body`/`cardTitleSm`, 18→`TYPE.cardTitle`, 22→`TYPE.sectionTitle` | Sweep. **24** (`ProfileIdentity:65`, `BlockedUsersModal:172`, `PigRosterPicker:342`, `UserSheet:1132`) is the one genuine gap → add `TYPE.profileName` (24/27) |
| Bare `borderRadius` | 21 distinct: 12 ×5 · 16 ×4 · 14 ×4 · 10 ×4 · 999 ×3 · 2 ×3 · **13 ×3** · 9 ×2 · 4 ×2 · 17 ×2 · 8 · 7 · 32 · 3 · 27 · 23 · 22 · 18 · 15 · 1 | Mostly redundant: 12→`RADII.md`, 14→`RADII.lg`, 8→`RADII.sm`, 18→`RADII.xl`, 22→`RADII.xxl`, 999→`RADII.pill`. **13** (`SounderCard` pips ×3) is a near-duplicate of `md`/`lg` with no reason. 9/15/16/17/22/23/27/32 are all `size/2` circles | Sweep to tokens; for circles use a `circle(size)` helper or `RADII.pill` |
| Bare spacing | ~175 sites, 20 distinct: 12 ×23 · 8 ×22 · 4 ×21 · **14 ×21** · 2 ×18 · 6 ×13 · 10 ×13 · 16 ×7 · 7 ×6 · 1 ×5 · 9 ×4 · 3 ×4 · 5 ×3 · 11 ×2 · 40/32/30/28/18 | 12/8/4/16 are `SPACE.*` verbatim — 66 sites of pure redundancy. **14** ×21 is off-scale and the area's second-commonest value (`Inbox`/`Friends` row padding) | Sweep the 66 redundant sites first. On 14: adopt `SPACE.lg` (16) for row padding — do not add a token for it |
| `fontWeight` | **0** | ✓ clean — weight travels via `FONTS.*` | keep |
| `shadowRadius > 0` | **0** | ✓ clean — only the two hard tiers | keep |
| `borderWidth` | 5 weights: 2 ×31 · 1.5 ×25 · 1 ×5 · 2.5 ×4 · 3 ×2 | **No token exists** (app-wide gap) | B-20: add `BORDER` |
| `opacity` | 12 distinct: 0.7 ×13 · 0.85 ×5 · 0.55 ×5 · 0.6 ×3 · 0.5 ×3 · 0.65 ×2 · 0.45 ×2 · 0.88 · 0.82 · 0.8 · 0.48 · 0.22 | **No token exists.** Three semantic states wearing twelve values | B-08, B-21: add `OPACITY` + a `DISABLED_FILL` that uses none |
| Timing constants | 320 ×3 (`UserSheet:237,246,270`) · 240/180 (`CrewSheet:66,74`) · 200 (`Friends:664`) · 300 (`PlayerInvitePicker:78`) · 800 (`UserSheet:468`) · 1800 (`lounge:606`) | **No token exists** | Add `MOTION = { sheetIn, sheetOut, modalHandoff, debounce, toast }` |

---

## 6 · What's working (keep and replicate)

1. **The `CrewRow` grammar is the model the rest of the area should be rebuilt on.**
   `components/CrewRow.tsx` exports a row, a portrait, a pill, a status, a link, a note, a section kicker
   and a dashed rule — and `FriendInvitePicker.tsx` / `PlayerInvitePicker.tsx` / `TransferLeadershipSheet.tsx`
   / `JoinableSounders.tsx` are built almost entirely out of them, at **zero** raw literals. This is what
   "the design system exists" looks like. Extend it (a11y in B-04, disabled/pressed split in B-08) rather
   than replacing it.
2. **Pre-disabling instead of failing.** `Inbox.tsx:545-546` computes `canAfford`/`shortBy` and relabels the
   button `Need N more`; `Friends.tsx:198-220` reads the window-global visit budget *and* the per-pair locks
   in one parallel fetch so a row's door disables before the tap; `UserSheet.tsx:399-405` pre-blocks Visit
   with the reason. Nobody is allowed to tap into a rejection. Replicate this everywhere.
3. **Reason-specific failure copy, centralised.** `components/sounder/inviteState.ts` keeps the copy for
   invite/join/ask failures out of React so two surfaces can never drift on the same message, and it is
   unit-tested. `Inbox.doRpc:322-341` does the same inline. This is the best error-copy work in the app.
4. **Von Restorff discipline.** Exactly one `STICKER_SHADOW` element per screen — `UserSheet.visitBtn`,
   `Inbox.pen`, the Sounder `Sticker`. The loudest thing is always the thing to do.
5. **The optimistic favourite toggle** (`Friends.tsx:107-134`) — flips local state first so the star snaps
   and the row re-sorts immediately, reverts on failure. Textbook "the world responds now".
6. **Warm copy under every loss.** "not today", "let it go", "no hard feelings", "the herd moves fast —
   that banner's full", "filled up before you tapped". Charter lens 4 is passed everywhere without
   exception.
7. **`app/porch-round.tsx` + `PorchRoundLaunchCard.tsx`** — the newest screens, fully tokenized, with
   correct a11y on the launch card. The standard to hold new work to.
8. **Fail-soft data loading.** Nearly every fetch degrades to a permissive default when a migration is
   unpushed (`Friends.tsx:180-184`, `UserSheet.tsx:294-300`, `PorchRoundLaunchCard.tsx:33-35` — which
   removes its own door rather than leaving a dead one). Keep this convention.

---

## 7 · System asks

The concrete additions the design system needs so this area can be rebuilt from it alone.

**Tokens**
1. `BORDER = { hairline: 1, thin: 1.5, base: 2, heavy: 2.5 }` — with a documented meaning per weight. Five
   weights ship today with no rule (B-20; 255 `borderWidth: 2` app-wide).
2. `OPACITY = { pressed: 0.7, dim: 0.55 }` for decorative dimming **plus** a `DISABLED_FILL` mixin
   (`cream2` fill · `ink` border · `mute` text · **no opacity**) so "a button, asleep" is something you
   compose, not something you remember (B-08; 12 raw values in this area).
3. `MOTION = { sheetIn: 240, sheetOut: 180, modalHandoff: 320, debounce: 250, toast: 800 }` — the iOS
   modal-handoff gap in particular is a footgun repeated verbatim three times in `UserSheet` alone.
4. `TYPE.profileName` (24/27 Caprasimo) — the only bare size in the area with no existing role.
5. `WHIMSY.prestige` (`#D9A45D`), `WHIMSY.tape` + `WHIMSY.tapeEdge` (`#EAD59E`/`#C8AD77`), `WHIMSY.grass`.
   Fold `utils/pigs.ts`'s six accents into WHIMSY and re-pick the two cool greys (`#646269`, `#4B4A50`)
   that fail AA as button fills; `#F8A8B3` is already `WHIMSY.roseDeep`.

**Components**
6. **`Sheet`** — one bottom-sheet primitive owning scrim, slide (one timing), grabber, exit tween, Reduce
   Motion fallback, `maxHeight`, and an obvious close. Retires four chromes and three grabbers (B-06).
7. **`EmptyState` gets a `retry` variant** and a `kind: "empty" | "error"` — so "load failed" stops being
   hand-rolled per screen or, worse, rendered as "you have nothing" (B-02, B-14). Make `LoadingBeat`'s
   `label` required.
8. **`ConfirmDialog` gets `tone: "warm" | "destructive"`** so "leave your Sounder" can confirm without
   shame framing, and becomes the *only* confirmation surface (B-01, B-03, B-11).
9. **`Button` variants covering the eight hand-rolled shapes**: `primary` (lilac) · `secondary` (paper) ·
   `sun` (the Sounder CTA) · `chip` (trove/rewards) · `locked`. With `minHeight: 44` baked in (B-12).
10. **`SegmentedControl` gets an `icon-over-label` variant** for the hub nav, retiring three controls (B-06).
11. **`Glyph` entries** for the six Inbox event kinds, and for `chevronRight` / `chevronDown` so B-13's
    nine text glyphs have somewhere to go. Migrate `CrewRow.FlagIcon` (`:264`, a one-off inline SVG
    transcribed "because no Icon entry exists for it") into `Icon`.
12. **`SectionHeader.ruleWidth` derives from the title** instead of being hand-tuned per string (B-17).

**Rules to add to the taste standard**
13. **No `Alert.alert` in any player-facing path.** Lint it.
14. **No `ActivityIndicator` under `app/` or `components/`.** Lint it. (11 files app-wide.)
15. **Extend the dingbat ruling to `›` `‹` `▾` `＋` as semantic → `Icon`/`Glyph`.**
16. **Any action that cannot be undone by the same control renders through `ConfirmDialog`.** One
    confirmation grammar, not four.
17. **A11y lives in the primitive.** `Button`, `SunPill`, `HandLink`, `IconButton`, `CrewRow` set
    `accessibilityRole` and require a label; value widgets expose `accessibilityValue`. Call sites should
    not be able to forget.
18. **No arithmetic on `SPACE`.** `SPACE.xs + 1` is an off-scale value wearing a token's clothes.
19. **A null fetch is not an empty state.** `null` = unknown → error/retry; `[]` = empty → `EmptyState`.
20. **Portrait + username is a `UserSheet` door, or it must not look like one** (B-16).

---

## Conformance pass — 2026-09-11 (wave 3, section B)

**Result: 529 → 0 `ttp/*` warnings across 17 files (plus the six identity primitives in `components/ui`); lint
flipped to error for the area; `components/CrewSheet.tsx` deleted (its four consumers mount `Sheet`).** Three parallel
passes (profile + pickers · hub + inbox · Sounder + lounge + porch). No `eslint-disable` remains — the one written
exception (the Barn visit's full-screen Modal) is retired by the new `Ceremony` primitive. Full suite 206/206 green.

**Findings closed:** B-02, B-03, B-04, B-05, B-06, B-07, B-08, B-09, B-10, B-11, B-12, B-13, B-14, B-16, B-17,
B-18, B-19, B-20, B-21, B-24, B-25, B-26. Highlights: a failed profile fetch is a three-way branch (loading / error +
retry / content), and `null` is an error everywhere in the area; leave · crown · kick · block · report · unfriend all
route through `ConfirmDialog` with the consequence in `confirmHint`; accessibility lives in `CrewRow`, `SunPill`,
`HandLink` so call sites cannot forget; the hub's four nav cards are `SegmentedControl layout="icon-over-label"`;
the Inbox's six event kinds are one `Glyph` vocabulary in an `Avatar`; the identity primitives (`ProfileIdentity`,
`PigAvatar`, `PrestigeAvatar`, `Alignment*`) are on tokens and `AlignmentBar` announces as a progressbar.

**Primitive growth (landed):** `Ceremony` (the third modal shape, full-screen); `IconButton` disabled on `DISABLED`
chrome; `TextField.icon` + `labelHidden`; `Sheet.bottomInset`; `MOTION.beat`; `PORCH_PAGE_SIZE` in `utils/porchRound`.

**Wave-4 items recorded:** graduate `SunPill`/`HandLink`/`CrewRow`/`CrewPortrait` into `components/ui`; B-15 (the
`/sounder` route name collision) and `app/lounge.tsx`'s unconditional `Redirect` are route decisions; inert
portrait+name rows on `sounder.tsx`/`porch-round.tsx` still swallow the tap; `PIG_ACCENT.pepper/.bandit` solids fail
AA as fills (tint-only for now); `PigRosterPicker` cannot retry a swallowed roster failure (`usePigRoster`); rename
`BlockedUsersModal` (it is a `Sheet`); a `Toggle` primitive; `Chip` `sub`/`badge`.
