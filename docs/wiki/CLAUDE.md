# Tickle the Pig — Game Wiki (LLM-maintained)

A compiled, interlinked knowledge base for the TTP game, built with the
`llm-knowledge-base` ("Karpathy wiki") pattern. **The LLM owns and maintains
this wiki; humans read it (open `docs/wiki/` as an Obsidian vault).**

This is a *game-design bible*, not codebase docs. The "raw sources" are the
repo itself — code under `utils/`, `components/`, `hooks/`, `app/`,
`constants/`, the SQL in `supabase/migrations/`, and the design docs in
`docs/`. Wiki pages **cite those paths**; they never copy code.

## Layout

```
docs/wiki/
├── CLAUDE.md        # this file — conventions + maintenance workflow
├── _index.md        # catalog of every page, grouped by category (LLM-maintained)
├── _topics.md       # taxonomy: systems → subsystems → pages (LLM-maintained)
├── _glossary.md     # domain terms → one-line def + [[link]] (LLM-maintained)
├── log.md           # append-only: "## [YYYY-MM-DD] <op> | <what>"
├── <concept>.md     # one page per system / entity / concept (kebab-case)
└── outputs/
    └── memos/       # filed query answers + analyses (strategy, audits)
```

## Page format

Every concept page uses YAML frontmatter + a fixed section skeleton:

```markdown
---
title: Alignment (Goblins vs Angels)
aliases: [alignment, schism]
tags: [system, season, social]
status: stable | draft | stub
sources:
  - code: utils/alignment.ts
  - sql: supabase/migrations/20260521000000_alignment.sql
  - doc: docs/season-1-goblins-vs-angels.md
last_compiled: 2026-06-13
---

# Alignment (Goblins vs Angels)

(1–2 sentence definition — what it is, why it matters.)

## How it works
...

## Key files
- `utils/alignment.ts` — ...

## Connects to
- [[blessings-curses-effects]] — casting shifts alignment
- [[seasons-and-judgement-day]] — the finale ranks + resets it

## Open questions / risks
- ...
```

Conventions:
- Filenames are **kebab-case** nouns (`tickle-trade.md`, not `how-trades-work.md`).
- LLM-maintained meta files start with `_`.
- Link with Obsidian wikilinks `[[slug]]` (the page's filename without `.md`).
- Cite a real repo path for every non-obvious claim.
- Prefer short, atomic, heavily-linked pages over long ones.
- Never rename a page casually — it breaks every wikilink.

## The four loops

1. **Ingest** — a new design doc / feature lands in the repo → read it, note its concepts.
2. **Compile** — write/extend the affected concept pages; refresh `_index`/`_topics`/`_glossary`; append to `log.md`.
3. **Query** — answer a hard cross-system question against the wiki; file substantive answers into `outputs/memos/` and link them from the relevant pages.
4. **Lint** — periodically: broken wikilinks, orphans, stale stubs, missing cross-refs, concepts mentioned ≥3× with no page. Report to `outputs/lint/`, fix on approval.

## Maintenance note

When a feature ships or a design decision is made, update the matching page(s)
in the same pass — that's the whole point. The wiki stays current because the
LLM does the bookkeeping.
