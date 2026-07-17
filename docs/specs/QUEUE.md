# Workflow-cleanup implement queue

> Grilled + decided with the founder 2026-07-16. Ordering principle: **stability
> first** — the tiny loop-validating fix, then the June bug backlog (cheap
> context, cleans the base), then wedge-plan Phase 1, then the remaining 1.4
> lane. Mock hub for founder review: `landing/mocks/index.html`.

## Loop protocol (read by the orchestrator, not the implementer)

- Branch: `workflow-cleanup` (cut from main at `0960de7`). One commit per
  completed spec: `spec NN: <title>`. **No pushes, no merges, no `db push` —
  ever.** Migrations are AUTHORED only and listed in the commit body.
- Each iteration: pick the top `pending` spec → spawn a **fresh Opus subagent**
  whose prompt is the spec file (plus CLAUDE.md context) → agent implements +
  runs the test suite → orchestrator (Fable) reviews the diff → commit → mark
  the row `done` (or `blocked` with a note) → next.
- A `report-and-pause` spec (07) ends with a written report committed to
  `docs/specs/reports/`, never a prod change.
- If a spec turns out to be already-built (12 is a candidate), mark `done
  (no-op)` with a one-line note — don't invent work.

## Queue

| # | Spec | Source | Status |
|---|------|--------|--------|
| 01 | Shop preview freeze + Closet/Visit frame sync | new bug (founder) | done (2026-07-16, 586 tests green) |
| 02 | Popup queue cluster: BuriedTruffleSheet null-block + unenrolled sheets | GH #3 + #4 | done (2026-07-16, 589 tests green) |
| 03 | Offline soft-locks: home_stats retry + saddling-up timeout | GH #5 | done (2026-07-16, 596 tests green) |
| 04 | Trough nudges: supersede + tap-through | GH #10 | done (2026-07-16, 603 tests + harness smoke green; migration 20260746000000 authored, unpushed) |
| 05 | Reinstall flow: silent first-session popups + veteran storybook re-run | GH #11 | done (2026-07-16, 612 tests + harness green; migration 20260747000000 authored, unpushed) |
| 06 | Small fixes batch: lucky_won toast, shop UTC refresh, 28/25 wording, Wardrobe→Closet | GH #12 | pending |
| 07 | Season-1 tiebreak post-mortem — investigate → report → PAUSE | GH #28 | pending |
| 08 | Seeded crew boards (wedge 5a) — migration authored + harness smoke | wedge Phase 1 | pending |
| 09 | Text-grid share on the dig receipt (wedge 5b) | wedge Phase 1 | pending |
| 10 | "Found the golden in N digs" receipt headline (wedge 5c) | wedge Phase 1 | pending |
| 11 | Pair Keepsakes + Strongest Pairs UI | 1.4 lane | done (verified built 2026-07-16: keepsake line UserSheet.tsx:530, board Leaderboard.tsx:254+; the FLAMES layer is Phase 2, not queued — Hearth Archive rejected, streak model stands) |
| 12 | Feeding-clock client gaps | 1.4 lane | done (verified built: utils/feedingConfig.ts server-authoritative w/ fallback; remaining work is the release-day server UPDATE, an ops action) |
| 13 | Feedback UI: settings whisper row (bell) + nudge mount | 1.4 lane | done (verified built: Account.tsx:1152 bell row, FeedbackNudgeModal mounted _layout.tsx:1051, unflagged) |
| 14 | Mud-wrap stacking: extend duration, never multiply regen | roadmap 💭 → decided | pending |

Out of the loop (blocked on founder, tracked in ROADMAP.md): sticker-pack App
ID registration, all DB pushes, ad-platform actions, demo-account re-seed.
