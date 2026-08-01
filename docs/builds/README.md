# Build changelog

One markdown per IPA shipped to TestFlight / App Store. Authored at build
time, source of truth for what changed between releases.

**Naming:** `YYYY-MM-DD-build-N.md` — date is the build date, N is the
sequential EAS build number.

Every new distributable build follows
[`../RELEASE_CHECKLIST.md`](../RELEASE_CHECKLIST.md). The build file is also
the evidence log for that checklist: record commands/results, manual checks,
pending gates, not-applicable gates with reasons, and accepted exceptions.

**Sections (in this order):**

- `## Build record` — classification (distributable or RC), version/build,
  source commit + working-tree state, target, previous live build, required DB
  state, rollout dependencies, and RC status (`pending` / `accepted` /
  `rejected`, or `not applicable`).
- `## Headline` — one sentence: the user-facing pitch of this build.
- `## User-facing` — bulleted, written for non-devs. These usually
  become the items shown in the in-app "What's new" modal.
- `## Internal` — refactors, build/infra changes, dev-only tools.
- `## Migrations` — every new SQL migration in this build with a
  one-line description.
- `## Known issues` — anything bug-shaped that didn't get fixed.
- `## Verification` — checklist evidence: automated results and counts,
  feature-specific checks, manual device/TestFlight checks, signed-binary
  inspection, and every pending/not-applicable/accepted-exception gate.
- `## Release status` — artifact path, upload/processing state, RC go/no-go
  decision, store release state, production activation actions, and monitoring.

`Build record`, `Verification`, and `Release status` are required for new build
files. The content sections may be omitted when empty.

The "What's new" modal in `constants/release_notes.ts` is **derived
from these files** — when a build has user-facing changes worth
highlighting, copy the User-facing bullets into a new `RELEASE_NOTES`
entry and bump the version.
