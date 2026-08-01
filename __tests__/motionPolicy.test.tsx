import fs from "node:fs";
import path from "node:path";
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text } from "react-native";
import {
	MotionPolicyProvider,
	startDecorativeLoop,
	useMotionPolicy,
	type MotionPolicy,
} from "../hooks/useMotionPolicy";

function PolicyProbe() {
	const policy = useMotionPolicy();
	return (
		<Text>
			{policy.reduceMotion ? "reduced" : "full"}:
			{policy.duration(400)}
		</Text>
	);
}

function renderText(node: React.ReactElement) {
	let renderer!: TestRenderer.ReactTestRenderer;
	act(() => {
		renderer = TestRenderer.create(node);
	});
	const children = renderer.root.findByType(Text).props.children;
	const value = Array.isArray(children) ? children.join("") : String(children);
	act(() => renderer.unmount());
	return value;
}

describe("systemic motion policy", () => {
	test("supports deterministic full and reduced overrides for the UI audit lab", () => {
		expect(
			renderText(
				<MotionPolicyProvider reduceMotion={false}>
					<PolicyProbe />
				</MotionPolicyProvider>
			)
		).toContain("full:400");
		expect(
			renderText(
				<MotionPolicyProvider reduceMotion>
					<PolicyProbe />
				</MotionPolicyProvider>
			)
		).toContain("reduced:150");
	});

	test("decorative loops do not start under Reduce Motion and reset to rest", () => {
		const start = jest.fn();
		const stop = jest.fn();
		const rest = jest.fn();
		const reducedPolicy: MotionPolicy = {
			reduceMotion: true,
			allowDecorativeMotion: false,
			largeTransition: "crossfade",
			duration: (_standard, reduced = 150) => reduced,
		};

		const cleanup = startDecorativeLoop({
			policy: reducedPolicy,
			animation: { start, stop } as never,
			rest,
		});
		cleanup();

		expect(start).not.toHaveBeenCalled();
		expect(stop).not.toHaveBeenCalled();
		expect(rest).toHaveBeenCalledTimes(1);
	});

	test("decorative loops start and stop under full motion", () => {
		const start = jest.fn();
		const stop = jest.fn();
		const fullPolicy: MotionPolicy = {
			reduceMotion: false,
			allowDecorativeMotion: true,
			largeTransition: "motion",
			duration: (standard) => standard,
		};

		const cleanup = startDecorativeLoop({
			policy: fullPolicy,
			animation: { start, stop } as never,
		});
		expect(start).toHaveBeenCalledTimes(1);
		cleanup();
		expect(stop).toHaveBeenCalledTimes(1);
	});
});

describe("motion-policy migration coverage", () => {
	const root = path.resolve(__dirname, "..");
	const namedSurfaces = [
		"components/ui/AnimatedBackground.tsx",
		"components/GreatHungerMeter.tsx",
		"components/LuckyPigModal.tsx",
		"components/BarnVisitModal.tsx",
		"components/TruffleButton.tsx",
		"components/ui/AnimatedCosmetic.tsx",
		"components/ui/PigStage.tsx",
		"components/ui/Skeleton.tsx",
		"components/ui/TierUpBanner.tsx",
		"components/AlignmentExplainerModal.tsx",
		"components/AlignmentSchismModal.tsx",
		"components/AchievementDigestModal.tsx",
		"components/SeasonEndModal.tsx",
		"components/MysteryHatReveal.tsx",
	];

	test.each(namedSurfaces)("%s consumes the shared policy", (file) => {
		expect(fs.readFileSync(path.join(root, file), "utf8")).toContain(
			"useMotionPolicy"
		);
	});

	test("legacy direct OS preference readers were removed from app and components", () => {
		const offenders: string[] = [];
		const visit = (directory: string) => {
			for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
				const fullPath = path.join(directory, entry.name);
				if (entry.isDirectory()) visit(fullPath);
				else if (/\.[jt]sx?$/.test(entry.name)) {
					const source = fs.readFileSync(fullPath, "utf8");
					if (
						source.includes("isReduceMotionEnabled") ||
						source.includes('"reduceMotionChanged"')
					) {
						offenders.push(path.relative(root, fullPath));
					}
				}
			}
		};
		visit(path.join(root, "app"));
		visit(path.join(root, "components"));
		expect(offenders).toEqual([]);
	});

	test("the audit lab exposes policy overrides and a Tier Up preview", () => {
		const source = fs.readFileSync(path.join(root, "app/ui-audit.tsx"), "utf8");
		expect(source).toContain("MotionPolicyProvider");
		expect(source).toContain('requestedMotion === "full"');
		expect(source).toContain('requestedMotion === "reduced"');
		expect(source).toContain("Preview Tier Up transition");
	});

	test("the audit lab can always exit to the Barn", () => {
		const source = fs.readFileSync(path.join(root, "app/ui-audit.tsx"), "utf8");
		expect(source).toContain("‹ Back to Barn");
		expect(source).toContain('router.replace("/")');
	});
});
