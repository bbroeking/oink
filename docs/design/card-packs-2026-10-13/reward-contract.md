# Card packs: reward, opening, finish, and Hedge Run server contract

Current policy: three cards per new pack, with `card_count` pinned to the grant policy and copied into its immutable receipt. Previously committed five-card receipts stay valid and never shrink or reroll. The client derives sequence length from the committed receipt. Cadence/completion simulations from the earlier five-card proposal must be rerun before economy approval.

Status: integration specification; no schema, RPC, migration, or production mutation is implemented here.

## Current authoritative seams

The daily source is a successful row in `public.rooting_receipts`. The latest submit body in `supabase/migrations/20260921150000_drum_draw.sql:1591` inserts a receipt keyed by `(user_id, window_index)`, then selects the durable row back. It runs for crewed and crewless digs and records `uncrewed`; a client animation or local practice board is not evidence. Daily eligibility is the first such receipt whose `created_at` lies in a UTC date on or after the card feature activation timestamp.

The Monday source is the successful `draw_monday_purse()` transaction in the same migration (`:416`). It takes a per-user advisory transaction lock, replays an existing `monday_draws` row, rejects fewer than one receipt-derived ball, inserts the unique `(user_id, iso_week)` draw, and then pays Tickles. A pack belongs beside that committed draw, not merely beside eligibility in `monday_draw_state()`. A player who never draws does not receive the Monday pack.

No card catalog, inventory, entitlement, opening, finish-progress, or challenge table/RPC currently exists. Names below are a proposed contract.

## Identities and account boundary

Every write RPC derives `user_id` from `auth.uid()`. It never accepts an effective owner ID from the client. Every child row carries or joins through that user ID, and row-level policies restrict reads to the owner except the deliberately disclosed two-player Hedge Run result. Foreign entitlement/opening/challenge IDs return `not_found`, avoiding account-existence disclosure.

Suggested records:

- `card_pack_grants(id, user_id, source, source_ref, policy_version, card_count, granted_at, opened_at)`; unique `(user_id, source, source_ref)`.
- `card_pack_openings(id, user_id, grant_id, policy_version, card_count, committed_at, presentation_state)`; unique `grant_id`.
- `card_pack_opening_cards(opening_id, position, card_id, finish, quantity_before, quantity_after, repeat_credit)`; primary key `(opening_id, position)`, check position 1–5 for migration compatibility, bounded by the opening’s immutable `card_count`.
- `user_card_inventory(user_id, card_id, quantity, first_acquired_at, updated_at)`; primary key `(user_id, card_id)`.
- `card_finish_wallet(user_id, credits, revision)` plus `card_finish_selections(user_id, card_id)` and `card_finish_claims(id, user_id, request_id, card_id, cost, balance_before, balance_after, committed_at)`; unique `(user_id, request_id)`.
- immutable, versioned catalog and collation policy records. Base Legends are outside random packs.

Database constraints should assert exactly `card_count` opening children (three for the current policy) at commit through the opening function, not a deferred client check. The receipt response includes all outcomes in position order and a digest over immutable receipt fields.

## Grant contracts

`claim_card_welcome()` inserts one fixed, versioned welcome grant keyed `welcome:<version>`. Its contents are fixtures, not random rolls. All six Legends and the borrowed Hedge Run kit are available without pack luck. Retrying returns the same receipt.

The Dig submit transaction calls an internal `_grant_card_pack(user, 'daily_dig', utc_date, policy)` after its authoritative `rooting_receipts` insert succeeds. The unique source key makes concurrent legacy/new submit doors and retries converge. A reconciliation function may derive the same key from an existing eligible receipt after the activation timestamp and insert only the missing grant. It cannot infer a grant from client state.

`draw_monday_purse()` calls `_grant_card_pack(user, 'monday_drum', iso_week, policy)` in the transaction that inserts `monday_draws`. Existing-draw replay also returns the existing linked grant. Reconciliation may repair an absent grant from a committed eligible `monday_draws` row with the same source key. Ball count affects only the existing purse roll.

Failure before the grant transaction commits leaves no entitlement. Failure after commit may hide the response, but retry/reconciliation returns the one existing entitlement. A grant never contains random card outcomes; that happens only when opened.

## Atomic opening

`open_card_pack(grant_id, request_id)` performs this transaction:

1. authenticate and select the caller's grant `FOR UPDATE`;
2. if an opening already exists, return its immutable receipt;
3. pin the grant's catalog/collation policy version;
4. draw `card_count` ordered outcomes (currently three) using server randomness and the pinned policy;
5. snapshot each quantity, increment inventory without deleting copies, and derive `newly_owned` and repeat credit;
6. credit repeats to the finish wallet and increment its revision;
7. insert the opening and all `card_count` child rows, mark the grant opened, assert a contiguous sequence of positions, and commit;
8. return the stored receipt.

The grant ID is the authority and idempotency key. `request_id` is tracing/replay convenience and cannot open one grant twice. Concurrent calls serialize on the grant row. The server alone determines identities, order, rarity, finish, duplicate status, quantities, and credits. The client never supplies odds or outcomes.

Before commit, any error rolls back opening, inventory, and finish progress together. After commit, a timeout produces an unknown client result but a known server result; retry returns the stored receipt. Skip, replay, reinstall, a missing Rive callback, or a changed request ID cannot roll, grant, or credit again. Ownership exists before animation and before **Keep in album**. Presentation acknowledgement is optional metadata and has no economic effect.

Receipt fields: `opening_id`, `grant_id`, `source`, `source_ref`, `policy_version`, `committed_at`, `wallet_revision`, `repeat_credits_awarded`, `card_count`, and exactly that many ordered entries with `position`, `card_id`, `rarity`, `finish`, `quantity_before`, `quantity_after`, `newly_owned`, and `repeat_credit`.

## Repeat-to-foil contract

Every copy remains in `user_card_inventory`; progress never consumes copies. Each repeat adds one wallet credit whether or not a goal is selected. Selection is nullable metadata and changing it does not move credits or inventory.

`claim_card_foil(request_id, card_id)` locks the caller's wallet and target ownership, replays a prior request, rejects an unowned/ineligible/already-owned finish, requires at least 10 credits, inserts the unique claim, grants the cosmetic finish, and debits exactly 10 in one transaction. Surplus carries forward. Two concurrent claims cannot spend the same credits because they serialize on the wallet row and revision. Failure before commit changes nothing; failure after commit replays the claim. No reroll exists. Living illustrations require an authored variant and are outside the generic foil claim.

## Named-friend Hedge Run seal

`create_hedge_run(friend_id)` requires an accepted friendship and binds creator and recipient before either sees play state. In one transaction the server stores participant IDs, a cryptographically generated seed (or its sealed material), rules version, derived borrowed 12-card-kit order, six-event trail, two run IDs, and seven-day expiry. A unique unordered pair constraint allows at most one active challenge per friend pair. Both participants receive the same mechanical kit and seed-derived trail.

The creator may play immediately. Each `submit_hedge_choice(challenge_id, expected_revision, choice)` locks that player's run, verifies the next round and legal choice, advances the pure versioned reducer, and increments revision. Retry at the same revision returns the stored state; conflicting input is rejected. Resume reads the same durable state. The client cannot submit seed, order, score, or opponent identity.

Until both runs are finished, each player can read only their own choices/state and a coarse opponent status (`pending`, `in_progress`, or `finished`); opponent choices, score, Discoveries, Cheer, and raw seed stay hidden. Once both finish, the server replays both choice logs, seals scores, compares Discoveries then Cheer then draw, and discloses both summaries. Expiry closes an incomplete match without a forfeit or win. Practice uses the same reducer but no opponent seat.

Hedge Run never writes currencies, inventory, pack grants, public rankings, ratings, streaks, or public win counts. Card ownership is unnecessary because the kit is borrowed; selected owned art/finish may decorate an eligible identity but cannot alter or obscure its mechanics.

## Required verification before implementation is considered complete

- transaction/concurrency tests for two grant doors, two opens, and two foil claims;
- forced failure immediately before commit and response loss immediately after commit;
- cross-account probes for grant, opening, claim, and challenge IDs;
- policy-count and ordered-receipt assertions, including preservation of legacy five-card receipts; repeated reads must byte-equivalently preserve outcomes;
- daily UTC boundary and activation-time cases, crewless receipt, Monday no-ball rejection, and existing-draw reconciliation;
- Hedge Run same-seed fixture, resume/revision conflicts, concealment before both finish, expiry, and an assertion of zero economy/public-ranking writes.

