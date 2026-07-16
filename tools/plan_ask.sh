#!/usr/bin/env bash
# Ask Codex CLI a question about the roadmap, or have it help build out the plan.
# The full ROADMAP.md is fed as context every call, so Codex always reasons
# over the current plan.
#
#   tools/plan_ask.sh "what should I do first this week?"
#   tools/plan_ask.sh "break the CF1 campaign todo into concrete steps"
#   tools/plan_ask.sh --edit "mark the notifications fix done and add a Discord setup task"
#
# --edit lets Codex propose changes to ROADMAP.md (it prints a diff; nothing is
# written unless you apply it). Without --edit it just answers.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROADMAP="$ROOT/docs/roadmap/ROADMAP.md"
EDIT=0
if [ "${1:-}" = "--edit" ]; then EDIT=1; shift; fi
Q="${*:?usage: plan_ask.sh [--edit] \"your question\"}"

if [ "$EDIT" -eq 1 ]; then
  PREAMBLE="You are the founder's planning partner for the mobile game Tickle the Pig. Below is the live ROADMAP.md. The founder wants: $Q. Propose the precise edits to ROADMAP.md as a unified diff (status-emoji legend at the top of the file). Explain each change in one line. Do not touch anything else."
else
  PREAMBLE="You are the founder's planning partner for Tickle the Pig. Below is the live ROADMAP.md. Answer this concisely and concretely, grounded ONLY in the roadmap (flag anything you'd need that's missing): $Q"
fi

{ echo "$PREAMBLE"; echo; echo '--- ROADMAP.md ---'; cat "$ROADMAP"; } \
  | codex exec --skip-git-repo-check
