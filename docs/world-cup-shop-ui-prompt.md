# World Cup Shop — UI generation prompt

Prompt(s) for generating the **World Cup shop** screen mockup, tuned to Tickle
the Pig's cozy paper-sticker look (so the output drops into the existing Shop,
not a generic sports app). Use with the `reference-to-ui` flow: generate the
hero screen first, then the component sheet, then extract CSS.

Design tokens to keep it on-brand (from `constants/theme.ts`): warm cream
paper `#fffaf0`/`#fbeee2`, ink brown `#2a1f15`, pastel accents (rose `#ffd6dc`,
sky `#c8e3f0`, sage `#c9dec1`, sun `#ffd87a`, lilac `#d6c8f0`), **hard sticker
drop shadows** (offset 4px/4px, NO blur, ink-colored), rounded cards with
2–3px ink borders and a slight playful tilt, chunky rounded display type
(Fredoka/Caprasimo feel) with hand-written accents (Patrick Hand feel).

---

## Master prompt — hero screen

> A mobile game shop screen, portrait orientation, in a **cozy hand-drawn
> storybook / paper-sticker style** — warm, whimsical, soft, NOT a corporate
> sports app. The screen is a special **World Cup event shop** for a cute game
> about dressing up a pet pig.
>
> **Theme dressing:** a gentle "Hog Cup" soccer celebration — strings of
> triangular **bunting/pennants** across the top, a friendly **soccer ball**
> motif, soft **grass-green** pitch accents, a little confetti. Festive and
> cozy, like a village fête — absolutely NO real FIFA branding, no real team
> crests, no real flags-as-logos, no neon, no casino/betting styling.
>
> **Palette:** warm cream paper background (`#fffaf0`), ink-brown linework
> (`#2a1f15`), pastel pop accents (rose, sky-blue, sage-green, sun-yellow,
> lilac). Every card is a **paper sticker** with a 2–3px ink border, rounded
> corners, a slight playful tilt, and a **hard drop shadow** (solid, offset
> down-right, no blur). Chunky friendly rounded headings; hand-written
> sub-labels.
>
> **Hero element (top):** an adorable round cartoon **pig** wearing a soccer
> **kit/jersey + a country fan scarf + tiny cleats**, happily holding a small
> soccer ball. Big friendly title banner reading **"World Cup Shop"**.
>
> **Layout, top → bottom:**
> 1. Themed header banner with bunting + the title + the hero pig.
> 2. **"Represent your country"** row — a horizontal strip of small round
>    **flag chips** to pick an allegiance, one chip highlighted as selected.
> 3. **Country racks** — a grid of sticker cards. Each card shows: a country
>    **flag**, that country's **signature cosmetic item** (e.g. a tiny
>    croissant, a cup of tea, a maple leaf), the **country name + a fun
>    title**, and a small **price pill** showing a coin icon + number.
> 4. **Soccer gear** section — neutral items: a soccer ball, cleats, a fan
>    scarf, goalie gloves, a little trophy — same sticker-card treatment.
> 5. A highlighted **"Support your country" bundle** card.
>
> Cohesive, joyful, cozy, readable. Mobile portrait, ~1080×2340.

## Variation prompts

- **Component sheet:** "Same cozy paper-sticker style and palette. A UI
  component sheet on a neutral cream background showing, separated and
  labelled: one country cosmetic card (flag + signature item + name + title +
  coin price pill) in default / owned / equipped states; a round flag
  allegiance chip in selected + unselected states; a soccer-gear card; the
  'Support your country' bundle card; a confederation filter tab bar; a
  themed section header with bunting."
- **Header only:** "Just the World Cup Shop header banner — bunting, the title
  wordmark in chunky rounded storybook type, and the hero pig in a kit + scarf
  holding a ball. Transparent/cream background, sticker style."

## Guardrails to repeat in every prompt

- Cozy storybook / paper-sticker — match the existing game, not a sports app.
- **No real FIFA marks, team crests, sponsor logos, or photorealism.**
- No dark mode, no neon, no betting/casino aesthetic.
- Generic flags are fine as cosmetics; never style a flag as a brand logo.
- Remember the **sanctions denylist** (`world-cup-countries.md`) — those
  countries' flags must not appear in any generated mockup either.
