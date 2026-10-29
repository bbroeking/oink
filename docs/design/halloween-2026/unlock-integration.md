# Spooky Snouts card unlock integration

## Current state

The database foundation is intentionally inactive. Migration `20261014180000_seasonal_card_item_unlocks.sql` creates a versioned `halloween_2026_v1` card set named **Spooky Snouts**, with a three-card pack limit, but seeds no catalog mappings and sets `active = false`. Applying the migration alone cannot grant any draft cosmetic or background.

`content.json` is validated in TypeScript as a 44-card draft manifest: 29 modular wearable pieces, six full-body costumes and nine backgrounds. The additive SSN catalog is integrated into the existing local card prototype, with 44 selected raster artworks and the shared card renderer across opening, receipt, album and detail. A fixed local three-card fixture grants local preview cosmetics, preserves receipts across reload, and keeps repeated copies without a second cosmetic grant. It does not register production items in `hats`, mint account rewards, set odds, or establish live dates.

The original 88-card base catalog is preserved. Seasonal cards are explicitly collection-only and excluded from constructed decks and Hedge Run. The local fixture and saved cosmetic map are demo authority; the production RPC repository remains an injectable, unwired boundary.

## Grant and opening contract

An already validated server reward calls `grant_seasonal_card_pack(user_id, set_key, source, source_ref, cards)`. The ordered `cards` value contains one to ten fixed card IDs and finishes; the configured set limit is three. This service-role-only function does not collate or randomize cards. Repeating the same `(user, set, source, source_ref)` and identical contents returns the original grant. Reusing that source identity with different contents fails. Once any grant references a catalog card, its set, card ID, mapped item, and unlock rule are immutable; display copy can still be corrected. Changed reward behavior requires a new versioned set.

The authenticated player calls `open_seasonal_card_pack(grant_id)`. The function accepts no requested card IDs, locks the owned grant, then takes a transaction-scoped advisory lock for that player and versioned set before changing inventory. This serializes different grants whose cards overlap or arrive in opposite orders, keeping receipt quantities exact and avoiding card-row deadlocks. It records one opening, increments durable card inventory, inserts mapped ownership into `user_hats`, and stores card-level and item-level receipts in one transaction. Reopening returns the original receipt even after the set is deactivated. Another user cannot inspect or open the grant.

For a `first_copy` mapping, the first copy of that card attempts the permanent item grant. A duplicate copy increases card quantity and never grants the item again. If the player already owns the mapped item through another path, the item receipt records `newlyOwned: false`. Existing card copies are not backfilled when a mapping is activated later; any deliberate backfill needs its own reviewed migration or server job and receipt source.

All new tables have row-level security. Authenticated reads are limited to the caller's inventory and receipts. Catalog writes, pack creation, and direct inventory writes are unavailable to clients. The security-definer routines use fixed search paths and qualified objects.

## Activation checklist

Before setting the catalog active:

1. Finish and register all 44 item/costume/background records and shipping assets in the production catalog. Card illustrations already exist; wearable front/profile artwork, pivots and all-frame fit acceptance remain separate.
2. Insert the 44 `(set_key, card_id, item_id)` mappings from the accepted content manifest. The 38 modular item/background IDs must resolve through the existing `hats` foreign key. The six full-body costumes require a separate reviewed costume catalog, entitlement and equipped-slot path; do not force its category through Hat or the existing Face mask. The inactive opening foundation cannot grant that dedicated costume until this boundary is extended.
3. Accept the title, live dates, eligibility source, and which existing earned reward transaction issues each fixed pack.
4. Decide collation/odds separately if randomized packs are desired. This foundation deliberately has no odds policy.
5. Exercise the database harness for idempotent grant replay, source conflicts, concurrent opening, wrong-owner access, inactive sets, unknown cards, duplicate cards, and pre-owned items.
6. Activate `halloween_2026_v1` only in the same reviewed release that contains the registered catalog and reward hook.

The client repository is an injectable RPC boundary that only reads the server snapshot and consumes an existing grant. It has no Supabase/session dependency, local reward fallback, or method that lets a client mint cards. After the migration is applied, regenerate live database types and supply the production RPC adapter as a separate activation change.

## Seasonal card exchange

[The trading contract](trading-contract.md) defines the isolated two-player prototype. It exchanges exact card finishes atomically after both parties confirm the same offer revision, preserves a final copy of each identity, and retains permanent cosmetic unlocks. Its client-editable local receipts are demo state, not account reward authority. Production exchange requires authenticated participants, trusted server time, durable reservations and an atomic server transaction; the current opening migration does not implement trades.

## Later Old Wisp ownership amendment

The founder chose actual wearables for daily handover and friend exchanges.
This is not supported by the permanent user_hats boolean foundation unchanged.
A prospective first-card grant must mint one usable instance once, preserving
historical discovery while transfers change its owner and handover consumes it.
Pack replay never remints a surrendered instance. Background entitlements remain
permanent. The local Old Wisp prototype is a separate quantity-based authority;
its draft Tickles never reach an account. See spooky-trader-loop.md and the
reviewed instance-ledger production plan before activation.
