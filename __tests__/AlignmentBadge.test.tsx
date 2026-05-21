// AlignmentBadge renders the right emblem + label for each alignment
// state, derives label from score when label not passed, and respects
// the compact flag (no label text shown).
//
// Uses react-test-renderer (built into jest-expo) for snapshot-style
// inspection without DOM. We probe the rendered tree directly rather
// than relying on testing-library.

import React from "react";
import TestRenderer from "react-test-renderer";
import { AlignmentBadge } from "../components/ui/AlignmentBadge";

// Crawl the rendered tree and collect every Text node's children
// concatenated into a single string. Useful for "does the badge
// say 'Generous' anywhere" checks without caring about exact DOM
// structure.
function textOf(tree: TestRenderer.ReactTestInstance): string {
	const out: string[] = [];
	function walk(node: TestRenderer.ReactTestInstance | string) {
		if (typeof node === "string") {
			out.push(node);
			return;
		}
		const children = node.children ?? [];
		for (const c of children) walk(c as any);
	}
	walk(tree);
	return out.join("");
}

describe("AlignmentBadge", () => {
	test("renders angel emblem + label when label='angel'", () => {
		const r = TestRenderer.create(<AlignmentBadge label="angel" />);
		const text = textOf(r.root);
		expect(text).toContain("😇");
		expect(text).toContain("Generous");
	});

	test("renders goblin emblem + label when label='goblin'", () => {
		const r = TestRenderer.create(<AlignmentBadge label="goblin" />);
		const text = textOf(r.root);
		expect(text).toContain("👹");
		expect(text).toContain("Greedy");
	});

	test("renders neutral emblem + label when label='neutral'", () => {
		const r = TestRenderer.create(<AlignmentBadge label="neutral" />);
		const text = textOf(r.root);
		expect(text).toContain("⚖️");
		expect(text).toContain("Pilgrim");
	});

	test("derives label from positive score when label is omitted", () => {
		const r = TestRenderer.create(<AlignmentBadge score={60} />);
		const text = textOf(r.root);
		expect(text).toContain("Generous");
	});

	test("derives label from negative score when label is omitted", () => {
		const r = TestRenderer.create(<AlignmentBadge score={-60} />);
		const text = textOf(r.root);
		expect(text).toContain("Greedy");
	});

	test("derives neutral from zero", () => {
		const r = TestRenderer.create(<AlignmentBadge score={0} />);
		const text = textOf(r.root);
		expect(text).toContain("Pilgrim");
	});

	test("compact mode hides the text label", () => {
		const r = TestRenderer.create(<AlignmentBadge label="angel" compact />);
		const text = textOf(r.root);
		expect(text).toContain("😇");
		expect(text).not.toContain("Generous");
	});

	test("falls back to neutral when neither score nor label provided", () => {
		const r = TestRenderer.create(<AlignmentBadge />);
		const text = textOf(r.root);
		expect(text).toContain("Pilgrim");
	});

	test("label prop takes precedence over score", () => {
		// If both are supplied, the explicit label wins. Useful when
		// the server has already computed the label and we want to
		// avoid drift if thresholds ever change.
		const r = TestRenderer.create(<AlignmentBadge score={-99} label="angel" />);
		const text = textOf(r.root);
		expect(text).toContain("Generous");
		expect(text).not.toContain("Greedy");
	});
});
