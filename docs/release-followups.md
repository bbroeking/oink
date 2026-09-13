# Release follow-up queue

Large changes often need checks that only become meaningful after their exact
App Store build is public. `docs/release-followups.json` is the durable queue
for those checks; it is separate from build preflight and TestFlight acceptance.

Queue a change immediately when it adds or materially changes any of these:

- database schema, authorization, economy, or irreversible data behavior;
- native runtime, SDK, entitlement, purchase, authentication, deep-link, or
  notification behavior;
- a major player-facing system, progression rule, rollout, or feature flag;
- a broad dependency/platform upgrade or other change whose real-world health
  must be observed after release.

Routine copy, cosmetic, isolated bug, and test-only changes do not need entries
unless they carry unusual rollout risk.

## Commands

```sh
# Validate or view the queue
npm run release:followups -- check
npm run release:followups -- list

# Add a large change while authoring it
npm run release:followups -- enqueue \
  --id stable-change-id \
  --title "Human-readable reminder" \
  --summary "What changed and why it needs a post-release look" \
  --checks "First production check|Second production check"

# Attach it to the distributable build that actually contains it
npm run release:followups -- include \
  --id stable-change-id --build 175 --version 1.3

# Run only after the public store version is confirmed
npm run release:followups -- release --version 1.3
```

The release command marks matching entries notified, prints their checks, and
raises a local macOS notification. The Codex release monitor independently
checks the public App Store version and invokes this command when a queued
version becomes public, so the reminder does not depend on remembering the
manual post-release checklist.

Never mark a TestFlight upload, App Review approval, or phased-release setup as
public release. The public App Store lookup must serve the queued version first.
