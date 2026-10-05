# Polish pass 2026-10-04 — the brief every area agent works from

The founder asked for the UI "polished to a truly impeccable standard", checked on the simulator, every tab, aimed at the next TestFlight build. This is **refinement, not redesign** (impeccable `polish`): the paper-craft sticker world, its tokens, its primitives and its copy voice are the brief. A correct-but-generic fix still fails; so does a fix that reads as a different app.

## Evidence

- Screenshots: `artifacts/polish-2026-10-04/before/` (118 PNGs, 2× copies; iPhone 17 Pro 402×874 pt for 001–109, iPhone SE 375×667 pt for 110–118, `accessibility-large` text for 103–108). Index with what each shows and defects noticed in passing: `artifacts/polish-2026-10-04/before/index.md`. **Open every screenshot for your area yourself** (Read the PNG) and look harder than the index did: alignment, spacing rhythm, hierarchy, truncation, overlap, inconsistent states, copy.
- The captures are the code as of 10:37 today; a few files may have changed since. Always reason from the current source.
- You cannot drive the simulator (the lead runs one "after" round when every area is done). Verify by reading the code path that draws each surface, by render tests, and by arithmetic on the layout.

## Read before editing

`docs/design/taste-standard.md` (all of it; the decision log is the law of this app), `DESIGN.md`, `constants/theme.ts`, `components/ui/index.tsx`, `.claude/skills/impeccable/reference/polish.md` and `.claude/skills/impeccable/reference/craft-floor.md`. **Where the craft floor conflicts with the taste standard, the taste standard wins**: hard zero-blur shadows, kicker pills over page titles, stickers as cards, tilt and the four display/hand fonts are this app's committed world, not defects.

## Triage order (fix in this order, don't perfect one corner)

1. Broken or blocked tasks, misleading state, inaccessible paths (a control VoiceOver can't press, a label that lies, a raw id in copy).
2. Missing or wrong states (loading, empty, error, disabled, success).
3. Flow, hierarchy and design-system drift (two primaries stacked, a selected state that isn't distinct, a header that doesn't own its scroll edge).
4. Visual and motion inconsistencies (alignment, truncation, overlap, ragged columns, a glyph used for two meanings).
5. Code cleanup in what you touched (dead styles, unused imports).

## Rules

- **Tokens and primitives only** (`ttp/*` lint rules are errors). Reach for an existing token/primitive first. Need a new token or a primitive change? **Do not edit `components/ui/**` or `constants/theme.ts` unless you are the primitives agent**: write the ask in your findings file and tell the lead; the primitives agent owns those files.
- **Copy**: the game's own voice, short, no emoji, **no em dash in any player-facing string**. Fix wrong facts (a tab called "Account" that is "Me", a raw identifier, a retired feature's name) freely; don't invent new claims. Data that comes from the database (title descriptions, achievement names) is **not** yours to rewrite in the client: list it under "server copy" in your findings and the lead will write a migration.
- **Dynamic Type**: scroll content follows the full scale (200 % rule); compact chrome (pills, chips, tiles, labels on a scene) states its ceiling with `CHROME_TYPE_CAP` (theme) rather than truncating. A word must never break mid-word: shrink the role, cap the multiplier, or let the row wrap.
- **Truncation**: a name that matters (an item, a title, a button's verb) never ends in "…" at default text size on a 375 pt phone. Fix the layout (wrap to two lines, give the label the yielding slot, shorten the surrounding chrome) before you shorten words.
- **Accessibility**: every pressable has role + label (+ hint naming the consequence); a close control is a button named "Close"; a label never disagrees with what's drawn.
- **Reduce Motion** honoured; touch targets ≥ 44 pt (frames may come back as `hitSlop`).
- Stay inside your file scope. Many files already carry uncommitted edits from earlier sessions: edit on top of them, never revert them.
- **Do not touch** `multiplayer/`, `server/`, `components/play/`, `app/play/`, `app/match/`, `utils/multiplayer/`, `hooks/useMultiplayer.tsx` (matchmade play, in progress elsewhere), or `app/_layout.tsx`.

## Output

1. `docs/design/polish-2026-10-04/findings-<area>.md`: every finding as a row (`ID · screenshot · surface · severity P0–P3 · what's wrong · cause (file:line) · fix · status fixed/deferred/asked`), plus "primitive asks", "server copy" and "deferred (why)".
2. The fixes, in one batch.
3. Green gates: `npx tsc --noEmit -p .`, `npx eslint <every file you touched>` (0 errors), `npx jest --ci <the suites for files you touched>` (and update tests your change legitimately alters), `npm run scorecard -- --json` prints `{}` (use `--json`: plain mode rewrites a shared doc).
4. A short report: counts by severity, what you fixed, what you deferred and why, primitive asks, server copy.
