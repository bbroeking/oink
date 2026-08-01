# Snatch Chain logic prototype

**Question:** Does a leaderboard-triggered snout theft stay understandable and
fun when every successful catch triples the retaliation, each response expires
after eight hours, and targeting is deliberately scarce?

This is throwaway, in-memory prototype code. It does not call Supabase or change
real player balances.

## Rules represented

- A theft takes 1 spendable snout. It never changes `tickles_earned`.
- The other pig has 8 hours to catch the thief for 3× the previous transfer.
- Every catch reverses the direction and starts a fresh 8-hour window.
- Missing the window loses the chain.
- Prototype insolvency assumption: if the payer cannot cover the next 3× hit,
  the catcher takes their remaining snouts and the payer busts.
- An initiator may target 2 unique pigs per rolling 24 hours.
- One active chain per pair.
- The same initiator cannot target the same pig again for 7 days.
- A target may face at most 3 unique attackers per rolling 24 hours.
- Self, blocked, hidden, and test pigs cannot be targeted.

## Run

```sh
npm run prototype:snatch-chain
```

For the clickable browser version:

```sh
npm run prototype:snatch-chain:web
```

Then open `http://localhost:4173`.

Useful first sequence:

```text
steal you ada
catch h1
catch h1
wait 8
```

Use `balance <pig> <snouts>` to force a bust and feel whether the insolvency
rule is satisfying.
