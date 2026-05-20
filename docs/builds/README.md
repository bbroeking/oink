# Build changelog

One markdown per IPA shipped to TestFlight / App Store. Authored at build
time, source of truth for what changed between releases.

**Naming:** `YYYY-MM-DD-build-N.md` — date is the build date, N is the
sequential EAS build number.

**Sections (always in this order, omit if empty):**

- `## Headline` — one sentence: the user-facing pitch of this build.
- `## User-facing` — bulleted, written for non-devs. These usually
  become the items shown in the in-app "What's new" modal.
- `## Internal` — refactors, build/infra changes, dev-only tools.
- `## Migrations` — every new SQL migration in this build with a
  one-line description.
- `## Known issues` — anything bug-shaped that didn't get fixed.

The "What's new" modal in `constants/release_notes.ts` is **derived
from these files** — when a build has user-facing changes worth
highlighting, copy the User-facing bullets into a new `RELEASE_NOTES`
entry and bump the version.
