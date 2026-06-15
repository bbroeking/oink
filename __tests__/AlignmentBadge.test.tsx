// AlignmentBadge renders the right alignment Icon + label for each
// state, derives the label from score when not passed, and respects
// the compact flag (no label text shown).
//
// Uses react-test-renderer; probes the rendered tree directly.

import React from "react";
import TestRenderer from "react-test-renderer";
import { AlignmentBadge } from "../components/ui/AlignmentBadge";

// Concatenate every Text node's string children — for label checks.
function textOf(tree: TestRenderer.ReactTestInstance): string {
	const out: string[] = [];
	function walk(node: TestRenderer.ReactTestInstance | string) {
		if (typeof node === "string") {
			out.push(node);
			return;
		}
		for (const c of node.children ?? []) walk(c);
	}
	walk(tree);
	return out.join("");
}

// The alignment emblem is an <AlignmentEmblem kind="halo|scales|horns" />.
// Find it by that prop rather than looking for emoji text.
function iconName(r: TestRenderer.ReactTestRenderer): string | undefined {
	for (const n of ["halo", "scales", "horns"]) {
		if (r.root.findAllByProps({ kind: n }).length > 0) return n;
	}
	return undefined;
}

describe("AlignmentBadge", () => {
	test("renders the halo icon + Generous label for label='angel'", () => {
		const r = TestRenderer.create(<AlignmentBadge label="angel" />);
		expect(iconName(r)).toBe("halo");
		expect(textOf(r.root)).toContain("Generous");
	});

	test("renders the horns icon + Greedy label for label='goblin'", () => {
		const r = TestRenderer.create(<AlignmentBadge label="goblin" />);
		expect(iconName(r)).toBe("horns");
		expect(textOf(r.root)).toContain("Greedy");
	});

	test("renders the scales icon + Pilgrim label for label='neutral'", () => {
		const r = TestRenderer.create(<AlignmentBadge label="neutral" />);
		expect(iconName(r)).toBe("scales");
		expect(textOf(r.root)).toContain("Pilgrim");
	});

	test("derives label from positive score when label is omitted", () => {
		const r = TestRenderer.create(<AlignmentBadge score={60} />);
		expect(iconName(r)).toBe("halo");
		expect(textOf(r.root)).toContain("Generous");
	});

	test("derives label from negative score when label is omitted", () => {
		const r = TestRenderer.create(<AlignmentBadge score={-60} />);
		expect(iconName(r)).toBe("horns");
		expect(textOf(r.root)).toContain("Greedy");
	});

	test("derives neutral from zero", () => {
		const r = TestRenderer.create(<AlignmentBadge score={0} />);
		expect(iconName(r)).toBe("scales");
		expect(textOf(r.root)).toContain("Pilgrim");
	});

	test("compact mode shows the icon but hides the text label", () => {
		const r = TestRenderer.create(<AlignmentBadge label="angel" compact />);
		expect(iconName(r)).toBe("halo");
		expect(textOf(r.root)).not.toContain("Generous");
	});

	test("falls back to neutral when neither score nor label provided", () => {
		const r = TestRenderer.create(<AlignmentBadge />);
		expect(iconName(r)).toBe("scales");
		expect(textOf(r.root)).toContain("Pilgrim");
	});

	test("label prop takes precedence over score", () => {
		const r = TestRenderer.create(<AlignmentBadge score={-99} label="angel" />);
		expect(iconName(r)).toBe("halo");
		expect(textOf(r.root)).toContain("Generous");
		expect(textOf(r.root)).not.toContain("Greedy");
	});
});
