# Provision stock prototype

Question: How should the returning crop-choice screen reveal the player’s existing harvested Provision stock without becoming an inventory panel or prescribing a correct crop?

Three variants live on the existing returning crop-choice route and switch with `?stockhint=A|B|C`:

- **A — Crop stamps:** a small `N at Home` paper stamp lives on each crop choice.
- **B — Shared pantry shelf:** a compact stock shelf separates the purpose prompt from the crop choices.
- **C — Action + stock:** each crop action keeps its verb and adds the current `N at Home` count beneath it.

The review state represents the first returning morning after a complete Glowroot Adventure: 4 Clover Lunch and 0 Moonberries at Home.

## Rendered verdict

**C — Action + stock wins.** It preserves the existing crop art, purpose prompt, crop duration, guaranteed yield, Adventure effect, and explicit action verb. The current stock count appears exactly where the player commits the choice, without adding a new inventory surface.

- A stayed compact, but the corner stamps competed with the crop art and were easy to miss.
- B made the screen read like a pantry/inventory panel and compressed both crop choices from about 129px to 101px tall.
- C kept both crop choices about 129px tall, kept the whole panel about 223px tall, retained one authored Rive canvas, and produced no page overflow in the rendered review viewport.

Production should keep only C and remove the prototype query, switcher, pantry shelf, and stamp treatments.
