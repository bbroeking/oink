# TTP UI/UX audit — 2026-09-11

End-to-end UI/UX audit of the Oink project (Tickle the Pig app + web surfaces) with one goal: **strict design
clarity, and a design system every UI element is built from.**

## Deliverables in this folder

| File | What it is |
| --- | --- |
| `00-evaluation-prompts.md` | The ten "is this design good?" prompts, the sources surveyed, severity scale, output contract |
| `00-auditor-brief.md` | The brief every auditor followed, with the whole-app baseline metrics |
| `findings-A-home-barn.md` … `findings-G-web.md` | Per-area findings from seven parallel Opus auditors (inventory, findings, scorecards, token triage, what works, system asks) |
| `01-audit-report.md` | The synthesized audit report organized by UI area, plus the prioritized cross-area findings summary |
| `../design-system-spec.md` | The draft design system spec (tokens · components · rules · migration) — implementation-ready |
| `../design-system-canvas/` | The design canvas sources (Foundations, Components, a rebuilt screen, Rules) published as the "Tickle the Pig Design System" artifact |

## Method

1. **Inventory + metrics from source.** A Python scan over `app/` + `components/` (194 files, dev/prototype screens
   excluded) counted every literal styling value against its token equivalent. Those numbers are the baseline in the brief.
2. **Research.** Nine sources surveyed (NN/g heuristics, Impeccable's critique/audit references, UICrit, design-system
   audit guides, Designlab, mobile-game accessibility heuristics, Laws of UX, and TTP's own charter/taste standard);
   ten prompts selected and adapted. See `00-evaluation-prompts.md`.
3. **Seven parallel Opus auditors**, one per UI area, each running all ten prompts against every file in its area with
   `file:line` evidence and system-shaped recommendations.
4. **Design system built in parallel** via the design canvas from the real values in `constants/theme.ts`, with proposed
   tokens/components derived from the metrics, then reconciled against the auditors' "system asks".
