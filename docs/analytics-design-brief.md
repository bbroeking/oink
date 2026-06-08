# Analytics website — Claude Design brief

Prompts to feed Claude Design to generate a hi-fi HTML/CSS bundle for the
Tickle the Pig analytics dashboard, in the TTP paper-sticker style. Output gets
ported into the live Next.js app at `analytics-dashboard/` (data already wired
to the `analytics_overview()` Supabase RPC).

Paste **Prompt 1 (style anchor) first**, then the page prompts.

---

## Prompt 1 — Style anchor (paste first)

```
You are designing a hi-fi web UI in the "Tickle the Pig" visual style — a warm,
whimsical paper-sticker scrapbook look. Produce self-contained HTML with inline
<style> (no JS frameworks, no Tailwind, no external CSS). Use Google Fonts via
@import. This is the brand system; remember it for every screen I ask for next.

PALETTE (use these exact hex):
- ink (all text + outlines):   #2a1f15
- paper (page bg):             #fffaf0
- cream surfaces:              #fbeee2 / #f6e6d4
- rose:    #ffd6dc / deep #f8a8b3
- sky:     #c8e3f0
- sage:    #c9dec1
- sun:     #ffd87a
- lilac:   #d6c8f0 / deep #a89bff   (also = "angel")
- peach:   #ffc8a8
- accent (terracotta/rust):    #c25a3f
- goblin gold: #d4a437
- barn red: #C44848, grass green: #8FBF6A

FONTS (Google Fonts):
- Display / numbers / headings: "Fredoka" (700)
- Decorative titles:            "Caprasimo" (400)
- Body / labels:                "Nunito" (700 / 800)
- Handwritten accent ("kicker"):"Patrick Hand" (400)

THE SIGNATURE LOOK — this is non-negotiable and defines the brand:
- Every card/panel is a PAPER STICKER: solid fill, a 2.5px solid #2a1f15
  outline, rounded corners (14–22px), and a HARD DROP SHADOW that is a solid
  #2a1f15 block offset 4px right / 4px down with ZERO blur (box-shadow:
  4px 4px 0 #2a1f15). Never use soft/blurred shadows, never gradients-as-depth,
  never glassmorphism, never dark mode.
- Cards and list rows get a tiny scrapbook TILT: rotate each between -1.2deg and
  +1deg, varied so it feels hand-placed, not gridded.
- Section headers use a small handwritten KICKER above them in Patrick Hand,
  terracotta #c25a3f, prefixed with a ★ (e.g. "★ the herd"), then the title in
  Caprasimo, with a short 2px ink underline (30% opacity) beneath it.
- Pastel fills rotate across cards (rose / sky / sage / sun / lilac / peach) so
  the page reads like a sticker album, not a SaaS dashboard.
- Little glyph "stickers" sit on cards as icons: hearts, stars, sparkles,
  trophies, crowns, a pig snout, a barn, truffles, coins. Draw them as simple
  flat outlined shapes in the palette (or inline SVG), matching the cutout feel.
- Mascot: a round pink cartoon pig (Rosie). A small pig face or snout motif is
  welcome in the header.

Confirm you understand the system, then wait for the screen specs.
```

---

## Prompt 2 — Main dashboard page

```
Design the main analytics dashboard page in the Tickle the Pig style from the
style anchor. Single scrolling page, max-width ~1100px centered on the paper
background. Use the placeholder numbers below verbatim (they're real). Sections,
top to bottom:

HEADER:
- Kicker "★ tickle the pig" + big Caprasimo title "Analytics".
- A small Rosie pig sticker beside the title.
- Right side: a tilted sticker pill "updated Jun 8, 2026, 9:14 AM".

SECTION "★ the herd" (player stats) — a row of sticker stat-cards, each a
different pastel fill, big Fredoka number + Nunito label + a glyph sticker:
- Total users: 31
- Active today: 0
- Active 7 days: 17
- Active 30 days: 20
- Push enabled: 6  (sub-label "19% of users")
- VIP: 0
- Friendships: 87
- Referrals done: 0

SECTION "★ what they're doing" (all-time action totals) — same stat-card grid:
- Tickles earned: 11,539  (heart glyph)
- Tickles wasted: 1,125
- Barn visits: 208  (barn glyph)
- Blessings cast: 142  (sparkle/halo glyph)
- Curses cast: 90  (goblin glyph)
- Tickle trades: 178  (sub-label "0 open · 108 fulfilled")
- Truffles buried: 32  (truffle glyph)
- Truffle digs: 2  (shovel glyph)

SECTION "★ last 14 days" — a wide sticker panel containing a GROUPED BAR CHART.
14 day-groups along the x-axis (May 26 … Jun 8). Each group has 6 thin rounded
sticker bars (each bar = an outlined pastel rounded rectangle): Signups (sun),
Barn visits (sky), Blessings (sage), Curses (rose-deep), Trades (peach),
Truffle digs (lilac). Include a small legend with colored squares. Bars should
look like little paper sticks with the same ink outline, not a slick chart lib.

SECTION "★ mood of the herd" — two side-by-side sticker panels:
- "Happiness" (avg 46.3): chunky horizontal bars — Happy 0, Neutral 29 (most),
  Sad 2. Bars are outlined rounded pastel fills with the count + % at the right.
- "Alignment": Angel 12 (lilac), Neutral 15 (grey-ink), Goblin 4 (goblin gold).

SECTION "★ snout season 1" (battle pass) — stat-card row:
- Pass players: 23
- Avg XP: 351
- Avg tier: 3.0 (sub-label "of 30")
- Premium unlocked: 0
- Completed: 0

SECTION "★ top of the pen" (leaderboards) — two side-by-side sticker panels,
each a numbered list of tilted name rows with a big number on the right:
- "Top tickles earned": 1 Jen 1,171 · 2 tegdirb 1,139 · 3 sivleg 1,082 ·
  4 piggy 1,004 · 5 mossy absorbing… (invent plausible names for 6–10).
  Put a tiny crown glyph on rank 1.
- "Top season XP": 1 Jen 980 · 2 sivleg 910 · 3 tegdirb 880 (invent 4–10).

Make it feel like a cozy scrapbook of the game's pulse — playful, warm, legible.
Output as one self-contained HTML file with inline CSS. Make it responsive:
stat-card grids wrap, the two-up panels stack on narrow screens.
```

---

## Prompt 3 — Login / password gate page

```
Design the login gate page for the Tickle the Pig analytics dashboard, in the
style-anchor style. Full-height paper background, centered. A single paper-
sticker card (cream fill, ink outline, hard 4px offset shadow, slight tilt)
containing:
- A Rosie pig sticker at the top.
- Kicker "★ internal" + Caprasimo title "Analytics".
- One-line muted subtitle "Tickle the Pig — for your eyes only".
- A password input (rounded, ink-outlined) and a chunky ink-filled "Enter"
  button with the hard offset shadow that presses down (translate) on hover.
- A small error slot in terracotta for "Wrong password."
Output as one self-contained HTML file with inline CSS.
```

---

## After Claude Design returns

The HTML/CSS gets ported into `analytics-dashboard/app/` (page.js, login,
globals.css), keeping the live `getOverview()` data wiring. Fonts added via
Google Fonts in `app/layout.js`. The placeholder numbers above are replaced by
the real RPC values automatically.
