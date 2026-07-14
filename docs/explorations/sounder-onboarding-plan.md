# Sounder onboarding + season page rethink — first principles (2026-07-13)

Supersedes the layout half of `season-clarity-refactor-plan.md` (its copy fixes
A/C/E/F still stand). Grounded in the two 2026-07-13 audits (new-player UX walk,
reward-communication map) and player feedback: the Sounder is too hidden, the
value prop too buried, the dig too confusing.

## First principles

A new player asks five questions, in this order. The current tab answers them
out of order (story → social ask → mechanics → rewards) or not at all:

1. **What is this?** — a season where the whole barnyard steals its joy back
   from a giant who ate it.
2. **What do I do right now?** — dig truffles at his feedings.
3. **What do I get?** — truffles (buy exclusives), pass XP (tier rewards),
   weekly dig-off payouts.
4. **Why with friends?** — a Sounder digs deeper, shares milestone purses, and
   races other herds.
5. **What's the long game?** — starve him stage by stage to the season finale.

**The core inversion: show the toy before the ask.** The dig minigame is the
fun; today it's locked behind the social commitment. Onboarding must let the
player DIG FIRST (practice mode already exists in code), then convert the
"that was fun" moment into the join.

## Part 1 — the Sounder path (onboarding funnel)

A persistent, resumable state machine (`sounder_path` step, derived — not
stored — from server state so it can never desync):

| Step | State test | Surface | CTA |
|---|---|---|---|
| 0 HOOK | hasn't seen tale | existing 29s video (unchanged) | "see the season ›" |
| 1 TASTE | no practice dig logged | **practice dig card** — "try a dig — no herd needed" launches the practice patch | play it |
| 2 VALUE | practiced, no crew | **one screen, three benefit stickers**: keep what you dig (truffles → Exchange preview art) · level your pass (next reward art) · dig deeper with a herd (25 vs 20 stirs + weekly payout table 6/5/4) | "join a Sounder ›" |
| 3 JOIN | no crew | join door (invites → open sounders → found-in-one-tap) | Join / Found it |
| 4 FIRST REAL DIG | crewed, 0 real digs | if window open → straight into the patch; else countdown + **notify me** opt-in ("we'll oink when the patch opens") | dig / notify |
| DONE | crewed + ≥1 real dig | normal season tab | — |

**"Prompt every single time" — the cadence contract.** Until DONE:
- The season tab's **primary card IS the current step** (not dismissible — it
  replaces the "next move" slot, everything else renders below it).
- The **Barn chip** (already shipped) persists every session, wired to the
  current step rather than always the join door.
- The **once-per-session modal** (existing SounderLaunchModal) stays, but its
  body/CTA reflect the current step (e.g. "try a dig" at step 1, not "join").
- After DONE, all three surfaces retire automatically — the state machine, not
  dismissal flags, decides. Nobody who finished is ever nagged; nobody who
  hasn't is ever without a next step.

Two escape valves so persistence never curdles into nagging: the modal stays
once-per-session (never more), and the inline card compresses to a single-line
version after the 3rd session at the same step ("still herdless — join a
Sounder ›") so it keeps prompting without shouting.

### Step 1 details (the taste)
- Practice patch exists (`useRooting` practice fallback + "practice patch"
  badge in TrufflePatch). Add: launchable while crewless from the step card.
- End-card for practice: show what a REAL dig would have banked ("you'd have
  kept 2 Golden Truffles — a Sounder digs for keeps") + step-2 CTA.
- Optional sweetener (DECISION): first practice dig mints 1 real Golden
  Truffle ("beginner's snout") so the Exchange preview isn't hypothetical.

### Step 4 details (closing the loop)
- If the patch is guarded at join time, the moment is lost today. The notify
  opt-in ("oink me when it opens") is the retention hinge — one local push at
  next window open. Uses the existing push infra; one new scheduled local
  notification, no server change.

## Part 2 — season tab, reordered from first principles

Top to bottom (each block answers one of the five questions, in order):

1. **VALUE BANNER** (Q1) — compressed hero: vignette thumbnail + stage +
   one loop line: *"dig at his feedings — keep the truffles, level your pass,
   starve him together."* Tap → story/ladder (full HungerHero moves into this
   sheet; the tab keeps only the compressed strip).
2. **DO THIS NOW** (Q2) — the state card: onboarding step (pre-DONE) or dig
   CTA "dig for truffles — closes in 2h 10m" / countdown + notify. ONE
   primary button, always. The 8h rhythm becomes a **visible window strip**
   (little timeline: open ▓▓ guarded ░░ with "you are here") — the single
   biggest dig-confusion fix; the rhythm is currently invisible prose.
3. **YOUR TAKE** (Q3) — personal value strip: pass tier ring + next-reward
   art ("next: Golden Bog Aura, 40 XP away") + truffle pouch count → tap to
   Exchange. Rewards stop being abstractions the moment the next one is a
   picture.
4. **YOUR HERD** (Q4) — roster + milestone bar + dig-off standings (with the
   payout table finally stated). Crewless: this block IS the step-2/3 card.
5. **THE LONG GAME** (Q5) — hunger ladder + finale promise line (needs the
   finale-reward decision from the clarity plan) + pass track below.

BountyBoard leaves the season tab while feature-dark (clarity-plan Q4).

## Part 3 — dig comprehension fixes (beyond the tab)

- Window strip (above) is primary.
- Patch explainer chip: shipped today (scroll icon). Keep.
- Post-dig end card gets one forward-looking line: "next feeding opens at
  {time} — we can oink you" (notify opt-in again, at the moment of highest
  intent).
- Copy rule from the clarity plan holds: "root the patch" always subtitled
  "dig for truffles"; "joy" retired from mechanical copy.

## Build phases (each shippable alone)

| Phase | Contents | Size |
|---|---|---|
| P1 | Loop line + tab reorder + window strip + BountyBoard hidden | M |
| P2 | Onboarding state machine + step cards (taste/value/join) + practice-dig launch for crewless + modal/Barn-chip wiring to steps | L |
| P3 | Notify-me local push at window open (step 4 + end card) | S |
| P4 | YOUR TAKE strip (next-reward preview, pouch → Exchange) | M |
| P5 | Copy pass from clarity plan (C/E/F) folded through | S |

P1+P5 fix "way more obvious what to do" immediately; P2 is the full funnel;
P3 closes the loop. Suggested order: P1 → P2 → P3 → P4 → P5 rides along.

## Metrics that say it worked

Join rate (crewless → crewed within 2 sessions), taste rate (practice digs by
crewless players), first-real-dig rate within 24h of joining, window-return
rate (dug two consecutive windows), and step-stall counts (which step loses
people). All derivable from existing tables except practice digs (client
event — one analytics counter).

## Decisions needed (Brian)

1. **Beginner's snout**: does the first practice dig mint 1 real Golden
   Truffle? (Makes step 2's value screen concrete; costs ~nothing.)
2. **Notify-me**: local scheduled push at next window open — approve the
   pattern? (No server change; per-player opt-in.)
3. **Hero demotion**: OK compressing the HungerHero to a strip with the full
   art one tap away? It's the emotional anchor but currently costs the whole
   first screen.
4. Carries over from the clarity plan: finale reward, naming the milestone
   purse amount.
