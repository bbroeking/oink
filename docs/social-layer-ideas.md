# Social layer — next big direction (ideas, to-do)

Status: **brainstorm / not started.** The next major direction for the game is
a real social layer: seeing and interacting with *other people's* pigs, not
just your own Barn. Two framings below — they're not mutually exclusive. The
recommendation is to build **Idea 2 (barn visiting)** first as the social
primitive, then layer **Idea 1 (teams)** on top as a seasonal meta-game.

---

## Idea 1 — Teams (Team A vs Team B, push & pull)

Two pig-themed factions. Each player picks a side. A **tug-of-war** meter sits
between them — collective activity pushes the rope toward one team or the
other. Mini-games hang off the team frame.

**Pig-themed team name candidates** (pick two, opposites):
- Mud Hogs ⛏️ vs Sky Swine ☁️
- Truffle Club 🍫 vs Slop Squad 🥣
- Sunrise Sows 🌅 vs Midnight Boars 🌙
- Pink Pen vs Golden Pen

**Core loop (push/pull):** each team's pull = sum of its members' activity
(tickles given, visits, mini-game wins…) over a window. The rope position is
`teamA_score − teamB_score`, normalized. A window (daily? weekly?) closes,
the leading team wins, everyone on it gets a reward, the rope resets.

**Keeping teams "similarly active":** balance by *assignment* rather than free
choice — when a player joins, auto-place them on the team that's currently
lower on **active** players (not headcount), so the sides stay competitive.
Alternatively let them choose but weight scoring by team size so a smaller team
isn't doomed.

**Open questions**
- Pick-a-side: free choice, balanced auto-assign, or choose-but-normalized?
- What activity feeds the pull? (tickles given is the obvious one)
- Cadence + win condition: daily skirmish, weekly war, season-long?
- Winner reward: snouts, an exclusive cosmetic, a team badge/title?
- **Relationship to alignment (angel/goblin schism).** The game already has a
  two-faction axis. Is "teams" a NEW orthogonal axis, or a reframing/merge of
  the existing schism? This is the biggest design fork — decide before building.
- Relationship to World Cup allegiance (already a 47-way "pick a side"). Teams
  is the 2-way version; could the WC be the first instance of the team frame?
- Mini-games: open-ended bucket (see below) — which one is the v1?

---

## Idea 2 — Barn visiting (simple, foundational)

> **Full mechanic design + depth: [`barn-visiting-design.md`](./barn-visiting-design.md).**
> Spine: *visiting is giving, not earning* — which solves anti-farming and feeds
> the alignment axis. Covers the gift loop, buried truffles, streaks, visit
> limits, and staging (MVP → v2 warmth loop → v3 depth).

I visit your Barn, you visit mine. See another player's pig with their equipped
cosmetics, background, stats. Framed as **"a better form of trading tickles"** —
instead of an abstract trade, you physically go to their Barn and *do
something* there.

**Entry points:** Friends list + Leaderboard rows → "Visit Barn."

**What you can do on a visit (the key question):**
- Tickle their pig → they receive tickles (the social version of the trade)
- Leave a blessing / little gift
- Sign a guestbook / leave a reaction
- See what they've got equipped (drives cosmetic envy → Shop)

**Async vs live:** simplest is **async** — you visit a snapshot of their Barn
(their profile + equipped items), no real-time presence needed. Live presence
is a much bigger lift; defer.

**Open questions**
- What's the core *action* on a visit? (tickle-for-them is the MVP)
- Anyone-can-visit vs friends-only? (privacy)
- Daily caps / cooldowns so it isn't farmable?
- Does this **replace** the current tickle-trade ritual, or sit beside it?
- Rewards for the visitor vs the visited?

**Why first:** it's the smaller build, it's an immediate upgrade to tickle
trading, and "view another player's pig" is the exact primitive Idea 1's teams +
mini-games need anyway.

---

## Mini-games bucket (hang off either idea)

Open-ended — capture ideas as they come. Each wants its own spec before build.
Candidates: penalty-kick (World Cup tie-in), tug-of-war tap race, pig-race,
hide-the-truffle, daily trivia. **Not scoped yet** — placeholder for later.
