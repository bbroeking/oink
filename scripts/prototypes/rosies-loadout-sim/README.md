# Rosie's Loadout logic prototype

**Question:** Does an 18-card dual-use starter create enough tension between
Training a favorite card permanently, assembling Head + Held + Aura, keeping
Critters ready to protect, and attacking before the opposing Legend peaks?

This is throwaway, in-memory terminal UI around a portable pure game model. It
implements the core deterministic loop, representative card effects, one Place
slot, and match telemetry. It deliberately does not implement all 88 printed
exceptions.

Run:

```sh
npm run prototype:loadout
```

The current experiment makes protection costly: one ready Critter exhausts to
prevent one damage. That differs from the paper draft and is intentionally
visible for playtesting.

