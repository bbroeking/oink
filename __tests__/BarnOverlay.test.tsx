// BarnOverlay renders the angel variant, the goblin variant, or
// nothing (neutral). Identified by testID on the variant root.

import React from "react";
import TestRenderer from "react-test-renderer";
import fs from "node:fs";
import path from "node:path";
import { StyleSheet, View } from "react-native";
import { BarnOverlay } from "../components/ui/BarnOverlay";

const barn = fs.readFileSync(
	path.join(__dirname, "..", "components", "Barn.tsx"),
	"utf8",
);

describe("BarnOverlay", () => {
	test("neutral renders nothing", () => {
		const r = TestRenderer.create(<BarnOverlay alignment="neutral" />);
		expect(r.toJSON()).toBeNull();
	});

	test("angel renders the angel overlay", () => {
		const r = TestRenderer.create(<BarnOverlay alignment="angel" />);
		expect(r.root.findByProps({ testID: "barn-overlay-angel" })).toBeTruthy();
		// and NOT the goblin one
		expect(
			r.root.findAllByProps({ testID: "barn-overlay-goblin" })
		).toHaveLength(0);
	});

	test("angel tint does not add white bubble decorations over Home content", () => {
		const r = TestRenderer.create(<BarnOverlay alignment="angel" />);
		const whiteBubbles = r.root.findAllByType(View).filter((node) => {
			const style = StyleSheet.flatten(node.props.style);
			return style?.backgroundColor === "#FFFFFF";
		});

		expect(whiteBubbles).toHaveLength(0);
		expect(barn).not.toContain("generousPuff");
	});

	test("goblin renders the goblin overlay", () => {
		const r = TestRenderer.create(<BarnOverlay alignment="goblin" />);
		expect(r.root.findByProps({ testID: "barn-overlay-goblin" })).toBeTruthy();
		expect(
			r.root.findAllByProps({ testID: "barn-overlay-angel" })
		).toHaveLength(0);
	});

	test("overlay never intercepts touches (pointerEvents none)", () => {
		const r = TestRenderer.create(<BarnOverlay alignment="angel" />);
		const root = r.root.findByProps({ testID: "barn-overlay-angel" });
		expect(root.props.pointerEvents).toBe("none");
	});

	test("a blessing does not tint the Barn", () => {
		const r = TestRenderer.create(
			<BarnOverlay alignment="neutral" {...({ blessed: true } as object)} />
		);
		expect(r.toJSON()).toBeNull();
	});
});
