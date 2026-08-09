# Returning crop choice — visual translation

## Design question

How should the returning crop choice borrow the approved physical seed-tray language and become legible at phone scale while preserving the five facts the player needs to make an informed Adventure preparation choice?

The five facts are crop identity, growth duration, guaranteed yield, Adventure use, and current stock at Home. Choosing either crop must remain one tap, ready crops must still wait safely, and the Farm must remain visible as a place rather than becoming a dashboard.

## Approved visual context

- [`02-farm-stock-seed-choice.png`](../../../assets/concepts/homegrown-adventures/end-to-end-flow/rosie-v3/02-farm-stock-seed-choice.png) is the primary composition reference: one strong question, recognizable physical crop objects, a wooden tray, large labels, and the Farm and Rosie still carrying the fantasy.
- [`03-plant-and-compost.png`](../../../assets/concepts/homegrown-adventures/end-to-end-flow/rosie-v3/03-plant-and-compost.png) is the interaction reference: one clear next action, optional Compost, and a physical relationship between the chosen crop and the bed.
- [`rosie-v3/README.md`](../../../assets/concepts/homegrown-adventures/end-to-end-flow/rosie-v3/README.md) locks the end-to-end story, touch-first format, Rosie model, and paper-craft visual language.

These images are composition references, not bitmap screens to import. The live prototype uses separable harvest-basket art already present in the production asset set so the crop objects can remain independently animated and interactive.

## Current rendered gap

The deployed v0.131 checkpoint correctly attaches duration, guaranteed yield, Adventure use, and current Home stock to each choice. However:

- the crop identities are abstract `☘` and `●` marks rather than physical things from Rosie's Farm;
- supporting facts render at roughly 6–7 px inside dense cards;
- the eye reaches two nearly equal text blocks before it recognizes what is being grown;
- the separate route receipt repeats information instead of helping the first scan.

This is a hierarchy and legibility problem, not a missing-system problem.

## Locked invariants

- Rosie’s current curiosity remains the reason for choosing a crop.
- Clover Lunch and Moonberries remain equally valid, freely chosen preparations.
- Clover takes 4 hours and yields 3 guaranteed; Moonberries take 8 hours and yield 4 guaranteed.
- Route-specific use and current stock remain attached to each crop.
- No crop spoils, and selecting a crop still advances directly to planting or tending.
- No additional inventory panel, currency row, stat dashboard, or modal is introduced.
- The existing crop-basket art remains separable so later Rive or CSS motion can add idle, hover, selection, planting, growth, and harvest beats.

## Prototype variants

### A — Illustrated tiles

Two side-by-side paper cards keep the current compact footprint but replace abstract glyphs with large crop baskets. Identity, facts, and action form four explicit vertical beats.

Hypothesis: this is the safest improvement and preserves the most Farm scenery, but the narrow cards may still make the Adventure-use line feel compressed.

### B — Physical seed tray

Two illustrated cards sit inside one wooden tray, translating the approved concept most directly. The question becomes a cream paper sign and the tray makes both crops feel like objects selected from Farm stock. The redundant route receipt is removed in this variant because its facts already live on the two crops; that space is reinvested in larger crop art, supporting facts, and action plates.

Hypothesis: this produces the strongest farming fantasy and clearest relationship to the approved art while retaining the two-choice scan.

### C — Field labels

Two full-width horizontal crop rows use a large harvest image at left, readable crop facts in the center, and one action plate at right.

Hypothesis: this is the most legible phone-scale structure, but may feel more like a settings menu and cover too much of the Farm.

## Evaluation criteria

The winner must be judged in the rendered 390 × 844 game, not from source alone:

1. A player can name both crops before reading the supporting copy.
2. Duration, guaranteed yield, Adventure use, and current stock are readable without zooming.
3. The primary tap target for either crop is at least 44 px and visually obvious.
4. Rosie's Farm remains the dominant place behind the choice.
5. The layout has no horizontal overflow at 390 px or 320 px.
6. Hover, press, disabled, keyboard-focus, and reduced-motion states remain understandable.
7. Selecting Moonberries advances to the rooted Moonberry planting/tending state; selecting Clover advances to Clover planting.

## Review route

Use `?debug=1&variant=A&mode=loop&position=2&route=lanternleaf&repeat=1`, then switch A/B/C with the prototype switcher or the left/right arrow keys. The production checkpoint must include only the selected composition and no player-facing variant switcher.

## Rendered verdict

**B — Physical seed tray wins.** It most closely translates the approved `02-farm-stock-seed-choice.png` composition while staying inside the existing Farm screen. The harvest baskets make crop identity immediate, the wooden frame makes the choice feel like selecting stock from Rosie's Farm, and removing the duplicated route receipt creates one calmer reading order:

1. what Rosie needs;
2. the two physical crops;
3. each crop's duration, guaranteed yield, route use, stock, and action.

In the rendered 384 × 838 phone layout, each crop is one 166 px-tall visible tap target after the desktop preview scale. Crop names render at 15 px, duration and decision facts at 10 px, stock at 9 px, the phone has `clientWidth === scrollWidth`, one authored Rive canvas remains mounted, and the player build contains no variant switcher. Selecting Moonberries advances to the rooted Bed 2 tending state with optional Compost; Clover remains the one-tap planting path.

- A improves the current screen safely, but still reads as two generic cards followed by a repeated route receipt.
- C has the fastest left-to-right fact scan, but its stacked rows feel like a settings list and suppress too much of the physical Farm choice.
- B is the strongest balance of legibility, established fantasy, approved visual language, and available scene space.

Production should keep only B, remove all experiment labels and conditional variant markup, and preserve the separable basket assets for later hover, selection, planting, and harvest motion.
