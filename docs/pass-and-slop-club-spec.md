# Season Pass + Slop Club — design spec

Untangles the four overlapping "premium" concepts (`is_vip`, "Tickle
the Pig Pro", the Snout Season battle pass, the Premium/Premium-Plus
sale modal) into **two clean, separate products**.

Decided in a design interview — model, perks, and name are locked;
the open items at the bottom are pricing / amounts only.

---

## The two products

### 1. Season Pass — one-time, per season
A non-recurring purchase that unlocks the **premium reward track**
for the current season. Buy it once per season; it does not carry
over. The free track stays free for everyone.

### 2. Slop Club — the membership (subscription)
A recurring subscription. **Quality-of-life perks only — no pass.**
Auto-renewing monthly / yearly.

Slop Club perks:
- **2× tickle regen** — the bank refills twice as fast.
- **Bigger bank** — tickle cap 50 instead of 25.
- **Monthly snout stipend** — a recurring snout grant each calendar
  month (NEW — see below).

Explicitly **NOT** Slop Club perks (removed from today's `is_vip`):
- ~~Leaderboard star~~ — dropped.
- ~~Auto-claim the premium pass~~ — dropped; the pass is now its own
  separate purchase.

---

## What changes from today

| Surface | Today | After |
|---|---|---|
| `profiles.is_vip` | "VIP" — 4 perks | The **Slop Club** flag — keep the *column name* `is_vip` (renaming it touches ~8 layered migrations + functions — drift risk); rebrand only the UI to "Slop Club". |
| Premium pass track | gated by `is_vip` (auto-claim) | gated by a **Season Pass entitlement** — a new per-season record, independent of `is_vip` |
| `utils/iap.ts` | one product, "Tickle the Pig Pro" sub | **two** products: the Slop Club subscription (monthly/yearly) + a Season Pass one-time IAP. RevenueCat: a sub entitlement + a non-renewing/one-time product per season. |
| `BattlePassSaleModal` | sells "Premium / Premium Plus" | becomes the **Season Pass** buy prompt (one-time, this season). Slop Club gets its own upsell surface. |
| VIP regen / cap RPCs | `regen_secs_for` etc. read `is_vip` | unchanged — `is_vip` still drives regen + cap (now branded Slop Club) |

---

## New things to build

**A. Season Pass entitlement.** A `season_passes` table —
`(user_id, season_id, purchased_at)`. The premium track is unlocked
iff the player has a row for the active season. A
`grant_season_pass(season_id)` RPC (called after a verified IAP /
RevenueCat webhook). The season UI reads
`has_season_pass(current_season)`.

**B. Monthly snout stipend.** A `claim_slop_stipend()` RPC,
**idempotent per calendar month**: if the caller `is_vip` and hasn't
claimed this month, grant the stipend + record the month. Track via
a `last_stipend_month` column on `profiles` (or a
`slop_stipend_claims` table). The client calls it on launch for
members; a "+N snouts — Slop Club" toast confirms it.

**C. Rebrand.** "Tickle the Pig Pro" → **Slop Club** everywhere
user-facing (`iap.ts` display name, the sale/upsell copy, any
settings row). Internal identifiers (`ENTITLEMENT_PRO`, `is_vip`)
can stay — they're not user-facing.

---

## Suggested phases

1. **DB** — `season_passes` table + `grant_season_pass` /
   `has_season_pass`; the stipend column + `claim_slop_stipend`.
2. **Entitlement wiring** — premium track reads `has_season_pass`
   instead of `is_vip`; drop the auto-claim-on-VIP path.
3. **Slop Club** — the stipend claim on launch + toast; drop the
   leaderboard star; rebrand copy.
4. **IAP** — `iap.ts` two-product setup; `BattlePassSaleModal` →
   Season Pass prompt; a Slop Club upsell. (Gated on `IAP_ENABLED`
   + App Store Connect / RevenueCat config — ops.)

---

## Open items — confirm before building

- **Pricing** (placeholders): Season Pass **$4.99** one-time/season;
  Slop Club **$3.99/mo** or **$29.99/yr**.
- **Stipend amount**: suggest **250 snouts/month** (post the 10×
  price cut, that's ~3–4 cheap cosmetics — meaningful, not
  game-breaking).
- **`is_vip` column**: recommend keeping the name (rebrand UI only).
  Confirm you're OK with the internal name staying.
