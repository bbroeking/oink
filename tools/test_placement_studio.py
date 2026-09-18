import json
import pathlib
import re
import tempfile
import unittest
from unittest import mock

from scripts import pig_preview
from tools import placement_studio


ROOT = pathlib.Path(__file__).resolve().parents[1]
STUDIO_HTML = ROOT / "tools" / "placement_studio.html"
TYPES_TS = ROOT / "constants" / "hat_overlay_types.ts"
STUDIO_PY = ROOT / "tools" / "placement_studio.py"


class PlacementStudioAuraTests(unittest.TestCase):
	def test_catalog_auras_are_discovered_and_editable(self):
		items, _ = placement_studio.build_items()
		auras = [item for item in items if item["category"] == "aura"]

		self.assertGreaterEqual(len(auras), 20)
		self.assertTrue(all(item["image"].endswith(".png") for item in auras))

		studio = STUDIO_HTML.read_text()
		self.assertIn(
			'function noPlacement(cat){ return cat==="background"||cat==="tickle_particle"; }',
			studio,
			"auras must retain the placement controls when selected",
		)

	def test_brian_aura_unlock_is_exposed_by_the_studio(self):
		studio = STUDIO_HTML.read_text()
		self.assertIn('id="unlockBrianAuras"', studio)
		self.assertIn('fetch("/api/unlock-brian-auras"', studio)

		completed = mock.Mock(returncode=0, stdout='{"ok":true,"auraCount":26,"granted":2}\n', stderr="")
		with mock.patch.object(placement_studio.subprocess, "run", return_value=completed) as run:
			result = placement_studio.unlock_brian_auras()

		self.assertEqual(result["auraCount"], 26)
		self.assertEqual(run.call_args.args[0][-1], "Brian")


SPEC = {"pivot": {"x": 0.5, "y": 0.5}, "widthFrac": 0.3, "anchor": "eye_r", "behind": False}


def _per(x, anchor):
	return {"pivot": {"x": x, "y": 0.5}, "widthFrac": 0.3, "anchor": anchor, "behind": False}


class PerAnimOverrideTests(unittest.TestCase):
	"""A per-pose override rides inline on the item's own line — so every reader
	of the generated file has to stay anchored at the line start, or the nested
	`face: { … }` entry parses as an item called "face"."""

	def _write(self, data):
		tmp = pathlib.Path(tempfile.mkdtemp()) / "hat_rel.generated.ts"
		with mock.patch.object(placement_studio, "HAT_REL", str(tmp)):
			placement_studio.write_hat_rel(data)
		return tmp

	def test_round_trip_is_exact(self):
		data = {
			"monocle": {**SPEC, "perAnim": {"face": _per(0.4, "eye_l"),
											"face_sit": _per(0.42, "eye_l")}},
			"tophat": {"pivot": {"x": 0.5, "y": 0.86}, "widthFrac": 0.42,
					   "anchor": "head", "behind": False},
		}
		path = self._write(data)
		parsed = placement_studio.parse_rel(str(path))
		self.assertEqual(parsed, data)

		# and writing what we parsed reproduces the same bytes
		again = self._write(parsed)
		self.assertEqual(again.read_text(), path.read_text())

	def test_override_poses_are_written_in_pig_animation_key_order(self):
		path = self._write({"monocle": {**SPEC, "perAnim": {
			"face_sit": _per(0.42, "eye_l"), "face": _per(0.4, "eye_l")}}})
		line = path.read_text().splitlines()[-2]
		self.assertLess(line.index("face:"), line.index("face_sit:"))
		self.assertIn('perAnim: { face: { pivot: { x: 0.4, y: 0.5 }, '
					  'widthFrac: 0.3, anchor: "eye_l", behind: false }', line)

	def test_nested_poses_never_parse_as_items(self):
		path = self._write({"monocle": {**SPEC, "perAnim": {
			"face": _per(0.4, "eye_l"), "face_sit": _per(0.42, "eye_l")}}})

		studio = placement_studio.parse_rel(str(path))
		preview = pig_preview.parse_rel(str(path))
		for parsed in (studio, preview):
			self.assertEqual(sorted(parsed), ["monocle"])
			self.assertNotIn("face", parsed)
			self.assertNotIn("face_sit", parsed)
		# the preview renderer keeps the FRONT spec and ignores the override
		self.assertEqual(preview["monocle"]["pivot"], (0.5, 0.5))

	def test_the_real_registries_expose_no_phantom_items(self):
		for reader in (placement_studio.parse_rel, pig_preview.parse_rel):
			parsed = reader(str(ROOT / "constants" / "hat_rel.generated.ts"))
			self.assertTrue(parsed)
			for anim in placement_studio.ANIMS:
				self.assertNotIn(anim, parsed)

	def test_one_eyed_items_are_classified_from_the_base_anchor(self):
		from tools import gen_side_items

		line = ('\tmonocle: { pivot: { x: 0.5, y: 0.5 }, widthFrac: 0.3, anchor: "head",'
				' behind: false, perAnim: { face: { pivot: { x: 0.4, y: 0.5 },'
				' widthFrac: 0.3, anchor: "eye_l", behind: false } } },\n')
		with mock.patch.object(gen_side_items, "REL_FILES", ("fake.ts",)), \
				mock.patch("builtins.open", mock.mock_open(read_data=line)):
			self.assertFalse(gen_side_items.is_eye_item("monocle"))


class StudioDataTests(unittest.TestCase):
	def test_anim_list_matches_the_pig_animation_key_union(self):
		union = re.search(r'export type PigAnimationKey\s*=(.*?"\s*;)',
						  TYPES_TS.read_text(), re.S)
		self.assertIsNotNone(union)
		expected = re.findall(r'\|\s*"(\w+)"', union.group(1))
		self.assertEqual(placement_studio.ANIMS, expected)
		self.assertIn("face_sit", placement_studio.ANIMS)

	def test_every_pig_reports_its_sprite_frame_counts(self):
		pigs = placement_studio.sprite_pigs()
		self.assertEqual(list(pigs)[0], "rosie", "rosie is the reference pig")
		self.assertEqual(pigs["rosie"]["idle"], 12)
		for pig, counts in pigs.items():
			self.assertEqual(counts["face_sit"], 4, pig)
			self.assertNotIn("lounge", counts)

	def test_side_sprites_are_reported_per_item(self):
		items, _ = placement_studio.build_items()
		side = [i for i in items if i["side"]]
		self.assertGreaterEqual(len(side), 40)
		for item in side:
			self.assertTrue((ROOT / item["side"]).is_file())

	def test_renderer_constants_are_parsed_from_hats_ts(self):
		self.assertEqual(placement_studio.parse_turned_eye_shift(), 16.0)
		self.assertEqual(placement_studio.parse_wearable_clamp(), [0.72, 1.18])


class StudioUiTests(unittest.TestCase):
	def test_the_sheet_tab_and_override_controls_are_present(self):
		studio = STUDIO_HTML.read_text()
		self.assertIn('data-m="sheet"', studio)
		self.assertIn('id="mode-sheet"', studio)
		self.assertIn('id="sheet"', studio)
		for control in ('id="ovAdd"', 'id="ovRemove"', 'id="ovCopy"',
						'id="ovCopyTo"', 'id="ovChips"', 'id="nextInList"',
						'id="ipig"', 'id="pig-pig"', 'id="sh-pig"',
						'id="pig-clampnote"'):
			self.assertIn(control, studio, control)
		# the preview mirrors resolveSlot, not a simplified version of it
		self.assertIn("function layoutItem(", studio)
		self.assertIn("TURNED_EYE_SHIFT", studio)
		self.assertIn("side sprite", studio)


class RigCandidateTests(unittest.TestCase):
	"""scripts/auto_rig.py writes docs/rig-candidate.json; the studio only ever
	READS it, re-reading on every request, and treats its absence as normal."""

	def _patched(self, name, text=None):
		tmp = pathlib.Path(tempfile.mkdtemp()) / name
		if text is not None:
			tmp.write_text(text)
		return mock.patch.object(placement_studio, "RIG_CANDIDATE", str(tmp))

	def test_a_missing_candidate_reads_as_empty(self):
		with self._patched("rig-candidate.json"):
			self.assertEqual(placement_studio.parse_rig_candidate(), {})

	def test_an_unparseable_candidate_reads_as_empty(self):
		with self._patched("rig-candidate.json", "{ not json"):
			self.assertEqual(placement_studio.parse_rig_candidate(), {})
		with self._patched("rig-candidate.json", "[1, 2, 3]"):
			self.assertEqual(placement_studio.parse_rig_candidate(), {})

	def test_a_present_candidate_is_returned_verbatim(self):
		doc = {
			"generatedAt": "2026-09-17T12:00:00Z",
			"source": "scripts/auto_rig.py",
			"pig": "rosie",
			"frames": {"idle": [{"head": {"x": 158, "y": 31}}]},
			"confidence": {"idle": [{"head": "detected"}]},
		}
		with self._patched("rig-candidate.json", json.dumps(doc)):
			self.assertEqual(placement_studio.parse_rig_candidate(), doc)

	def test_the_endpoint_is_served(self):
		self.assertIn('path == "/api/rig-candidate"', STUDIO_PY.read_text())


class RigCompareUiTests(unittest.TestCase):
	def test_the_compare_and_accept_controls_are_present(self):
		studio = STUDIO_HTML.read_text()
		self.assertIn('fetch("/api/rig-candidate")', studio)
		for control in ('id="rig-items"', 'id="rig-sheet"', 'id="pig-auto"',
						'id="pig-accept"', 'id="pig-accept-frame"',
						'id="pig-accept-anim"', 'id="pig-accept-all"',
						'id="pig-autonote"'):
			self.assertIn(control, studio, control)
		# the candidate draws as its own non-draggable dot class
		self.assertIn(".autoDot{", studio)
		self.assertIn("pointer-events:none", studio)
		# per-anchor accept + confidence tag
		self.assertIn('data-auto="', studio)
		self.assertIn("function autoConf(", studio)
		# one shared rig selection drives Items AND the Sheet through resolveA
		self.assertIn("function rigFrames(", studio)
		self.assertIn('RIGVIEW==="auto"', studio)

	def test_the_all_animations_accept_is_a_two_step_not_a_blocking_dialog(self):
		studio = STUDIO_HTML.read_text()
		self.assertIn("Really replace every animation?", studio)
		for blocking in ("window.confirm", "window.alert", "confirm(", "alert("):
			self.assertNotIn(blocking, studio, blocking)


if __name__ == "__main__":
	unittest.main()
