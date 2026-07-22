# Per-surface refusal copy stays per-surface

Rejecting the consolidation of server refusal-reason handling (the `already_rooted` / `too_poor` / `truffle_cap` / … switches in TrufflePatch, useFeedingCta, the bury sheets, and the season claim dialogs) into a shared reason→copy module. Decided 2026-07-22 while resolving the architecture-review backlog (issue #34).

## Why record this

Any future architecture review will re-flag the pattern — four surfaces switching on overlapping-but-different reason-string sets reads as textbook duplication. It isn't: it's deliberate voice work, and the "drift risk" it implies is effectively unreachable.

## Rationale

- **The same conceptual refusal wears different words in different rooms.** The pass says "The mud needs a little more XP before you can Wallow"; a claim says "Your Golden Truffle pouch is full. Spend one at the Exchange, then come back"; the patch words its refusals dig-side. Context-specific copy is the product's voice (SKILL.md's whimsy register), not accidental divergence.
- **A shared reason→copy module would be shallow.** Nearly every entry would need a per-surface override, leaving an interface as large as the implementation — the exact shallow-module trap the reviews exist to remove.
- **Server reason strings are a stable contract.** Renaming one breaks shipped clients, so it doesn't happen; the feared "renamed reason = multi-file grep" failure mode has no realistic trigger.

## Revisit when

Season-2 content adds enough new refusal reasons that typos become a real risk. The remedy then is a **reason-constant module** (shared string names only — copy stays per-surface), not a copy consolidation.
