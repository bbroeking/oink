# Layout and API security quality loop

The quality loop is the local, deterministic interface for preventing layout
and server-authority regressions while the app is changing.

## Commands

```sh
# Fast one-shot layout + security gate
npm run quality:check

# Keep the fast gate running after relevant source changes
npm run quality:loop

# Run one side while working in that area
npm run quality:layout
npm run quality:security

# Release-grade local gate: full Jest, production-source lint, iOS Metro export, database
# harness, and linked Supabase lint. Docker/Colima and linked Supabase access
# are required; unavailable infrastructure is a failure, never a silent skip.
npm run quality:check:full
```

Every run writes `.quality/last-run.json`. The directory is ignored by Git.
A failing one-shot command exits non-zero. Watch mode stays alive after a
failure so the next edit can make the loop green.

## What the fast loop proves

Layout contracts:

- text shrinking and literal sizes below 11pt remain at zero;
- raw Modal, text-clamp, and `Dimensions.get` debt cannot exceed the audited
  baseline;
- adoption of `AdaptiveModalScaffold`, `IconButton`, and
  `SegmentedControl` cannot move backward;
- focused tests cover adaptive geometry, modal semantics, navigation clarity,
  motion policy, contrast, list/image scaling, and the Hunger hero.

Security contracts:

- migration versions are unique and correctly named;
- every table created in the audited migration chain enables RLS;
- no migration disables RLS or grants function execution to `PUBLIC`;
- every `SECURITY DEFINER` fixes its `search_path`;
- anonymous function access is deny-by-default with an explicit allowlist;
- definer functions are revoked from default roles, with one documented
  legacy trigger-function budget;
- focused tests exercise RPC failure behavior, cosmetics ownership,
  redemption/referrals, pig membership, Wallow overflow, shop exclusivity,
  rooting, membership, Hunger rewards, and visit emotes.

## Debt budgets

The current layout still contains legacy debt. Its values live in
`scripts/quality/quality.config.mjs` as ceilings, not targets. When a tranche
removes raw modals, line clamps, dimension snapshots, or an unrevoked trigger,
lower the corresponding budget in the same change. The loop then makes the
improvement permanent.

## What only the full loop proves

The full loop adds the complete Jest suite, production TypeScript/Jest lint, a
simulator-free iOS Metro export, the plain-Postgres database harness, and
linked Supabase lint. The lint adapter deliberately excludes vendored model
source, scratch environments, and Deno edge-function imports; those are not
React Native application source.

The harness adapter also supplies the ordered later migrations required by its
always-on smoke files. That list lives beside the other quality configuration;
running `scripts/db-harness/run.sh` with no migration arguments is not
equivalent and currently lacks the functions those smokes exercise.
It does not push migrations, build an IPA, upload anything, or mutate the
production database.

Visual device acceptance still belongs to the release checklist: Dynamic Type,
VoiceOver, smallest/largest supported phones, keyboard paths, and the exact
TestFlight binary cannot be proven by source inspection alone.
