# Halloween seasonal-card trading contract

Status: renderer-neutral local demo contract. It has no production persistence, RPC, notification, token, or reward authority.

## Player contract

A trade is a private exchange between two known fixture players. One participant proposes one exact seasonal card identity, finish, and quantity in exchange for one exact seasonal card identity, finish, and quantity from the other participant. Standard, foil, and living quantities are distinct. A participant may offer only reserved spare inventory: after every pending reservation and the proposed transfer, that owner must retain at least one copy of the card identity across all finishes.

Creating an offer reserves both sides' stated assets in the demo authority. Its creation and expiry timestamps come from the integration's clock seam; participant input supplies a positive lifetime, not timestamps. Revising an offer increments its revision and clears every confirmation without extending the original expiry. A revision at or beyond expiry terminates the offer instead of reviving it. Both named participants must confirm the same revision before either inventory changes. Confirmation and receipt completion time also come from the clock seam, so a participant-provided or backdated timestamp cannot bypass expiry. The second valid confirmation performs both transfers atomically and produces one immutable receipt. Repeating confirmation of that completed revision returns the same receipt and never transfers again.

Cancellation, expiry, and blocking are terminal. They release the local reservation and cannot be confirmed later. Blocking also terminates every pending offer between that pair. Self-trades, unknown players, non-seasonal/base cards, unknown finishes, invalid quantities, stale revisions, last-copy transfers, and exact-finish underflow are rejected.

The first time a recipient ever acquires a seasonal card identity through the prepared demo history, the matching permanent local cosmetic is granted if it is not already owned. A pre-owned cosmetic is not duplicated. Trading a card away never removes a cosmetic from the sender.

## Demo authority and reload integrity

`features/cards/domain/seasonalTrading.ts` is deliberately isolated from `LocalCardAuthorityState`. That older local prototype aggregates copies for pack-opening and foil progress and has no two-owner transaction or reservation model. The Halloween trading fixture seeds two players, exact finish quantities, and matching cosmetics under the explicit `local-seasonal-trading-demo` authority notice.

`createSeasonalTradingDemo` prepares fresh fixture state. `reconstructSeasonalTrading` accepts an unknown stored array and rebuilds completed ownership from the app-authored seed plus ordered, app-prepared immutable trade receipts. Before nested access it validates the receipt, participant, transfer, asset, grant, ID, positive revision, nonnegative completion time, and chronological order shapes; it then checks seed/set identity, spare-copy rules, conservation, and expected cosmetic grants. Pending offers are ephemeral and are not inferred from receipts. This detects corrupt local demo data; it does not sign receipts, authenticate client data, or make the demo safe for live rewards. A UI may persist a prepared snapshot separately, but it must either validate it against the seed and receipts or discard it and reconstruct; raw client inventory is never reward authority.

## Production activation contract

The repository currently has no production seasonal-trading RPC, tables, ordered row-lock implementation, or server friendship/block enforcement. Activation needs a server-owned transaction with this order:

1. Authenticate the caller and resolve the two user IDs from the stored trade; never accept a recipient token or client-authored reward identity.
2. Lock the trade row, then lock both participant inventory owners in stable user-ID order, then lock the exact card/finish ownership rows in stable `(owner_id, card_id, finish)` order.
3. Re-read status, expiry, block/friend eligibility, revision, both confirmations, exact quantities, all other pending reservations, and the keep-one-total-identity invariant while locks are held.
4. Apply both debits and credits in one database transaction, rejecting any negative quantity. Insert first-acquisition cosmetics through the server's canonical cosmetic grant path; never trust a client-created cosmetic or card grant.
5. Insert a unique immutable receipt keyed by trade ID and revision, mark the offer completed, and commit. A retry with the same idempotency identity returns that receipt. A conflicting payload or revision fails without mutation.

Production also needs authorization/RLS tests, stable lock-order concurrency tests, idempotency tests before and after commit ambiguity, friendship and blocked-user tests, expiry at the server clock, reservation cleanup, audit retention, and exact standard/foil/living conservation checks. No SQL or production call is implemented by this demo.

## Renderer-facing interface

The bounded module exports state transitions for opening, revising, confirming, cancelling, expiring, and blocking, plus `availableSeasonalTradeQuantity` and receipt reconstruction. Opening takes a `ttlMs`; opening, revision, confirmation, and expiry accept a `SeasonalTradingClock` function and default to `Date.now`. Renderers consume returned state and receipts; they do not calculate grants, reservations, transfers, or authoritative timestamps. `HALLOWEEN_TRADING_DEMO_SEED` is ready for a local two-seat friend-trade fixture and sends no real message. Its registry entries use the authored Spooky Snouts IDs: Moonbrew Witch Hat (`halloween_2026_card_moonbrew_witch_hat` → `moonbrew_witch_hat`), Hollow Jack (`halloween_2026_card_hollow_jack_costume` → `halloween_2026_hollow_jack_costume`), and Lantern Porch (`halloween_2026_card_lantern_porch_bg` → `lantern_porch_bg`).
