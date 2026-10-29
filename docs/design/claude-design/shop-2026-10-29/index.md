# Shop: the seasonal shelf (2026-10-29)

Design canvas: https://claude.ai/artifact/SKRAMAmuFP63goc7QApGau

A dated shelf whose first tenant is Halloween 2026 (Spooky Snouts: 29 accessories + 9 backgrounds in scope; the 11 costumes wait on a body slot) and whose next is a winter set. The build reaches players after Oct 31, so the window is generic: a `seasonal_shelves` row (key, title, kicker, opens_at, closes_at), "leaving in N days" from `closes_at`, new pieces sold only inside the window, returning pieces (Skull Mask, Pumpkin Patch, Firefly Lantern, Candy Land) keeping their daily-drop life after it.

Three directions, one row each, six 390x844 boards per row (shop landing, the set, preview/try-on, buy, owned/equip, after the window). A sticky per row states pillar fit, what changes vs today's shop, the server change and the build hours for one Opus engineer with 2.5 h.

| Direction | Boards | The one idea | Hours | Server |
| --- | --- | --- | --- | --- |
| A · The Third Plank | `Main`, `A2_Set`, `A3_Preview`, `A4_Buy`, `A5_Owned`, `A6_Closed` | A third plank in today's wall with bunting and a leaving-in kicker; "all 16" opens the set as a sheet; today's preview sheet with one lilac tag; one-tap buy; bare plank for 3 days after close. | ~2.5 (fits; cut = the set sheet) | `seasonal_shelves` + `hats.shelf_key/shelf_lane`; `seasonal_shelf()`; `daily_shop()` excludes new rows; `buy_hat()` window check |
| B · The Pop-up Stall | `B1_Shop` .. `B6_Closed` | A painted stall card opens its own route: hero stage that tries on what you tap, a haul meter, New · Back · Yours, ConfirmDialog on buy; packed-up sign after close. | ~3.5 (2.5 cut: no in-place try-on, no meter) | A's plus `backdrop_hat_id`, theme, `owned_count` |
| C · Dress for the Night | `C1_Shop` .. `C6_Closed` | The shelf is a fitting room: slot rail, pickers, every tap dresses her, price tags hang off unowned pieces, one basket buys the look, share the look. | ~5.75 (two sessions) | A's plus atomic `buy_hats(uuid[])` and a share card |

Recommendation on the canvas: build A today; fold in B's countdown language and a "Yours" segment if the clock allows; B's route then C's basket are what the shelf grows into for the winter set.

Art: the Halloween shop art folders (`assets/images/hats/halloween-2026/`, `assets/images/backgrounds/halloween-2026/`) were empty at build time, so every Halloween piece on the boards is the trading-card art from `assets/images/trading-cards/halloween-2026/` as a stand-in, downsampled; existing items are their shipped sprites; Rosie is `sprites/rosie/idle_1` at rest. Overlay placement is eyeballed, not the renderer's RelSpec. Tokens were copied by hand from `constants/theme.ts` (the "Tickle the Pig" design-system artifact existed but was still empty). Regenerate with `python3 gen.py` (asset urls are the canvas's uploads); `canvas.json` lays the boards out.
