Implement the spec referenced in `$ARGUMENTS` (a path to a spec file,
or — if blank — the most recently modified spec under `docs/`).

## How to run it

1. **Read the spec fully.** If it has phases, implement them in order.
2. **Create a running implementation-notes file** at
   `docs/<spec-basename>-implementation-notes.md` *before writing any
   code*. Append to it continuously as you work — never wait until the
   end.
3. **Implement.** After each phase (or each coherent chunk): run the
   project's typecheck + tests, then commit with a clear message.
4. When the spec is ambiguous on something material, make the
   **conservative call**, log it, and keep going. Only stop to ask if
   a choice is genuinely blocking and irreversible.

## The implementation-notes file

This file is a required companion to the work, not optional. Structure
it with these four sections and append dated, one-line entries (each
with a sentence of rationale + a `file:line` ref where useful):

- **Off-spec decisions** — choices the spec didn't cover that you had
  to make.
- **Changes from spec** — where you deviated from what the spec said,
  and why.
- **Tradeoffs** — where you picked one option over another, and what
  was given up.
- **Heads-up** — anything else the user should know: risks, follow-ups,
  partial work, things that surprised you, deferred items.

## Finish

When the spec is fully implemented (or a phase boundary is reached and
you're pausing), summarize for the user: what shipped, what's in the
implementation-notes file they should review, and what remains.
