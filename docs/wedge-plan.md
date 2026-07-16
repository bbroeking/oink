# The Wedge Plan — "the group chat's pet"

> Founder-approved wedge (2026-07-15): Tickle the Pig competes with "the group
> chat has nothing to say today," not with other games. Light, no-guilt
> connection between real friends. **Wedge test for every feature: does a
> 30-second session produce something worth texting?**
>
> This doc integrates every wedge option raised in the 07-15 founder session
> into a phased build plan. Companion decisions live in SKILL.md's log.

## The pieces (status at writing)

| # | Piece | Status |
|---|-------|--------|
| 1 | Rosie iMessage sticker pack (14 stickers, codeless extension) | BUILT — rides 1.4; needs `com.broeking.ttp.stickers` App ID before next build |
| 2 | Invite links w/ Rosie OG unfurls (`/i/CODE`) | LIVE (landing fixed 07-15) |
| 3 | Pair Keepsakes + Strongest Pairs board | BUILT — migration `20260743000000` staged, unpushed |
| 4 | Feeding-clock fix (window-keyed dug, honest copy) | BUILT — rides 1.4 |
| 5 | The Shared Dig (seeded crew boards + text-grid share + "golden in N") | PLAN — Phase 1 |
| 6 | Herd-landing invite links ("bring the group chat") | PLAN — Phase 2 |
| 7 | Monday recap share card | PLAN — Phase 2 |
| 8 | The Ember (streaks, cozy-reconciled) | PLAN — Phase 2, pending founder taste call |
| 9 | Barn notes (canned, zero-moderation) | PLAN — Phase 2 |
| 10 | Interactive iMessage extension (act-in-the-bubble) | PLAN — Phase 3 |
| 11 | Home-screen widget (herd moods) | PLAN — Phase 3 |
| 12 | Browser mini-dig at ticklethepig.com/labs | PLAN — Phase 3 |
| 13 | WhatsApp sticker pack | PLAN — Phase 3 |

## Phase 1 — ships with 1.4: "every dig produces the text"

**5a. Seeded crew boards.** Board generation takes seed = f(window_id, crew_id)
so the whole Sounder digs the IDENTICAL patch each feeding. Comparability is
the Wordle unlock ("the golden was in the corner — took me 14"). Per-crew (not
global) keeps spoilers in-herd where they're fun; boards expire every 8h so
leaks decay. Server: seed plumbed through open_rooting's board gen (carry
latest def; harness smoke: same window+crew ⇒ identical board, different crew
⇒ different board; practice digs stay random). Solo/crewless pigs seed on
(window_id, user_id) — unchanged feel.

**5b. Text-grid share on the dig receipt.** One "share your dig" affordance on
the receipt → copies a text block (text pastes inline everywhere; images have
attachment friction):

```
tickle the pig · feeding #402
🟫🟫✨🍄🟫
✨🟫👑🟫🟫
4 finds in 19 digs
ticklethepig.com
```

Emoji allowed here — outbound message content, not UI (the UI ban stands).
Spoiler-light: shapes, not coordinates. Native share sheet + copy.

**5c. "Found the golden in N digs"** becomes the receipt's headline number —
the game's 3/6: one compact, comparable, braggable stat. Client-only (the
receipt already knows the dig sequence).

Also in 1.4 (already built): stickers (#1), pair bonds UI (#3), feeding fix
(#4). Migrations to push together on go: pair_bonds + seeded boards.
**Apple gate:** register `com.broeking.ttp.stickers` App ID before building.

## Phase 2 — the ritual layer (1.5 lane)

**6. Herd-landing invite links.** A Sounder link (`/s/TOKEN`) that lands a new
player INTO the herd as a pre-approved knock — one link in the chat converts
the whole group. Server: crew invite tokens (single-table + RPC, reuses the
knock model's accept path); landing page variant; deep link into onboarding.
The referral +100/+50 economics ride along unchanged.

**7. Monday recap card.** When spoils settle, the herd gets a shareable
week-card: rank, finds, biggest pair-bond gain, "{crew} took #3 — 41 finds."
Server: recap RPC over existing race tables. The synchronized weekly moment
already exists; this gives it an artifact. (NYT "your week in Wordle" move.)

**8. The Ember — streaks, reconciled with the charter.** Founder wants
streaks; the charter bans guilt. The cozy synthesis:
- The herd keeps ONE shared ember: it brightens each feeding any member digs
  (3 stages: glowing → bright → roaring at 7/14/28 consecutive feedings-with-
  a-dig, any digger counts).
- A missed feeding DIMS it one stage — it never dies to zero, never shames an
  individual ("the ember dimmed" not "kate broke the streak"), and any single
  dig rekindles the climb.
- Pair embers optional later (same rules at pair scope).
- Share artifacts show the ember stage, never a fragile day-count.
This keeps the ritual pull (something alive that your absence affects) while
staying herd-collective and forgiveness-first. ALTERNATIVE if the founder
wants classic personal streaks: hard opt-in display, freeze tokens earned by
blessing friends. Decision pending; log to SKILL.md when made.

**9. Barn notes.** Canned note-cards left on a friend's barn ("good dig
monday", "thinking of your pig", a snout doodle) — no free text, so zero
moderation surface. Visits finally leave a trace; notes count toward pair
bonds (+1 notes column, or fold into visits).

## Phase 3 — the deep integrations (post-traction)

**10. Interactive iMessage extension** — send a tickle-ask/blessing AS a
bubble the friend taps to fulfill without opening the app (GamePigeon lane).
Real extension code + auth-in-extension; do after share cards prove demand.
**11. Widget** — your pig + herd moods on the home screen (Widgetable lane).
**12. Browser mini-dig** at /labs — the zero-install Wordle property: a tiny
web dig ending in "your herd is waiting →" + store link.
**13. WhatsApp stickers** — same art, their API.

## Measurement (wedge-truth)

- Share-rate: count share-sheet opens per receipt (lightweight client event →
  existing analytics lane, or a fail-soft RPC counter).
- K-factor: installs via /i/ and /s/ links (referral tables already attribute).
- Ember: feeding-participation rate per herd before/after.
- Existing gates stand: CF1 winner + CPI before paid scale; ≥1,500 reach/arm.

## Sequencing & gates

1. NOW: push pair_bonds + seeded-boards migrations (one founder "go"), build
   Phase-1 client work, register sticker App ID, build 1.4 after 1.3 clears
   review.
2. Phase 2 needs one taste decision (Ember vs classic streaks) + its own
   migration batch.
3. Phase 3 waits for share-rate/K-factor data from Phases 1–2.
