# Drop 3 local login gift contract

This contract covers the local card prototype only. It does not represent a database grant, authenticated user entitlement, production receipt, or inventory ledger.

## Public interface

`LocalCardAuthorityState.loginGift` optionally stores the one Halloween 2026 receipt. Older saved states without this field remain valid.

`grantLocalHalloweenLoginGift(state, { draw, claimedAt? })` accepts a finite draw in the half-open range `[0, 1)`. It divides the five-entry `HALLOWEEN_LOGIN_GIFT_POOL` into equal quantiles and saves the selected costume/card pair. The first call atomically:

- records a `HalloweenLoginGiftReceipt` with receipt ID `local-demo:halloween_2026_login_gift_v1`;
- adds one aggregate card copy and the standard finish;
- records the cosmetic unlock against that receipt when the cosmetic was not already unlocked;
- leaves repeat progress, foil progress, pack grants, and pack receipts unchanged.

The result has `{ state, status, receipt }`, where `status` is `new` on the first grant and `replay` afterward. Every replay returns the saved receipt and the same state object regardless of the new draw or timestamp. This remains true after acknowledgement. A card already owned can therefore have its aggregate copy count incremented once by the gift, while the cosmetic unlock map still has only one provenance entry. The prototype does not claim to model separate consumable card instances.

`ackLocalHalloweenLoginGift(state, acknowledgedAt?)` records acknowledgement once. Calling it before a gift exists or after acknowledgement returns the same state. Acknowledgement is explicit; granting and restoring never acknowledge automatically.

When timestamps are omitted, the local methods use the current ISO timestamp. Callers and tests may supply a timestamp for deterministic behavior.

## Persistence rules

`restoreLocalCardAuthority` preserves a valid gift receipt across reloads. An unacknowledged receipt remains eligible for presentation; an acknowledged receipt stays acknowledged and does not reopen.

Restoration fails closed to a fresh local authority state when any saved gift invariant is invalid:

- receipt ID or campaign key differs from the local Halloween campaign;
- costume and card are not a matching pair in `HALLOWEEN_LOGIN_GIFT_POOL`;
- claimed or acknowledged timestamps are malformed;
- the selected card is missing, has no positive aggregate copy count, or lacks the standard finish;
- the selected cosmetic has no valid committed provenance, or its saved gift receipt ID is altered.

Existing pack receipt provenance wins when that pack previously unlocked the same cosmetic. Otherwise the login gift receipt is the cosmetic provenance. The local bitmap remains an aggregate demonstration state; production owns real receipt issuance and any card-instance ledger.

## Boundaries

The local grant and acknowledgement functions perform no database calls, authentication, profile writes, hat changes, UI actions, or production mutations. The UI supplies `Math.random()` only for this local demo path. Live grants must use the production authority and must never use the local draw.
