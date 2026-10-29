# Halloween 2026 login gift contract

`halloween_2026_login_gift_v1` grants one randomly selected costume on the first eligible login after server activation. Applying the migration activates neither the campaign nor any of the five costume catalog rows. Operations must accept all five fitted assets in the costume catalog and set the campaign row active only after the client build is deployed. The seeded campaign has no automatic calendar expiry (`-infinity` to `infinity`); it opens and closes through explicit server activation. Minimum client build, fit-policy version, all-five costume acceptance, and the exact pool remain independent server gates. The draft minimum build of `1` must be replaced with the actual accepted build before activation.

The frozen pool is:

| Costume | Discovery card |
| --- | --- |
| `halloween_2026_linen_lurker_costume` | `halloween_2026_card_linen_lurker_costume` (045) |
| `halloween_2026_starspell_costume` | `halloween_2026_card_starspell_costume` (046) |
| `halloween_2026_bat_nap_costume` | `halloween_2026_card_bat_nap_costume` (047) |
| `halloween_2026_little_imp_costume` | `halloween_2026_card_little_imp_costume` (048) |
| `halloween_2026_marshmallow_boo_costume` | `halloween_2026_card_marshmallow_boo_costume` (049) |

`claim_halloween_login_gift(p_client_build, p_fit_policy_version)` derives the owner only from `auth.uid()`. Before a receipt exists it checks activation, the half-open campaign window, client build, fit policy, active costume catalog, and the exact allowlist. Selection is uniform by pool position. The transaction persists a unique account/campaign receipt, one provenance-linked costume instance, and one matching seasonal-card inventory discovery before returning `status: "new"`. Concurrent calls serialize per account and campaign. Every later call returns `status: "replay"` with the same immutable receipt, including after deactivation or from another install or device. An inactive or gated campaign returns `status: "inactive"` and creates nothing.

Costume ownership is an instance ledger. It does not write `user_hats`, does not equip anything, and keeps `consumed_at` available for a later authoritative consume/equip flow. Receipt and instance identities, including the original owner and receipt provenance, are immutable. Once the first receipt exists, the pool cannot be appended to, removed from, edited, or moved between campaign versions; changing the pool requires a new versioned campaign. Receipt uniqueness uses the stable `halloween_2026_login_gift` grant key rather than the versioned campaign key, so a later configuration version cannot remint the gift for existing accounts. A deliberate second grant requires a new grant key and migration.

This ledger does not provide live costume trading or transfer. Any future wearable transfer needs a reviewed custody model and provenance migration that preserves the original gift receipt while recording each ownership transition. It must not mutate the immutable gift owner or reuse the login claim RPC as a trade path.

`acknowledge_halloween_login_gift(p_receipt_id)` sets `acknowledgedAt` once and replays it thereafter. It filters the supplied immutable receipt by `auth.uid()`, so an account switch cannot acknowledge another account's gift. The client calls it only from an explicit Continue or Try-on action. Login retries may claim/replay, but an unacknowledged receipt remains presentable; an acknowledged receipt must not reopen the modal. A network failure never counts as acknowledgement.

The focused disposable-Postgres verification is `scripts/db-harness/run-halloween-login-gift.sh`. It covers default inactivity, client/fit gates, atomic costume and card grant, absence of `user_hats` writes, stable replay after deactivation, immutable pool, idempotent acknowledgement, unauthenticated rejection, account deletion, ACLs, and parallel first claims converging on one receipt and one owned instance. The migration remains unapplied until the user explicitly authorizes a database push. Activation is a separate production mutation and also requires explicit authorization.
