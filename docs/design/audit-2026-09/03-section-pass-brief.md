# Section-pass brief (waves 3–4)

You are rebuilding one slice of Tickle the Pig on the design system. The system exists now; your job is to make the
screens speak it. Read, in order: `docs/design/design-system-spec.md` (§2 component table, §3 laws),
`docs/design/taste-standard.md`, `components/ui/index.tsx` (the barrel — the ONLY sanctioned import path for
primitives; skim the modules it names so you know what exists), `constants/theme.ts` (every token), and the
area's findings file in `docs/design/audit-2026-09/` for the specific findings your files carry.

## The bar for each file you own

1. **Zero `ttp/*` warnings.** Check with `npx eslint <file>` — the seven `eslint-plugin-ttp` rules
   (`no-raw-style-literal`, `pressable-needs-a11y`, `no-space-arithmetic`, `no-raw-modal`, `no-activity-indicator`,
   `animated-needs-motion-policy`, `no-legacy-palette`) must report nothing for the file. Fix causes, never suppress
   (no `eslint-disable` unless a literal is a genuine drawing constant — then the disable comment states why, and it
   counts against you in the summary).
2. **Composition law.** Text renders through the text roles (`T`, `Body`, `Hand`, `Label`, `Kicker`, `KickerPill`,
   `CardTitle`, `SectionTitle`, `PageTitle`, `Numeral`, `Stat`) — a raw `<Text>` with a `fontSize` is the smell.
   Surfaces are `Sticker` (use its `title`/`right`/`footer`/`pad`/`onPress`); lists are `ListRow`/`NavRow`;
   capsules are `Chip`/`Tag`/`Ribbon`; headers are `PageHeader` (page) / `SectionHeader` (section); loading is
   `LoadingBeat`/`Skeleton`; empty and error are `EmptyState` (`kind="error"` + `action`); bottom sheets are
   `Sheet`; centered dialogs are `AdaptiveModalScaffold` + `DialogButtonRow` or `ConfirmDialog`; toasts are
   `showToast`; inputs are `TextField`; meters are `ProgressTrack`; active effects are `EffectCard`.
3. **State law.** Pressed = `PRESSED`/`PRESSED_FLAT` (or the primitive's own); disabled = `DISABLED` +
   `DISABLED_TEXT`, never opacity; selected = `BORDER.heavy`; every spend/claim/cast control states its cost or
   target in its `accessibilityLabel` and its consequence in `accessibilityHint`.
4. **Behaviour law.** A file that animates imports `useMotionPolicy` and gives every decorative loop a rest pose;
   `null` from a fetch is an error state, `[]` is empty; irreversible actions go through `ConfirmDialog`.
5. **Preserve behaviour.** No feature changes, no copy changes beyond what a finding names, no layout redesign —
   same screen, spoken in the system. Where the audit's finding says the old drawing was wrong (a dissolved disabled
   control, a paper glyph on a pastel), the finding wins.
6. **Tests.** Run every `__tests__/` suite that names your files. Update an assertion only when it tested the old
   rendering (a style value, a text glyph, a `Modal` mount); never weaken a behaviour assertion. Add a test when you
   add a path.

## Rules of engagement

- **Do not edit** `constants/theme.ts`, `.eslintrc.js`, `components/ui/*`, or any file outside your list. If you need a
  token or a primitive change, use the closest existing token and put the ask under **System asks** in your
  summary — the orchestrator lands it.
- Tabs for indentation where the file already uses tabs.
- `npx tsc --noEmit -p tsconfig.json` must stay clean.
- Do not commit.

## Return

A ≤200-word summary: per file, warnings before → after (from `npx eslint`); the findings you closed by id; tests run
and results; **System asks** (tokens / primitive gaps / disables you had to leave, each one line).
