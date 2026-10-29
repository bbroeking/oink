# Promoting a build to verified

A built IPA is a **candidate**. It becomes **verified** when four independent
checks pass against that exact artifact, and it ships only after the founder
records **go** bound to the artifact's SHA-256 and source commit. This
formalizes the exact-binary RC acceptance in
[`../app-store/1.3-remaining-checks.md`](../app-store/1.3-remaining-checks.md)
and [`../app-store/1.3-release-packet.md`](../app-store/1.3-release-packet.md).

```
candidate → binary → server → sim → device → verified → go
```

| Rung | Proves | Who | Command |
|---|---|---|---|
| candidate | The changelog records `Candidate commit: \`<sha>\`` and `SHA-256 \`<hash>\``, the commit exists, `artifacts/build-N/build-N.ipa` exists. | Builder, when writing Release status | (checked by every command) |
| binary | The IPA is the one recorded (SHA-256), is 1.3 / build N / `com.broeking.ttp`, MinimumOSVersion as recorded, production APS, `get-task-allow` false, associated domains, `codesign --verify --deep --strict` OK; the candidate is an ancestor of HEAD and app inputs since it are empty or listed. | Agent | `python3 scripts/release/promote_build.py binary N` |
| server | Production is in the state this binary expects: the read-only SELECTs in `docs/builds/expectations/build-N.json` (season, dark switches, catalog, tuning, applied migrations). Each runs in `set transaction read only`. | Agent (needs `.env.supabase`) | `… server N` |
| sim | The release-identical simulator build (`artifacts/build-N-sim/app/*.app`, EAS profile `production-simulator`) installs on the iPhone 16 Pro Max sim, launches, and is alive after 20 s; signed in, it captures Home, the Barn-button fan, Shop, Season and the Closet. Signed out it stays `pending` until the founder signs in on the sim (the tool never types credentials or touches system dialogs). | Agent; founder signs in once | `… sim N` |
| device | The founder's exact-binary TestFlight acceptance on a physical iPhone: every row in `docs/builds/expectations/build-N-acceptance-template.json` is pass or waived-with-a-note. | Founder | `… device N --record <filled copy>` |
| verified | Candidate and all four stages pass. | (derived) | `… status N` |
| go | The founder's decision, bound to the IPA SHA-256 and candidate commit. Refused unless verified; a later stage regression or hash change invalidates it. | Founder | `… go N --by "<name>" --decision go\|no-go --note "…"` |

Every stage writes `artifacts/build-N/verification/status.json` (stage →
status, at, evidence, details) plus its evidence files, and regenerates the
generated `## Verification` section at the end of the build's changelog. Rerun
a stage to refresh it; do not edit the generated section by hand (the tool
refuses to overwrite a hand-written `## Verification`).

For a new build: write `docs/builds/expectations/build-N.json` from the
changelog's Database table (what must be live, what must stay dark), and copy
the previous acceptance template, adding the build's What to Test rows.

Selecting the build in App Store Connect, attaching subscriptions, submitting,
and the later public release stay separate founder actions after go.

Tests for the pure parts: `python3 -m unittest scripts/release/test_promote_build.py`.
