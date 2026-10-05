// The crew row: portrait · name · line as ONE accessibility element, and its
// action column beside it, never inside it (2026-10-04, after/038). Inside the
// element every control was silent: the leader's kick, Join / Decline, "let
// them in" / "not now", Invite, "take it back".
import fs from "node:fs";
import path from "node:path";
import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import { CrewRow } from "../components/ui/CrewRow";
import { HandLink, RowStatus, SunPill } from "../components/ui/SocialRows";
import {
	ProfileIdentity,
	profileIdentityText,
} from "../components/ui/ProfileIdentity";
import { SPACE } from "../constants/theme";

// The portrait's pig pulls in the Sentry logger (a module-level timer); these
// tests are about the row's accessibility tree, not the sprite. (Jest hoists
// this above the imports.)
jest.mock("../components/ui/PrestigeAvatar", () => ({ PrestigeAvatar: () => null }));

function mount(element: React.ReactElement) {
	let renderer!: TestRenderer.ReactTestRenderer;
	act(() => {
		renderer = TestRenderer.create(element);
	});
	return renderer;
}

// An accessibility element hides everything inside it from VoiceOver.
function insideAnElement(node: TestRenderer.ReactTestInstance) {
	for (let p = node.parent; p; p = p.parent) {
		if (p.props.accessible === true) return true;
	}
	return false;
}

const control = (r: TestRenderer.ReactTestRenderer, label: string) =>
	r.root.findAll(
		(n) => n.props.accessibilityLabel === label && n.props.accessibilityRole === "button",
	)[0];

const identity = (r: TestRenderer.ReactTestRenderer) =>
	r.root.findAll((n) => n.props.accessible === true && typeof n.props.style === "function")[0];

describe("CrewRow", () => {
	test("the leader's kick is its own control, beside the member's element", () => {
		const r = mount(
			<CrewRow
				left={null}
				title="alice"
				sub="rides with you"
				onPress={() => {}}
				accessibilityHint="Opens their profile"
				right={
					<HandLink onPress={() => {}} accessibilityLabel="Remove alice from the Sounder">
						kick
					</HandLink>
				}
			/>,
		);
		const kick = control(r, "Remove alice from the Sounder");
		expect(kick).toBeDefined();
		expect(insideAnElement(kick)).toBe(false);
		// The member is still one button that opens their profile.
		expect(identity(r).props.accessibilityRole).toBe("button");
		expect(identity(r).props.accessibilityLabel).toBe("alice, rides with you");
		act(() => r.unmount());
	});

	test("a row that opens nothing still leaves its controls reachable (an invite's Join / Decline)", () => {
		const r = mount(
			<CrewRow
				left={null}
				title="Maple wants you in Mud Club"
				sub="2 seats open"
				right={
					<>
						<SunPill onPress={() => {}} accessibilityLabel="Join Mud Club">
							Join
						</SunPill>
						<HandLink onPress={() => {}} accessibilityLabel="Decline the invite to Mud Club">
							not now
						</HandLink>
					</>
				}
			/>,
		);
		expect(insideAnElement(control(r, "Join Mud Club"))).toBe(false);
		expect(insideAnElement(control(r, "Decline the invite to Mud Club"))).toBe(false);
		// The identity reads as text, not a button it isn't.
		expect(identity(r).props.accessibilityRole).toBe("text");
		act(() => r.unmount());
	});

	test("a status in the action column is read on its own, not swallowed", () => {
		const r = mount(
			<CrewRow left={null} title="alice" sub="wearing the crown now" right={<RowStatus accent>leader</RowStatus>} />,
		);
		const status = r.root.findAll((n) => typeof n.props.children === "string" && n.props.children === "leader")[0];
		expect(insideAnElement(status)).toBe(false);
		act(() => r.unmount());
	});

	test("a ProfileIdentity title still names the pig: the plain title stands in", () => {
		const r = mount(
			<CrewRow
				left={null}
				title="alice"
				titleNode={<ProfileIdentity username="alice" />}
				sub="rides with you"
				onPress={() => {}}
			/>,
		);
		expect(identity(r).props.accessibilityLabel).toBe("alice, rides with you");
		act(() => r.unmount());
	});

	test("the identity's hit frame reaches back into the row's pad", () => {
		const r = mount(<CrewRow left={null} title="alice" onPress={() => {}} />);
		expect(identity(r).props.hitSlop).toEqual({
			top: SPACE.sm,
			bottom: SPACE.sm,
			left: 0,
			right: 0,
		});
		act(() => r.unmount());
	});
});

describe("profileIdentityText", () => {
	test("says what the identity draws: name, #code, suffix, then the title", () => {
		expect(
			profileIdentityText({
				username: "DemoPig",
				suffix: "(you)",
				title: { name: "Silvester Sow", placement: "pre" },
			}),
		).toBe("DemoPig (you), Silvester Sow");
		expect(profileIdentityText({ username: "DemoHelper1", discriminator: "1035" })).toBe(
			"DemoHelper1 #1035",
		);
		expect(profileIdentityText({ username: null })).toBe("Anonymous");
	});

	test("the Sounder's roster rows speak it, then their line", () => {
		const source = fs.readFileSync(path.join(process.cwd(), "components/SounderCard.tsx"), "utf8");
		const roster = source.slice(source.indexOf("crew.members.map("));
		const row = roster.slice(0, roster.indexOf("/>\n\t\t\t\t\t\t))}"));
		expect(row).toContain("accessibilityLabel={`${profileIdentityText({");
		expect(row).toContain('"wearing the crown now" : "rides with you"}`}');
	});
});
