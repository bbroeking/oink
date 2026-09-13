# Findings G — Web surfaces (landing/* + analytics-dashboard/*)

Auditor G · 2026-09-11 · audited from source, app not run.

## 1. Area summary

The web is eleven independently-authored HTML/CSS surfaces with **no shared stylesheet and no shared token
file** — the marketing front door (`landing/index.html`), the invite page (`landing/i/`), three legal/feedback
documents, two password-gated internal tools, a redeem page, an adventure click-through prototype, and a
Next.js analytics dashboard. Three of them are genuinely good: the **analytics dashboard** is the only surface
that uses all four TTP typefaces and reads unmistakably as Tickle the Pig; the **adventures click-through**
(`scripts/prototypes/adventures/styles.css`) is the only surface with a designed focus ring, 44px minimum
targets, a reduced-motion block, and zero raw hex outside `:root`; `landing/report.html`'s copy and error
handling are the warmest writing on the web.

The single biggest systemic gap is that **the app's token layer stops at the app boundary**. Every web file
hand-copies a subset of `WHIMSY` into a fresh `:root` block, and the copies have drifted: `WHIMSY.accent`
(`#a13f30`) appears on **zero** web surfaces — two use the hex `theme.ts` explicitly retired for failing AA
(`#c25a3f`), three use `#c0566a`, one uses `#d94a62`, and the landing family uses `rose-deep #f8a8b3` as its
accent at **1.87:1** contrast. `WHIMSY.mute` (`#605449`, 7.05:1) appears nowhere; six files carry `#9a8c7a`
at **3.15:1** under 11–14px body text. The ink-bordered hard-shadow card — one `Sticker` primitive in the app —
is re-declared roughly eighteen times across nine files with **six border widths, sixteen radii and ten
shadow tiers** where the app sanctions one border width, six radii, and exactly two shadows. And `landing/i/`,
the most-shared link in the entire product, ships an emoji.

**Pillar exposure:** the invite page is the whole **Connect** funnel; the redeem page is a **Collect** claim
surface; both are the surfaces most drifted from the system.

---

## 2. Inventory table (P5)

| # | Surface | File | Primitive used | States present | App element doing the same job differently |
| --- | --- | --- | --- | --- | --- |
| 1 | Marketing hero card | `landing/index.html:160` `.card` | hand-rolled (3px/r26/8,8 shadow/−0.6° tilt) | default, `body.shown` fallback, reduced-motion | `Sticker` (2px/`RADII.lg`/`STICKER_SHADOW` 4,4) |
| 2 | Kicker "★ Tickle the Pig ★" | `landing/index.html:190` | hand-rolled | default, twinkle loop | `KICKER_TEXT` / `KICKER_PILL` |
| 3 | Referral code pill | `landing/index.html:374` `.code-pill` | hand-rolled (2.5px/r14/no shadow) | default only | in-app code row |
| 4 | Copy button | `landing/index.html:392` `.copy-btn` | hand-rolled (2.5px/r11/2,2) | default, hover, active, "Copied" | `Button` (sun variant) |
| 5 | Primary CTA | `landing/index.html:407` `.join-btn` | hand-rolled (3px/r15/4,4) | default, hover, active | `Button` primary |
| 6 | Steps panel | `landing/index.html:430` `.steps` | hand-rolled (2.5px/r15) | default | `Sticker` sage |
| 7 | No-code fallback | `landing/index.html:442` `.no-code` | hand-rolled (2.5px/r14) | default | `EmptyState` |
| 8 | SEO answer card ×8 | `landing/index.html:488` `.answer-card` | hand-rolled (2.5px/r18/4,4) + `nth-child` tints | default only | `Sticker` + `RARITY_*` tint pattern |
| 9 | Toast | `landing/index.html:528` `.toast` | hand-rolled pill | hidden, `.show` | in-app toast |
| 10 | Footer | `landing/index.html:519` | hand-rolled, `#756653` | default | — |
| 11 | Invite card | `landing/i/index.html:72` `.card` | hand-rolled, 67 % copy-paste of #1 | default, shown, reduced-motion | duplicate of #1 |
| 12 | Tap-to-copy code pill | `landing/i/index.html:220` | hand-rolled (3px/r18/4,4) | default, hover, active, **copied** | different from #3 on the same site |
| 13 | Legal document shell | `privacy.html:12` / `terms.html:12` (byte-identical) | **none** — plain flow text | default only | `PageHeader` + `Sticker` |
| 14 | Report form: kind cards | `report.html:41` `.kind` | hand-rolled (2px/r14/no shadow) | default, hover, **checked**, focus-visible | `SegmentedControl` |
| 15 | Report form: textarea/input | `report.html:56` | hand-rolled (2px/r14) | default, focus, counter over-limit | in-app text field |
| 16 | Report submit | `report.html:69` `.submit` | hand-rolled, **border:0**, flat `--rose` fill | default, hover, active, disabled | `Button` (ink border + hard shadow) |
| 17 | Report success panel | `report.html:84` `.done` | hand-rolled (2px/r16/no shadow) | success only | `EmptyState` success |
| 18 | Den gate + door cards | `den/index.html:12` | hand-rolled (3px/r22/8,8/tilt) | default, error msg, good msg | `Sticker` |
| 19 | Plan gate | `plan/index.html:9` `.gate` | hand-rolled (3px/r22/8,8/−0.4°) | default, error (border-color only) | `Sticker` |
| 20 | Plan status item | `plan/index.html:20` `.item` | hand-rolled (2.5px/r12/3,3), 5 emoji-coded tints | 5 status variants | `SectionHeader` + status chip |
| 21 | Redeem ticket | `redeem/index.html:14` `main` | hand-rolled, **off-palette** (4px/r28/soft blurred shadow) | default only | `Sticker` |
| 22 | Adventures: sticker family | `scripts/prototypes/adventures/styles.css` | `--shadow` / `--shadow-small` vars, 2px borders | default, hover, focus-visible, disabled, reduced-motion | closest thing to `Sticker` on the web |
| 23 | Dashboard `.sticker` | `analytics-dashboard/app/globals.css:41` | **the one real shared rule** (`--fill`/`--tilt` API) | default only | `Sticker` (2.5px vs 2px, r18 vs r14) |
| 24 | Dashboard stat card | `globals.css:83` + `page.js:18` `<Stat>` | composes `.sticker` | default only | `Sticker` + `Glyph` |
| 25 | Dashboard section header | `globals.css:73` `.sec` (kicker + Caprasimo h2 + rule) | hand-rolled but **faithful** to `SectionHeader`/`TITLE_RULE` | default | `SectionHeader` |
| 26 | Dashboard leaderboard row | `globals.css:120` `.lbrow` | hand-rolled (2.5px/r14/3,3), `nth-child` tilt | default, `.top` | in-app leaderboard row + `ROW_TILTS` |
| 27 | Dashboard bar chart | `globals.css:96–107` + `page.js:282` | hand-rolled | default, empty (no) | none in app |
| 28 | Dashboard empty state | `globals.css:143` `.empty` | PatrickHand line, no sticker, no glyph | empty only | `EmptyState` (sticker + `Glyph` + warm line) |
| 29 | Dashboard error panel | `globals.css:155` + `page.js:182` | composes `.sticker` | error only | `EmptyState` error |
| 30 | Login card | `globals.css:195` | hand-rolled (2.5px/r24/4,4/−1.4°) | default | `Sticker` |
| 31 | Login password field | `globals.css:215` `.pw` | hand-rolled | default, focus (**outline removed**), placeholder | in-app text field |
| 32 | Login submit | `globals.css:231` `.enter` | hand-rolled | default, hover, active, disabled — **no focus** | `Button` |
| — | `landing/mocks/*` (7 files) | — | **throwaway mockups, not audited** — all carry in-page `noindex` | — | — |
| — | `landing/labs/*` (3 files) | — | **throwaway mockups, not audited** — `X-Robots-Tag` noindex in `vercel.json` | — | — |

---

## 3. Findings

### [P0] G-01 · Emoji on the invite page — the most-shared link in the product

**Location** `landing/i/index.html:399`
**Prompt(s)** P2 (design specificity), P10 (d)
**Evidence**
```html
<p class="hint">psst — tap Rosie 🐽</p>
```
**Expected standard** `docs/design/taste-standard.md`: *"No emoji in UI, ever. Use `Glyph` (hand-drawn art) or
`Icon` (SVG). An emoji character in a render is an automatic taste failure."* The P0 definition in
`00-evaluation-prompts.md` names emoji-in-UI explicitly.
**Gap** A vendor-rendered pig-snout emoji sits eight lines below a hand-drawn Rosie PNG on the one page every
new player sees before they have the app. It renders as Apple's snout on iOS, Google's on Android, and a
tofu box on some Windows builds — three different art directions on a page whose entire job is to say "this
game has a look."
**Recommendation** Delete it. The line already works without a mark; if a mark is wanted, ship the same
inline-SVG pattern `analytics-dashboard/app/svg.js` already uses (`GlyphSprite`) so the web has a `Glyph`
equivalent. Add a lint rule to the web lane: no codepoint in `U+1F300–U+1FAFF` or `U+2600–U+27BF` in rendered
text, with `★ ✦ ✧ ♥ ✓ ›` explicitly allowed as the sanctioned dingbat set.
**Pillar** Connect — this is the entire friend-invite funnel.

---

### [P1] G-02 · The landing family is set in Archivo — a typeface that exists nowhere in the game

**Location** `landing/index.html:109,214`; `landing/i/index.html:25`; `landing/privacy.html:11`;
`landing/terms.html:11`; `landing/report.html:11`; `landing/den/index.html:6,15`; `landing/plan/index.html:4,15`
**Prompt(s)** P2, P3 (text readability), P4, P9, P10 (a)
**Evidence**
```
7 of 9 landing pages request:  family=Archivo … &family=Archivo+Black
landing/index.html:130   font-family: "Archivo", -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
landing/index.html:214   font-family: "Archivo Black", "Archivo", sans-serif;   /* the h1 */
landing/redeem/index.html:13  font-family:ui-rounded,"Arial Rounded MT Bold",system-ui,sans-serif;
landing/index.html:386   font-family: "SF Mono", Menlo, monospace;   /* the referral code */
```
**Expected standard** `FONTS` in `constants/theme.ts` — four intentional families, each with a job: Fredoka
(display), Nunito (body), Caprasimo (whimsy titles), PatrickHand (hand kickers). Taste standard: *"Never reach
for a system font."*
**Gap** The public front door and the invite page — the two surfaces that set a first impression — use a
grotesque that appears in no screen of the game, while two non-public surfaces (`adventures`, the dashboard)
already load the real four from Google Fonts and prove it works. `landing/redeem/index.html` goes further and
uses the OS rounded system font; the referral code, the literal hero element of the invite page, is set in the
developer monospace.
**Recommendation** One web font stack, shared: `--font-display: Fredoka`, `--font-body: Nunito`,
`--font-whimsy: Caprasimo`, `--font-hand: "Patrick Hand"` — the exact request string
`analytics-dashboard/app/globals.css:1` already uses. Map `h1/h2/h3 → whimsy`, body → Nunito, kickers → hand,
numerals/CTA → Fredoka. The referral code gets Fredoka with tabular figures, not `SF Mono`.
**Pillar** Connect · Collect — brand recognition is the reason a shared link converts.

---

### [P1] G-03 · `--mute: #9a8c7a` is 3.15:1 on paper and carries 11–14px body text on six files

**Location** `landing/index.html:120` (used at `:354, :371, :443`); `landing/i/index.html:36` (used at
`:216, :297, :330`); `landing/privacy.html:13` (footer `:36`); `landing/terms.html:13`;
`landing/report.html:13` (used at `:50, :63, :89, :131`); `landing/den/index.html:8` (used at `:16, :30, :31`);
`landing/plan/index.html:6` (used at `:16, :18, :25`)
**Prompt(s)** P3 (color contrast), P4, P6
**Evidence**
```css
--mute: #9a8c7a;                      /* 3.15:1 on --paper #fffaf0 — fails WCAG AA (4.5:1) */
.hint { font-size: 11px; color: var(--mute); }        /* landing/index.html:351,354 */
.code-label { font-size: 12px; color: var(--mute); }  /* landing/index.html:366,371 */
.no-code { font-size: 14px; color: var(--mute); }     /* landing/index.html:442-443 */
.kind .k-sub { font-size:13px; color:var(--mute); }   /* landing/report.html:50 */
```
**Expected standard** `WHIMSY.mute = "#605449"` with the comment *"Explicit warm-ink steps avoid
alpha-dependent contrast as surfaces change. `mute` is text-safe across every core pastel."* It measures
**7.05:1** on paper. `WHIMSY.muteSoft = "#8c7e71"` (3.78:1) exists precisely for *"disabled icons, separators,
and other non-body-text UI."*
**Gap** Six files copied a secondary-text hex that is neither of the app's two sanctioned steps and fails AA
under real body copy — including `.no-code`, the paragraph an organic visitor reads first, and `.k-sub`, the
line that explains each option on the report form.
**Recommendation** Publish `--ink-mute: #605449` and `--ink-mute-soft: #8c7e71` from the shared token file and
replace every `--mute` use site. Rule: `--ink-mute-soft` may never be applied to a `<p>`, `<li>`, or any
element under 15px.
**Pillar** Craft / comprehension.

---

### [P1] G-04 · The site kicker is `rose-deep` at 1.87:1 — the lowest-contrast text on the web

**Location** `landing/index.html:190–198` (rendered `:591`); `landing/i/index.html:93–101` (rendered `:366`)
**Prompt(s)** P3, P6, P8 (Von Restorff)
**Evidence**
```css
.kicker { font-size: 13px; letter-spacing: 2px; text-transform: uppercase;
          color: var(--rose-deep); font-weight: 800; }   /* #f8a8b3 on .card background #fff */
```
`#f8a8b3` on `#ffffff` = **1.87:1**. The same pastel is reused for `.sub .arrow` (`:250`) and
`.copy-hint` (`landing/i/index.html:249`).
**Expected standard** `KICKER_TEXT = { ...TYPE.kicker, color: WHIMSY.accent }` — PatrickHand at
`WHIMSY.accent #a13f30`, **6.17:1** on paper. `WHIMSY.roseDeep` is a *fill* token in the app (ear/snout tints,
the sad-mood bar), never a text color.
**Gap** "★ TICKLE THE PIG ★" — the brand line itself — is effectively invisible to a low-vision reader and
washes out in sunlight on a phone. The pastel is doing an accent's job because the landing family never
imported an accent token.
**Recommendation** `--accent: #a13f30` becomes the only kicker/link/emphasis color on the web; pastels
(`rose`, `rose-deep`, `sky`, `sage`, `sun`, `lilac`, `peach`) are **fill-only** tokens and the shared stylesheet
should never assign them to `color:`. Kickers pick up the hand font per G-02.
**Pillar** Connect — the brand line is the first two seconds.

---

### [P1] G-05 · Both token-literate surfaces use `#c25a3f`, the accent `theme.ts` explicitly retired

**Location** `analytics-dashboard/app/globals.css:14`; `scripts/prototypes/adventures/styles.css:13`
(shipped at `landing/adventures/adventures.css:1`)
**Prompt(s)** P3, P4, P6
**Evidence**
```css
--accent:#c25a3f;
/* dashboard use sites, all small text on tinted sticker fills: */
.stat .sub   { font-size:14px;   color:var(--accent); }  /* globals.css:86  — on sun/rose/peach/lilac */
.glabel .mo  { font-size:11px;   color:var(--accent); }  /* globals.css:107 */
.lbrow .pts small { font-size:11.5px; color:var(--accent); } /* globals.css:134 */
.mval small  { font-size:11px;   color:var(--accent); }  /* globals.css:116 */
.lbrow .rank { color:var(--accent); }                    /* globals.css:127 */
```
Measured: `#c25a3f` on `--sun #ffd87a` = **3.18:1** · on `--rose #ffd6dc` = **3.29:1** · on `--peach #ffc8a8` =
**2.92:1** · on `--lilac #d6c8f0` = **2.77:1** · on paper = 4.18:1. All fail AA at these sizes.
**Expected standard** `constants/theme.ts:17–19` — *"Interactive terracotta. Dark enough for normal-size text
on paper and rose surfaces (**the previous `#c25a3f` missed AA on paper**)."* `WHIMSY.accent = "#a13f30"`
measures 6.17:1 on paper and 5.64:1 on cream.
**Gap** The app fixed this hex and wrote down why; both web surfaces still carry the old value, and the
dashboard places it at 11–14px on top of the four *most* saturated fills in the palette. This is the exact
governance erosion the taste standard names: the token moved, the copies didn't.
**Recommendation** `--accent: #a13f30` in the shared token file, deleted from every local `:root`. Add the
companion rule the app already implies: **accent-on-pastel is only legal at `TYPE.cardTitle` size or above**;
small captions on a tinted sticker use `--ink-mute`.
**Pillar** Craft — and it is the specific drift the parity question asked about.

---

### [P1] G-06 · No shared stylesheet: the sticker card is re-declared ~18 times across 9 files

**Location** `landing/index.html:160, 374, 430, 442, 488`; `landing/i/index.html:72, 220, 281, 299`;
`landing/report.html:41, 56, 69, 84`; `landing/den/index.html:12, 14, 17, 19`; `landing/plan/index.html:9, 20`;
`landing/redeem/index.html:14, 20, 22`; `analytics-dashboard/app/globals.css:41, 120, 195, 215, 231`;
`scripts/prototypes/adventures/styles.css` (`--shadow` family)
**Prompt(s)** P4, P5, P8 (Gestalt similarity), P10 (i)
**Evidence** — measured across the nine audited files:

| Property | App sanctions | Web ships |
| --- | --- | --- |
| Border width | `2` (the sticker law) | `1px` ×2 · `1.5px` ×3 · `2px` ×28 · `2.5px` ×20 · `3px` ×10 · `4px` ×1 |
| Radius | `RADII` = 8 · 12 · 14 · 18 · 22 · 999 | `2 · 4 · 5 · 10 · 11 · 12 · 14 · 15 · 16 · 18 · 20 · 22 · 24 · 26 · 28 · 999` (16 values) |
| Shadow | exactly two: `4,4/0` and `2,2/0` | `8,8` ×5 · `5,5` ×3 · `4,4` ×6 · `3,3` ×7 · `2,2` ×4 · `1.5,1.5` ×4 · `1,1` ×4 · `0 5px 0` ×1 · `0 12px 0 rgba(…,.16)` ×1 · `drop-shadow(3px 3px 0 rgba(42,31,21,.18))` ×2 |

`landing/index.html` alone uses **six** shadow tiers (`8,8` card · `5,5` CTA hover · `4,4` CTA · `3,3` copy hover
· `2,2` copy · `1,1` CTA active). The card is 3px/r26/8,8; the answer card twenty lines of HTML later is
2.5px/r18/4,4.
**Expected standard** Taste standard: *"Everything lives on a `Sticker` / `Tape` primitive — 2px ink border,
hand-drawn tilt (±0.5–1.5°), hard offset drop-shadow"* and *"Two shadow tiers, both hard … No new shadow tiers."*
**Gap** There is no shared source of truth at all: each HTML file hand-copies a subset of `WHIMSY` into a fresh
`:root` and then re-invents the card. Nothing enforces the two-tier shadow rule because nothing is shared. The
dashboard's `.sticker` rule (`globals.css:41`, with its `--fill`/`--tilt` custom-property API) is the only
correct-shaped abstraction on the whole web and it is used by exactly one app.
**Recommendation** Ship `web/tokens.css` + `web/sticker.css` (see **System asks**). One `.sticker` rule with
`--fill` / `--tilt` / `--shadow` (`sm` | `lg`) — lifted verbatim from `globals.css:41` but corrected to
`border-width: 2px` and `border-radius: var(--radius-lg)` — imported by every page including the legal docs.
Delete all 18 local declarations.
**Pillar** Craft — this is the root cause of G-03, G-04, G-05 and G-07.

---

### [P1] G-07 · `landing/redeem/` is off-palette entirely — a claim surface that is not a TTP surface

**Location** `landing/redeem/index.html:9–24`
**Prompt(s)** P2, P3, P4, P10 (f, i)
**Evidence**
```css
:root { color-scheme:light; --ink:#442d38; --pink:#ffd7df; --cream:#fff8e8; --red:#d94a62; }
body  { font-family:ui-rounded,"Arial Rounded MT Bold",system-ui,sans-serif; }
main  { border:4px solid var(--ink); border-radius:28px; box-shadow:0 12px 0 rgba(68,45,56,.16); }
.code { border:3px dashed #e7a331; border-radius:16px; background:#fff5c7; font:900 24px/1 ui-monospace,…; }
a     { border-radius:15px; color:white; background:var(--red); box-shadow:0 5px 0 #9d3045; }
```
**Expected standard** `WHIMSY.ink #2a1f15`, `WHIMSY.paper #fffaf0`, 2px border, `RADII`, `STICKER_SHADOW`
(4,4 offset, radius 0, opacity 1), the four fonts. Taste standard: *"One palette: WHIMSY … New color = a token,
never a fresh hex."*
**Gap** Every single value is a fresh hex: a plum ink (`#442d38`), a candy red (`#d94a62`), an amber dashed
border (`#e7a331`), a shadow that is **downward and translucent** (`0 12px 0 rgba(68,45,56,.16)`) rather than
the offset-diagonal opaque sticker shadow, a 4px border, a 28px radius, and the OS rounded system font. The
CTA's contrast (white on `#d94a62`) is **4.11:1** — fails AA at its inherited 16px size — and the `.kicker`
at `#d94a62` on `#fffdf8` is **4.05:1**. This is a **Collect** claim surface a real player reaches from an
event code, and it looks like a different company's page.
**Recommendation** Rebuild from the shared stylesheet: `.sticker` card, `--sun` code chip with the 2px ink
border, `Button` CTA in `--sun`/`--lilac` with `--accent` ink text. Add the rule: *any page that can appear in
a player's hands imports `web/tokens.css`; no page declares its own `:root`.*
**Pillar** Collect — claiming a Golden Ticket is a collection moment and it should feel like the shop, not a
coupon site.

---

### [P1] G-08 · The dashboard's two interactive elements have no keyboard focus indicator

**Location** `analytics-dashboard/app/globals.css:225–230, 231–242`; used at `login/page.js:41–55`
**Prompt(s)** P1 (h4/h6), P6, P8 (Jakob)
**Evidence**
```css
.pw:focus { outline:none; border-color:var(--accent); transform:translate(1px,1px); box-shadow:2px 2px 0 var(--ink); }
.enter { … }                      /* no :focus / :focus-visible rule anywhere */
.enter:hover  { transform:translate(4px,4px); box-shadow:0 0 0 var(--accent); }
.enter:active { transform:translate(4px,4px); box-shadow:0 0 0 var(--accent); }
```
**Expected standard** `scripts/prototypes/adventures/styles.css:36` shows the intended treatment:
`button:focus-visible, input:focus-visible { outline: 4px solid var(--focus); outline-offset: 3px; }`
**Gap** The login page has exactly two focusable controls; one kills its outline and substitutes a border-color
swap from `#2a1f15` to `#c25a3f` (both dark on cream — a barely perceptible change), the other has no focus
state at all, so a keyboard user tabbing to "Enter" sees nothing move. Secondary but related: `.enter:hover`
translates the button **into** its shadow (the pressed look) while `landing/index.html:405,427` translate the
opposite way on hover — the same gesture means "pressed" on one surface and "lifted" on the other.
**Recommendation** Promote the adventures rule to the shared stylesheet as the global focus token:
`--focus` + `button:focus-visible, a:focus-visible, input:focus-visible, [tabindex]:focus-visible { outline: 3px
solid var(--focus); outline-offset: 2px; }`. Never `outline: none` without a replacement of equal prominence.
Codify one press metaphor: **hover lifts (shadow grows), active presses (translate into shadow)**.
**Pillar** Craft.

---

### [P1] G-09 · "Send another" is a hrefless `<a>` — keyboard users can't reset the report form

**Location** `landing/report.html:149` (styled `:91`, handler `:242`)
**Prompt(s)** P1 (h3 user control), P6
**Evidence**
```html
<p class="again"><a id="again">Send another ›</a></p>
```
```css
.done .again a { color:var(--rose); text-decoration:none; font-weight:700; cursor:pointer; }
```
**Expected standard** Every interactive element is reachable by keyboard, exposes a role, and is ≥44pt.
**Gap** An `<a>` without `href` is not in the tab order and exposes no role, so the only escape from the success
state is a page reload. The surrounding text is 14px with no padding, so the hit area is roughly 18px tall on
touch as well. `.note.ok { color:#5A8338 }` (`:82`) is also a raw hex lifted from the legacy `COLORS.successText`
rather than a token.
**Recommendation** `<button type="button" class="text-button">` — and add a shared `.text-button` primitive
(`scripts/prototypes/adventures/styles.css` already has one at `min-height:44px`) so no web surface ever styles
a link to look like a button again.
**Pillar** Craft.

---

### [P1] G-10 · `landing/i/index.html` is a 67 % copy of `landing/index.html` and has already drifted

**Location** `landing/index.html` (826 lines) vs `landing/i/index.html` (539 lines) — **364 identical lines**
**Prompt(s)** P4, P5, P9
**Evidence** The confetti-star generator (`index:706–721` / `i:409–424`), the tickle-Rosie block
(`index:724–761` / `i:427–464`), `legacyCopy` / `showToast`, and ~200 lines of CSS are byte-identical. Where they
differ, they have **diverged rather than specialised**:

| | `landing/index.html` | `landing/i/index.html` |
| --- | --- | --- |
| `.code-pill` | `2.5px` / `r14` / no shadow (`:374`) | `3px` / `r18` / `4,4` shadow (`:220`) |
| copy affordance | a separate `.copy-btn` (`:392`) | the pill itself is the button (`:220`) |
| copied feedback | button label → "Copied" | `#3f9d5a` green text (`:253`), **2.97:1** on cream |
| emoji | none | `🐽` (`:399`) |
| favicon | none | none |

**Expected standard** One primitive, one behaviour. The app solves this with `Sticker` + `Button`.
**Gap** Two pages that do the same job (show a code, copy it, send to the App Store) have two different code
pills, two different copy interactions, and two different success colors — one of which fails AA. Any future
copy-flow fix has to be made twice and will be made once.
**Recommendation** Extract `web/tokens.css`, `web/sticker.css`, and `web/tickle.js` (confetti + tickle + copy +
toast). `/` and `/i/` become thin pages that import all three and differ only in copy and which block is shown.
**Pillar** Connect.

---

### [P2] G-11 · Emoji on the two internal gated surfaces

**Location** `landing/den/index.html:35` (`the den 🐽`); `landing/plan/index.html:28` (`the plan 🐷`),
`:30` (`🔴 🟡 🟢 🔵 💭` legend chips), `:31` (the same five repeated ~30× as status dots)
**Prompt(s)** P2, P10 (d)
**Evidence**
```html
<span class="lg blocked">🔴 blocked on you</span><span class="lg ready">🟡 staged / ready</span>…
<div class="item blocked"><span class="dot">🔴</span><span><strong>ASC: pull 1.3 from review</strong>…
```
**Gap** Same rule as G-01, on internal tools rather than a player surface — hence P2. The status dots are also
redundant with the `.blocked`/`.ready`/`.done`/`.planned`/`.decision` tint classes already on the same element
(`plan/index.html:23`), so the emoji adds nothing the color doesn't already say.
**Recommendation** `landing/plan/index.html` is generated by `tools/build_roadmap.mjs` — change the generator
to emit `<span class="dot" aria-hidden="true"></span>` styled as a 10px ink-bordered circle filled with the
status tint, plus a visually-hidden status word for screen readers. Drop `🐽`/`🐷` from the two gate titles.
**Pillar** Craft.

---

### [P2] G-12 · The public front door and the invite page ship no favicon

**Location** `landing/index.html` (no `rel="icon"`); `landing/i/index.html`; `landing/den/index.html`;
`landing/plan/index.html`; `landing/redeem/index.html`
**Prompt(s)** P2, P9
**Evidence** `privacy.html:8`, `terms.html:8`, `report.html:8` all carry `<link rel="icon" href="/rosie.png" />`;
the five pages above carry none. `landing/rosie.png` exists and is already served.
**Gap** The two highest-traffic pages show a generic browser globe in the tab and in bookmarks/shares, while
the privacy policy shows Rosie. Backwards.
**Recommendation** `<link rel="icon" href="/rosie.png">` + `<link rel="apple-touch-icon">` in the shared head
partial. Ship a proper 32/180px favicon crop rather than the full 370×383 PNG.
**Pillar** Connect.

---

### [P2] G-13 · Touch targets under 44pt on the mobile landing surfaces

**Location** `landing/index.html:392–404` (`.copy-btn`), `:519–526` (footer links);
`landing/den/index.html:17,19`; `landing/plan/index.html:10,11`; `landing/privacy.html:36–38` (footer)
**Prompt(s)** P6, P8 (Fitts)
**Evidence**
```css
.copy-btn { padding: 9px 16px; font-size: 14px; border: 2.5px solid var(--ink); }   /* ≈ 40px tall */
button    { padding:10px; font-size:15px; }        /* den:19 · plan:11 — ≈ 40px */
input     { padding:9px 12px; font-size:15px; }    /* den:17 — ≈ 38px */
footer a  { font-size:13px; }                      /* index:523 — inline, ≈ 18px tall */
footer.site a { font-size:14px; }                  /* privacy:36 — inline, ≈ 19px tall */
```
**Expected standard** 44pt minimum. `scripts/prototypes/adventures/styles.css` gets this right —
`.brand-link { min-height:44px }`, `.text-button { min-height:44px }`, both re-asserted in the 520px media query.
**Gap** The copy button on the referral flow is the single most important tap on `landing/index.html` when a
code is present, and it is ~40px. Every legal/footer link on every page is an inline 13–14px run.
**Recommendation** `min-height: 44px; display: inline-flex; align-items: center;` on the shared `.btn`,
`.text-button`, and footer link rules. Footer links get `padding: 10px 4px`.
**Pillar** Connect.

---

### [P2] G-14 · No designed focus ring anywhere in the landing family

**Location** `landing/index.html` (`.copy-btn`, `.join-btn`, `.rosie-stage[tabindex=0]:600`),
`landing/i/index.html` (`.code-pill[tabindex=0]:375`, `.rosie-stage:370`), `landing/den/index.html`,
`landing/plan/index.html`, `landing/redeem/index.html` — zero `:focus` or `:focus-visible` rules in any of them
**Prompt(s)** P6
**Evidence** `landing/index.html:272` also sets `-webkit-tap-highlight-color: transparent` on the Rosie stage,
removing the only mobile press feedback the browser would give the `div[role=button]`.
**Expected standard** As G-08. Only `scripts/prototypes/adventures/styles.css:36` has one, and it uses
`--focus: #16729c` (`:16`) — a hue with **no corresponding app token**.
**Gap** Two `div[role="button"][tabindex="0"]` custom controls (the Rosie stage, the tap-to-copy pill) rely
entirely on the UA default ring against a white card.
**Recommendation** Shared focus token (G-08) applied globally. Add `--focus` to `theme.ts` as `UI_COLORS.focus`
so the app and the web share the value instead of the web inventing one.
**Pillar** Craft.

---

### [P2] G-15 · The dashboard chart is mouse-only and has no text alternative

**Location** `analytics-dashboard/app/globals.css:101–107`; `app/page.js:291–319`
**Prompt(s)** P1 (h1, h6), P6
**Evidence**
```jsx
<div className="plot-scroll">            {/* overflow-x:auto, no tabindex / role / aria-label */}
  <div className="plot">                 {/* min-width:680px */}
    <div className="bar" style={{height:…, background:s.color}} title={`${s.name}: ${v}`} />
```
**Expected standard** A scrollable region must be keyboard-reachable; data conveyed only by color and hover
needs a text equivalent.
**Gap** Fourteen days × six series = 84 values reachable only by hovering a `title` tooltip. On a phone the
680px plot scrolls horizontally inside a container a keyboard cannot reach. The six legend swatches
(`globals.css:100`) are the only mapping from color to series and are never repeated at the bar.
**Recommendation** `tabIndex={0} role="group" aria-label="Daily activity, last 14 days"` on `.plot-scroll`;
render a visually-hidden `<table>` of the same series as the accessible alternative; give each bar
`aria-hidden="true"`. Add this to the system as a **`Chart`** primitive rule: every chart ships a table.
**Pillar** Craft.

---

### [P2] G-16 · Decorative SVGs are unlabelled and semi-labelled inconsistently

**Location** `analytics-dashboard/app/svg.js:4–25` (`Rosie`), `:29+` (`GlyphSprite`);
`app/page.js:8–16` (`Glyph`), `:105–107`, `:133`, `:331`, `:342`, `:392`, `:401`, `:419`, `:428`, `:450`, `:459`
**Prompt(s)** P6
**Evidence**
```jsx
<svg className="rosie" width={size} height={size} viewBox="0 0 76 76" aria-label="Rosie">   {/* no role="img" */}
<span className="glyph"><svg><use href={`#${id}`} /></svg></span>                           {/* no aria-hidden */}
<svg className="crown"><use href="#i-crown" /></svg>                                        {/* page.js:105 */}
```
**Gap** `aria-label` on an `<svg>` without `role="img"` is inconsistently exposed across screen readers, and the
purely decorative stat/panel glyphs are announced as unnamed graphics. The crown at `page.js:105` is the *only*
visual marker of rank 1 and carries no accessible name at all.
**Recommendation** Two rules for the web `Glyph`/`Icon` equivalent: decorative → `aria-hidden="true"`,
meaningful → `role="img"` + `<title>`. `GlyphSprite` is already correct (`aria-hidden="true"` at `svg.js:30`);
apply the same to the consumers.
**Pillar** Craft.

---

### [P2] G-17 · `--rose` names three different colors across the web

**Location** `landing/index.html:115` · `landing/i/index.html:31` · `landing/den/index.html:8` (`#ffd6dc`);
`landing/privacy.html:13` · `landing/terms.html:13` · `landing/report.html:13` (`#c0566a`);
`landing/redeem/index.html:9` (`--pink:#ffd7df` + `--red:#d94a62`)
**Prompt(s)** P4, P9
**Evidence**
```css
--rose: #ffd6dc;   /* pastel fill  — landing, den, i */
--rose:#c0566a;    /* link/CTA red — privacy, terms, report  (4.22:1 on paper: fails AA) */
--pink:#ffd7df;    /* the pastel again, renamed and shifted one step in green — redeem */
```
`--rose #c0566a` also serves as the report form's submit background with white text: **4.39:1**, fails AA.
**Expected standard** `WHIMSY.rose` is a single pastel fill; interactive red is `WHIMSY.accent`; danger text is
`UI_COLORS.dangerText #983a2c`.
**Gap** A developer reading `var(--rose)` on the web cannot know what it means without opening the file. The
legal pages use the *name* of a fill token for their *link and button* color, which is why those links fail AA.
**Recommendation** One namespace, roles not paint: `--fill-rose`, `--fill-sky`, `--fill-sage`, `--fill-sun`,
`--fill-lilac`, `--fill-peach` for surfaces; `--accent`, `--ink`, `--ink-mute`, `--danger-text` for text. No
web file redefines a token name.
**Pillar** Craft.

---

### [P2] G-18 · The legal + report pages have no paper-craft DNA at all — design-specificity FAIL

**Location** `landing/privacy.html:12–39`; `landing/terms.html:12–39` (byte-identical style blocks);
`landing/report.html:12–92`
**Prompt(s)** P2, P10 (f, g, h, i)
**Evidence** Across all three: **zero** `transform: rotate()`, **zero** offset `box-shadow`, no Caprasimo, no
PatrickHand, no kicker, no `Glyph`. The entire visual language is `h1{font-size:30px;font-weight:800}` +
`border-bottom:2px solid #ece0cc` + a `--rose` link. The only TTP element on the page is the 34px `rosie.png`
in the header (`:43`).
**Verdict (P2)** **FAIL** — this composition, interaction, and visual language could be dropped into any
indie SaaS product unchanged. The two questions: it serves no pillar visibly, and a designer who knows this
game would not ship a warm-paper background gradient under an otherwise generic document.
**Gap** The report form in particular is a *feedback* surface — a Connect moment where a player whispers to the
founder — and its copy knows this ("whisper it here", "the founder reads every one", "a passing pig") while its
visual design does not. The flat borderless red submit button (`report.html:69–73`, `border:0`) is the single
most un-TTP element on the web.
**Recommendation** Legal pages are allowed to be quiet, but quiet is not the same as generic: give them the
`PageHeader` crown (uppercase hand kicker + Caprasimo title + `TITLE_RULE`), set body text in Nunito, set the
link color to `--accent`. The report form gets the real thing: `.sticker` shell, `SegmentedControl`-shaped
kind picker, `Button`-shaped submit with the 2px ink border and `2,2` shadow, and an `EmptyState`-shaped
success panel with a `Glyph`.
**Pillar** Connect (report) · trust (legal).

---

### [P2] G-19 · The dashboard has no reduced-motion block and several fixed-width text containers

**Location** `analytics-dashboard/app/globals.css` (no `prefers-reduced-motion` anywhere; `@keyframes shake` at
`:251`); fixed widths at `:112` (`width:74px`), `:115` (`width:78px`), `:127` (`width:24px`), `:68`, `:131`,
`:140`, `:148`, `:246` (`white-space:nowrap`); `:212` (`opacity:.5` on text)
**Prompt(s)** P6 (reduce motion, 200 % text)
**Evidence**
```css
.mrow .ml { font-size:14px; width:74px; flex:0 0 auto; }
.mval     { font-size:15px; width:78px; flex:0 0 auto; }
.lbrow .rank { font-size:18px; width:24px; flex:0 0 auto; }
.login-err   { white-space:nowrap; }
.login-card .sub { color:var(--ink); opacity:.5; }   /* ≈ 2.86:1 on --cream */
```
`landing/index.html:577`, `landing/i/index.html:355` and `styles.css:503` all *do* have the reduced-motion
block; the dashboard is the outlier. `landing/index.html:221–222,243` also `white-space:nowrap` the h1 lines
and the "Connect. Collect. Contend." subtitle.
**Gap** At 200 % browser zoom the mood-row label (74px for "Neutral"), the value column (78px for
"1,234 100%"), and the rank column (24px for a two-digit rank) all clip. `.login-card .sub` uses
`opacity:.5` on ink — the alpha-dependent contrast `theme.ts:19–22` was written to avoid.
**Recommendation** Add the shared reduced-motion block. Replace fixed pixel widths with `min-width` + `ch`
units. Replace `opacity` on text with `color: var(--ink-mute)`. Add a rule: **opacity is never a text color**.
**Pillar** Craft.

---

### [P3] G-20 · One-off hexes bypassing even the local `:root`

**Location** `landing/index.html:465` (`#7f6d5a`), `:495–498` (`#fff7dc #fff0f2 #edf6e9 #f2edfb`),
`:522` (`#756653`); `landing/i/index.html:253` (`#3f9d5a`); `landing/report.html:47` (`#d9c8ab`), `:51`
(`#fff4f5`), `:82` (`#5A8338`); `landing/den/index.html:23` (`#b0483e`, `#4a7a43`);
`landing/plan/index.html:17,23,39` (`#ffe0e4 #f6d4cf #ffe6a8 #cfe6c4 #cfe0f2 #e6dbf2 #b0483e`)
**Prompt(s)** P4
**Evidence** The four `.answer-card:nth-child(4n+…)` tints at `landing/index.html:495–498` are hand-mixed
near-duplicates of `WHIMSY.sun / rose / sage / lilac` lightened — the same "five files hand-mixed this pair
off-palette" pattern `theme.ts:38–44` documents and fixed for `bless`/`curseGreen`.
**Recommendation** Add `--fill-*-soft` variants (the light end of each pastel, mirroring `RARITY_GRADIENT`'s
top-light/bottom-darker pair) to the shared token file and delete the one-offs. Success/danger text picks up
`UI_COLORS.successText #476436` / `dangerText #983a2c`.
**Pillar** Craft.

---

### [P3] G-21 · Naming and capitalisation drift across surfaces

**Location** `landing/index.html:591` (`★ Tickle the Pig ★`, upper-cased in CSS `:196`);
`analytics-dashboard/app/page.js:177,235,244,…` (`★ tickle the pig`, `★ the herd` — lowercase);
`landing/den/index.html:35` (`the den`); `landing/plan/index.html:28` (`the plan`);
`landing/redeem/index.html:17` (`Golden Ticket`, Title Case); `landing/index.html:655` ("Sounder") vs
`landing/i/index.html:373,376` ("herd")
**Prompt(s)** P9
**Evidence** Four kicker conventions on five surfaces: `UPPERCASE` (landing), `★ lowercase` (dashboard),
`Title Case` (redeem), bare lowercase titles (den/plan). More materially, the marketing page calls the crew a
**Sounder** (`:655` "Join a Sounder", "Your Sounder is your crew") while the invite page calls it a **herd**
(`:373` "A friend saved you a spot in their herd", `:376` "Your friend's herd code") — a player who reads the
site and then opens the invite meets two names for the same thing before they install.
**Recommendation** Codify in the taste standard: kickers are `★ lowercase hand` (the dashboard's convention,
which matches `KICKER_TEXT`'s PatrickHand intent); `KICKER_PILL`'s uppercase is for tracked pill kickers only.
Pick one player-facing noun for the crew and sweep both pages — `CONTEXT.md` should arbitrate.
**Pillar** Connect — a shared vocabulary is what makes a group feel like a group.

---

### [P3] G-22 · Discovery affordance for the tickle interaction is weak and mis-placed

**Location** `landing/index.html:636` (`<p class="hint">psst — tap Rosie</p>`), styled `:349–358`
**Prompt(s)** P7, P8 (Fitts, proximity)
**Evidence** The hint is `font-size: 11px; color: var(--mute)` (3.15:1 — see G-03) and lives **outside** the
`.card` element (`:636`, after `</div>` at `:634`) while its target, `#rosieStage`, is inside it at `:600`.
On `landing/i/index.html:399` the hint is correctly inside the card.
**Gap** The one delightful interaction on the marketing page — the thing that demonstrates what the game
*feels* like — is announced by the lowest-contrast, smallest text on the page, separated from its target by the
card's 3px border and 8px shadow. Gestalt proximity works against it.
**Recommendation** Move the hint inside the card directly under the Rosie stage (as `/i/` already does), set it
in PatrickHand at `TYPE.kicker` size in `--accent`, and give the stage a resting idle cue.
**Pillar** Connect.

---

### [P3] G-23 · Route hygiene: `/report` is indexable but unlisted; `landing/mocks` has no header-level noindex

**Location** `landing/sitemap.xml` (3 URLs); `landing/vercel.json:12–33` (`X-Robots-Tag` for `/labs/*` and
`/adventures*` only); `landing/report.html:7` (`<meta name="robots" content="index,follow" />`)
**Prompt(s)** P9
**Gap** `/report` declares itself indexable but is absent from the sitemap; all seven `landing/mocks/*.html`
carry an in-page `noindex` but, unlike `/labs`, get no `X-Robots-Tag` from `vercel.json`.
**Recommendation** Add `/report` to `sitemap.xml`; add a `/mocks/(.*)` entry to the `vercel.json` headers block
alongside `/labs/(.*)`.
**Pillar** —

---

## 4. Heuristic scorecards (P1, 0–4)

### `landing/index.html` — the marketing front door

| # | Heuristic | Score | Note |
| --- | --- | --- | --- |
| 1 | Visibility of system status | 3 | Toast + "Copied" label are good; nothing signals the referral branch is live until the code renders |
| 2 | Match to the real world | 4 | Rosie, snouts, Sounder, "psst" — the copy is the strongest thing on the page |
| 3 | User control and freedom | 3 | Nothing destructive; toast auto-dismisses at 1.6 s with no pause |
| 4 | Consistency and standards | **1** | Archivo (G-02), six shadow tiers on one page (G-06), two different code pills vs `/i/` (G-10) |
| 5 | Error prevention | 3 | `PATTERN` validates the code before showing it; `legacyCopy` fallback |
| 6 | Recognition over recall | 3 | The 3-step redeem list is explicit |
| 7 | Flexibility and efficiency | 3 | Clipboard pre-warm for the in-app sniff (`:796`) is a genuinely clever shortcut |
| 8 | Aesthetic and minimalist | 3 | Hero card is charming; the SEO answer-hub below it is a second, flatter design language |
| 9 | Recognise/diagnose errors | **2** | `legacyCopy()` swallows its exception (`:821`) and still calls `done()` — a failed copy reports success |
| 10 | Help and documentation | 3 | Privacy/Terms/Report in the footer |

### `analytics-dashboard` (`page.js` + `globals.css` + `login/`)

| # | Heuristic | Score | Note |
| --- | --- | --- | --- |
| 1 | Visibility of system status | 3 | "updated {gen}" pill; `force-dynamic` means a blank wait with no loading beat |
| 2 | Match to the real world | 4 | "the herd", "the schism", "goblin kings", "tickles missed" — excellent |
| 3 | User control and freedom | **1** | No sign-out, no date range, no refresh, no sort; login has no recovery path |
| 4 | Consistency and standards | 3 | Strong internal consistency; drifts from the app on `--accent` (G-05) and `2.5px` borders |
| 5 | Error prevention | 3 | — |
| 6 | Recognition over recall | 3 | Glyphs unlabelled (G-16); legend not repeated at the bars (G-15) |
| 7 | Flexibility and efficiency | **1** | Zero filtering, sorting, or range controls |
| 8 | Aesthetic and minimalist | **4** | The best web surface — `.sticker` API, `ROW_TILTS`-style alternating tilt, `.sec` header matching `SectionHeader`/`TITLE_RULE` |
| 9 | Recognise/diagnose errors | 3 | `errpanel` (`page.js:182–189`) is warm, specific, and names the missing migration |
| 10 | Help and documentation | 2 | The happiness-decay explainer (`page.js:359`) is good; nothing else is explained |

### `landing/report.html` — the feedback form

| # | Heuristic | Score | Note |
| --- | --- | --- | --- |
| 1 | Visibility of system status | **4** | Live counter, "Sending…", `role="status" aria-live="polite"` (`:143`) |
| 2 | Match to the real world | **4** | "whisper", "the bog", "a passing pig", "folded into the Den" |
| 3 | User control and freedom | 2 | No route back from success except the non-focusable "Send another" (G-09) |
| 4 | Consistency and standards | **1** | No TTP DNA (G-18); flat borderless red button |
| 5 | Error prevention | **4** | `novalidate` + own checks + honeypot + `maxlength` + `minlength` |
| 6 | Recognition over recall | 4 | Three labelled kinds with sub-descriptions |
| 7 | Flexibility and efficiency | 3 | No account required — right call |
| 8 | Aesthetic and minimalist | 3 | Clean, but generic |
| 9 | Recognise/diagnose errors | **4** | The `REASONS` map (`:189–194`) is warm and specific per failure |
| 10 | Help and documentation | 3 | The lede explains where it goes and who reads it |

---

## 5. Token triage table (P4) — web vs `constants/theme.ts`

### 5a · Color parity

| App token | App value | Web equivalent(s) found | Verdict |
| --- | --- | --- | --- |
| `WHIMSY.ink` | `#2a1f15` | `--ink` in 8 of 9 files ✓; `#442d38` in `redeem:9` | **drift (1 file)** |
| `WHIMSY.paper` | `#fffaf0` | `--paper` ✓ 8 files; `#fffdf8`/`#fff8e8` in `redeem` | **drift (1 file)** |
| `WHIMSY.cream` | `#fbeee2` | ✓ `globals.css:6`, `styles.css:5`; **`#f7efe1`** in `index:114`, `i:30` | **drift (2 files)** |
| `WHIMSY.cream2` | `#f6e6d4` | ✓ `globals.css:7` only | partial |
| `WHIMSY.rose` | `#ffd6dc` | ✓ `index`, `i`, `den`, `globals`, `styles`; `#ffd7df` in `redeem`; **name reused for `#c0566a`** in privacy/terms/report | **collision (G-17)** |
| `WHIMSY.roseDeep` | `#f8a8b3` | ✓ where present — but used as *text* at 1.87:1 (G-04) | **misuse** |
| `WHIMSY.sky` | `#c8e3f0` | ✓ `globals:9`, `styles:9`; absent from the landing family | partial |
| `WHIMSY.sage` | `#c9dec1` | ✓ `index:117`, `den:8`, `globals:10`, `styles:10` | ✓ |
| `WHIMSY.sun` | `#ffd87a` | ✓ all five that define it | ✓ |
| `WHIMSY.lilac` | `#d6c8f0` | ✓ `index:119`, `i:35`, `globals:12`, `styles:12` | ✓ |
| `WHIMSY.lilacDeep` / `angel` | `#a89bff` | ✓ `globals:12` only | partial |
| `WHIMSY.peach` | `#ffc8a8` | ✓ `globals:13` only | partial |
| **`WHIMSY.accent`** | **`#a13f30`** | **zero web files.** `#c25a3f` (retired) ×2; `#c0566a` ×3; `#d94a62` ×1; `rose-deep` as de-facto accent ×2 | **FAIL (G-04, G-05)** |
| **`WHIMSY.mute`** | **`#605449`** | **zero web files.** `#9a8c7a` ×6 (3.15:1); `--ink-soft #67584b` ×1 | **FAIL (G-03)** |
| `WHIMSY.muteSoft` | `#8c7e71` | zero | missing |
| `WHIMSY.bark` / `barkText` | `#3a2c1e` / `#fff3e2` | ✓ exact, `styles.css:14–15` | ✓ |
| `WHIMSY.goblin` | `#d4a437` | ✓ `--gold`, `globals:15` | ✓ |
| `COLORS.barn` / `grass` | `#C44848` / `#8FBF6A` | `globals:16–17` — from the **legacy** `COLORS` palette the app is retiring | legacy |
| *(no app token)* | — | `--grey #b8ad9e` · `--line #ece0cc` · `--cream-deep #ead8c1` · `--focus #16729c` · `--red #d94a62` · `#e7a331` · `#9d3045` | **6 untokenised roles** |

### 5b · Type, radius, border, shadow

| Axis | App standard | Web reality | Verdict |
| --- | --- | --- | --- |
| Fonts | 4 (`Fredoka`, `Nunito`, `Caprasimo`, `PatrickHand`) | Landing family: **Archivo + Archivo Black** (7 files). `redeem`: `ui-rounded` system. Code: `SF Mono`. Dashboard: all 4 ✓. Adventures: 3 of 4 (no Fredoka) | **FAIL (G-02)** |
| Type roles | 15 named `TYPE.*` roles | **zero role composition anywhere.** 25 distinct `font-size` literals incl. half-pixel values `11.5 · 12.5 · 13.5 · 14.5 · 15.5` that exist in no `TYPE` role | **FAIL** |
| Radius | `RADII` 8·12·14·18·22·999 | 16 values: `2·4·5·10·11·12·14·15·16·18·20·22·24·26·28·999`. On-scale: 12·14·18·22·999. Off-scale: 11 values | **partial** |
| Border | `2` (sticker law) | `1 ×2 · 1.5 ×3 · 2 ×28 · 2.5 ×20 · 3 ×10 · 4 ×1` | **partial** |
| Shadow | exactly 2 hard tiers (`4,4` · `2,2`) | 10 tiers incl. `8,8`, `5,5`, `3,3`, `1.5,1.5`, `1,1`, a downward translucent `0 12px 0 rgba(…,.16)`, and 2 CSS `drop-shadow()` filters | **FAIL (G-06)** |
| Spacing | `SPACE` 4·8·12·16·24 · `PAGE_PAD` 18 | free-form padding/margin on every file; no scale, no shared page pad | **FAIL** |
| Tilt | `ROW_TILTS` ±0.4–1.2° | `index:171` −0.6° · `den:12` −0.4°/+0.5° · `plan:9` −0.4° · `globals:125` ±0.7° · `PIG_TILTS` `page.js:43` ±0.5–1.1 (the closest match to `ROW_TILTS`) | ✓ in spirit |

**Shared source of truth: none.** Nine `:root` blocks, each a hand-copied subset. `analytics-dashboard`'s
`.sticker` rule and `adventures`' `--shadow`/`--shadow-small` vars are the only two abstractions, and they
disagree with each other and with `theme.ts`.

---

## 6. What's working — keep and replicate

- **`analytics-dashboard/app/globals.css:41` — the `.sticker` rule with a `--fill`/`--tilt` custom-property
  API.** This is exactly the right shape for a web `Sticker`: one rule, per-instance variation through custom
  properties, consumed declaratively (`page.js:20–23`). Promote it verbatim (with `2px`/`RADII.lg` corrections)
  as the foundation of the shared stylesheet.
- **`analytics-dashboard/app/globals.css:73–79` — `.sec`.** A hand kicker + Caprasimo `h2` + a 2px 30 %-opacity
  ink rule is a faithful, independent re-derivation of `SectionHeader` + `TITLE_RULE` (`theme.ts:243–249`).
  The web already knows what a TTP section header looks like.
- **`analytics-dashboard/app/svg.js` — inline hand-drawn SVG Rosie + a `<symbol>` sprite sheet.** This is the
  web's `Glyph`/`Icon` and it is the correct answer to G-01: TTP art, not emoji, at any size, in ink.
- **`scripts/prototypes/adventures/styles.css` — the most system-literate file on the web.** Zero raw hex
  outside `:root`; named `--shadow`/`--shadow-small` matching the app's two tiers exactly; a real
  `:focus-visible` ring (`:36`); `min-height:44px` on every text button, re-asserted at 520px (`:493–495`);
  a `prefers-reduced-motion` block (`:503`) plus a `.reduce-motion` class for user-controlled opt-out
  (`:473–474`); `text-wrap: pretty` on headings and body; exact `--bark`/`--bark-text` token match. It is the
  template every other web page should be rebuilt against.
- **`landing/index.html:556–580` — the reveal safety net.** `body.shown` forces the animated content visible
  after 1.6 s in case animations are throttled in a background tab, *and* the reduced-motion block neutralises
  every animation while forcing `opacity:1`. Content is never stuck invisible. Copy this pattern anywhere
  content is revealed by animation.
- **`landing/report.html:189–194` — the `REASONS` map.** Server failure codes mapped to warm, specific,
  in-voice player copy ("The Den is napping — try again in a little bit"). This is the taste standard's
  "warm loss, never shame" applied to an error state, and it belongs in the app's error handling too.
- **`landing/report.html:41–52` — the radio-card kind picker.** A visually-hidden native radio inside a
  `<label>`, with `:has(input:checked)` and `:has(input:focus-visible)` for state. Correct semantics, styled
  state, keyboard-complete. This is the shape a web `SegmentedControl` should take.
- **`landing/index.html:766` / `landing/i/index.html:468` — pattern parity with the app.** Both copies of the
  referral regex carry a comment pointing at `REFERRAL_CODE_PATTERN` in `utils/referrals.ts`. The right
  instinct; the fix is to make the sharing real rather than commented.

---

## 7. System asks

What a shared web layer must contain so every surface above can be rebuilt from it alone.

**1. `web/tokens.css` — generated from `constants/theme.ts`, never hand-edited.**
A build step (`scripts/build-web-tokens.mjs`) that imports `theme.ts` and emits CSS custom properties, checked
in and imported by every HTML file. It must contain, at minimum:

| Group | Custom properties |
| --- | --- |
| Ink & paper | `--ink` `--paper` `--cream` `--cream2` `--ink-mute` `--ink-mute-soft` `--bark` `--bark-text` `--bark-mute` |
| Fills (surface only) | `--fill-rose` `--fill-rose-deep` `--fill-sky` `--fill-sage` `--fill-sun` `--fill-lilac` `--fill-lilac-deep` `--fill-peach` `--fill-slop-gold` `--fill-slop-band` |
| Semantic (from `UI_COLORS`) | `--accent` `--action-surface` `--success-text` `--success-surface` `--warning-text` `--warning-surface` `--info-text` `--info-surface` `--danger-text` `--danger-surface` `--separator` `--scrim` `--text-on-dark` |
| Rarity | `--rarity-{common,uncommon,rare,epic,legendary}-fill` and `-stripe` |
| Fonts | `--font-display` (Fredoka) `--font-body` (Nunito) `--font-whimsy` (Caprasimo) `--font-hand` (Patrick Hand) + the single Google Fonts `@import` |
| Type roles | `--type-display` … `--type-kicker-pill-sm` as `font`-shorthand custom properties, one per `TYPE.*` role, so a rule reads `font: var(--type-body)` and never a bare `font-size` |
| Radius | `--radius-sm 8` `--radius-md 12` `--radius-lg 14` `--radius-xl 18` `--radius-xxl 22` `--radius-pill 999px` |
| Space | `--space-xs 4` … `--space-xl 24` · `--page-pad 18px` |
| Shadow | `--shadow-sticker: 4px 4px 0 var(--ink)` · `--shadow-sm: 2px 2px 0 var(--ink)` — **and nothing else** |
| Tilt | `--tilt-1 … --tilt-8` from `ROW_TILTS` |

**2. Three tokens the app itself is missing** (blocking a clean generation — these are asks on `theme.ts`,
not just on the web):
- **`UI_COLORS.focus`** — the web invented `#16729c` (`styles.css:16`) because no token exists. The app needs
  one too, for the same reason.
- **`BORDER` scale** — the audit baseline already notes *"`borderWidth` 2 (255) · 1.5 (129) · 1 (12) · 2.5 (10)
  · 3 (6) — no token exists."* The web has six widths for the same reason. Name them: `hairline 1` ·
  `thin 1.5` · `sticker 2` · `heavy 3`.
- **`--cream-deep`** — `styles.css:6` needed a page ground darker than `cream2` and invented `#ead8c1`.
  Either sanction it in `WHIMSY` or rule that the web page ground is always `paper`.

**3. `web/sticker.css` — the primitive layer.** One rule per app primitive, each consuming only tokens:
`.sticker` (`--fill`/`--tilt`/`--shadow`) · `.btn` + `.btn--primary`/`--ghost`/`--text` (with
`min-height:44px`, hover-lifts / active-presses, and a disabled state that **keeps its outline**) ·
`.section-header` (kicker + whimsy title + rule) · `.page-header` · `.empty-state` (sticker + glyph slot +
warm line) · `.kicker` / `.kicker-pill` · `.chip` · `.field` (input/textarea) · `.segmented` (the
`report.html:41` radio-card pattern) · `.toast`. Plus the three global rules every page needs: the
`:focus-visible` ring, the `prefers-reduced-motion` block, and the `body.shown` reveal safety net.

**4. `web/glyph.svg` — a shared sprite sheet.** `analytics-dashboard/app/svg.js`'s `GlyphSprite` extracted to a
standalone file every page can `<use>`, with the two-rule contract: decorative → `aria-hidden="true"`,
meaningful → `role="img"` + `<title>`. This is what makes "no emoji on the web" an enforceable rule instead of
an aspiration.

**5. `web/tickle.js` — the shared interaction module.** Confetti-star field, tickle-Rosie burst, copy-with-
fallback, and toast — currently duplicated byte-for-byte between `landing/index.html` and
`landing/i/index.html` (G-10). One module, one place to fix the silent copy failure noted in the scorecard.

**6. A web lane in the taste standard.** Three rules, written down and lintable:
(a) no HTML file declares its own `:root`; (b) no codepoint in `U+1F300–U+1FAFF` / `U+2600–U+27BF` in rendered
text, with `★ ✦ ✧ ♥ ✓ ›` as the allowed dingbat set; (c) pastel fill tokens may never be assigned to `color:`.
Add a `npm run lint:web` that greps for raw hex, bare `font-size`, `box-shadow` offsets outside the two tiers,
and emoji — and wire it into the same pre-commit path the app uses.

**7. A decision-log entry** in `docs/design/taste-standard.md`: *"The web is a consumer of `theme.ts`, not a
second design system."* The four in-tree accents (`#a13f30` app · `#c25a3f` adventures+dashboard · `#c0566a`
legal · `#d94a62` redeem) are the cost of not having written that down.

---

## Conformance pass — 2026-09-11 (wave 5, the web)

**Result: every public web surface consumes `theme.ts`.** `scripts/build-web-tokens.mjs` emits `tokens.css` +
`sticker.css` into `web/`, `landing/` and `analytics-dashboard/app/` (all `linguist-generated`); `scripts/build-design-md.mjs`
regenerates `DESIGN.md`; `npm run lint:web` fails on an emoji or on any copy drifting from the theme. Raw hex outside
meta/JSON-LD: landing 22 → 0, invite 19 → 0, privacy 5 → 0, terms 5 → 0, report 12 → 0, redeem 10 → 0, adventures 25 → 0,
dashboard globals 18 → 0. No HTML file declares a `:root`. Three parallel passes (landing family · legal/report/redeem/
adventures · analytics dashboard).

**Findings closed:** G-01 (already in wave 0), G-02 (Archivo retired — Caprasimo / Nunito / Patrick Hand via
`--font-*`), G-03, G-04, G-05, G-06 (the sticker card is declared once, in generated `sticker.css`), G-07 (redeem is a
TTP surface: `.sticker--dialog` ticket, `.kicker`, sun code chip, rose `.btn`), G-08 (`:focus-visible` ring on every
control; the generator's field reset no longer kills it), G-09 (`<button class="btn btn--link">`), G-10 (`/i/` is a thin
page over a comment-marked `COMMON` block + `landing/site.css`; the drift cannot recur), plus the silent copy-failure bug
(`TTP.copy` resolves a real boolean and toasts the truth). Shared `landing/glyph.svg` (21 symbols, decorative/meaningful
contract) and `landing/tickle.js` (reduced-motion-aware) retire the byte-duplicated scripts.

**Generator growth the pass forced:** alignment/membership/effects tokens (`--angel … --prestige`), `--type-hero`,
`.radio-card`, `.btn--lilac`, `--ease-out`; the focus-reset fix.

**Recorded:** `landing/den` and `landing/plan` stay outside the gate (founder-only, generated with an emoji legend);
`landing/mocks` and `landing/labs` are throwaway; adventures' absolute `/tokens.css` link resolves only at a domain root.
