# Trade Interface — "The Tickle Stockyard, est. 1924"

A 1920s livestock-yard reskin of the Tickle Trade modal. The trade
*mechanics* are unchanged — this is purely presentation + theme.

---

## How we trade (the states the UI must show)

Post trade-economy flip there are exactly two live states:

| State | Meaning | Actions |
|---|---|---|
| **Incoming request** | a friend asked YOU for N tickles | **Give N** (spend N → they pocket 2N) · **Pass** |
| **Outgoing request** | YOU asked a friend, pending | **Withdraw** |

Fulfilled / cancelled trades are terminal — not shown. New requests
start from a friend's UserSheet, not here.

---

## The theme

A weathered 1920s stockyard / livestock-auction house. Warm aged
wood, cream auction paper, ink, chalk. Harmonizes with the cozy
storybook palette — a deepening, not a clash.

### Layout

```
╔═══════════════════════════════════════╗
║   ┌─────────────────────────────────┐ ║  hanging woodtype sign
║   │   ☛ THE TICKLE STOCKYARD ☚      │ ║  (gentle sway)
║   └─────────────────────────────────┘ ║
║                                        ║
║   AT THE GATE                          ║  incoming requests
║  ┌────┲━━━━━━━━━━━━━━━━━┱──────────┐   ║
║  │ 🐷 ┃ briguy · Greedy ┃ ╱ GIVE ╲ │   ║  pen card
║  │    ┃ lot 14 · wants 2┃ ╲      ╱ │   ║
║  └────┺━━━━━━━━━━━━━━━━━┹──────────┘   ║
║                              · pass · ║
║                                        ║
║   OUT TO MARKET                        ║  outgoing requests
║  ┌────┲━━━━━━━━━━━━━━━━━┱──────────┐   ║
║  │ 🐷 ┃ alice           ┃ withdraw │   ║
║  │    ┃ consigned · 3   ┃          │   ║
║  └────┺━━━━━━━━━━━━━━━━━┹──────────┘   ║
║                                        ║
║   ╴╴ today's tally: 3 given ╴╴╴╴╴╴╴╴   ║  chalkboard ledger
╚════════════════════════════════════════╝
```

### Elements

- **Header** — a hand-painted wooden sign hanging on two chains,
  "THE TICKLE STOCKYARD" in chunky display type, slight sway anim.
- **"At the Gate"** (incoming) — each request is a *pen card*: the
  friend's pig penned behind a wooden fence-rail (the card's top
  border *is* the rail), a chalk **lot tag** ("lot 14 · wants 2"),
  their alignment shown beside the name. Big brass **GIVE** button;
  declining is a quiet "· pass ·".
- **"Out to Market"** (outgoing) — your consigned lots, awaiting a
  buyer; **withdraw** pulls one back.
- **Cancelled feedback** — a red rubber-stamp "WITHDRAWN" beat.
- **Empty state** — "The yard's quiet. No lots at the gate today."
- **Footer** — a chalkboard tally of the day's trades.

### What's View-styled vs art

| Element | How |
|---|---|
| Fence rails, pen frames | View borders / the `Sticker` component |
| Brass GIVE button, "pass" | View styling |
| Chalkboard tally | dark View + light hand font |
| Section labels, sign text | text (display font) |
| **Wood-plank background texture** | 🎨 Midjourney |
| **"WITHDRAWN" rubber stamp** | 🎨 Midjourney |
| **Hanging sign plate** | 🎨 Midjourney (optional — View fallback exists) |

---

## Midjourney prompts (accent art)

Midjourney can't do reliable text or true transparency — prompt
**blank faces** + **plain backgrounds**, overlay text in-app, knock
out backgrounds in post.

### 1. Wood-plank background texture (tileable)
```
seamless tileable weathered barn wood plank texture, warm aged
honey-pine, soft visible grain, gentle horizontal planks, cozy
children's storybook illustration, flat soft painted shading, muted
warm palette, no text --tile --ar 1:1
```

### 2. "Withdrawn" rubber stamp (blank — text added in-app)
```
a single distressed vintage rubber stamp imprint, empty oval double
ruled border, smudged faded red ink, ink-bleed rough edges, plain
off-white background, flat 2D, storybook illustration, no text,
no letters --ar 1:1
```
*(App overlays the word "WITHDRAWN" in the oval.)*

### 3. Hanging auction sign (blank face)
```
a hand-painted wooden hanging shop sign, weathered planks, rounded
corners, two small iron hanging rings at top, blank empty sign face,
1920s livestock auction yard, cozy storybook illustration, bold
~3px outline, flat painted shading, plain background, no text
--ar 3:1
```
*(App overlays "THE TICKLE STOCKYARD".)*

### 4. Brass auction paddle (optional GIVE-button accent)
```
a small auction paddle, round brass head, short wooden handle,
cozy storybook illustration, bold ~3px black outline, flat painted
shading, plain background, no text --ar 1:1
```

---

## Build notes

- Reskin `components/TickleTradeModal.tsx` — keep `useTickleTrades`,
  the `fulfill` / `cancel` RPC calls, and the trade filtering exactly
  as-is. Only presentation changes.
- Art slots use a placeholder colour fill until the Midjourney PNGs
  land in `assets/images/stockyard/`.
- Wood texture: `ImageBackground` once the PNG exists; until then a
  flat warm-wood `backgroundColor`.
