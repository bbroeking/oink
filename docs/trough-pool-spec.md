# The Trough — friend-funded item drive (design doc)

> Status: **idea capture, actively being grilled** — not yet build-ready.
> Decisions reached so far are marked *(Decided)*; everything else is in
> Open Questions.
>
> Player-facing name: **The Trough** (cozy pig word — friends throw snouts
> into a shared trough to help you get something). Internal/technical name:
> `item_drive` / "drive" (technical language in code per `feedback_module_naming`).

---

## The pitch

A player wants something from the Shop (`app/(tabs)/shop.tsx`) but doesn't
want to (or can't) pay the full snout price alone. They **open a Trough** for
that item. Their **Sounder** (friends) **donate snouts** toward it, and the
**opener always gets the item** once it's funded — no raffle, no draw, no
losing. In return for chipping in, **each donor gets a claimable tickle
reward** for their generosity.

It's a barn-raising, not a bet. Everyone comes out ahead: the opener lands
their item, the donors bank tickles for helping.

> This replaces an earlier raffle/weighted-draw design. The donation model is
> cozier, has no "you lost your snouts" feel-bad, and — because there's no
> chance or loss — sidesteps the App-Review gambling scrutiny entirely.

---

## Why it fits TTP

- **Social, not solo.** Like Visit and trades, the value is the people. A
  Trough is a small event in your Sounder — a reason to rally friends.
- **Cross-currency exchange.** Donors spend **snouts** (cosmetic currency)
  and receive **tickles** (the engagement currency). A new, voluntary bridge
  between the two economies, driven by generosity.
- **Reset-clock FOMO.** The Shop rotates daily; a coveted item is fleeting.
  A Trough is a time-boxed rally to fund it before it rotates out.

---

## Player flow

1. **Open.** From a Shop item's preview, tap **"Open a Trough."** The Trough
   goes live for that item. (Opener cooldown applies — see below.)
2. **Find / Invite.** Two ways in:
   - **Browse** — live Troughs from your **Sounder** surface as a "group"
     section inside the Shop, alongside the daily rotation. Sounder-scoped —
     you see and join friends' Troughs, not strangers'. *(Decided.)*
   - **Invite** — the opener can also share a Trough straight to the Sounder
     (reuse the referral / share-sheet plumbing); friends see an inbox card.
3. **Donate.** A friend opens it, sees the item, the funding bar, and the
   clock, and donates N snouts. The bar fills live (realtime, like active
   effects). Each donation earns that friend a **tickle reward**.
4. **Fund → grant.** When the bar hits the item's price, the **opener is
   granted the item** automatically. Donors' tickle rewards become claimable.
5. **Claim + tell everyone.** Donors get a notification — "you helped briguy
   land the Golden Snout, here's your tickles" — and claim their reward
   (reuse `BuyCelebration` for the opener's grant).

---

## Mechanics

### The grant — opener always gets it *(Decided)*

No draw. Once the Trough funds, the item goes to the **opener**. Guaranteed.
The tension is purely *will my friends fund it before the clock runs out* —
not *will I win it.*

### Opener stake — minimum 10% *(Decided)*

The opener **must cover at least 10%** of the item's snout price to open a
Trough (skin in the game; no zero-cost begging). They may **contribute more**
above that if they want — a generous opener can ask friends for only a small
gap. Friends fund the remainder (up to 90%). The opener's reward is the
**item**; they earn no tickle reward (those are the donors' thank-you).

### Donor reward — snouts in, claimable tickles out *(Decided)*

Donating snouts earns the donor a **tickle reward**, granted as **claimable**
(not auto-credited — the donor taps to collect, like bounty/achievement
rewards). Rewards **vest only on a successful fund** (see lifespan). Open: the
**exchange rate** (tickles per snout) and whether it's flat or scales with
donation size — see Open Questions.

### Lifespan & terminal outcomes — 48h window *(Decided)*

A Trough lives for **48 hours** from open (fixed; decoupled from Shop
rotation — the item reference is captured at open time, so it stays grantable
even after it rotates out of the daily shop).

- **Funded within 48h → success.** Opener is granted the item; donor tickle
  rewards become claimable. **Notify each donor:** "you helped *{opener}* get
  *{item}*."
- **Not funded within 48h → expire.** **Refund everything** — all donors'
  snouts *and* the opener's seed — grant nothing, vest no rewards. **Notify
  each participant** that they've been refunded.

### Over-capping tickles — the load-bearing technical change *(required)*

Tickle rewards must be able to push a player **over the normal tickle cap**
(25; 50 for VIP). Today that's impossible — and not because of storage:

- Tickles live in `user_items.item_count`; `last_increment` drives regen.
- **The cap is enforced as a read-time clamp, not a storage limit.**
  `tickle_balance` returns `LEAST(cap, item_count + regen)`. Bump `item_count`
  to 40 and the next read returns `LEAST(25, 40+…) = 25` — **over-cap tickles
  are silently erased on read.**
- That clamp is **copy-pasted across ~8 live migrations** (`vip`,
  `bonus_lucky_tickles`, `economy_rebalance`, `admin_tickle_overview`,
  `referrals`, …).

**The rule *(Decided)*:**

- **Normal regen never over-caps.** Passive regen still tops out at the cap
  (25; 50 VIP) — exactly as today.
- **Only grants/rewards can push you over cap** — the Trough donor reward and
  any other explicit grant. (This generalizes: it's a property of the tickle
  bank, not a Trough special-case — *any* grant can now exceed cap.)
- **While over cap, regen pauses.** No passive generation happens until the
  balance is spent back down to/under the cap, then normal regen resumes
  automatically.

**The change:** the regen formula must never reduce a balance already above
cap — `GREATEST(item_count, LEAST(cap, item_count + regen))`. When
`item_count ≤ cap` this is identical to today (fills up to cap). When
`item_count > cap`, `LEAST(cap,…)` would be below the balance, so `GREATEST`
preserves it and regen adds nothing — exactly "stops generating while over."

This must land in **every** live copy of the clamp, or balances clamp
inconsistently depending on which RPC reads them. Strong candidate for
**consolidating the regen formula into one function** as part of this work
(the duplication is a standing risk regardless of Trough).

> Cross-ref: historically, granting over-cap tickles was impossible without
> *raising the cap* — `20260501230000_gift_50_available_raise_cap.sql` bumped
> the cap to 100 just so a +50 gift would land, then `20260502020000_cap_25`
> dropped it back with a one-time `LEAST(item_count, 25)` clamp. This fix
> removes that whole dance: grants can exceed cap directly, forever.

### Opener cooldown — one Trough per opener every 3 days *(Decided)*

Keeps Troughs special, throttles spam in the Sounder feed, and stops a player
running a perpetual personal donation drive. Gates *opening* only — donating
to a friend's Trough is unrestricted (TBD — see Open Questions).

### Anti-abuse

- Item is account-bound (TTP has no player-to-player item market).
- Likely cap donors and/or per-person donation so the math stays sane.

---

## Data model sketch (illustrative, not final)

```
item_drives
  id, item_id (FK shop item), opener_user_id,
  target_snouts, raised_snouts, status (open|funded|granted|expired),
  opens_at, closes_at, granted_at

item_drive_donations
  id, drive_id (FK), donor_user_id, snouts,
  tickle_reward, reward_claimed_at, created_at
```

RPCs (named typed wrappers over the generic `rpc<T>` seam, per `utils/rpc.ts`):

- `open_item_drive(item_id)` → drive
- `donate_to_drive(drive_id, snouts)` → updated drive + this donor's reward
- `claim_drive_reward(donation_id)` → grants over-cap tickles
- `my_drives()` / `drive_detail(drive_id)` — read paths, realtime-subscribed

Realtime: subscribe to `item_drive_donations` so the funding bar animates as
friends pile in (same shape as the blessings/curses subscription).

---

## Open questions (need a call before speccing)

1. ~~**Exchange rate**~~ **Decided: 2:1** — 2 snouts donated → 1 tickle reward
   (conservative, so it doesn't undercut the tickle IAP or become a farm).
2. ~~**Eligibility**~~ **Decided: any Shop item** can have a Trough opened on it.
3. ~~**Donating cooldown**~~ **Decided: 12h** — a player can donate to a
   Trough once every 12 hours.
4. **Hard ceiling on over-cap** — over-cap tickles **persist (no decay)** and
   only come from grants *(Decided)*. Still open: is there an *absolute* max
   bank to stop unbounded hoarding from a busy Sounder, or is it bounded
   purely by donation/reward caps? *(Leaning: rely on donation caps + reward
   sizing rather than a separate hard ceiling, unless hoarding shows up.)*

### Settled

- Audience: **Sounder-scoped**, browsable from a Shop "group" section.
- Model: **donation drive** — opener always gets the item; **no raffle/burn**.
- Donor reward: **claimable tickles**.
- Tickles **can exceed the cap only via grants/rewards** (never passive
  regen); over-cap balances **persist, regen pauses while over** (clamp fix).
- Opener cooldown: **one per 3 days**.
- Opener stake: **must cover ≥10%** of price; may contribute more.
- Lifespan: **48h** fixed window. Funded → grant + "you helped {opener} get
  {item}" notify. Expired → **refund everyone** (donors + opener seed) +
  "you've been refunded" notify; no rewards vest.
- ~~Gambling/compliance ADR~~ — moot under the donation model (no chance, no loss).

---

## Smallest shippable slice

Open a Trough on one eligible Shop item · Sounder browse + donate · funding
bar to the item's price · opener auto-granted on full fund · claimable tickle
reward per donor with over-cap support · under-funded expiry returns snouts.
No opener-stake seeding, no scaling exchange rate, no weekly marquee — those
are deepening layers once the core loop proves fun.
