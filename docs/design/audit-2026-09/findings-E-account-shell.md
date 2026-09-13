# Findings E — Account · Onboarding · Auth · App shell · System dialogs

Auditor E, 2026-09-11. Source audit (no app run). 29 files. Full ten prompts on `components/Account.tsx`,
`app/_layout.tsx`, `components/Onboarding.tsx`; token grep + inventory row on the rest. Plus two cross-cutting
sweeps: every `Alert.alert` call site and every raw `<Modal>` mount in `app/` + `components/`.

---

## 1. Area summary

This area is the app's **frame and its front door**: the pre-shell gate chain (`SupaAuth` → `UsernameSetup` →
`ReferralCodeEntry` → `Onboarding` → tabs), the root layout that owns launch popups / deep links / push routing,
the Me tab, and the shared dialog primitives every other surface borrows. The **bones here are excellent**: the
`PopupQueue` state machine (`components/ui/PopupQueue.tsx`) is the best-documented, most carefully-reasoned code in
the repo and it solves a real iOS class of bug; the auth→name→storybook chain is one continuous cream/Rosie
storybook with no black flash; `app/_layout.tsx:121` pins React Navigation's whole theme to `UI_COLORS` so a
system route can never flash dark; `app/scan-code.tsx` is the model screen for what a rebuilt surface looks like
(`PageHeader` + `Sticker` + `Button`/`TicketButton` + `EmptyState`/`LoadingBeat` + `Glyph`, near-zero literals).

The single biggest systemic gap is **the dialog layer is three parallel systems that don't know about each
other**: a tokenized `ConfirmDialog`/`AdaptiveModalScaffold`/`SlideUpSheet` primitive set (20 consumer files), 33
files that hand-roll a raw `<Modal>` with their own backdrop/cardWrap/btnRow, and 9 files that fall all the way
out of the paper-craft world into iOS's system `Alert`. The two worst instances of the third system are **P0**:
the one-time, explicitly-irreversible companion choice and the referral-code grant are both confirmed in a system
alert. Secondarily, `components/Account.tsx` is the app's largest single reservoir of governance erosion — 81 bare
`fontSize`, 140 bare padding/margin/gap and 7 raw `radius={n}` props on a primary tab screen, roughly 15% of the
whole app's bare-`fontSize` budget in one file.

**Counts:** P0 × 2 · P1 × 11 · P2 × 13 · P3 × 6 (32 findings).

---

## 2. Inventory table (P5)

| Element | File | Primitive or hand-rolled | States present | Duplicate elsewhere |
| --- | --- | --- | --- | --- |
| Sign-in screen | `SupaAuth.tsx` | hand-rolled (uses `Sticker`) | default · busy · error · collapsed/expanded email | — |
| Apple sign-in button | `AppleAuth.tsx:13` | vendor `AppleAuthenticationButton` | default only | GoogleAuth (different chrome) |
| Google sign-in button | `GoogleAuth.tsx:108` | hand-rolled `Pressable` | default · pressed · disabled/busy | AppleAuth |
| Email/password inputs | `SupaAuth.tsx:131,146` | raw `TextInput` | default · disabled · (no error border) | `UsernameSetup`, `Account` rename, `ReferralCodeEntry` each style their own |
| Name-pick screen | `UsernameSetup.tsx` | hand-rolled (uses `Sticker`) | default · saving · error · invalid/disabled | — |
| Referral code step | `ReferralCodeEntry.tsx` | hand-rolled (uses `Sticker`) | idle · applying · error · applied | `Account` "Got a code?" box, different look |
| Storybook onboarding | `Onboarding.tsx` | hand-rolled | per-page; no pressed state on CTA | — |
| Saddling-up gate | `app/(tabs)/_layout.tsx:209-242` | `WaitingRosie` + `Button` + `KICKER_TEXT` | loading · error+retry | — |
| Tab bar | `app/(tabs)/_layout.tsx:270` | `HangingSignsTabBar` | default · selected · badge | — |
| Me page header | `Account.tsx:680-684` | hand-rolled (`KICKER_TEXT`+`TITLE_RULE`) | static | `PageHeader` (8 stack screens); no tab uses it |
| Identity card | `Account.tsx:696-760` | `Sticker` + `Tape` | loaded only (hidden until fetch lands) | — |
| Membership chip | `Account.tsx:713-722` | hand-rolled | vip · free | shop MEMBERS ribbon |
| Lifetime stats band | `Account.tsx:731-748` | hand-rolled `Pressable` | static (no pressed feedback) | `LedgerRow` in same file |
| Wallow rank card | `Account.tsx:1742` | `Sticker` (+ `TYPE.*`, best-tokenized block) | current · next · dev-preview | — |
| Nav row (digging / achievements) | `Account.tsx:774,802` | hand-rolled row | default · pressed · badge | `SettingRow` same file, different geometry |
| Slop Club card | `Account.tsx:828-947` | `Sticker` | member · non-member · busy · purchases-off · referral-grant | shop members band |
| Referral card | `Account.tsx:955-1115` | `Sticker` | code · copied · capped · friends · redeem-box · success | `ReferralCodeEntry` |
| Progress bars | `Account.tsx:1658,1622` | hand-rolled ×2 (h8/r4 and h6/r3) | fill only | each other |
| Settings card | `Account.tsx:1125-1177` | `Sticker` + `SettingRow` | default · pressed · destructive · last | — |
| Rename dialog | `Account.tsx:1243-1316` | **raw `<Modal>`** | default · busy · error | `ConfirmDialog` (same backdrop/btnRow/btnGhost/btnConfirm) |
| Feedback dialog | `Account.tsx:1322-1441` | **raw `<Modal>`** | picker · busy · error · sent | rename dialog (styles copy-pasted) |
| Long-story sheet | `Account.tsx:1448-1546` | **raw `<Modal>`** | loaded · loading (`LoadingBeat`) | rename dialog |
| Confirm dialog | `ui/ConfirmDialog.tsx` | primitive | default · busy · destructive · pressed | rename/feedback dialogs |
| Adaptive dialog shell | `ui/AdaptiveModalScaffold.tsx` | primitive (13 consumers) | native · inline · bare · keyboard-aware | 21 raw-Modal centered dialogs |
| Bottom sheet shell | `ui/SlideUpSheet.tsx` | primitive (7 consumers) | open only | `CrewSheet`, `UserSheet`, `TrufflePatch`, `PigRosterPicker`, `MoteWageringScreen`, `TruffleExchangeSheet` hand-roll it |
| Dismiss rail | `ui/DialogCloseRow.tsx` | primitive | default | ad-hoc "Close"/"Got it" in `Account`, `ReleaseNotesModal` |
| Release notes | `ReleaseNotesModal.tsx` | **raw `<Modal>`** + `Sticker` | default · scroll | — |
| Page background | `ui/PageBackground.tsx` / `AnimatedBackground.tsx` | primitives | static · animated · reduce-motion | — |
| Pig tap surface | `SwipeElement.tsx` | hand-rolled | idle · reaction · six-seven · disabled | — |
| 404 screen | `app/+not-found.tsx` | `ThemedText`/`ThemedView` (Expo starter) | static | nothing else uses these |
| OAuth callback | `app/auth-callback.tsx` | bare `ActivityIndicator` | loading · done | `LoadingBeat`/`WaitingRosie` |
| Invite landing | `app/i/[code].tsx` | bare `View` | pass-through | — |

---

## 3. Findings

### [P0] E1 · The irreversible companion choice is confirmed in a system `Alert`

**Location** `components/PigPenView.tsx:100-111`; `components/PigRosterPicker.tsx:61-73`
**Prompts** cross-cutting Alert sweep · P2 · P7 · P10
**Evidence**
```
Alert.alert(
  `Choose ${pig.name} as Rosie's friend?`,
  "This is your one long-term companion choice. You can't change it right now.",
  [{ text: "Keep looking", style: "cancel" }, { text: `Choose ${pig.name}`, … }],
);
```
**Expected standard** Severity scale: *"a system Alert in a spend, destructive or in-world action"* is an automatic
P0. `components/ui/ConfirmDialog.tsx` exists for exactly this and already ships a `destructive` variant
(`ConfirmDialog.tsx:53-56`) plus a `confirmCoin` affordance.
**Gap** The single most consequential, explicitly-unreversible decision a Slop Club member makes — choosing the
companion that greets them at home forever — is rendered by iOS in San Francisco on a grey blur: no pig art, no
paper, no ink border, no tilt. Worse, the alert body *says* "you can't change it right now," so the moment the
game asks for the most commitment is the moment it stops looking like the game.
**Recommendation** Route both call sites through `ConfirmDialog` with `destructive` (or a new `commit` tone —
lilac confirm with the chosen pig's `PigPortrait` in the dialog body). Rule: **no `Alert.alert` may appear in a
path that mints, spends, grants, equips, deletes, or permanently binds.** Add a `no-restricted-imports` lint rule
on `Alert` outside `components/dev/**` so the next one is caught in review.
**Pillar** Collect (the companion is the headline collectible) · craft/governance.

---

### [P0] E2 · Referral grant and Golden-Ticket redeem are prompted by system `Alert` at app root

**Location** `app/_layout.tsx:730-751` (apply friend's code, +50 snouts), `:737` and `:744` (result),
`:819-830` (redeem Golden Ticket)
**Prompts** cross-cutting Alert sweep · P2 · P7 · P9 · P10
**Evidence**
```
Alert.alert("Apply your friend's code?", `Add ${code} to your account?`, [
  { text: "Cancel", style: "cancel" },
  { text: "Apply", onPress: async () => { … Alert.alert("Code applied", `${…} brought you in. +50 snouts.`) … } },
]);
```
**Expected standard** Same rule as E1 — this grants currency. Taste standard: *"the world responds now"* and the
show-don't-tell law; the app already owns `showPurchaseToast` (`Account.tsx:194`, `:476`, `:588`) for this beat.
**Gap** The referral flow is the app's primary **Connect** surface. A player who taps a friend's link gets, as
their *first in-world moment*, a grey iOS dialog reading `Add ROSIE-K3T9 to your account?` — a raw code string in
system chrome. The success beat ("+50 snouts landed") is likewise a system alert where everywhere else the same
event fires a paper toast. The prompt also renders the code rather than the friend: the one human in the
interaction is invisible.
**Recommendation** Give the root layout a queue-slotted `ConfirmDialog` (priority above the launch ceremonies) for
the apply prompt, and hand the result to `showPurchaseToast({ type: "success" })`, matching `Account.tsx:194`.
Same for the Golden-Ticket prompt — or skip the prompt and deep-route to `/scan-code`, which already owns a
beautiful in-world reveal (`app/scan-code.tsx:417` `RevealCard`).
**Pillar** Connect (a referral is a person, not a token) · Collect.

---

### [P1] E3 · `Account.tsx` is the app's largest single token-governance leak

**Location** `components/Account.tsx` (whole file; styles `:1819-2949`)
**Prompts** P3 · P4 · P10
**Evidence** 81 bare `fontSize:`, 140 bare `padding*/margin*/gap:`, 7 raw `radius={n}` props, 5 bare
`borderRadius:`. Concrete: `:1834 fontSize: 32` (= `TYPE.display`), `:1868 fontSize: 12` (= `TYPE.label`),
`:1880 fontSize: 24`, `:2195 fontSize: 18` (= `TYPE.cardTitle`), `:2204 fontSize: 28`, `:2263 fontSize: 22`,
`:1845 paddingTop: 12`, `:1917 marginTop: 14`, `:2144 marginTop: 22`, `:2271 marginTop: 22`,
`:2450 paddingVertical: 12`, `:2488 height: 8, borderRadius: 4` and `:2554 height: 6, borderRadius: 3` (two
different progress bars in one file), `:2186 borderRadius: 20`, `:2211 borderRadius: 11`.
**Expected standard** Taste standard rules 1–3: *"never inline a raw hex / size / radius / pad"*, *"a bare
`fontSize: 15` in new code is a smell"*, *"leave it better"*. `TYPE`, `SPACE`, `RADII` all exist.
**Gap** ~15% of the app's entire bare-`fontSize` budget (521 app-wide) lives in this one primary-tab file. The file
is not uniformly bad — `wallowWallStyles` (`:2765-2860`) is fully tokenized and proves the rest is mechanical. The
leak is concentrated in the older blocks: `styles`, `achievementStyles`, `settingsStyles`, `referralStyles`,
`renameStyles`, `feedbackStyles`, `longStoryStyles`.
**Recommendation** Treat `wallowWallStyles` as the in-file reference implementation and sweep the other seven
StyleSheets to it, block by block (the file is far too big for one diff). The two progress bars collapse to one
`ProgressBar` primitive (`track`/`fill`, `size: "sm" | "md"`). Delete the dead styles listed in E31 in the same
pass. **System ask:** a `BORDER` token set — this file alone uses `borderWidth` 1 / 1.5 / 2 with no rule.
**Pillar** craft/governance.

---

### [P1] E4 · Subscription fine print and Terms/Privacy fail WCAG AA and the 44pt floor — on the purchase surface

**Location** `components/Account.tsx:2115-2122` (`slopFinePrint`), `:2102-2108` (`slopLegalLink`),
`:930-944` (the Pressables), `:2109-2114` (`slopLegalDot`)
**Prompts** P3 (colour contrast) · P6 · P10
**Evidence**
```
slopFinePrint: { fontFamily: FONTS.hand, fontSize: 11, color: WHIMSY.ink, opacity: 0.55, … }
slopLegalLink: { fontFamily: FONTS.hand, fontSize: 11, color: WHIMSY.ink, opacity: 0.6, textDecorationLine: "underline" }
<Pressable onPress={() => Linking.openURL("https://ticklethepig.com/terms")}>   // no padding, no hitSlop
```
**Expected standard** WCAG AA 4.5:1 for text under 18pt; 44×44pt minimum target (`DialogCloseRow` already uses
`visualSize={44}`). Taste standard 2026-07-07: *"you mute the fill, you never dissolve the outline"* — the same
principle applies to text; opacity-crush is not a colour decision.
**Gap** The card's fill is `WHIMSY.sun` (`#ffd87a`) for non-members. Ink at `opacity: 0.55` over sun composites to
≈`#8a7242` → **3.36:1**. At `opacity: 0.6` → ≈`#7f6a3d` → **3.85:1**. Both fail AA at 11px. The Terms and Privacy
Pressables carry zero padding and no `hitSlop`, so their live targets are roughly **35 × 15pt** — under a third of
the required area, on links Apple's review guidance expects to be reachable.
**Recommendation** Kill the opacity crush: use `WHIMSY.mute` (`#605449`, ≈7.4:1 on sun) at `TYPE.bodySm` or
`TYPE.kicker`, and wrap the legal row in a `minHeight: 44` container with `paddingVertical: SPACE.sm` + `hitSlop`.
**System ask:** an `OPACITY` token set with an explicit ruling that *text* colour never comes from an opacity
multiplier — 70 sites app-wide use `opacity: 0.7`, 28 use `0.85`, 22 use `0.6`, with no rule.
**Pillar** Collect (money buys expression — the terms of that purchase must be legible) · craft.

---

### [P1] E5 · `ConfirmDialog` — the app's canonical spend/destructive dialog — has zero accessibility

**Location** `components/ui/ConfirmDialog.tsx:81-136`, styles `:139-202`
**Prompts** P1 (heuristics 4, 7) · P5 · P6
**Evidence** 4 `Pressable`s, **0** `accessibility*` props in the file. No `accessibilityViewIsModal`, no
`accessibilityRole="button"`, no `accessibilityState={{ disabled: busy }}`, no label on the backdrop-dismiss
`Pressable` (`:87`). Buttons: `paddingVertical: 11` + 15px text ≈ **37pt tall** (`:170-179`). Literals:
`fontSize: 20/14/15` (`:151,:157,:186,:190,:195`), `borderRadius: 12` (`:174`), `radius={18}` (`:92`),
`padding: 28 / 22 / 20 / 18 / 14 / 11 / 10 / 8` (`:145,:148,:154,:162,:168,:172-173`).
**Expected standard** `AdaptiveModalScaffold.tsx:80-81` already does this right (`accessibilityViewIsModal` +
`onAccessibilityEscape`); `DialogCloseRow.tsx:30` already enforces `visualSize={44}`.
**Gap** Because this is the primitive, the deficit multiplies across every consumer — `Account` account-deletion,
`BountyCard` bounty swap (a snout spend), `UserSheet`, `SeasonGuideModal`. A VoiceOver user confirming an
irreversible account deletion hears two unlabelled buttons and can swipe outside the dialog.
**Recommendation** Add `accessibilityViewIsModal` + `onAccessibilityEscape={onCancel}` to the card wrap;
`accessibilityRole="button"` + `accessibilityState={{ disabled: busy }}` to both buttons; label + role on the
backdrop; `minHeight: 44` on `styles.btn`. Migrate literals to `TYPE.cardTitle`/`TYPE.hand`/`TYPE.label`,
`RADII.md`, `RADII.xl`, `SPACE.*`. Better still: rebuild `ConfirmDialog` *on top of* `AdaptiveModalScaffold` so
there is one modal shell, not two.
**Pillar** craft/governance.

---

### [P1] E6 · "Sign out" fires on one tap; "Delete account" — one row below — asks first

**Location** `components/Account.tsx:1160-1176`
**Prompts** P1 (heuristics 3, 5) · P7 · P8 (Fitts)
**Evidence**
```
<SettingRow icon="exit" label="Sign out" onPress={async () => { await clearPushToken(); await supabase.auth.signOut(); }} />
<SettingRow icon="x" label="Delete account" onPress={() => setDeleteOpen(true)} destructive last />
```
**Expected standard** Nielsen #3 (exits need confirmation or undo) and #5 (error prevention); the lens's *"does
losing still feel warm?"* clause.
**Gap** Two adjacent ~48pt rows; the upper has no confirmation and no undo. A mis-tap ejects the player to
`SupaAuth`. The lower, genuinely destructive row *is* gated by `ConfirmDialog` — so the screen teaches "settings
rows ask first" and breaks that promise one row up.
**Recommendation** Route sign-out through `ConfirmDialog` ("Sign out of the barn?" / "Rosie will be here when you
get back." / "Sign out" · "Stay"). Rule: **any settings row that ends a session or destroys state opens a
`ConfirmDialog`; rows that navigate do not.** Separate the two destructive rows with a `SPACE.md` gap or a solid
rule so Fitts' proximity doesn't punish a thumb.
**Pillar** Connect (leaving should be as warm as arriving) · craft.

---

### [P1] E7 · The Me tab has no loading state — it assembles itself in front of the player

**Location** `app/(tabs)/account.tsx:21-25`; `components/Account.tsx:687` (`{username && …}`), `:954`
(`{referral?.code && …}`), `:999` (`{recruiterStats && …}`), `:827` (`{IAP_ENABLED && …}`)
**Prompts** P1 (heuristic 1) · P5 · P7 · P10(h)
**Evidence**
```
// app/(tabs)/account.tsx
return <View style={{ flex: 1, backgroundColor: WHIMSY.cream }}>{session && <Account session={session} />}</View>;
// Account.tsx — five independent fetches, each gating its own card
{username && ( … identity card … )}
{referral?.code && ( … referral card … )}
```
**Expected standard** Taste standard rule 4: *"Empty and loading states are cozy, not utilitarian… the Barn's
'saddling up' beat is the bar."* `LoadingBeat` is already imported into this very file (`:31`) — but used only
inside the long-story sheet (`:1531`).
**Gap** Tapping Me shows a bare cream rectangle, then a header, then cards popping in one at a time as six
independent reads land (`:285` profile, `:353` renames, `:366` wallow, `:374` season_state, `:203` referral,
`:213` recruiter, `:170` achievements). `app/(tabs)/_layout.tsx:209-242` already solved this exact problem for the
boot gate — Rosie on cream with a hand kicker plus an error+retry path. The Me tab gets none of it, including no
error path: if the profile select fails, the identity card simply never appears and there is no way to retry.
**Recommendation** Gate the screen on a single `ready` flag; render `Skeleton`/`ListRowSkeleton` in the card slots
while pending, and a `WaitingRosie` + `Button` retry beat on hard failure — mirroring `app/(tabs)/_layout.tsx:220-234`.
Rule: **every screen backed by more than one fetch shows one loading state, not N pop-ins.**
**Pillar** craft ("the world responds now" — including when it can't).

---

### [P1] E8 · The Expo starter theme is still reachable in production (`+not-found`)

**Location** `app/+not-found.tsx`, `components/ThemedText.tsx`, `components/ThemedView.tsx`,
`constants/Colors.ts`, `hooks/useThemeColor.ts`, `hooks/useColorScheme.ts`
**Prompts** P2 (specificity) · P3 · P4 · P10(d,f,g)
**Evidence**
```
// constants/Colors.ts
light: { text: '#11181C', background: '#fff', tint: '#0a7ea4', … }
dark:  { text: '#ECEDEE', background: '#151718', … }
// ThemedText.tsx — no fontFamily at all
title: { fontSize: 32, fontWeight: "bold", lineHeight: 32 }
link:  { fontSize: 16, color: "#0a7ea4" }
```
**Expected standard** P2's specificity test — *could an unrelated product use this unchanged?* **FAIL**: this is
the unmodified `create-expo-app` template. Taste standard: four intentional fonts, one palette (`WHIMSY`),
*"never reach for a system font"*, *"every tab is cream/paper."*
**Gap** `+not-found` is reachable in production from any malformed Universal Link. It renders San Francisco bold on
white with a teal `#0a7ea4` link — 10 raw hex in `Colors.ts`, 5 bare `fontSize` and 3 `fontWeight` in
`ThemedText.tsx`, zero `FONTS`. Mitigating: `app.json:9` sets `userInterfaceStyle: "light"`, so the `#151718` dark
branch shouldn't fire — but it is one config flip from a genuine black wrapper, and the taste standard already
names the Account black-flash as a past incident. The whole `Colors`/`useThemeColor`/`ThemedText`/`ThemedView`
island exists only to serve this one screen.
**Recommendation** Rebuild `+not-found` as a paper screen: cream, a `Sticker` with a `Glyph`, hand copy ("Rosie
can't find that field."), a `Button` home. Then **delete** `ThemedText`, `ThemedView`, `Colors.ts`,
`useThemeColor.ts`, `useColorScheme.ts` so no future screen can import a non-WHIMSY palette. The legacy `COLORS`
export in `theme.ts` should follow (it survives in this area at `Account.tsx:2378` alone).
**Pillar** craft/governance.

---

### [P1] E9 · Accessibility density on the Me tab: 6 props across 31 pressables, with sub-44pt targets throughout

**Location** `components/Account.tsx` — labelled: `:780-782`, `:1733-1735`. Unlabelled and/or undersized:
`:749`, `:731`, `:802`, `:884`, `:891`, `:901`, `:930`, `:938`, `:969`, `:984`, `:1016`, `:1040`, `:1084`,
`:1182`, `:1287`, `:1298`, `:1365`, `:1408`, `:1421`, `:1534`, `:1787`, plus every `SettingRow` (`:1570`)
**Prompts** P6 · P8 (Fitts)
**Evidence** Measured from the styles: `referralStyles.copyBtn` (`:2436`) `paddingVertical: SPACE.sm` + 12px text
≈ **32pt**; `referralStyles.seeMore` (`:2562`) `paddingVertical: 4` + `hitSlop={6}` ≈ **26pt**;
`referralStyles.downlineLink` (`:1018`) `hitSlop={6}` ≈ **26pt**; `slopManageLink` (`:2084`) `paddingVertical: 9`
≈ **31pt**; `styles.shareBtn` (`:1954`) `paddingVertical: 9` ≈ **32pt**; `slopLegal` links ≈ **15pt** (E4).
**Expected standard** 44pt minimum (or `hitSlop` to 44); every pressable carries `accessibilityRole` +
`accessibilityLabel`; state-bearing controls carry `accessibilityState`. 70/98 files app-wide already do this, so
Account is below the house average on its most-tapped screen.
**Gap** The two blocks that *do* carry a11y (`:780`, `:1733`) are the two newest; everything older is silent. A
VoiceOver user cannot tell "Copy my code" from "Copy" from "Share your code", and the disabled `applyBtn`
(`:1086-1091`) announces as enabled.
**Recommendation** Add `accessibilityRole="button"` + a distinct `accessibilityLabel` to every `Pressable` in the
file, `accessibilityState={{ disabled }}` wherever `disabled` is passed, and a shared `styles.tapTarget`
(`minHeight: 44, justifyContent: "center"`) mixed into every small link. **System ask:** a `TAP_MIN = 44` constant
and a `TextButton`/`Link` primitive — the bare-`Pressable`-wrapping-`Text` pattern recurs 12 times in this file.
**Pillar** craft.

---

### [P1] E10 · `WHIMSY.muteSoft` used as placeholder text — 3.79:1, and against its own token contract

**Location** `components/Account.tsx:1078`
**Prompts** P3 (colour contrast) · P4 · P6
**Evidence** `placeholderTextColor={WHIMSY.muteSoft}` — `#8c7e71` on `WHIMSY.paper` `#fffaf0` → **3.79:1**,
against `constants/theme.ts:24-26`: *"`mute` is text-safe across every core pastel; `muteSoft` is for **disabled
icons, separators, and other non-body-text UI**."*
**Expected standard** WCAG AA 4.5:1; the token's own docstring.
**Gap** Every *other* input in the area correctly uses `WHIMSY.mute` — `SupaAuth.tsx:134,151`,
`UsernameSetup.tsx:102`, `ReferralCodeEntry.tsx:217`, `Account.tsx:1272,1392`, `scan-code.tsx:391`. This single
site diverges, and it is the referral-redeem field — the one input a brand-new player is asked to fill in, where
the placeholder `PIGGY-1234` *is* the format instruction.
**Recommendation** One-token fix to `WHIMSY.mute`. Then encode it: add `UI_COLORS.textPlaceholder = WHIMSY.mute`
and have every `placeholderTextColor` read the role, not the brand token.
**Pillar** craft/governance.

---

### [P1] E11 · Two different things are both called "your code" on the same screen

**Location** `components/Account.tsx:704` + `:757` vs `:966` + `:988` + `:1067`
**Prompts** P9 · P1 (heuristics 2, 4) · P7
**Evidence**
```
:704  <Text style={styles.codeLabel}>your code</Text>            // renders username#discriminator
:757  {copied ? "Copied!" : "Copy my code"}                      // copies the handle
:966  <Text style={referralStyles.label}>Your invite code</Text> // renders PIGGY-1234
:988  <Text …>Share your code</Text>
:1067 <Text …>Got a code from a friend?</Text>
```
**Expected standard** P9 (*is the same concept named the same way across screens?*); SKILL.md lens #2 (*can a
player hold it in one sentence?*).
**Gap** On one scroll a player meets "your code" (a handle for `Friends → Add`), "Copy my code", "Your invite
code" (a referral code), "Share your code", and "Got a code from a friend?" — three distinct code objects sharing
one noun, with two adjacent Copy buttons copying different strings (`handleCopyCode` `:553` vs
`handleCopyReferralCode` `:633`). The comment at `:630-632` shows the author already knew this was confusing.
**Recommendation** Name them apart, once, everywhere: the identity string is **your handle** ("Copy my handle"),
the referral string is **your invite code** ("Copy invite code" / "Share invite code" / "Have a friend's invite
code?"). Add both to `CONTEXT.md`'s glossary so `Friends`, `sounder` and `ReferralCodeEntry` stay aligned.
**Pillar** Connect (both flows are how a player reaches another player).

---

### [P1] E12 · Three parallel modal systems; `Account` alone re-rolls the dialog shell three times

**Location** 33 raw `<Modal>` files (full classification in §5b). In this area: `Account.tsx:1243` (rename),
`:1322` (feedback), `:1448` (long story); `ReleaseNotesModal.tsx:48`
**Prompts** P5 · P4 · P8 (Jakob) · P10
**Evidence** `renameStyles` (`:2612-2675`) and `feedbackStyles` (`:2679-2763`) are the same
`backdrop`/`cardWrap`/`card`/`btnRow`/`btn`/`btnGhost`/`btnGhostText`/`btnConfirm`/`btnConfirmText` block — and
that block is itself a copy of `ConfirmDialog.tsx:139-202`. `longStoryStyles.backdrop` (`:2889`) is a fourth.
Four backdrops, four button pairs, one app.
**Expected standard** Taste standard rule 1 + the `AdaptiveModalScaffold` docstring (*"Phone-first modal shell that
remains usable on compact-height windows and with accessibility text sizes"*). 13 files already consume it.
**Gap** The hand-rolled copies inherit none of the scaffold's phone-first work: no `useWindowDimensions` sizing, no
safe-area padding, no `maxHeight`, no scroll path. The rename and feedback dialogs use a fixed `maxWidth: 340` and
no height cap — at 200% Dynamic Type the feedback dialog (title + 3 chips + 88pt multiline input + 2 buttons) will
overflow a small phone with no way to scroll to the buttons. The long-story sheet works around this by hardcoding
`maxHeight: 380` (`:2907`) — a magic number that is wrong on an SE and wasteful on a Pro Max.
**Recommendation** Migrate all four to `AdaptiveModalScaffold` (`keyboardAware` for rename/feedback,
`showCloseButton` for long story). Extract the confirm/cancel pair into a `DialogButtonRow` primitive next to
`DialogCloseRow`, and have `ConfirmDialog` compose `AdaptiveModalScaffold` + `DialogButtonRow` so there is exactly
one definition of "a centered paper dialog with two buttons."
**Pillar** craft/governance.

---

### [P1] E13 · `<Stack>` declares no `screenOptions` — a route ships with a system header unless it opts out

**Location** `app/_layout.tsx:968-971`; victims `app/auth-callback.tsx` (no `Stack.Screen` at all),
`app/+not-found.tsx:10`
**Prompts** P1 (heuristic 4) · P2 · P10(f,g)
**Evidence**
```
<Stack>
  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
  <Stack.Screen name="+not-found" />
</Stack>
```
13 of 26 stack routes carry their own `headerShown: false`; `auth-callback.tsx` does not.
**Gap** On Android the Google OAuth redirect lands on `/auth-callback`, which therefore renders React Navigation's
default header — a white bar with the **technical route name `auth-callback`** in a system font — over a cream
screen, at the most fragile moment of sign-in. Every future route inherits the same default.
(`app/expedition.tsx` is `__DEV__`-gated, so it doesn't ship this.)
**Recommendation** `<Stack screenOptions={{ headerShown: false }}>` at `:968`, and drop the 13 per-route opt-outs
as each file is next touched. A route that genuinely wants a header should get a themed one (cream card,
`FONTS.whimsy` title) declared once beside `APP_NAV_THEME` — never the platform default.
**Pillar** craft ("every screen wears the same crown").

---

### [P2] E14 · `Alert` used as a navigation menu

**Location** `components/habitat/HabitatWorkshopCabinet.tsx:82-91`
**Prompts** cross-cutting Alert sweep · P8 (Jakob) · P2
**Evidence**
```
Alert.alert("Workshop", state, [
  { text: "Mote Machine",   onPress: () => router.push("/mote-machine") },
  { text: "Workshop shelf", onPress: () => router.push("/contraptions") },
  { text: "Close", style: "cancel" },
])
```
**Expected standard** An alert announces; a sheet chooses. `SlideUpSheet` exists for a bottom-anchored
two-destination choice.
**Gap** Tapping a hand-drawn workshop cabinet in the Barn produces an iOS alert titled "Workshop" whose body is a
raw status string (`"N Clockwork Acorns available"`). It is also the wrong *shape*: an alert's buttons are
equal-weight, so "Close" reads as important as the two destinations.
**Recommendation** A `SlideUpSheet` with two `Sticker` destination rows and the cabinet's own art. **System ask:**
an `ActionSheet` variant of `SlideUpSheet` (title + N rows + cancel).
**Pillar** Collect · craft.

---

### [P2] E15 · Refusal and failure notices fall out of the world into system alerts

**Location** `components/Account.tsx:616-620`, `:623`, `:667`, `:669`, `:672`;
`app/(tabs)/shop.tsx:566`, `:581`, `:599`, `:606`, `:626`, `:639`; `components/TitlesSection.tsx:67-74`
**Prompts** cross-cutting Alert sweep · P2 · P7
**Evidence** `Alert.alert("Couldn't join the Slop Club", "Please try again.")`,
`Alert.alert("Nothing to restore", …)`, `Alert.alert("Today only", "This item is only available in today's shop.")`,
`Alert.alert("Couldn't equip title", …)`
**Expected standard** The taste standard's *"losing/empty/locked states are warm, never shame"*; the app already
owns a toast host (`PurchaseToastHost`, `app/_layout.tsx:1077`) with a `type` discriminator.
**Gap** 12 informational refusals, each dropping the player out of the storybook into iOS chrome for a sentence
that would fit in a toast. `app/(tabs)/season.tsx:2115` records that the claim path *already migrated away* from
`Alert.alert` for exactly this reason — the correction was made once and never propagated.
**Recommendation** Add `error` (and `info`) tones to `showPurchaseToast` and route all 12 through it. Rule:
**refusals are toasts, decisions are `ConfirmDialog`s, `Alert` is for nothing.** The `__DEV__`-guarded alert at
`Account.tsx:601` may stay.
**Pillar** craft.

---

### [P2] E16 · Disabled CTAs dissolve their outline — the 2026-07-07 ruling isn't reaching new code

**Location** `components/UsernameSetup.tsx:200` (`btnDisabled: { opacity: 0.5 }`),
`components/ReferralCodeEntry.tsx:366` (same), `components/Account.tsx:2340` (`applyBtnDisabled: { opacity: 0.45 }`),
`Account.tsx:908` (`!PURCHASES_LIVE && { opacity: 0.75 }`)
**Prompts** P3 (button usability) · P10(j)
**Expected standard** Taste-standard decision log, 2026-07-07: *"the `locked` Button variant is now 'a button,
asleep'… you mute the fill, you never dissolve the outline… waiting/cooldown states keep the control's shape."*
**Gap** `UsernameSetup`'s Save is the **primary action of the second screen a new player ever sees**, and it starts
disabled (empty field). At `opacity: 0.5` its 2px ink border washes to a grey ghost — precisely the "washed-out
ghost that didn't read as a button at all" the ruling retired. `ui/Button`'s `locked` variant already implements
the correct treatment; none of these four sites use it.
**Recommendation** Replace all four with `<Button variant="locked">` (or mute the fill to `WHIMSY.cream2` + text to
`WHIMSY.muteSoft` and keep the border at full strength). `UsernameSetup`, `ReferralCodeEntry` and `SupaAuth`
should be on the `Button` primitive outright — they are three copies of one lilac/ink CTA
(`UsernameSetup.tsx:191-206`, `ReferralCodeEntry.tsx:357-372`, `SupaAuth.tsx:291-304`).
**Pillar** craft/governance.

---

### [P2] E17 · `SlideUpSheet` ignores the motion policy

**Location** `components/ui/SlideUpSheet.tsx:56-65`
**Prompts** P6 (Reduce Motion) · P10(e)
**Evidence** `Animated.timing(anim, { toValue: 1, duration, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();`
— no `useMotionPolicy()` import, unlike its sibling `AnimatedBackground.tsx:38,47`.
**Gap** Six sheets (`BuryTruffleSheet`, `BuriedTruffleSheet`, `TruffleCatalogSheet`, `EnemyBreakdownSheet`,
`TickleBreakdownSheet`, `HoofprintsSheet`) always play a 300ms full-screen translate with Reduce Motion on. 40
files consume `useMotionPolicy`; this primitive is the gap, so the omission propagates.
**Recommendation** Read `useMotionPolicy()` in `SlideUpSheet` and collapse to a crossfade (or `duration: 0`) when
`reduceMotion`. **System ask:** `MOTION` tokens (`MOTION.sheet`, `MOTION.dialog`, `MOTION.pop`) that bake the
reduce-motion fallback in, so a component can't animate off-policy by omission.
**Pillar** craft.

---

### [P2] E18 · Disclosure chevrons are a text glyph while the same concept is drawn as an `Icon`

**Location** `components/Account.tsx:795`, `:822`, `:1195`, `:1589` (`<Text …>›</Text>`) vs `:1758`
(`<Icon name="chevronDown" …>`) — 68 `›` occurrences app-wide
**Prompts** P6 (icon consistency) · P3 · P9
**Evidence** `achievementStyles.chev` `fontSize: 28`, `settingsStyles.rowChev` `fontSize: 22`,
`reportStyles.chev` `fontSize: 22` — three sizes for one mark, in one file, beside a real vector chevron.
**Expected standard** The 2026-07-13 dingbat ruling: *"`✦` and `·` are typography… `✓`, `✕`, `♥` are semantic — the
same concept the app already draws as art elsewhere in the same file, and a text-glyph version of a semantic mark
is the inconsistency the June audit named."* A disclosure indicator is semantic.
**Gap** `Icon.tsx` has no `chevronRight` (it has `chevronDown` and `arrowRight`), so there is nothing to migrate
*to* — the glyph is a workaround that hardened into a pattern across 68 sites.
**Recommendation** **System ask:** add `chevronRight`/`chevronLeft` to `IconName`, then sweep. A `NavRow` primitive
(icon bubble + label + sub + optional badge + chevron) would retire `SettingRow`, `achievementStyles.row` and
`reportStyles.row` — three geometries for one row type in `Account.tsx` alone.
**Pillar** craft/governance.

---

### [P2] E19 · The six-seven celebration renders in a system font

**Location** `components/SwipeElement.tsx:394-402`
**Prompts** P2 · P3 · P4
**Evidence**
```
bigDigit: { position: "absolute", bottom: 100, fontSize: 90, fontWeight: "900",
            color: "#fff", textShadowColor: "#D17C92", textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 0 }
```
Plus `borderRadius: 15` ×3 (`:366,:372,:379`) and `marginVertical: 20` (`:361`).
**Expected standard** *"Four intentional fonts, each with a job. Never reach for a system font."* One palette:
WHIMSY. `#D17C92` is the legacy `COLORS.pinkDeep`.
**Gap** The 6/7 easter egg is the most delightful moment on the Barn — the app's best "the world responds now" beat
— and it renders in San Francisco Black with two raw hex. It is also the only `fontWeight` in the area outside the
dead `ThemedText`.
**Recommendation** `fontFamily: FONTS.whimsy` (Caprasimo at 90 reads heavier and more hand-made than SF Black),
`color: WHIMSY.paper`, `textShadowColor: WHIMSY.roseDeep`, `borderRadius: RADII.lg`, `marginVertical: SPACE.xl`.
**Pillar** craft.

---

### [P2] E20 · One surface, three names: tab "Me", title "Account", kicker "your scrapbook"

**Location** `app/(tabs)/_layout.tsx:279` (`title: "Me"`), `components/Account.tsx:682` (`Account`), `:681`
(`★ your scrapbook`)
**Prompts** P9 · P2
**Gap** The tab sign says **Me**; the page title says **Account** — a system/settings word and the only
non-storybook page title in the app (compare "Your Recruits", "Referral Rewards", "Redeem a Code"); the kicker
promises a **scrapbook**. The kicker is the right idea and the title contradicts it. "Account" also mis-frames the
page: only the bottom third is housekeeping; the top two-thirds are identity, prestige, lifetime story, referrals.
**Recommendation** Title the page in the game's voice and match the tab — e.g. kicker `★ your scrapbook`, title
**Your Pen** or **Me**. Rule: **the tab sign, the page title and the kicker name one thing.**
**Pillar** Collect (the page is a trophy case, not a control panel).

---

### [P2] E21 · The referral card offers two near-identical doors

**Location** `components/Account.tsx:1016-1023` ("referral board →" → `/sounder`, titled *Your Recruits*) and
`:1040-1048` ("Referral details + rewards ›" → `/sounder-progress`, titled *Referral Rewards*)
**Prompts** P7 · P8 (Hick) · P9
**Gap** Two links ~25 lines apart, inside one card, to two screens a player cannot distinguish from the link
labels; neither label matches its destination's `PageHeader` title. The card already carries Copy, Share, a
milestone bar, a recent-friends list, two fine-print lines and (for eligible accounts) a redeem input — **8
interactive elements in one card**, well past P7's 4-option threshold.
**Recommendation** One door. Merge `/sounder` and `/sounder-progress`, or pick one as canonical and label the link
with the destination's own title ("Your Recruits ›"). Move the redeem box out of the invite card entirely — giving
a code and getting a code are opposite jobs sharing a container.
**Pillar** Connect.

---

### [P2] E22 · `ReleaseNotesModal` hand-rolls its shell and offers no corner dismiss

**Location** `components/ReleaseNotesModal.tsx:48-104`, styles `:107-172`
**Prompts** P5 · P8 (Jakob) · P4
**Evidence** Raw `<Modal>`; the backdrop is a plain `View` (`:49`) so tapping outside does nothing; the only exit
is the "Got it" button below a `maxHeight: 380` scroll (`:55`). `radius={18}`, `fontSize: 24/12/18/16/13`,
`borderRadius: 16/12`, `padding: 18/14/11/10/8`.
**Gap** A player opening "What's new" from Settings must scroll a potentially long list to reach the only exit.
`DialogCloseRow` exists for this; the scaffold provides the scroll path and height cap for free.
**Recommendation** `AdaptiveModalScaffold` with `showCloseButton`; keep "Got it" as the affirmative. Migrate
literals to `TYPE`/`RADII`/`SPACE`.
**Pillar** craft.

---

### [P2] E23 · `GoogleAuth` draws Google's mark as a Caprasimo "G"

**Location** `components/GoogleAuth.tsx:118-120`, styles `:143-156`
**Prompts** P2 · P6 (icon consistency) · P9
**Evidence** `<View style={styles.gBadge}><Text style={styles.gMark}>G</Text></View>` — a paper square with a
storybook letterform standing in for a third-party wordmark, on an ink-filled pill.
**Gap** Two problems pulling opposite ways. (a) Google's Sign-In branding guidelines require the official mark and
approved button treatments; a substituted letterform is a compliance risk on the Android listing. (b) It is also
the only place in the app where a *letter* is used as an icon, sitting next to `AppleAuth`'s vendor button — so
the two sign-in buttons on the two platforms share neither chrome nor mark system.
**Recommendation** Ship the official Google `g` asset (SVG) through `Icon`, keep the paper chip as its frame, and
follow the approved light-background button spec. The comment at `:128-130` shows the paper-craft translation was
deliberate — worth recording in the taste-standard decision log either way, since it is the one sanctioned place a
foreign brand sits inside the storybook.
**Pillar** craft/governance.

---

### [P2] E24 · Onboarding: raw values, no pressed feedback on the primary CTA, unannounced pagination

**Location** `components/Onboarding.tsx:140-153`, `:114-124`, styles `:160-240`
**Prompts** P1 (heuristics 1, 4) · P3 · P4 · P6 · P8
**Evidence**
```
<Pressable onPress={goNext} style={styles.cta} …>   // no ({ pressed }) => — nothing happens on touch-down
cta: { paddingHorizontal: 28, paddingVertical: 12, borderRadius: 14, borderWidth: 2, … }
title: { fontSize: 26 }   body: { fontSize: 16, opacity: 0.8 }   skipLink: { fontSize: 15 }
dot: { width: 8, height: 8, borderRadius: 4 }   dotActive: { width: 24 }
```
**Expected standard** *"The world responds now"* — every other CTA in the area does `pressed && { opacity: 0.7 }`.
`RADII.lg` = 14, `TYPE.pageTitle` = 26, `SPACE.xl` = 24.
**Gap** The literal first button a new player presses gives no touch-down feedback. The dots row (`:114-124`) has
no `accessibilityRole`/`accessibilityValue`, so a VoiceOver user gets no "1 of 3"; and `scrollEventThrottle={100}`
(`:93`) lets the active dot lag the swipe by up to 100ms. Positive: `:71` correctly honours `motion.reduceMotion`
on the programmatic scroll, and `:133-148` is the best-labelled pressable pair in the area.
**Recommendation** Move to `<Button variant="primary">`; add `accessibilityValue={{ min: 1, max: 3, now: page+1 }}`
to the dots container; drop `scrollEventThrottle` to 16; swap `borderRadius: 14 → RADII.lg`,
`fontSize: 26 → TYPE.pageTitle`, `fontSize: 16 → TYPE.bodyLg`, `paddingHorizontal: 28 → SPACE.xl + SPACE.xs`.
**Pillar** Connect (this is the app's first handshake).

---

### [P2] E25 · The Slop Club and Settings blocks each blow the 4-option ceiling

**Location** `components/Account.tsx:1131-1196` (Settings: 7 `SettingRow`s + the report row = **8**);
`:828-947` (Slop Club: status chip, Pen/Join CTA, Manage link, Terms, Privacy = **5**)
**Prompts** P7 · P8 (Hick, Von Restorff)
**Evidence** Settings rows: Change your name · Blocked users · What's new · Barn introduction · Restore purchases ·
Sign out · Delete account, then "Found a bug or have an idea? Report it".
**Gap** Eight flat, identically-weighted rows with no grouping, two of them destructive (E6). Von Restorff: the
only differentiated row is "Delete account" (accent-coloured) — so the *most dangerous* action is the one thing
that stands out. On the Slop Club card for a non-member, the "Join the Slop Club" CTA and the "Coming soon…"
disabled state share a style, and the legal links compete visually with the fine print.
**Recommendation** Group the rows with a hairline + `SPACE.md` into **Your pig** (name, blocked users, barn intro),
**Purchases** (restore), **Account** (sign out, delete) — the dashed dividers already exist, they just need two
group gaps. Move "Report a bug" up into the first group rather than orphaning it below the card.
**Pillar** craft (legibility beats depth).

---

### [P2] E26 · `app/(tabs)/account.tsx` swallows the signed-out case silently

**Location** `app/(tabs)/account.tsx:11-25`
**Prompts** P1 (heuristic 1) · P5
**Evidence** `{session && <Account session={session} />}` — if `session` is null the tab renders an empty cream
rectangle with no header, no Rosie, no message, indefinitely.
**Gap** In practice `app/(tabs)/_layout.tsx:193` gates the whole tab group on a session, so this is defensive — but
it is also a second, divergent session subscription (`:11-19`) duplicating the layout's (`_layout.tsx:54-65`). Two
sources of truth for "am I signed in" in the same subtree.
**Recommendation** Take the session from a context provided by `app/(tabs)/_layout.tsx` rather than re-subscribing,
and let the layout's gate own the signed-out UI. This file should be three lines.
**Pillar** craft.

---

### [P3] E27 · `radius={n}` passed raw to `Sticker` where `RADII` has the exact value

**Location** `Account.tsx` ×7 (`:696,:828,:955,:1128,:1261,:1340,:1742`), `ConfirmDialog.tsx:92` (`18` =
`RADII.xl`), `Onboarding.tsx:103` (`18`), `ReleaseNotesModal.tsx:51` (`18`)
**Prompts** P4
**Evidence** 38 raw `radius={n}` app-wide vs 75 `radius={RADII.*}` — a 34% miss rate on a prop that has a token.
**Recommendation** Mechanical sweep. `16` has no token, so either add `RADII.lgPlus = 16` or snap to `RADII.lg`
(14) / `RADII.xl` (18). Better: default `Sticker`'s `radius` to `RADII.xl` and type the prop as
`keyof typeof RADII` so a raw number stops type-checking.
**Pillar** craft/governance.

---

### [P3] E28 · Raw `#fffaf0` on the invite landing route

**Location** `app/i/[code].tsx:43` — `<View style={{ flex: 1, backgroundColor: "#fffaf0" }} />`, the literal value
of `WHIMSY.paper`.
**Recommendation** `WHIMSY.paper` — or `UI_COLORS.canvas`. (The screens on either side of this pass-through are
`WHIMSY.cream`, so cream is a hair more continuous during the replace-nav.)
**Pillar** craft/governance.

---

### [P3] E29 · `auth-callback` shows a naked spinner

**Location** `app/auth-callback.tsx:61-65` — `<ActivityIndicator color={WHIMSY.ink} />` on `WHIMSY.paper`.
**Expected standard** Taste standard rule 4: *"never a bare gray string or a naked spinner."* 11 files app-wide
still use `ActivityIndicator`; this is one.
**Gap** Small blast radius (Android OAuth only, sub-second), but it is the seam between Google's browser and the
storybook — the one frame where the transition could feel authored.
**Recommendation** `<LoadingBeat label="finding your barn" />` (or `WaitingRosie` + `KICKER_TEXT`, matching
`app/(tabs)/_layout.tsx:220`), on `WHIMSY.cream` to match the screens on either side.
**Pillar** craft.

---

### [P3] E30 · `scan-code`'s camera well is raw `#000` + an untokenized text shadow

**Location** `app/scan-code.tsx:502`, `:523`
**Evidence** `backgroundColor: "#000"`, `textShadowColor: "rgba(0,0,0,0.6)"`, plus bare
`fontSize: 13/14/15/20/26/44` and `letterSpacing: 3`.
**Gap** The black is *correct* (a camera viewport is a window, not paper) but it is the app's only sanctioned black
surface and it is undeclared. Same for the hint's legibility shadow over live video.
**Recommendation** Tokenize once: `WHIMSY.lens = "#000"` and `LENS_TEXT_SHADOW` in `theme.ts`, with the carve-out
documented ("the only non-paper surface: a camera viewport"). Otherwise this file is the area's exemplar.
**Pillar** craft/governance.

---

### [P3] E31 · Dead styles left behind by earlier redesigns

**Location** `components/Account.tsx` — `styles.codeAvatar` (`:1860`), `codeNameRow` (`:1872`), `codeValue`
(`:1878`), `restoreLink`/`restoreLinkText` (`:2130`), `signOut`/`signOutText` (`:2142`), `devLink`/`devLinkText`
(`:2152`); `achievementStyles.iconText` (`:2194`); `referralStyles.pendingRow`/`pendingPig`/`pendingNote`
(`:2348-2364`); `longStoryStyles.wrap`/`kicker`/`card`/`statsRow`/`seeAll` (`:2866-2887`)
**Prompts** P4 (redundancy) · taste-standard roadmap item 4 (*"pruning the now-dead per-screen header styles"*)
**Gap** ~18 orphaned style objects, several encoding values the file no longer uses (`marginTop: 22`,
`borderRadius: 32`), which a future reader will mistake for live precedent.
**Recommendation** Delete in the same pass as E3.
**Pillar** craft/governance.

---

### [P3] E32 · Link label drift: "referral board" lands on "Your Recruits"

**Location** `components/Account.tsx:1021` → `app/sounder.tsx:56-58`; `:1046` → `app/sounder-progress.tsx:85-86`
**Evidence** Link text `referral board →`, destination `title="Your Recruits"`. Link text
`Referral details + rewards ›`, destination `title="Referral Rewards"`.
**Recommendation** Label every link with its destination's own `PageHeader` title. Rule: **a link says where it
goes, spelled the way the destination spells itself.** (Related to E21.)
**Pillar** craft.

---

## 4. Heuristic scorecard (P1)

### `components/Account.tsx` (Me tab)

| # | Heuristic | Score | Note |
| --- | --- | --- | --- |
| 1 | Visibility of system status | **1** | No loading state for 6 concurrent reads (E7); no failure surface; copy/copied feedback is good (`:757`) |
| 2 | Match to the real world | **2** | Kicker/copy voice is excellent; "Account" title and the triple "your code" collision fight it (E11, E20) |
| 3 | User control & freedom | **1** | Sign-out has no confirm or undo (E6); delete correctly does; rename cancels cleanly |
| 4 | Consistency & standards | **1** | 3 hand-rolled modals duplicating `ConfirmDialog` (E12); 3 row geometries; `›` vs `Icon` (E18) |
| 5 | Error prevention | **2** | Rename pre-checks length + moderation client-side (`:449-463`); sign-out unguarded |
| 6 | Recognition over recall | **3** | `renameCostCopy` (`:433`) states the price before the tap; redeem box gated to eligible accounts (`:403`) |
| 7 | Flexibility & efficiency | **3** | Deep-link `?feedback=1` (`:508`), clipboard prefill (`:162`), dev W5 preview (`:1725`) |
| 8 | Aesthetic & minimalist | **2** | Tape + tilt + sticker language is strong; Settings is 8 flat rows and the referral card carries 8 controls (E21, E25) |
| 9 | Error recovery | **2** | Server reasons map to warm copy (`:484`, `:542`, `:200`) — genuinely good; profile-fetch failure has none |
| 10 | Help & documentation | **2** | Wallow card explains the next rank concretely (`:1761-1786`); "what counts as a referral" gets one fine-print line |

### `app/_layout.tsx` (app shell)

| # | Heuristic | Score | Note |
| --- | --- | --- | --- |
| 1 | Visibility of system status | **3** | Splash held until `loaded && authChecked` (`:956-964`) — no blank flash |
| 2 | Match to the real world | **1** | Deep-link prompts speak in raw codes through system alerts (E2) |
| 3 | User control & freedom | **3** | Every popup dismissible; `POPUP_HANDOFF_GAP_MS` choreography prevents the wedge |
| 4 | Consistency & standards | **1** | `Alert` ×4 vs the app's own dialog/toast systems (E2); `<Stack>` with no `screenOptions` (E13) |
| 5 | Error prevention | **4** | `launchEventSourcesSucceeded` refuses to advance `away_seen_v1` on a partial batch (`:476-487`); consume-once push guard (`:926-930`) — exemplary |
| 6 | Recognition over recall | n/a | No persistent UI of its own |
| 7 | Flexibility & efficiency | **4** | Tap-routing pays the handoff latency only when a popup is actually presented (`:870-884`) |
| 8 | Aesthetic & minimalist | **3** | `APP_NAV_THEME` (`:121-132`) pins every nav surface to `UI_COLORS` — done once, correctly |
| 9 | Error recovery | **3** | Notifications module resolved defensively (`:908-952`); Sentry scoped to the user (`:282-304`) |
| 10 | Help & documentation | **4** | The best in-repo comments; the `PopupQueue` timing contract is a spec |

### `components/Onboarding.tsx`

| # | Heuristic | Score | Note |
| --- | --- | --- | --- |
| 1 | Visibility of system status | **3** | Dot row shows position; no announcement for AT (E24) |
| 2 | Match to the real world | **4** | Three steps, each one sentence, each naming a real screen ("Dig now", "Opening in") |
| 3 | User control & freedom | **3** | Skip present on pages 1–2; no Back |
| 4 | Consistency & standards | **2** | CTA hand-rolled rather than `Button`; no pressed state (E24) |
| 5 | Error prevention | n/a | Nothing to get wrong |
| 6 | Recognition over recall | **4** | Rosie animates the concept being described (`:98`) |
| 7 | Flexibility & efficiency | **3** | Swipe or tap; `markSeen` writes local + server (`:62-65`) |
| 8 | Aesthetic & minimalist | **3** | Clean; raw radius/sizes (E24) |
| 9 | Error recovery | n/a | — |
| 10 | Help & documentation | **3** | This *is* the documentation; re-openable via Settings → Barn introduction |

---

## 5a. Token triage table (P4)

| File | raw hex | `rgba(` | bare `fontSize` | bare `borderRadius` | bare pad/margin/gap | `fontWeight` | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `components/Account.tsx` | 0 | 0 | **81** | 5 (+7 `radius={n}`) | **140** | 0 | E3 — the area's whole problem in one file |
| `components/SupaAuth.tsx` | 0 | 0 | 8 | 2 (`10`,`12`) | 19 | 0 | `10`→`RADII.sm`, `12`→`RADII.md`; `fontSize: 36` needs a role |
| `components/ReferralCodeEntry.tsx` | 0 | 0 | 6 | 0 | 21 | 0 | partly on `RADII`/`TYPE` — finish it |
| `components/ReleaseNotesModal.tsx` | 0 | 0 | 6 | 2 (`16`,`12`) | 12 | 0 | E22 |
| `components/UsernameSetup.tsx` | 0 | 0 | 5 | 2 (`12`,`12`) | 14 | 0 | E16 |
| `components/ui/ConfirmDialog.tsx` | 0 | 0 | 5 | 1 (`12`) | 9 | 0 | E5 — worst offender relative to its role |
| `components/Onboarding.tsx` | 0 | 0 | 4 | 2 (`14`,`4`) | 13 | 0 | E24 |
| `app/scan-code.tsx` | 1 (`#000`) | 1 | 7 | 0 | 5 | 0 | E30 — otherwise the exemplar |
| `components/GoogleAuth.tsx` | 0 | 0 | 2 | 0 | 1 | 0 | fully on `RADII`; only `fontSize: 16/17` |
| `components/SwipeElement.tsx` | 2 (`#fff`,`#D17C92`) | 0 | 1 | 3 (`15`×3) | 1 | **1** | E19 |
| `components/ThemedText.tsx` | 1 (`#0a7ea4`) | 0 | 5 | 0 | 0 | **3** | E8 — delete |
| `constants/Colors.ts` | **10** | 0 | 0 | 0 | 0 | 0 | E8 — delete |
| `app/i/[code].tsx` | 1 (`#fffaf0`) | 0 | 0 | 0 | 0 | 0 | E28 |
| `app/+not-found.tsx` | 0 | 0 | 0 | 0 | 3 | 0 | E8 |
| `app/(tabs)/_layout.tsx` | 0 | 0 | 0 | 0 | 3 (`14`,`32`) | 0 | inline gate styles → `SPACE.lg` / `SPACE.xl + SPACE.sm` |
| `app/_layout.tsx`, `app/(tabs)/account.tsx`, `auth-callback.tsx`, `ui/DialogCloseRow.tsx`, `ui/AdaptiveModalScaffold.tsx`, `ui/PageBackground.tsx`, `ui/AnimatedBackground.tsx`, `ui/WaitingRosie.tsx`, `ui/PopupQueue.tsx`, `AppleAuth.tsx`, `ThemedView.tsx`, `hooks/*` | 0 | 0 | 0 | 0 | 0 | 0 | **clean** |

Top literal values in the area: `fontSize` **13** (14×), **12** (13×), **14** (12×), **15** (10×), **11** (9×) —
all five have exact `TYPE` roles (`bodySm`, `label`, `hand`, `body`, `kickerPill`). `borderRadius` **12** (7×) =
`RADII.md`. Padding **14** (21×) and **22** (9×) have *no* token — nearest are `SPACE.md` (12) and `SPACE.lg` (16);
these are the two values that most need a ruling.

## 5b. Raw `<Modal>` classification (cross-cutting)

33 files mount a raw `<Modal>`; 3 are the primitives themselves. The other 30:

**Centered dialog → should be `AdaptiveModalScaffold` (21)**
`Account.tsx` ×3 (rename, feedback, long story — E12) · `ReleaseNotesModal.tsx` (E22) · `AchievementDigestModal.tsx` ·
`AlignmentSchismModal.tsx` · `BattlePassSaleModal.tsx` · `BlockedUsersModal.tsx` · `CleanseModal.tsx` ·
`Friends.tsx` · `habitat/HabitatEditor.tsx` ×2 · `habitat/HabitatStarterWelcome.tsx` · `mudwar/TrufflePatch.tsx` ·
`mudwar/useFeedingCta.tsx` · `MysteryHatReveal.tsx` · `season1/HungerHero.tsx` · `season1/SeasonGuideModal.tsx` ·
`season1/SeasonInfoModal.tsx` · `app/(tabs)/season.tsx` ×3

**Bottom sheet → should be `SlideUpSheet` (6)**
`CrewSheet.tsx` · `UserSheet.tsx` · `PigRosterPicker.tsx` · `mudwar/TruffleExchangeSheet.tsx` ·
`mote-machine/MoteWageringScreen.tsx` · `season1/DevSeasonStatesSheet.tsx` *(dev)*

**Full-screen ceremony → keep bespoke, but share a `CeremonyScaffold` (3 + 2 hybrids)**
`GreatHungerIntroModal.tsx` · `JudgementDayModal.tsx` · `SeasonEndModal.tsx`; `LuckyPigModal.tsx` and
`WhileAwayModal.tsx` sit between ceremony and dialog (centered but full-bleed and animated).

**Intentional exception (1)** `ui/Spotlight.tsx` — a coach-mark cutout; raw `Modal` + `absoluteFill` is correct.

The scaffolds have 13 and 7 consumers against 27 files that should be using them — the primitives exist and are
**~42% adopted**. That ratio, not any individual modal, is the finding.

---

## 6. What's working (keep and replicate)

- **`components/ui/PopupQueue.tsx`** — a documented state machine with an explicit timing contract, a stated
  invariant (`beat < gap`), and a named upstream bug it defends against. It is also *composable*:
  `useUnmanagedModalHold` (`:295`) lets a non-queue sheet participate in one line, which is why `Account.tsx:261`
  is a single call. **This is the model for how every future cross-cutting concern in this app should be shaped.**
- **`app/_layout.tsx:121-132` `APP_NAV_THEME`** — pinning React Navigation's entire colour set to `UI_COLORS` so a
  system-drawn transition surface can never flash off-palette. Exactly the "tokenize before it leaks" posture the
  `bark` / `slopGold` decision-log entries describe.
- **`app/(tabs)/_layout.tsx:201-243`** — the "saddling up" gate: Rosie on cream, a hand kicker, a real
  `accessibilityRole="progressbar"` (`:238`), and an error branch that swaps the endless spinner for a warm retry
  ("★ the barn's being shy ★" / "Couldn't reach the farm. Give it another nudge."). This is the bar for E7.
- **`app/scan-code.tsx`** — the area's exemplar. `PageHeader` + `Sticker` + `Button`/`TicketButton` +
  `EmptyState`/`LoadingBeat` + `Glyph`, three distinct permission states each with in-world copy ("Camera's
  napping", "Rosie only peeks through the camera to read a giveaway QR — nothing else"), haptics on both success
  and refusal, and a reveal that names the grant. Zero `Alert`, zero hand-rolled modal.
- **`components/Account.tsx:1701-1807` `WallowWall`** — fully tokenized (`TYPE.*`, `SPACE.*`, `RADII.*`), explicit
  `minHeight: 44` on every interactive row (`:2770`, `:2817`, `:2848`), `accessibilityState={{ selected }}` on the
  dev toggle, and a current→next progression showing the concrete delta (`4h → 3h`) instead of a bare number. The
  in-file reference implementation for E3.
- **Server-reason → warm copy mapping** — `Account.tsx:484-494` (rename), `:542-546` (feedback: *"the den's ears
  are full for today — come whisper tomorrow"*), `utils/referrals.referralErrorMessage`. Losing states that stay in
  voice, per the charter's *"does losing still feel warm?"*
- **`ui/AdaptiveModalScaffold.tsx`** — window-sized rather than module-snapshot-sized (`:68`), safe-area aware,
  always gives dense content a scroll path, carries `accessibilityViewIsModal` + `onAccessibilityEscape`. It just
  needs the other 21 dialogs on it.
- **The auth→name storybook continuity** — `SupaAuth.tsx:1-13` and `UsernameSetup.tsx:1-6` both document the intent
  ("so the transition feels like one continuous storybook flow rather than two unrelated screens") and deliver it:
  same Rosie hero, same cream, same paper card, same kicker treatment.

---

## 7. System asks

1. **`BORDER` tokens.** `borderWidth` is 2 (255×) / 1.5 (129×) / 1 (12×) / 2.5 / 3 app-wide with no rule. Ask:
   `BORDER = { hair: 1, thin: 1.5, ink: 2 }` plus a ruling on which weight belongs to a card vs a chip vs a
   divider. (E3, E5)
2. **`OPACITY` tokens *and* a rule that text colour never comes from opacity.** 0.7 (70×), 0.85 (28×), 0.6 (22×),
   0.55, 0.5, 0.45. E4 is an AA failure caused entirely by this gap.
3. **`TAP_MIN = 44` plus a `TextButton`/`Link` primitive.** 12 sites in `Account.tsx` alone are a bare `Pressable`
   wrapping a `Text` with no minimum height. (E4, E9)
4. **`Icon "chevronRight"` / `"chevronLeft"`.** 68 `›` text glyphs exist app-wide because the icon set has no
   disclosure chevron. Add it, then sweep. (E18)
5. **A `NavRow` primitive** — icon bubble · label · sub · optional badge · chevron. `Account.tsx` has three
   geometries for this row; `Friends`, `Inbox` and `season` have more. (E18, E25)
6. **`DialogButtonRow`** (confirm + cancel) beside `DialogCloseRow`, and **`ConfirmDialog` rebuilt on
   `AdaptiveModalScaffold`.** Four copies of the same button row exist today. (E5, E12)
7. **An `ActionSheet` variant of `SlideUpSheet`** (title + N destination rows + cancel), so "pick where to go"
   never reaches for `Alert` again. (E14)
8. **`error` / `info` tones on `showPurchaseToast`**, then the rule *refusals are toasts · decisions are
   `ConfirmDialog` · `Alert` is for nothing*, enforced by a lint rule restricting `Alert` outside
   `components/dev/**`. (E1, E2, E15)
9. **`MOTION` tokens with reduce-motion baked in** (`MOTION.sheet`, `MOTION.dialog`, `MOTION.pop`) so a primitive
   can't animate off-policy by omission, as `SlideUpSheet` currently does. (E17)
10. **A `ScreenScaffold` / `PageHeader variant="tab"`** — no tab screen uses `PageHeader`; all five hand-roll
    kicker + title + `TITLE_RULE`. One crown, two variants (stack with `‹ back`, tab without). (E7, E20)
11. **Padding rulings for 14 and 22** — the two most-used untokenized spacing values in this area (21× and 9×),
    sitting between `SPACE.md` (12) and `SPACE.lg` (16). Add them or rule that they snap. (E3)
12. **`WHIMSY.lens` + `LENS_TEXT_SHADOW`**, with the carve-out documented: the camera viewport is the one
    sanctioned non-paper surface. (E30)
13. **`UI_COLORS.textPlaceholder`** so `placeholderTextColor` reads a role, not a brand token — the E10 contract
    violation was invisible precisely because `WHIMSY.muteSoft` *looks* like a legitimate choice at the call site.
14. **Deletion as a system act:** `ThemedText`, `ThemedView`, `constants/Colors.ts`, `hooks/useThemeColor.ts`,
    `hooks/useColorScheme.ts`, and the legacy `COLORS` export. While they exist, a non-WHIMSY palette is one
    import away. (E8)

---

## Conformance pass — 2026-09-11 (wave 3, section E)

**Result: 560 → 0 `ttp/*` warnings across 14 files; lint flipped to error for the area. With E landed, every
in-scope file in `app/`, `components/` and `features/` is conformant: 201 / 201, 0 warnings.** Three parallel passes
(Account tab · onboarding chain · shell + routes). No `eslint-disable`; surviving literals are named drawing constants.
Full suite 207/207 green.

**Findings closed:** E3 (Account.tsx 351 → 0, 2,949 → 2,142 lines; seven StyleSheets collapsed to two), E4, E6, E7,
E9, E10, E11, E12, E13 (`<Stack screenOptions>` declared once), E16, E18, E19, E20 (page title "Me" under
"★ your scrapbook" — one concept, one name), E22, E23, E24, E25, E27, E28, E29, E30 (the lens is `WHIMSY_LENS` +
`LENS_TEXT_SHADOW`, the sanctioned non-paper surface), E31. Highlights: the Me tab paints a `LoadingBeat` first and
an `EmptyState kind="error"` on a failed profile; sign-out confirms, delete is destructive with its consequence
spoken; every settings row is one `NavRow` geometry (`tone="danger"` on delete); the code wells are `TextField`
(`variant="code"` for the Golden Ticket); the storybook dots announce "1 of 3"; the root reads the motion policy to
crossfade stack transitions under Reduce Motion; `RARITY_COLORS` is deleted from `constants/hats.ts`.

**Primitive growth (landed):** `TextField` `variant="code"`, `multiline`/`rows`; `NavRow.tone`; `Sticker`
`color="slopBand"`; `Button.loadingLabel`; `ART_SIZE.badge`; `WHIMSY_LENS`/`LENS_TEXT_SHADOW`; the motion-policy lint
rule ignores a bare side-effect import.

**Deliberate calls:** Apple sign-in is the native `AppleAuthenticationButton` (App Review risk with a custom
Nunito-labelled button) — recorded as the spec §3.1 platform-control exception; Google stays a `ghost` Button with
the four-colour mark. `Icon` does not gain brand marks; they live beside their consumer.

**Wave-4 items recorded:** `PageDots` primitive; a celebration numeral above `TYPE.hero` (six-seven is 90pt as a
drawing constant).
