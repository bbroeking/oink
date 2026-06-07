# Teams push-pull — design ideas

Status: **brainstorm / design only, not started.** Successor scratchpad to the
"Idea 1 — Teams" section of [`social-layer-ideas.md`](./social-layer-ideas.md),
now that barn visiting (the social primitive) is shipped. Ideas accumulate here
in batches; nothing here is decided. A clickable mock (Mud Hogs vs Sky Swine
tug-of-war) lives on branch `social-teams-pushpull`.

---

## Batch 1 — the core fork + initial shapes

### The fork to resolve first: where do teams sit?

The game already has two "pick a side" systems. Teams must **relate** to them or
it's a third competing identity the player has to track. Three framings:

**A. New orthogonal axis — "your team" is separate from alignment + country.**
You're (say) a Mud Hog *and* Generous *and* backing Brazil. Teams is its own
permanent-ish identity with its own tug-of-war.
- ➕ Clean slate; can be designed for balance (auto-assign); doesn't disturb the
  Season-1 alignment finale.
- ➖ A *third* faction badge to explain; risks identity fatigue ("which of my
  three sides is this screen about?"). Cosmetics/titles proliferate.

**B. Teams *are* the alignment schism, made into live PvP.** Angels vs Goblins
stop being a personal morality meter and become two literal teams in a tug-of-war.
Your every generous/greedy act already pulls the rope.
- ➕ Zero new identity — reuses the axis players already have; the alignment acts
  (give freely / pocket double) become *team contributions* with a visible
  collective payoff, which gives alignment the "teeth" it's been wanting.
- ➕ Narratively gorgeous: Judgement Day becomes a *team* victory, not just
  individual ranking.
- ➖ Alignment is currently a **personal slider you can move any time** — turning
  it into a fixed team means committing players to a side (or constantly
  reshuffling them as their score crosses zero). Balance is *emergent*, not
  assignable → sides may be lopsided. And it couples a big new system to the
  Season-1 finale that's already in flight.

**C. Teams = the recurring "event frame"; World Cup was its first instance.**
The World Cup is already a time-boxed "pick a side, fly a flag, earn together"
event. Generalize that into a reusable **Rivalry** frame: each season/event spins
up a fresh 2-way (or N-way) team battle — Mud Hogs vs Sky Swine this month, two
new factions next.
- ➕ Teams becomes *content you can re-skin forever* instead of a permanent axis;
  no identity fatigue because it's explicitly temporary ("this month's rivalry").
- ➕ Reuses World Cup plumbing (allegiance pick modal, flags, leaderboard tint).
- ➖ Less "deep belonging" than a permanent team; needs a content cadence to feel
  alive (a dead rivalry between events is worse than no rivalry).

**Leaning:** **C as the container, B's energy inside it.** Ship teams as a
*time-boxed Rivalry event* (C) so it never collides with the permanent alignment
identity — but let **alignment-flavored acts be the strongest pull** so the two
systems reinforce instead of compete (a Generous act pulls your rope *and* nudges
your slider). Keep alignment personal; make the *rivalry* the team. This is the
biggest decision and everything below assumes it's still open.

### Initial shapes for the "push/pull" itself

The rope is the obvious metaphor; here are five concrete shapes, simplest first:

1. **Tug-of-war rope (baseline).** One meter, `pull = teamA − teamB` over a
   window, normalized to a rope position. Window closes → leading team wins →
   reward → reset. Dead simple, readable, matches the mock.
2. **Territory / the Mud Line.** Instead of one rope, a *field* of N segments
   (days of the week, or map tiles). Each window your team's activity claims the
   current segment; the team holding more segments at season end wins. Adds
   "we're losing Tuesday, push!" texture and daily reset drama.
3. **Relay / shared goal, not zero-sum.** Both teams race a *separate* bar to a
   target (e.g. "1,000,000 tickles given"); first to finish wins, but both teams
   that hit it get a smaller reward. Less feel-bad for the losing side; rewards
   raw activity over edging out the rival.
4. **Push-the-pig (mascot avatar).** The rope is reskinned as each team's mascot
   pig physically shoved across a field — the *visual* is a pig being tickled
   forward by its team. Same math as #1 but the artifact is a charming animation,
   not an abstract bar. Strong "juice" candidate.
5. **Wave / momentum (anti-snowball).** Pull decays toward center over time, so a
   team can't bank a lead and coast — keeps it close and keeps everyone tapping
   to the end. Pairs with any of the above as a *modifier*, not a standalone.

### What feeds the pull (contribution sources)

Reuse existing verbs so there's nothing new to learn — every social act already
in the game becomes a team contribution:
- **Tickles given** (home + at barns) — the core, highest-volume signal.
- **Barn visits** (the new primitive) — a visit = a pull for your team.
- **Trades answered / blessings cast** — generosity acts; ties to framing B/C.
- **Mini-game wins** — burst contributions (see bucket below).
- Open: weight by *act* (a visit worth more than a home tap?) and cap per-player
  per-window so whales don't solo the rope (anti-farm, mirrors visit budget).

### Balance — keeping sides "similarly active"

The recurring risk: one team runs away. Options (not exclusive):
- **Auto-assign on join** to the team with fewer *active* (not total) players.
- **Normalize score by active roster size** so a smaller team isn't doomed
  (pull = average contribution, or total ÷ √members).
- **Handicap/comeback bonus** for the trailing team (×1.2 pull) — pairs with the
  wave/anti-snowball modifier.
- If framing is C (event), **re-roll teams each event** so a stomp doesn't calcify.

### Cadence + win condition (open)

- **Daily skirmish** (fast dopamine, resets nightly) vs **weekly war** (the rope
  is the week's story) vs **season-long** (one big arc → finale). Likely *nested*:
  daily skirmishes that roll up into a weekly/seasonal result, like the battle
  pass's daily/weekly/finale rhythm.

### Winner reward (open)

- Snouts (easy), an **exclusive team cosmetic** (flag/cape/aura in team colors —
  reuses multi-slot), a **team title** ("Mud Hog Champion"), or a permanent
  *tally* ("Mud Hogs lead the rivalry 4–2") for bragging rights across events.

### Mini-game v1 candidates (one to start)

From the bucket — pick the one that (a) reuses the tap verb and (b) feeds the rope:
- **Tug-of-war tap race** (literal: a live/async tap sprint, your taps = pulls) —
  most on-theme, lowest art cost, doubles as the push/pull itself.
- **Penalty kick** (World Cup tie-in, already have soccer assets) — good event fit.
- Pig-race, hide-the-truffle, daily trivia — later.

### Open questions (for you)

1. **The fork** — A (new axis), B (alignment becomes teams), or C (re-skinnable
   Rivalry event, my lean)?
2. Permanent team vs per-event team?
3. Zero-sum rope (#1/#2) or shared-goal/co-op (#3) — how feel-bad can losing be?
4. Cadence: daily / weekly / season — or nested?
5. Is the v1 mini-game the rope itself (tap race), or a separate game hanging off it?

---

## Batch 2 — deepening the Rivalry-event framing (C container, B energy)

Assumes the leaning from batch 1: a **time-boxed Rivalry event** (alignment stays
a personal slider; the *rivalry* is the team), where alignment-flavored acts pull
the rope hardest. Concrete proposals below — still all open, but with numbers to
react to.

### Scoring formula + anti-farm caps

**Contribution points per act** (weights chosen so high-volume/low-effort acts
matter least, and the social/generous acts the game wants to encourage matter
most):

| Act | Points | Why this weight |
|---|---|---|
| Home tickle | 1 | highest volume, lowest weight — floor of participation |
| Barn-visit tap | 3 | the social primitive; already rate-limited (1 friend / 3h, 7/hr) |
| Trade answered (gave freely) | 5 | a generosity act → ties to B's energy |
| Blessing cast | 4 | generosity act |
| Tap-race sprint win | 15–25 (burst) | the dedicated mini-game (below) |

**Per-player daily contribution cap** — e.g. **200 pts/day**. Past the cap your
acts still *do their normal thing* (tickles, happiness, alignment) but stop
feeding the rope. This is the anti-whale lever, philosophically identical to the
tickle cap (25/50) and the visit budget: one player can't solo the rope, and a
team's strength is *breadth of active members*, not a few grinders.

**Team pull = size-normalized sum.** Raw total favors the bigger roster, so
normalize. Three candidates (pick one in a later batch):
- `pull = total_pts ÷ active_members` (pure average — fairest, but a tiny
  hyper-active team can spike).
- `pull = total_pts ÷ √active_members` (**leaning**) — rewards *both* breadth and
  per-head intensity, dampens pure-headcount dominance without fully erasing the
  value of a big active base.
- `pull = total_pts` **+ comeback multiplier** (×1.15 for the trailing team) —
  simplest, leans on the catch-up bonus for fairness.

`active_members` = contributed ≥1 pt this window (so dormant sign-ups don't
dilute the average).

### Cadence — daily skirmish → weekly war → season rivalry (nested)

Mirror the battle-pass rhythm the player already knows (daily/weekly/finale):

- **Daily skirmish** (resets 00:00 a fixed TZ): the rope for *today*. At close the
  leading team **claims the day** (a Mud-Line/territory segment, shape #2) and
  contributors on the winning side get a small snout trickle. Contribution points
  reset each skirmish — every day is a fresh push.
- **Weekly war**: a best-of-7 of the daily skirmishes. Team holding **more days**
  at week's end wins the week → bigger reward + one leg on the season tally.
  (Territory framing makes "we're down 3–4, must take the weekend" legible.)
- **Season rivalry** (~4–8 weeks, aligned to a season/event): cumulative
  **weeks won** decides the champion → exclusive cosmetic + a permanent entry in
  the all-time **rivalry tally**. Then teams **re-roll** for the next event so a
  stomp never calcifies.

What persists vs resets: points reset per skirmish; days-won accumulate within
the week; weeks-won within the season; the head-to-head **tally persists forever**.

### Team-cosmetic rewards (reuse multi-slot + WC plumbing)

- **Team flag** (flag slot) in team colors — auto-granted on joining the rivalry,
  exactly like the World Cup allegiance flag (reuse that pick-modal + flag-overlay
  code wholesale).
- **Season-champion cosmetic** — an **aura** or **background** in the winning
  team's colors, claimable *only* by winning-side members **who cleared a minimum
  contribution** (so it's earned, not just "was on the lucky team"). Reuses the
  multi-slot aura/background slots.
- **Team titles** — tiered like achievements: "Mud Hog" (joined) → "Mud Hog
  Champion" (won a season) → rare "Rivalry Legend" (won N seasons). Slots into the
  existing `user_titles` system.
- **The tally board** — a persistent head-to-head scoreboard ("Mud Hogs lead
  4–2, all-time"). Cheap to build, high bragging-rights value, gives losing
  seasons long-term meaning ("we'll get them next time").

### Tap-race mini-game spec (the rope, as a literal game)

The push/pull *is* the game — no separate art needed.

- **Async tap sprint.** A short burst (≈15s) where you tap as fast as you can on
  your team's mascot pig; your tap count converts to rope pull for the current
  skirmish (e.g. taps ÷ 3 = points, contributing toward your 200/day cap).
- **Reuses existing juice** — the Visit screen's pig squish + flying hearts +
  heartbeat; on a strong run the pig tires (reuse the `tired` sprite), which
  naturally rate-limits and ties the metaphor together ("you tickled your team's
  pig forward until it napped").
- **Async, with a live ghost.** No realtime needed: log each session's taps and
  update the rope; show a softly-animating rope reflecting *recent* taps from both
  teams so it feels alive without presence infrastructure.
- **Cost / cooldown (open).** Either free-but-cooldown (one sprint every few
  hours) or it **spends tickles** (an economy sink, like visiting) — lever for
  whether this is pure engagement or also a snout/tickle drain.
- **Anti-bot** — server-validated tap count + a sane taps/second ceiling.

### Open questions (batch 2)

1. Normalization: average ÷N, ÷√N (lean), or raw + comeback multiplier?
2. Daily cap value — how much *can* one player matter (200? lower)?
3. Does the tap-race **cost tickles** (sink) or is it free-with-cooldown (engagement)?
4. Re-roll teams each season, or let players keep a team across events for loyalty?
5. Could the **World Cup literally be Rivalry #0** — collapse 47 countries into 2
   bracket-side super-teams for a knockout-weekend version?

---

## Batch 3 — edge cases, notifications, WC-as-Rivalry-0, build path

### Edge cases & fairness

- **Joining mid-season.** Auto-assign to the lower-active team; you contribute to
  the *current* skirmish immediately, but past weeks-won aren't retroactively
  yours. The champion cosmetic gates on a **season-long min participation**, so a
  late joiner can still earn skirmish/week rewards but may miss the top prize —
  fair, and an incentive to be there from the start.
- **Switching sides.** **Lock teams for the season** (re-roll only *between*
  seasons). This kills bandwagoning onto the winning side, which would otherwise
  destroy the rope. If switching is ever allowed, past contribution stays with the
  old team and you restart at zero with a cooldown — but the lean is *no
  mid-season switching*.
- **Time-zone fairness on the daily reset.** A fixed-TZ midnight favors players
  whose active hours align with the "fresh day." Three handlings: (a) **per-player
  rolling 24h** window (fairest, but harder to make "the day is closing!"
  dramatic); (b) **global reset, but the *weekly* result is what counts** — daily
  is just texture, so TZ skew averages out over 7 days (**leaning**); (c) reset at
  a deliberately-neutral UTC hour. Lean: (b) — keep the daily drama, let the week
  wash out the skew.
- **Dead rivalry between events.** A rivalry with no live event reads as a ghost
  town — worse than none. So: show the rivalry UI **only during an event window**;
  between events only the **tally board** persists ("next rivalry in 3 days") as
  anticipation; and tie event cadence to the existing season/WC rhythm so there's
  always a visible "next."
- **One-sided stomp.** Anti-snowball wave (pull decays toward center) + trailing-
  team comeback multiplier + per-season re-roll. Past a lopsidedness threshold,
  render "Dominating" rather than a depressing unwinnable bar.
- **Tiny early player base.** With few players a 2-team rope feels sad (3-v-2).
  Below a roster threshold, fall back to the **co-op shared-goal** shape (#3) —
  "everyone vs a target" — and switch to true PvP once the base is big enough.

### Notification hooks (push now works — build 82+)

Reuse `ensurePushPermission` + the `push_delivery` path; etiquette-capped
(≤1 nudge/day, opt-out honored):
- **"Your team's down — push! 2h left in today's skirmish"** → trailing team's
  under-contributors near reset. The generosity nudge.
- **"Mud Hogs won the day! +N snouts"** → outcome push to winning contributors.
- **"The rivalry begins: Mud Hogs vs Sky Swine"** → event-start.
- **"Your champion aura is ready to claim"** → season-end reward.
These are exactly the re-engagement pushes the notification work just unblocked —
the rivalry gives push something genuinely worth sending.

### World Cup as Rivalry #0 (the cheap pilot)

The WC already has the whole pick-a-side/flag/leaderboard-tint apparatus. Pilot
the rope on it with **zero new identity**: for the **final week**, collapse the
field into a **2-team rivalry** — e.g. the two finalist countries' backers, or
"Team Sun vs Team Moon" mapping the day's fixtures. Scoring = tickles + visits;
one snout reward. It validates the rope + scoring + reward plumbing on an audience
that *already opted into allegiance*, before committing to a permanent system.

### Phased build path

- **v0 — validate (WC-as-Rivalry-0):** one 2-team rope over one weekend, scoring =
  tickles + visits, single snout reward. Reuses WC allegiance + flags. Learn-and-
  maybe-throw-away.
- **MVP:** one rivalry event · 2 **auto-assigned** teams · **daily skirmish only**
  (no weekly/season nesting yet) · rope = √-normalized, capped contribution ·
  reward = snouts + team flag · the **tap-race is the rope** (no other mini-game).
- **v2:** weekly-war + season nesting · territory/Mud-Line · earned **champion
  cosmetics + titles + the all-time tally** · notification hooks · comeback/anti-
  snowball modifiers.
- **v3:** more mini-games off the frame (penalty kick) · cross-event meta
  (rivalry standings, "Rivalry Legend" titles).

### Open questions (batch 3)

1. Daily reset: per-player rolling 24h, or global reset with weekly-decides (lean)?
2. Run **WC-as-Rivalry-0** as the pilot before anything permanent — yes/no?
3. Min season participation to claim the champion cosmetic — what bar?
4. Below what roster size do we fall back to co-op shared-goal instead of PvP?
