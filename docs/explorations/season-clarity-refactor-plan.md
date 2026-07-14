# Season clarity refactor — plan (2026-07-13)

Player feedback: Season 1 is overwhelming — what a Sounder is, how to join,
how to play, why, and what the rewards are. Two audits ground this plan: a
new-player walk of every season surface, and a promise-vs-surprise map of
every reward lane (full reports in the session; key refs inline). This is a
**refactor, not an overhaul** — the systems stay; the layout, ordering, and
copy change.

## Diagnosis (what the audits found)

1. **The why-chain is never stated as one sentence.** "Dig → XP → tiers →
   rewards" is split across three surfaces: the dig button (SounderHomeCard),
   a hidden XP modal (season.tsx ~2389), and the tier bar. Golden Truffles'
   purpose lives only inside the Exchange sheet. Nothing on the season tab
   answers "why am I here" without opening a modal.
2. **Concept overload.** A first pass through the tab introduces 12+ terms
   (Sounder, Hungerer, feeding, rooting, milestones, tickles-reclaimed,
   stages, dig-off, spoils, tiers, XP, premium). Some are never explained
   (root, spoils), one isn't even real ("joy" has no mechanic — pure flavor).
3. **The crewless dead-end.** No solo dig path exists; the race section is
   invisible without a crew; and "Join a Sounder" is the page's second
   headline — the ask arrives before the game has shown anything fun. The
   join door's pitch ("four snouts, one banner") states zero tangible
   benefits; the real ones (dig budget 20→25, milestone snout purses, weekly
   dig-off truffle payouts 6/5/4/3/2) are stated nowhere a crewless player
   can see.
4. **Rewards are surprises, not promises.** Dig-off payouts settle silently
   (RACE_TRUFFLE_TABLE is never rendered as copy); dig yields have no
   up-front statement; the season has no stated endpoint ("starve him to
   Famished — then what?" → silence).

## Principles

- **One sentence, then one button.** Every screen states its why in a line,
  then offers exactly one primary action for the player's current state.
- **Promise before the ask.** Rewards are stated where the commitment is
  requested, not discovered after.
- **Concept budget: 6 on the first screen** (Hungerer, Sounder, dig/feeding,
  truffles, pass tier, snouts). Everything else is progressive disclosure —
  explained the moment it's first encountered, or in the guide.
- The **SeasonGuideModal stays the single canonical explainer**; every "?"
  deep-links to its relevant step instead of spawning new explainer surfaces.

## The changes (smallest set that fixes it)

### A. The loop line (S)
One sentence under the HungerHero, always visible:
> *"dig at his feedings — keep the truffles, level your pass, and starve him
> with every find."*
That's the whole game. Three glyphs (gem/star/ogre) tie it to the sections
below. File: `components/season1/HungerHero.tsx`.

### B. One state-aware "next move" card (M)
Reorder the tab to a ladder of commitment and collapse competing CTAs into
one primary card directly under the hero:
- **Crewless:** "join a Sounder" — WITH the benefits pitch (see C) + the
  practice-dig taste (see D).
- **Crewed, window open, not dug:** "Root the patch — dig for truffles"
  (verb + plain-words subtitle) + closes-in countdown.
- **Crewed, dug/guarded:** countdown card ("dug this feeding — opens in Xh").
New order: Hero + loop line → next-move card → pass (with inline XP line, E) →
sounder roster/race detail → bounties. Files: `app/(tabs)/season.tsx` render
order, `components/season1/SounderHomeCard.tsx`.

### C. Sell the Sounder with its real benefits (S)
Replace the join door's flavor-only pitch with three concrete lines:
- *"dig deeper together — a full Sounder digs 25 stirs, not 20"* (currently
  stated NOWHERE)
- *"herd milestones pay everyone — titles + snout purses"* (name the amount)
- *"race the weekly dig-off — top Sounders split Golden Truffles every
  Monday (6 each for 1st)"* (render RACE_TRUFFLE_TABLE as copy at last)
Files: `SounderHomeCard.tsx` JoinDoor, `components/SounderCard.tsx` (Friends
tab twin), `SounderLaunchModal.tsx` body copy.

### D. Practice dig for crewless players (M — biggest single fix)
The dig already has a practice mode (`useRooting` practice fallback; the UI
even has a "practice patch" badge). Surface it on the join door: *"try a
practice dig ›"* — teaches rub/shove/finds with nothing banked, and ends on
*"a Sounder digs this for keeps — join one."* Kills the hard gate where the
game asks for social commitment before showing the toy. Files:
`SounderHomeCard.tsx`, `useFeedingCta.tsx` (allow practice launch when
crewless), `TrufflePatch.tsx` end-card copy for practice mode.

### E. Promise-before-ask copy drops (S, several spots)
- Pass header: subtitle *"earn XP by digging, tickling, and visiting"* (the
  chain in one line; the existing modal stays for detail).
- Dig-off card header: payout promise up front (from C).
- Patch end-card: *"truffles spend at the Exchange ›"* link line.
- Golden-truffle pouch counter (wherever shown): tappable → Exchange, so the
  currency's purpose is one tap away from every sighting.
Files: `season.tsx`, `RaceSection.tsx`, `TrufflePatch.tsx`,
`SounderHomeCard.tsx`, `TruffleExchangeSheet` entry points.

### F. Concept diet (S)
- Retire "joy" from mechanical-sounding copy (keep it only inside the story
  modal as poetry) — it has no mechanic and reads like a currency you can't
  find.
- "Root the patch" keeps its flavor but always carries the plain-words
  subtitle ("dig for truffles").
- "spoils" → "weekly rewards" outside the story surfaces.
- Guide modal steps become deep-linkable (`SeasonGuideModal` accepts an
  initial step) so contextual "?"s land on the right beat.

### G. State the endpoint (S code + one DESIGN DECISION)
One line on the hunger ladder: *"starve him to Famished before the season
ends — every digger shares the finale reward."* Requires deciding what the
finale reward IS (currently: nothing is wired; the SeasonEndModal payout is
the season-0 legacy grant). Decision needed from Brian — options: a finale
cosmetic for all diggers above N finds, a snout purse scaled by finds, or a
"Famished" title. Wire-up is small once decided.

### H. Intro sequencing (S)
Keep the 29s tale video, but its end CTA ("Rally your Sounder") should land
on the join door WITH the new benefits pitch (C) — today it routes to a door
whose pitch is all flavor. Also: the guide auto-open and the video can fire
on the same first visit — stagger them (video first visit, guide auto-opens
on the SECOND visit if unseen) so the first session isn't two modals deep.

## Sizing + order

| Step | Size | Depends on |
|---|---|---|
| A loop line | S | — |
| C join-door benefits | S | — |
| E promise drops | S | — |
| F concept diet | S | — |
| H intro sequencing | S | C |
| B next-move card + reorder | M | A, C |
| D practice dig | M | — |
| G endpoint line | S | finale-reward decision |

A+C+E+F+H is one focused copy/layout pass (one agent, one day). B and D are
each a contained component change. Nothing touches the DB except possibly G.

## Decisions needed (Brian)

1. Finale reward for starving the Hungerer (G) — cosmetic / snout purse /
   title / combo?
2. Practice dig for crewless (D) — confirm you want solo players to taste the
   minigame (it banks nothing; pure teaching).
3. Milestone "snout purse" — okay to name the actual amount in copy? Vague
   rewards read as no reward.
4. Any concept you'd cut entirely this season rather than explain (e.g. hide
   the BountyBoard on the season tab while it's feature-dark)?
