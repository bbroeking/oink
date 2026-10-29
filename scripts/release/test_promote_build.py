"""Tests for the pure parts of promote_build.py.

Run: python3 -m unittest scripts/release/test_promote_build.py   (from the repo root)
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import promote_build as pb  # noqa: E402

SHA = "d393406e4b824b1805c501ac9d699bd3d1c41317efb74e7bc2a2c5d8da088496"


class ExpectationTests(unittest.TestCase):
    def test_row_subset_match_with_numeric_normalisation(self):
        rows = [{"pair_multiplier": 1.5, "trade_up": True, "finds_per_visit": 9, "extra": "x"}]
        ok, _ = pb.evaluate_expectation({"row": {"pair_multiplier": 1.5, "trade_up": True, "finds_per_visit": 9}}, rows)
        self.assertTrue(ok)
        ok, _ = pb.evaluate_expectation({"row": {"num": 1.5}}, [{"num": "1.5"}])
        self.assertTrue(ok, "Postgres numeric arrives as a string")

    def test_row_mismatch_names_the_column(self):
        ok, detail = pb.evaluate_expectation({"row": {"id": "snout_season_1"}}, [{"id": "snout_season_2"}])
        self.assertFalse(ok)
        self.assertIn("snout_season_2", detail)

    def test_row_needs_exactly_one_row(self):
        self.assertFalse(pb.evaluate_expectation({"row": {"a": 1}}, [])[0])
        self.assertFalse(pb.evaluate_expectation({"row": {"a": 1}}, [{"a": 1}, {"a": 1}])[0])

    def test_bool_is_not_a_number(self):
        self.assertFalse(pb.evaluate_expectation({"row": {"b": False}}, [{"b": 0}])[0])
        self.assertFalse(pb.evaluate_expectation({"row": {"n": 1}}, [{"n": True}])[0])

    def test_null_and_missing(self):
        self.assertTrue(pb.evaluate_expectation({"row": {"opens_at": None}}, [{"opens_at": None}])[0])
        self.assertFalse(pb.evaluate_expectation({"row": {"opens_at": None}}, [{"other": 1}])[0])
        self.assertFalse(pb.evaluate_expectation({"row": {"opens_at": None}}, [{"opens_at": "2026-10-30"}])[0])

    def test_rows_and_row_count(self):
        self.assertTrue(pb.evaluate_expectation({"rows": [{"a": 1}, {"a": 2}]}, [{"a": 1}, {"a": 2}])[0])
        self.assertFalse(pb.evaluate_expectation({"rows": [{"a": 1}, {"a": 2}]}, [{"a": 2}, {"a": 1}])[0])
        self.assertTrue(pb.evaluate_expectation({"row_count": 0}, [])[0])
        self.assertFalse(pb.evaluate_expectation({"row_count": 1}, [])[0])

    def test_unknown_or_ambiguous_expectation_fails(self):
        self.assertFalse(pb.evaluate_expectation({"nope": 1}, [])[0])
        self.assertFalse(pb.evaluate_expectation({"row": {}, "row_count": 1}, [])[0])

    def test_migrations_applied(self):
        local = pb.migration_versions(["20261029230000_a.sql", "20261004230000_held.sql", "20261029240000_b.sql",
                                       "README.md", "20261029240000_b.sql"])
        self.assertEqual(local, ["20261004230000", "20261029230000", "20261029240000"])
        want = {"migrations_applied": {"held": ["20261004230000"]}}
        rows = [{"version": "20261029230000"}, {"version": "20261029240000"}, {"version": "20200101000000"}]
        ok, detail = pb.evaluate_expectation(want, rows, local)
        self.assertTrue(ok, detail)
        self.assertIn("1 applied with no local file", detail)
        ok, detail = pb.evaluate_expectation(want, rows[:1], local)
        self.assertFalse(ok)
        self.assertIn("NOT APPLIED: 20261029240000", detail)
        ok, detail = pb.evaluate_expectation(want, rows + [{"version": "20261004230000"}], local)
        self.assertFalse(ok)
        self.assertIn("held but applied", detail)

    def test_readonly_guard(self):
        self.assertIsNone(pb.validate_readonly_sql("select 1"))
        self.assertIsNone(pb.validate_readonly_sql("  WITH x AS (select 1) select * from x"))
        self.assertIsNotNone(pb.validate_readonly_sql("update hats set cost = 0"))
        self.assertIsNotNone(pb.validate_readonly_sql("select 1; delete from hats"))

    def test_parse_query_output(self):
        out = '{\n "boundary": "x",\n "rows": [{"id": "snout_season_1"}],\n "warning": "..."\n}'
        self.assertEqual(pb.parse_query_output("Initialising login role...\n" + out), [{"id": "snout_season_1"}])
        with self.assertRaises(ValueError):
            pb.parse_query_output("error: nope")


def _status(**stages):
    return {"build": 198, "stages": {k: v for k, v in stages.items()}}


P = {"status": "pass"}


class LadderTests(unittest.TestCase):
    def test_rollup(self):
        self.assertEqual(pb.rollup([]), "pending")
        self.assertEqual(pb.rollup([{"status": "pass"}, {"status": "pass"}]), "pass")
        self.assertEqual(pb.rollup([{"status": "pass"}, {"status": "pending"}]), "pending")
        self.assertEqual(pb.rollup([{"status": "pending"}, {"status": "fail"}]), "fail")

    def test_empty_ladder(self):
        rungs = {r["rung"]: r["status"] for r in pb.ladder(_status(), True)}
        self.assertEqual(list(rungs), pb.LADDER)
        self.assertEqual(rungs["binary"], "pending")
        self.assertEqual(rungs["verified"], "pending")
        self.assertEqual(rungs["go"], "pending")

    def test_verified_needs_every_stage_and_the_candidate(self):
        binary = {"status": "pass", "details": {"sha256": SHA}}
        s = _status(binary=binary, server=P, sim=P, device=P)
        self.assertTrue(pb.is_verified(s, True))
        self.assertFalse(pb.is_verified(s, False))
        self.assertFalse(pb.is_verified(_status(binary=binary, server=P, sim={"status": "pending"}, device=P), True))
        self.assertFalse(pb.is_verified(_status(binary=binary, server={"status": "fail"}, sim=P, device=P), True))

    def test_go_binds_to_the_hash(self):
        binary = {"status": "pass", "details": {"sha256": SHA}}
        go = {"status": "pass", "details": {"decision": "go", "ipa_sha256": SHA}}
        s = _status(binary=binary, server=P, sim=P, device=P, go=go)
        self.assertEqual(pb.ladder(s, True)[-1]["status"], "pass")
        moved = dict(go, details={"decision": "go", "ipa_sha256": "0" * 64})
        self.assertEqual(pb.ladder(_status(binary=binary, server=P, sim=P, device=P, go=moved), True)[-1]["status"], "fail")
        # A go recorded while verified goes stale if a stage later regresses.
        self.assertEqual(pb.ladder(_status(binary=binary, server={"status": "fail"}, sim=P, device=P, go=go), True)[-1]["status"], "fail")

    def test_no_go_is_recorded_as_fail(self):
        s = _status(go={"status": "fail", "details": {"decision": "no-go"}})
        self.assertEqual(pb.ladder(s, True)[-1], {"rung": "go", "status": "fail", "note": "no-go"})


class AcceptanceTests(unittest.TestCase):
    T = {"fields": {"tester": "", "device": ""},
         "rows": [{"id": "riddle", "check": "..."}, {"id": "referrer-deletion", "check": "..."}]}

    def rec(self, rows, fields=None):
        return {"build": 198, "fields": fields or {"tester": "Brian", "device": "iPhone 15"}, "rows": rows}

    def test_all_pass(self):
        checks, problems = pb.evaluate_acceptance(self.T, self.rec([{"id": "riddle", "result": "pass"},
                                                                    {"id": "referrer-deletion", "result": "pass"}]))
        self.assertEqual(problems, [])
        self.assertEqual(pb.rollup(checks), "pass")

    def test_missing_row_is_pending_and_fail_wins(self):
        checks, _ = pb.evaluate_acceptance(self.T, self.rec([{"id": "riddle", "result": "pass"}]))
        self.assertEqual(pb.rollup(checks), "pending")
        checks, _ = pb.evaluate_acceptance(self.T, self.rec([{"id": "riddle", "result": "fail"}]))
        self.assertEqual(pb.rollup(checks), "fail")

    def test_waived_needs_a_note(self):
        rows = [{"id": "riddle", "result": "pass"}, {"id": "referrer-deletion", "result": "waived"}]
        checks, problems = pb.evaluate_acceptance(self.T, self.rec(rows))
        self.assertEqual(pb.rollup(checks), "pending")
        rows[1]["notes"] = "Brian accepts: covered by the 2026-10-04 production repair check"
        checks, problems = pb.evaluate_acceptance(self.T, self.rec(rows))
        self.assertEqual((pb.rollup(checks), problems), ("pass", []))

    def test_blank_field_keeps_it_pending(self):
        rows = [{"id": "riddle", "result": "pass"}, {"id": "referrer-deletion", "result": "pass"}]
        checks, problems = pb.evaluate_acceptance(self.T, self.rec(rows, {"tester": "Brian", "device": " "}))
        self.assertEqual(pb.rollup(checks), "pending")
        self.assertIn("missing field: device", problems)


CHANGELOG = """# Build 198

## Build record

- stuff

## Release status

- Candidate commit: `54e635cb` (this changelog).
- Artifact: SHA-256 `%s`.
""" % SHA


class ChangelogTests(unittest.TestCase):
    def section(self, body):
        return "\n".join([pb.SECTION_HEADING, "", pb.SECTION_MARKER.format(n=198), "", body]) + "\n"

    def test_parse_changelog(self):
        self.assertEqual(pb.parse_changelog(CHANGELOG), {"candidate_commit": "54e635cb", "recorded_sha256": SHA})

    def test_append_then_replace_is_idempotent(self):
        once = pb.replace_verification_section(CHANGELOG, self.section("first"))
        self.assertTrue(once.endswith(self.section("first")))
        self.assertIn("## Release status", once)
        twice = pb.replace_verification_section(once, self.section("second"))
        self.assertEqual(twice.count("## Verification"), 1)
        self.assertIn("second", twice)
        self.assertNotIn("first", twice)
        self.assertEqual(pb.replace_verification_section(twice, self.section("second")), twice)

    def test_replace_in_place_keeps_later_sections(self):
        text = pb.replace_verification_section(CHANGELOG, self.section("first")) + "\n## Release follow-ups\n\n- none\n"
        out = pb.replace_verification_section(text, self.section("second"))
        self.assertEqual(out.count("## Verification"), 1)
        self.assertTrue(out.rstrip().endswith("- none"))
        self.assertLess(out.index("second"), out.index("## Release follow-ups"))

    def test_refuses_to_overwrite_hand_written_section(self):
        text = CHANGELOG + "\n## Verification\n\n- device pass by Brian\n"
        with self.assertRaises(pb.HandWrittenSection):
            pb.replace_verification_section(text, self.section("x"))

    def test_parse_ignores_the_generated_section(self):
        other = "f" * 64
        text = pb.replace_verification_section(CHANGELOG.replace(SHA, "nothing"),
                                               self.section(f"- SHA-256 `{other}` Candidate commit: `deadbeef`"))
        self.assertEqual(pb.parse_changelog(text), {"candidate_commit": "54e635cb", "recorded_sha256": None})

    def test_render_section_has_marker_and_ladder(self):
        s = _status(binary={"status": "pass", "at": "t", "evidence": ["a.json"],
                            "details": {"sha256": SHA, "checks": [{"name": "x", "status": "pass", "detail": "a|b"}]}})
        out = pb.render_section(198, s, True)
        self.assertTrue(out.startswith("## Verification\n"))
        self.assertIn(pb.MARKER_PREFIX, out)
        self.assertIn("candidate **pass** → binary **pass** → server **pending**", out)
        self.assertIn("a\\|b", out)


if __name__ == "__main__":
    unittest.main()
