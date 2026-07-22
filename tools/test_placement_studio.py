import pathlib
import unittest
from unittest import mock

from tools import placement_studio


ROOT = pathlib.Path(__file__).resolve().parents[1]
STUDIO_HTML = ROOT / "tools" / "placement_studio.html"


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


if __name__ == "__main__":
	unittest.main()
