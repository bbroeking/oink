# Seasonal trading review

Reviewed `features/cards/domain/seasonalTrading.ts` and
`__tests__/cards-seasonal-trading.test.ts` against the local prototype contract.
The Halloween fixture uses the authored Witch, Hollow Jack, and Lantern Porch
IDs; this review does not treat fixture selection as a production catalog.

## Fix disposition

### Resolved · Trusted-time expiry and revision transitions

Open, revise, confirm, and expiry now read time through one clock boundary.
`clockNow` rejects negative and non-safe-integer values. Offers accept a duration
instead of caller-authored creation and expiry timestamps, and overflow is
rejected. Confirm no longer accepts a participant timestamp, so a backdated
payload cannot complete an expired offer. Revise checks the same clock before
changing terms, preserves the original expiry, and converts a pending offer to
`expired` at its deadline instead of resurrecting it.

Targeted tests cover a backdated participant payload, revision immediately
before the deadline, revision at the deadline, expiry preservation, and invalid
clock values. The original P1 scenario no longer reproduces.

### Resolved · Runtime validation of stored receipts

`reconstructSeasonalTrading` now accepts `readonly unknown[]` and parses each
receipt through explicit record, string, ID, tuple, array, numeric, finish,
asset, participant, and cosmetic-mapping checks before replaying a transfer.
Revision must be a positive safe integer; completion time must be a nonnegative
safe integer and receipts must be supplied in completion order. Missing and
wrong-shaped nested data receives a controlled malformed-storage error instead
of an incidental property-access failure.

Targeted tests cover null and missing receipts, invalid revision and completion
time, malformed participants, transfers, and grants, plus out-of-order receipt
history. The original P2 malformed-state scenarios no longer reproduce.

## Remaining findings

No correctness issues remain from the two targeted findings. Production still
needs a server transaction and authenticated clock/receipts; that is an explicit
authority boundary rather than an unresolved defect in this local prototype.

## Behaviors checked

- Completion requires both named participants to confirm the same current
  revision; revision clears earlier confirmations. The two transfers are
  computed into temporary immutable state and returned together, so a thrown
  second transfer does not publish the first.
- Exact-finish reservations and the one-copy identity reserve compose correctly
  across multiple pending trades and across standard, foil, and living finishes.
  Cancelled, explicitly expired, blocked, and completed trades release their
  reservations because only `pending` trades are counted.
- Cancel, explicit expiry, and block are terminal once recorded. Blocking also
  terminates every pending trade for the unordered pair and prevents later
  offers for that pair.
- Completed confirmation replay does not transfer twice. Receipt IDs are
  canonical (`seasonal-trade:{tradeId}`), trade IDs cannot be reused in live
  state, and reconstruction rejects duplicate/conflicting canonical receipt IDs.
- Reconstruction checks set/seed identity, transfer direction, known cards,
  exact finish underflow, the spare-copy rule, and the expected first-acquisition
  cosmetic grants in receipt order.
- Cosmetic ownership is permanent in this model: sending a card never removes
  the sender's cosmetic, and receiving a card does not duplicate an already
  owned cosmetic.

## Authority limit

The seed is trusted author configuration for a local two-player demo. The
receipts are app-prepared and client-editable. Freezing them after reconstruction
prevents accidental in-memory mutation only; it does not authenticate their
origin. A player can edit storage and construct a self-consistent transfer and
cosmetic-grant history, so these receipts cannot support production inventory,
reward, or cosmetic authority. The module's current authority/notice strings and
reconstruction comment state that limit accurately.

Focused verification passed: 23 tests in
`__tests__/cards-seasonal-trading.test.ts`.
