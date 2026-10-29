# Spooky Trader domain review

Date: 2026-10-14  
Scope: `features/cards/domain/spookyTrader.ts` and `__tests__/cards-spooky-trader.test.ts`  
Product interpretation: the Trader takes owned wearable instances in exchange for draft Tickles. This is an isolated local demo; production authentication and server transactions remain explicitly outside this module.

## Final disposition

Re-reviewed against the current module and six-test suite on 2026-10-14. All three original P1 findings are resolved. The targeted command `npm test -- --runInBand __tests__/cards-spooky-trader.test.ts` passes all six tests. No blocking correctness finding remains for this pure-state local prototype.

### Resolved — daily request is independent of cohort membership

`spookyTraderRequestFor` now hashes `setKey`, `day`, and `playerId` directly. It no longer uses a sorted-player index, so adding or removing another fixture player cannot reroll an existing player's request. Different players may legitimately collide on the same wearable.

The regression recreates the state with a newly joined player and confirms Rosie's item is unchanged.

### Resolved — alternate ownership IDs cannot remint the first-card wearable

The grant receipt key is now canonical to `(setKey, playerId, wearableId)` rather than the caller-provided ownership nonce. A later call with a different `cardOwnershipId` returns the first receipt and does not restore a traded or consumed item.

The regression grants, consumes, and then calls grant again with a different client nonce; inventory remains zero. The implementation comment correctly limits this to the local domain and leaves production to derive the event from an authoritative card-to-wearable mapping.

### Resolved — destination overflow is rejected before commit

First-card grant rejects when the existing quantity is already `Number.MAX_SAFE_INTEGER`. Trade computes both destination quantities from the original state and rejects if either cannot accept one exact unit before calling either `move`. This preserves safe-integer quantities and the all-or-nothing trade result.

The combined regression covers grant overflow and one trade destination overflow, then verifies the original players' holdings remain unchanged. The preflight is symmetric in code for both destinations.

## Invariants that currently hold

- **Atomic two-owner trade in the pure state model:** both senders and both holdings are checked against the original state before any result is returned. `move` produces copies, so a failed validation does not mutate the input. A successful exchange conserves both wearable identities, including the harmless same-identity swap case.
- **Trade replay:** a repeated `tradeId` returns the prior receipt without moving inventory again, and mismatched first player, second player (via the recorded first transfer's destination), first wearable, or second wearable rejects.
- **Redemption consumption and idempotency:** a first redemption subtracts exactly one requested wearable and records the draft payout. The same nonce returns the prior receipt. A different nonce for the same player/day also returns the original daily receipt, so it neither consumes twice nor describes a second payout.
- **Redemption identity binding:** reusing a redemption ID for another player or day fails because the recomputed request ID differs.
- **Malformed calendar dates:** the strict `YYYY-MM-DD` check plus UTC round-trip rejects impossible dates such as `2026-02-30` and format variants.
- **No live currency claim:** the receipt carries `draftTickles`; the state contains no balance and its authority/notice explicitly mark the result local. Production authentication, ownership locks, consumption, and balance grant must be one server transaction, as already stated in `spooky-trader-loop.md`.

## Date and catalog policy to make explicit

The module accepts any syntactically valid calendar day, including arbitrary past and future days. That is deterministic and reasonable for a clockless demo, but it does not enforce "today." Tests should lock this in as intentional demo behavior. Production should accept no client-selected day: resolve the feeding day from server time and the chosen server-known time zone, persist one request keyed by player/day/set, and return that request on replay.

Request IDs contain player and day but omit `setKey`. States are currently scoped to one set, so this does not collide inside one state. A persisted or cross-set receipt namespace should include the set key.

The eligible array is copied during construction but is not frozen at runtime. TypeScript `readonly` does not stop a JavaScript caller or cast from mutating it, which can reroll requests after state creation. Freeze the copied catalog (and ideally returned domain state branches) if runtime immutability is part of the prototype contract.

## Remaining test gaps

- Constructor rejects duplicate players, duplicate catalog values safely deduplicate, fewer than two eligible items/players, unknown seed items, negative/unsafe quantities, and unsafe/negative Tickles.
- Request rejects unknown players and invalid/impossible dates.
- Trade rejects self-trades, unknown/ineligible items, and either missing sender holding without changing input state.
- Trade replay is a reference-stable no-op; reuse with changed participants or either item rejects.
- Same-day redemption with a different nonce returns the first receipt and leaves quantity unchanged.
- Redemption nonce reuse across player/day rejects.
- First-card grant replay for the same canonical `(set, player, wearable)` key is a no-op.
- Runtime mutation of the eligible catalog cannot change an already-derived request, if runtime freezing is adopted.

The current six tests now cover cohort-independent request stability, alternate-ownership-ID first-card replay, and safe-integer grant/trade rejection in addition to the original ownership, redemption, conservation, and sink behavior. The gaps above are additional hardening coverage rather than blockers for the local demo.
