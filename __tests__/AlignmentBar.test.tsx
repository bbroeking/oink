// AlignmentBar renders the Greedy ◄──► Giver poles, the standing
// label + signed score, and pins the marker proportionally to the
// score (clamped to the -100..+100 track).

import React from "react";
import TestRenderer from "react-test-renderer";
import { AlignmentBar } from "../components/ui/AlignmentBar";

function textOf(tree: TestRenderer.ReactTestInstance): string {
	const out: string[] = [];
	function walk(n: TestRenderer.ReactTestInstance | string) {
		if (typeof n === "string") { out.push(n); return; }
		for (const c of n.children ?? []) walk(c as any);
	}
	walk(tree);
	return out.join("");
}

// Find the marker view by its absolute-positioned `left` percentage.
function markerLeft(r: TestRenderer.ReactTestRenderer): string | undefined {
	const views = r.root.findAll(
		(n) => Array.isArray((n.props as { style?: unknown }).style)
	);
	for (const v of views) {
		const flat = Object.assign(
			{},
			...(v.props.style as unknown[]).filter(Boolean)
		);
		// the marker has a negative marginLeft + a left percentage
		if (typeof flat.left === "string" && flat.marginLeft < 0) {
			return flat.left;
		}
	}
	return undefined;
}

describe("AlignmentBar", () => {
	test("always shows both poles", () => {
		const t = textOf(TestRenderer.create(<AlignmentBar score={0} />).root);
		expect(t).toContain("GREEDY");
		expect(t).toContain("GIVER");
	});

	test("neutral score shows Pilgrim standing", () => {
		const t = textOf(TestRenderer.create(<AlignmentBar score={0} />).root);
		expect(t).toContain("Pilgrim");
		expect(t).toContain("0");
	});

	test("positive score shows Generous + a leading +", () => {
		const t = textOf(TestRenderer.create(<AlignmentBar score={52} />).root);
		expect(t).toContain("Generous");
		expect(t).toContain("+52");
	});

	test("negative score shows Greedy standing", () => {
		const t = textOf(TestRenderer.create(<AlignmentBar score={-60} />).root);
		expect(t).toContain("Greedy");
		expect(t).toContain("-60");
	});

	test("marker sits at 50% for score 0", () => {
		expect(markerLeft(TestRenderer.create(<AlignmentBar score={0} />))).toBe("50%");
	});

	test("marker sits at 0% for the greediest score", () => {
		expect(markerLeft(TestRenderer.create(<AlignmentBar score={-100} />))).toBe("0%");
	});

	test("marker sits at 100% for the most generous score", () => {
		expect(markerLeft(TestRenderer.create(<AlignmentBar score={100} />))).toBe("100%");
	});

	test("out-of-range score is clamped to the track", () => {
		expect(markerLeft(TestRenderer.create(<AlignmentBar score={999} />))).toBe("100%");
		expect(markerLeft(TestRenderer.create(<AlignmentBar score={-999} />))).toBe("0%");
	});

	test("explicit label prop overrides the score-derived one", () => {
		const t = textOf(
			TestRenderer.create(<AlignmentBar score={-80} label="angel" />).root
		);
		expect(t).toContain("Generous");
	});
});
