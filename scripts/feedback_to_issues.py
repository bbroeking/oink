#!/usr/bin/env python3
"""
feedback_to_issues.py — the Den → GitHub board bridge.

Pulls NEW rows from public.feedback (the Den) and files one GitHub issue per
whisper in bbroeking/oink, then marks the row 'seen' so a re-run never files a
duplicate. Idempotent and safe on a cron / loop.

Founder decision (2026-07): the board is GitHub Issues for now (not Linear).

  read   → `npx supabase db query --linked --output-format json "SELECT ..."`
           (the CLI lane is already authenticated; output is JSON wrapped in
            log noise, so we extract the JSON defensively).
  file   → `gh issue create -R bbroeking/oink` with a kind-mapped label
           (bug→bug, idea→enhancement, love→feedback) + needs-triage on all.
  mark   → feedback_mark(secret, array[id], 'seen') via the same db query lane;
           falls back to a direct UPDATE (owner-privileged lane) if the secret
           has rotated out from under the repo copy.

  --dry-run  print what would be filed; create nothing, mark nothing.

Stdlib only.
"""

import argparse
import json
import os
import subprocess
import sys

REPO = "bbroeking/oink"

# Repo-visible pull secret (see 20260745000000_feedback_den.sql — the migration
# puts this literal in the repo on purpose; worst case is read + status-mark of
# feedback rows). feedback_mark() is gated on it.
# The Den pull secret. Repo-visible in the 20260745 migration already, but
# prefer the env var so a rotation doesn't require editing this script.
FEEDBACK_SECRET = os.environ.get(
	"TTP_FEEDBACK_SECRET", "den-0ce9a84f7ef87f9cd2267bcd"
)

# kind → (github label, needs-triage always added on top).
KIND_LABEL = {"bug": "bug", "idea": "enhancement", "love": "feedback"}

# Labels this script relies on. Created idempotently before first use. Colors +
# descriptions are cosmetic; already-exists is tolerated.
LABEL_DEFS = [
    ("bug", "d73a4a", "Something isn't working"),
    ("enhancement", "a2eeef", "New feature or request"),
    ("feedback", "c5def5", "Player feedback / love note from the Den"),
    ("needs-triage", "ededed", "Maintainer needs to evaluate this issue"),
]


def run(cmd, check=True):
    """Run a subprocess, returning (rc, stdout, stderr)."""
    p = subprocess.run(cmd, capture_output=True, text=True)
    if check and p.returncode != 0:
        sys.stderr.write(
            "command failed (%d): %s\n%s\n" % (p.returncode, " ".join(cmd), p.stderr)
        )
    return p.returncode, p.stdout, p.stderr


def extract_json(text):
    """
    Pull the first complete JSON value (array or object) out of `text`, which
    may be wrapped in CLI log lines. Returns the parsed value or None.
    """
    if not text:
        return None
    # Fast path: the whole thing is clean JSON.
    stripped = text.strip()
    try:
        return json.loads(stripped)
    except Exception:
        pass
    # Scan for the first '[' or '{' and raw_decode from there.
    decoder = json.JSONDecoder()
    for i, ch in enumerate(text):
        if ch in "[{":
            try:
                value, _ = decoder.raw_decode(text[i:])
                return value
            except Exception:
                continue
    return None


def db_query(sql):
    """
    Run a SQL statement through the linked supabase CLI and return the result
    rows as a list (or None on failure).

    The CLI wraps results in a { "boundary", "rows", "warning" } envelope,
    preceded by a log line — extract_json skips the log prefix, and we unwrap
    the "rows" list here. The boundary/warning are an anti-prompt-injection
    guard around untrusted DB data; we treat every row strictly as data.
    """
    cmd = [
        "npx", "supabase", "db", "query",
        "--linked", "--output-format", "json", sql,
    ]
    rc, out, err = run(cmd, check=False)
    if rc != 0:
        sys.stderr.write("db query failed: %s\n" % (err or out))
        return None
    parsed = extract_json(out)
    if parsed is None:
        return None
    if isinstance(parsed, dict) and isinstance(parsed.get("rows"), list):
        return parsed["rows"]
    if isinstance(parsed, list):
        return parsed
    return [parsed]


def fetch_new_rows():
    sql = (
        "SELECT id, username, kind, body, source, created_at "
        "FROM public.feedback WHERE status = 'new' ORDER BY created_at"
    )
    data = db_query(sql)
    if data is None:
        return None
    return [r for r in data if isinstance(r, dict)]


def ensure_labels():
    """
    Create the labels we file with. Idempotent: an already-existing label makes
    `gh label create` exit non-zero, which we swallow (check=False) — we do NOT
    pass --force, so an existing label keeps its current color/description.
    """
    for name, color, desc in LABEL_DEFS:
        run(
            ["gh", "label", "create", name, "-R", REPO,
             "--color", color, "--description", desc],
            check=False,
        )


def issue_title(kind, body):
    first = " ".join((body or "").split())
    if len(first) > 60:
        first = first[:60].rstrip() + "…"
    return "[%s] %s" % (kind, first or "(no message)")


def issue_body(row):
    return (
        "%s\n\n"
        "---\n"
        "- **From:** %s\n"
        "- **Kind:** %s\n"
        "- **Source:** %s\n"
        "- **Submitted:** %s\n"
        "- **Feedback id:** `%s`\n\n"
        "_Filed automatically from the Den by scripts/feedback_to_issues.py._"
        % (
            row.get("body", ""),
            row.get("username", "a passing pig"),
            row.get("kind", ""),
            row.get("source", ""),
            row.get("created_at", ""),
            row.get("id", ""),
        )
    )


def file_issue(row):
    kind = row.get("kind", "")
    labels = [KIND_LABEL.get(kind, "feedback"), "needs-triage"]
    cmd = [
        "gh", "issue", "create", "-R", REPO,
        "--title", issue_title(kind, row.get("body", "")),
        "--body", issue_body(row),
    ]
    for lbl in labels:
        cmd += ["--label", lbl]
    rc, out, err = run(cmd, check=False)
    if rc != 0:
        return None
    return (out or "").strip()


def mark_seen(row_id):
    """
    Mark one feedback row 'seen'. Primary path: feedback_mark() with the
    repo secret. Fallback: a direct owner-privileged UPDATE (in case the secret
    rotated out from under the repo copy).
    """
    sql = (
        "SELECT public.feedback_mark('%s', ARRAY['%s']::uuid[], 'seen')"
        % (FEEDBACK_SECRET, row_id)
    )
    res = db_query(sql)
    ok = False
    if res:
        # db_query returns the result rows; a single select yields one row like
        # {"feedback_mark": {"ok": true, "marked": 1}}.
        val = res[0] if isinstance(res, list) else res
        if isinstance(val, dict):
            inner = val.get("feedback_mark", val)
            if isinstance(inner, str):
                try:
                    inner = json.loads(inner)
                except Exception:
                    inner = {}
            ok = bool(isinstance(inner, dict) and inner.get("ok") and inner.get("marked"))
    if ok:
        return True
    # Fallback — direct UPDATE via the owner-privileged CLI lane.
    upd = (
        "UPDATE public.feedback SET status = 'seen' WHERE id = '%s'" % row_id
    )
    res2 = db_query(upd)
    return res2 is not None


def main():
    ap = argparse.ArgumentParser(description="Den → GitHub issues bridge.")
    ap.add_argument(
        "--dry-run", action="store_true",
        help="print what would be filed; create/mark nothing.",
    )
    args = ap.parse_args()

    rows = fetch_new_rows()
    if rows is None:
        sys.stderr.write("Could not read feedback rows — aborting.\n")
        return 1

    print("Found %d new feedback row(s)." % len(rows))
    if not rows:
        return 0

    if not args.dry_run:
        ensure_labels()

    filed = 0
    for row in rows:
        rid = row.get("id", "")
        title = issue_title(row.get("kind", ""), row.get("body", ""))
        labels = [KIND_LABEL.get(row.get("kind", ""), "feedback"), "needs-triage"]
        if args.dry_run:
            print("\n[dry-run] would file:")
            print("  title:  %s" % title)
            print("  labels: %s" % ", ".join(labels))
            print("  from:   %s (%s, %s)" % (
                row.get("username", ""), row.get("source", ""), row.get("created_at", "")))
            print("  id:     %s" % rid)
            body = " ".join((row.get("body", "") or "").split())
            print("  body:   %s" % (body[:200] + ("…" if len(body) > 200 else "")))
            continue

        url = file_issue(row)
        if not url:
            sys.stderr.write("  ! failed to file issue for %s — leaving row 'new'.\n" % rid)
            continue
        print("  filed %s  (%s)" % (url, title))
        if mark_seen(rid):
            filed += 1
        else:
            sys.stderr.write(
                "  ! filed %s but could NOT mark row %s 'seen' — a re-run may "
                "duplicate it. Mark it by hand.\n" % (url, rid)
            )

    if not args.dry_run:
        print("\nFiled %d issue(s)." % filed)
    return 0


if __name__ == "__main__":
    sys.exit(main())
