# Spooky Trader daily wearable loop

Status: isolated local domain prototype. Its configurable `7` Tickles is a draft value, not a live balance grant.

## Loop

The Ghost Sheep Trader asks each pig for one Halloween wearable. The request is stable for that player, local day, and set even when the player cohort changes; independent assignments may occasionally collide. A player who lacks the item trades one actual wearable instance with a friend, then hands the requested instance to the Trader. The trade conserves both items. Redemption is an explicit sink and its idempotent receipt describes the consumed item and draft Tickles.

This uses neither card copies nor Satchel Finds. Finds already feed the live Trader, and Satchel Swap deliberately mints no currency. The requested social object is the wearable itself: after trading or redeeming it, the former owner cannot equip that instance.

## Ownership consequence

The current first-card rule permanently unlocks a cosmetic. A permanent boolean entitlement cannot also be transferred or consumed. This prototype introduces collectible **wearable instances**. A first-card acquisition can mint one instance once, recorded under the canonical set/player/wearable source rather than a caller nonce. Replaying or reacquiring that same card ownership does not restore an instance after trade or redemption; replacement acquisition needs separate earned design. Production must resolve the wearable through a trusted card mapping.

That is a product and migration decision because existing players were promised permanent unlocks. Production must either add instance ownership beside the historical entitlement or explicitly change the promise. It must not silently treat today's permanent cosmetic IDs as disposable.

## Invariants and economy

- Friend trade atomically exchanges two owned instances and conserves each identity.
- Redemption requires current ownership and yields `instances before = instances after + receipt quantity`.
- One receipt per player/day plus a client nonce prevents duplicate consumption and reward.
- First-card mint receipts are idempotent and never regrant a disposed item.
- Every increment uses checked safe-integer arithmetic, and both trade destinations are preflighted before mutation.
- The prototype changes fixtures only: no server, Closet, message, or balance mutation.

Eligible instances should be earned. Cash-sold cards or wearables that can become Tickles create pay-to-currency. Paid-origin instances must be ineligible, or the reward must stop being spendable currency. Record mint provenance rather than inferring it later. Tune the draft reward against regeneration, live Find Trader prices, item supply, completion rate, and the real cost of losing an equipable item.

## Production plan

Add a wearable-instance ledger with immutable mint provenance, current owner, and terminal consumed state. Materialize one persisted request keyed by user, local day, and set using the server-known feeding time zone. Trade two locked instance IDs only after both players confirm the same revision. Redeem by locking the request and instance, validating ownership and origin, consuming the instance, inserting the nonce receipt, and granting tuned earned Tickles in one transaction. Return prior receipts on replay. No database change is included in this prototype.
