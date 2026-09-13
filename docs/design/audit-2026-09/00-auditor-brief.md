# Auditor brief — TTP UI/UX audit, 2026-09-11

You are one of seven parallel auditors. You audit **from source** (React Native / Expo 52, or HTML/CSS for the web
surfaces). You do not fix anything. You do not run the app. You write one findings file and return a short summary.

## Read first (in this order)

1. `docs/design/audit-2026-09/00-evaluation-prompts.md` — the ten prompts you must run, the severity scale, and the
   **output contract** (your file's required sections).
2. `docs/design/taste-standard.md` — the craft lens. TTP is a maximalist paper-craft storybook; cards, tilt, hard
   shadows and four fonts are *correct* here. "Slop" in TTP means tokens bypassed, not a generic look.
3. `constants/theme.ts` — the token layer (`WHIMSY`, `UI_COLORS`, `TYPE`, `FONTS`, `RADII`, `SPACE`, `PAGE_PAD`,
   `TAB_SAFE`, `STICKER_SHADOW`, `SHADOW_SM`, `KICKER_TEXT`, `KICKER_PILL`, `TITLE_RULE`, `RARITY_*`).
4. `components/ui/index.tsx` and the primitives it neighbours: `Sticker`, `Button`, `IconButton`, `SectionHeader`,
   `PageHeader`, `EmptyState`/`LoadingBeat`, `SlideUpSheet`, `AdaptiveModalScaffold`, `DialogCloseRow`,
   `ConfirmDialog`, `SegmentedControl`, `Glyph`, `Icon`, `Skeleton`, `PigStage`.
5. `SKILL.md` — the North Star (Connect · Collect · Contend) and decision lens. Skim; cite pillars by name.

## Baseline numbers (whole app, `app/` + `components/`, excluding dev/prototypes — 194 files)

| Measure | Literal | Token |
| --- | --- | --- |
| Colors | 97 raw hex in 22 files (54 distinct); 41 `rgba(`; 14 legacy `COLORS.*` | 2,155 `WHIMSY.*`, 206 `UI_COLORS.*` |
| Type | 521 bare `fontSize` (11/12/13/14 dominate) | 599 `TYPE.*` |
| Radius | 169 bare `borderRadius` (32 distinct values, 16× `999`) | 386 `RADII.*` |
| Spacing | 980 bare padding/margin/gap (34 distinct values incl. 1,2,3,5,6,7,9,11,13) | 1,276 `SPACE.*` |
| Borders | `borderWidth` 2 (255) · 1.5 (129) · 1 (12) · 2.5 (10) · 3 (6) | no token exists |
| Opacity | 0.7 (70) · 0.85 (28) · 0.6 (22) · 0.5 · 0.55 · 0.45 · 0.65 … | no token exists |
| Primitives | 33 files mount a raw `<Modal>`; 11 use `ActivityIndicator`; 9 use `Alert.alert`; 133 files use raw `<Text>` | `Sticker` 61 files · `SectionHeader` 19 · `PageHeader` 11 · `EmptyState` 30 · `SlideUpSheet` 7 · `AdaptiveModalScaffold` 13 · `Button` primitive 16 |
| A11y | 70 of 98 files with pressables carry any accessibility prop | — |
| Emoji | 3 files: `app/(tabs)/season.tsx`, `components/BountyCard.tsx`, `components/Barn.tsx` | — |
| Shadows | 1 soft shadow (`TierUpBanner`, shadowRadius 16) | 99 `STICKER_SHADOW` · 179 `SHADOW_SM` |

Use these to judge whether a pattern in your area is local or systemic; don't recompute them for the whole app.

## Rules

- Evidence is `file:line` plus the literal value or snippet. A finding without a location is not a finding.
- Recommendations are **system-shaped**: name the token, the primitive, the variant, or the rule. "Make it prettier" is
  not a recommendation. If the system lacks what you need, put it under **System asks**.
- Severity per the prompt file. Do not inflate; a bare `fontSize: 13` on a dev-only screen is P3, on the Barn it is P1.
- Strengths first in the summary; the taste standard says the bones are strong. Say what to keep.
- Prefer breadth with precision over depth on one file. Every file in your area gets at least a P4 token grep and a
  P5 inventory row; the biggest three files get the full ten prompts.
- Write the findings file with the Write tool at the path you were given. Return a ≤200-word summary listing the
  finding counts by severity, the top three findings, and the top three system asks.
