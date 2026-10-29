# UI audit · 2026-09-22 · the "AI slop" tells

Every shipped screen of the app and every public page of the landing family, checked
against a list of thirty template tells (harsh gradients, Lucide icons, pure white,
rainbow colouring, soft drop shadows, three feature cards in a row, emoji, liquid glass,
em dashes, Inter/Geist/Space Grotesk, a coloured left stripe, fake testimonials, bento
grids, a terminal window, "it's not X, it's Y", checkmark bullets, three pricing tiers,
no real product demo, soft corner radius, purple-and-black, no skeleton loaders, radial
orbs, dot grids, sparkle icons, animated arrows, no terms, no privacy policy, hover
animations, neon, basic pastels), plus correctness, consistency and accessibility where
the code can show it.

The short version: the app's governance held. The 2026-09 design-system waves left
every in-scope file at zero on the seven `eslint-plugin-ttp` rules, so the tells that
are *visual* (icons, shadows, fonts, white, spinners, emoji, hex leaks) were mostly
already gone. What remained was **copy** (em dashes everywhere) and the **landing
site** (radial orbs, animated arrows, a rainbow card grid, contrast framing), plus one
generic icon family hiding inside `Icon.tsx`. All of it is fixed below and guarded by
lint so it stays fixed.

## 1 · Screen inventory (what was crawled)

Dev-only routes (`app/*-preview.tsx`, `app/*-prototype.tsx`, `app/ui-audit.tsx`,
`app/pig-angle-audit.tsx`, `app/rosie-gallery.tsx`) are `__DEV__`-gated redirects and are
out of scope; their screens live under `components/dev/` and are lint-exempt by design.

**Pre-shell gates** (`app/(tabs)/_layout.tsx`): `SupaAuth` (sign-in: Apple / Google /
email form, error line), `UsernameSetup`, `ReferralCodeEntry`, `Onboarding` storybook,
the "★ saddling up ★" loading beat, the "★ the barn's being shy ★" offline retry state.

**Tabs** (`HangingSignsTabBar`): Barn (`app/(tabs)/index.tsx` → `Barn`), Friends
(`friends.tsx` → `Friends`, `Inbox`, `JoinableSounders`, `SounderCard`), Season
(`season.tsx` → Feed · Draw · Pass panels under `components/season1/almanac/`), Shop
(`shop.tsx` → `ClosetView` with the store wall, `Chalkboard`, `Shelf`, `Counter`,
`TroughByCounter`), Me (`account.tsx` → `Account`).

**Stack routes**: `achievements`, `barn-collection`, `barn-interior` (habitat),
`contraptions`, `dig-collection`, `expedition` (+ `components/expedition/*`),
`i/[code]` (invite deep link), `lounge`, `mote-machine`, `pen`, `porch-round`,
`recruits`, `recruits-progress`, `scan-code`, `auth-callback`, `+not-found`.

**Modals and sheets** (each was read): AchievementDigest, AlignmentExplainer,
AlignmentSchism, BarnVisit, BlockedUsers, BuriedTruffle, BuryTruffle, Cleanse,
ConfirmDialog, DigPostcardInbox, EnemyBreakdown, FriendInvitePicker, GreatHungerIntro,
HabitatEditor / FriendRoom / GiftReveal / Inspection / ItemPreview / Preset /
StarterWelcome / WorkshopCabinet, ItemPreview, JudgementDay, LuckyPig, MondayDraw,
DrawReveal, BarnRewardClaim, MoteReward, MysteryHatReveal, PigFriendsLaunch,
PlayerInvitePicker, ReleaseNotes, RewardReturn, RitualExplain, RitualPicker,
SatchelSheet, SeasonEnd, SeasonGuide, SeasonInfo, SendSheet (pen), SounderOink,
SnoutDeepSheets, TickleBreakdown, TitlesPicker, TraderSheet, TransferLeadership,
TroughSheet, TruffleCatalog, TruffleExchange, UserSheet, WhileAway.

**Empty / loading / error states**: `EmptyState` (empty + `kind="error"`),
`LoadingBeat`, `Skeleton` / `ListRowSkeleton`, `WaitingRosie`; used on 37 files.

**Web**: `landing/index.html`, `landing/i/index.html` (invite), `landing/redeem/`,
`landing/report.html`, `landing/terms.html`, `landing/privacy.html`, shared
`landing/site.css` + `tickle.js`. (`landing/den`, `landing/plan`, `labs`, `mocks`,
`adventures`, `cards` are founder tools or noindex'd prototypes; excluded, as the web
lint already excludes them.)

## 2 · Findings

Severity: **High** = visible on the public face or on every screen; **Medium** = a
tell a designer would spot on a normal session; **Low** = governance drift with no
visible cost today. "Repro" is how to see it before the fix.

| # | Screen | Location | Issue | Sev | Repro |
| --- | --- | --- | --- | --- | --- |
| F-01 | Every screen | 359 string literals / JSX texts in 93 files under `app/`, `components/`, `constants/`, `utils/`, `hooks/`, `features/` | **Em dashes** in player-facing copy: toasts, refusals, hints, accessibility labels, release notes, the field guide, the null placeholder "—". | High | `npx eslint . ` with the new `ttp/no-em-dash-copy` rule (before: 359 errors). Or open any refusal toast ("Couldn't bury that — try again"). |
| F-02 | Landing `/`, `/i/`, `/report`, `/terms`, `/privacy` | `site.css` `body`, and the inline `<style>` of the other four pages | **Radial orbs**: two rose/lilac `radial-gradient` blobs in the page corners; a third radial glow behind Rosie. | High | Load `/` at desktop width; pink and lilac haze top-left and bottom-right. |
| F-03 | Landing `/`, `/i/` | hero subtitle `▶` (`.hero-sub .arrow`, infinite nudge), CTA `→` (`.cta .ja`, hover translate) | **Animated arrows** and a **hover animation**. | High | Hover the App Store button; the arrow slides. Watch the subtitle; the triangle nudges forever. |
| F-04 | Landing `/` | `.answer-grid` cards | **Rainbow colouring**: the four answer cards cycle sun / rose / sage / lilac by `nth-child`. | Medium | Scroll to "What is Tickle the Pig?". |
| F-05 | Landing `/` | lede, "Play with people you know", "Earn status through play", "Does it have ads?" | **"It's not X, it's Y" framing** ("not a feed full of strangers", "not pay-to-win", "rather than an attention-maximizing feed", "instead of an endless daily grind"). | Medium | Read the four paragraphs. |
| F-06 | Landing `/`, `/i/`, `/report`, `/terms`, `/privacy`, `/redeem` | titles, meta, prose, JS strings (about 70 lines) | **Em dashes** on the web, including `<title>` tags social cards copy. | Medium | View source; or the browser tab title. |
| F-07 | `Account` › Settings, `Leaderboard`, `SounderCard`, `JudgementDay`, `Barn`, `BountyCard`, release notes | `components/ui/Icon.tsx` `VECTOR_ICON_MAP` | **Generic icon family (Feather = Lucide's parent set, and MaterialCommunityIcons)** for 14 names: gear, edit, refresh, exit, chevronDown, crown, gift, scales, trophy, ghost, handshake, pig, target, scroll. Everything else in the app is hand-cut. | Medium | Me › Settings row icons (gear, scroll) vs. the tab bar's own icons. |
| F-08 | Primitives | `Icon.tsx` (55 raw hex fills incl. `#7B5FFF` purple, `#fff`, `#1A1A1A`), `HangingSignsTabBar.tsx` (wood hexes retyped from the `WOOD` token), `Snout.tsx`, `TickleIcon.tsx`, `AnimatedCosmetic.tsx`, `Shovel.tsx`, `Trotter.tsx` | **Hex leak** inside `components/ui` (the folder is exempt from `no-raw-style-literal`, so nothing caught it). | Low | `grep -n '#[0-9a-fA-F]\{6\}' components/ui/Icon.tsx`. |
| F-09 | `SupaAuth` (sign-in) | below the sign-in card | **Terms / Privacy not reachable before sign-in.** Both links exist under Me › Settings and in the landing footer, but a new player can't read them from the first screen. | Low | Fresh install, sign-in screen: no legal links. |
| F-10 | `Barn` share sheet, `utils/digShare.ts` | `Share.share` messages | **Emoji in outbound share text** (a 🔥 on the streak share; the 🍄 ✨ 👑 🟫 dig grid). Not rendered in the app. | Info | Share a streak. |
| F-11 | `legal/privacy-policy.html` | repo root | A second, stale privacy policy on system fonts with raw hex. Unreferenced by the app or the landing (`/privacy` serves `landing/privacy.html`). | Info | `grep -rn privacy-policy` finds nothing outside `legal/`. |
| F-13 | Season › bounty board | `BountyCard.tsx` `bountyVisual()` | **Emoji-range character rendered as text**: a curse bounty's mark was `☁` (U+2601), returned from a plain object literal, so the JSX-only emoji lint never saw it. | Low | Open a curse/itch bounty; the mark is a text cloud beside hand-drawn glyphs. |
| F-12 | Landing `/` | whole page | **No real product demo**: Rosie art and copy, no screenshots of the game. The only screenshots in the repo (`docs/screenshots/v1`, May 2026) show the retired leaderboard and the pre-redesign shop, so they can't be used. | Medium (open) | Load `/`; there is no image of the app. |

### What was checked and found clean (so nobody re-audits it)

- **Lucide / Feather imports**: only inside `Icon.tsx` (F-07); `no-restricted-imports` bans them everywhere else.
- **Emoji in rendered UI**: zero. `★ ✦ ♥ ✓ ✕` are the sanctioned print marks (typography, not emoji). `constants/release_notes.ts` carries an `emoji:` key that maps to art (`releaseIcon`) and never renders raw. `components/dev` prototypes use emoji but are exempt and unshipped.
- **Pure white**: no `#fff`/`white` background anywhere shipped. `#fff` survives only as SVG mask luminance in `Spotlight.tsx` (a mask, not paint) and as icon fills now tokenized to `WHIMSY.paper`.
- **Fonts**: Fredoka / Nunito / Caprasimo / PatrickHand only; no Inter, Geist or Space Grotesk in app, landing or legal.
- **Shadows**: two hard tiers (`STICKER_SHADOW` 4,4 and `SHADOW_SM` 2,2, radius 0). No `shadowRadius > 0` in shipped code. The tab rail's `shadowOpacity: 0.18` is a hard 2px line (radius 0), not a blur.
- **Gradients**: 9 `LinearGradient` sites, all sanctioned ramps (`WOOD` rail, `GRADIENT.rose/purple/gold` buttons, the Judgement Day stage `inkDeep → stage → bark`, a scrim). No neon, no purple-and-black; the "purple" button variant is the lilac alignment hue.
- **Skeletons**: `Skeleton`/`LoadingBeat` on 37 files; `ttp/no-activity-indicator` is an error; the two remaining `ActivityIndicator`s are inside `Button loading` and `EmptyState`'s own beat.
- **Checkmark bullets / sparkle icons / animated arrows in-app**: `✓` appears once as a done badge on an achievement card, never as a bullet. `Glyph name="sparkle"` is hand-drawn art used in-fiction (Lucky Pig, buy celebration, reveals) and as the "no art yet" fallback; never as a generic AI/premium marker. No `Animated` arrow.
- **Left stripes**: three `borderLeftWidth` sites are hairline rules inside a table (`season.tsx`) and `ProgressTrack`'s segment divider, in ink or `uiMuted`. Not a coloured status stripe.
- **Bento / three-cards / pricing tiers / testimonials / terminal / dot grid / glass**: none in app or landing. The landing's answer grid is 2×2 and the FAQ is 2×2. One membership (Slop Club) and a per-season pass; no tier table.
- **Pastels / soft radius**: `WHIMSY` is a muted storybook pastel set on warm paper and `RADII` is 8–22 + pill. Both are the charter (`docs/design/taste-standard.md`, "What taste means here"): the sticker language *is* the design. The tell is pastels without hierarchy (rainbow), which F-04 was and the one-hero rule (`utils/seasonHero.ts`) already guards in-app.
- **Accessibility (static)**: `ttp/pressable-needs-a11y` is an error and at zero; 734 `accessibilityLabel`/`Role` sites; contrast is tokenized (`ACCENT_SAFE_FILLS`, `muteDim` ≥ 4.5:1 on every core fill) and unit-tested. Runtime VoiceOver order was not exercised in this pass.
- **TOS / privacy**: in-app (Me › Settings › Terms / Privacy, now also on sign-in), landing footer, and `ticklethepig.com/terms` + `/privacy` served.

## 3 · Grouping and root causes

| Group | Findings | Root cause |
| --- | --- | --- |
| **A · Copy voice** | F-01, F-06 | The house voice writes with em dashes (CLAUDE.md, the taste standard and every comment do too), and the lint gate only guarded emoji. Nothing distinguished a comment's dash from a player's. |
| **B · Landing composition** | F-02, F-03, F-04, F-05, F-12 | The landing was rebuilt on the generated token layer (G-wave) for *paint*, but its *composition* (page background, CTA affordance, card fills, marketing phrasing) was never run through the taste lens. The web lint checked emoji and token freshness, not composition. |
| **C · Primitive exemption** | F-07, F-08, F-13 | `components/ui/**` is exempt from `no-raw-style-literal` because it is "where a token becomes a pixel", and `Icon.tsx` was additionally exempt from the vector-icons ban. The exemption is right for tokens becoming pixels; it silently covered a hex leak and a whole generic icon family. |
| **D · First-run legal** | F-09 | Terms/Privacy were wired where a signed-in player lives (Settings); the pre-shell gates were built later and nobody re-asked. |
| **E · Accepted, documented** | F-10, F-11 | Share text is not UI (an iMessage grid of emoji is the genre). The stale legal copy is unreferenced; deleting a legal document is the founder's call. |

## 4 · Fix plan (as executed)

| Priority | Work | Impact | Guard |
| --- | --- | --- | --- |
| 1 | **F-01** Rewrite all 359 em-dash strings by rule (two clauses → two sentences; explanation → colon/comma; kicker fragments → " · "; placeholder → en dash). Tests asserting old copy updated. | Every toast, hint and refusal in the app; the single most visible tell. | `ttp/no-em-dash-copy` (error) in `tools/eslint-plugin-ttp`; comments are not AST nodes so they stay free. |
| 2 | **F-02/03/04/05/06** Landing: flat paper on every page, a flat rose paper disc behind Rosie, arrows removed, one cream fill for the answer cards, affirmative copy, em dashes gone from titles/meta/prose/JS, the radio card's hover transition dropped. | The public face. | `npm run lint:web` now strips comments and fails on any em dash or `radial-gradient(` in the public landing HTML/CSS/JS. |
| 3 | **F-07** Fourteen hand-cut SVG cases replace the Feather/MCI delegates; `@expo/vector-icons` no longer imported anywhere; `Icon.tsx` loses its lint exemption. | Settings, leaderboard, Sounder card, Judgement Day, bounty board, release notes all read as one hand. | `no-restricted-imports` now covers `Icon.tsx` too. |
| 4 | **F-08** Every hex in the five primitives → `WHIMSY` / `WOOD` tokens, or the new `ART` ramp (theme.ts) for the two illustration-only ramps (tickle token pink/plum, flame). | Governance; zero visible change (`Snout`'s pink *was* `WHIMSY.roseDeep`). | `ART` is the one place an illustration hue may live. |
| 5 | **F-09** `Terms · Privacy` hand-link row under the sign-in card. | Compliance / first impression. | — |
| 6 | **F-13** The bounty card's `✦` / `☁` text marks become the `bless` / `curse` glyphs. | One card row reads as one hand. | — |
| DB | The `patch_open` preset body is also derived and CHECK-pinned on the server. `supabase/migrations/20260922120000_preset_sounder_message_copy.sql` moves the constraint, the sent rows and `send_sounder_coordination()` together (carried forward in full). **Written, not pushed** — needs the founder's "go". Until then the server sends the old body while the picker previews the new one. | Parity. | `__tests__/sounderMessages.test.ts` pins client copy to this file. |
| open | **F-12** Real screenshots on the landing page. Needs a fresh capture set from the simulator pipeline (`docs/screenshots/v1` is five months stale and shows retired screens). | Marketing conversion. | Track as a follow-up. |
| accepted | **F-10, F-11** | — | Logged here. |

## 5 · Verification (after)

Static, because every tell on the list is code-detectable; the landing pages were also
opened in Chrome (`/`, `/terms`) and the fourteen new icons rendered outline + filled in
a preview sheet and inspected.

| Check | Before | After |
| --- | --- | --- |
| `ttp/no-em-dash-copy` hits (app, components, constants, utils, hooks, features) | 359 in 93 files | **0** |
| ESLint errors, whole tree (`ttp/*` + core taste rules) | 2 (the vector-icons import, once un-exempted) | **0** (636 pre-existing warnings, unchanged classes) |
| `@expo/vector-icons` importers | 1 (`Icon.tsx`) | **0** |
| Raw hex in `components/ui/*.tsx` (excluding the `Spotlight` mask luminance) | 63 | **0** |
| Emoji-range characters rendered in shipped UI | 1 (`☁`) | **0** (the streak share's 🔥 is outbound text, accepted) |
| Landing: `radial-gradient(` / animated or hover arrows / rainbow card fills / "not X, it's Y" | 7 / 3 / 4 / 4 | **0 / 0 / 0 / 0** |
| Landing + legal em dashes in reader-facing text | ~70 lines | **0** (`npm run lint:web` proves it; the gate was tested against a fixture) |
| `npm run scorecard` | 255/255 conformant | **255/255** |
| `npm run lint:web` | green (emoji + tokens only) | **green** (now also em dash + orb) |
| `npx tsc --noEmit` | clean | **clean** |
| `npx jest --ci` | 2662 passed | **2671 passed, 2 skipped, 0 failed** (265 suites) |

Still open after this pass: F-12 (real screenshots on the landing page) and the push of
the preset-copy migration.
