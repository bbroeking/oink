# Card economy simulation

Run from the repository root:

```sh
node scripts/prototypes/card-economy/simulate.mjs 10000
```

The optional argument is the number of deterministic player histories. The script reads the generated 88-card gallery catalog, excludes the six base Legends, begins with the documented 12-card Hedge Run starter, and applies the explicitly hypothetical slot weights documented in `docs/research/2026-10-13-card-pack-cadence-model.md`.

Output is JSON so later checks can capture or compare it. It reports collection completion, duplicate frequency, repeats at completion, and ten-repeat foil affordability. It does not approve odds, predict retention, choose tutorial-pack contents, or model production cost.
