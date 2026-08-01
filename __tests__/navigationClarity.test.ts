import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const onboarding = fs.readFileSync(
	path.join(ROOT, "components/Onboarding.tsx"),
	"utf8",
);
const friendsHub = fs.readFileSync(
	path.join(ROOT, "app/(tabs)/friends.tsx"),
	"utf8",
);

describe("first-session clarity", () => {
	test("onboarding teaches the care, timed dig, and social loop", () => {
		expect(onboarding).toContain('title: "Meet Rosie"');
		expect(onboarding).toContain('title: "Dig when it opens"');
		expect(onboarding).toContain('title: "Help your herd"');
		expect(onboarding).toContain("Dig now");
		expect(onboarding).toContain("Opening in");
		expect(onboarding).toContain("join a Sounder");
	});

	test("onboarding names snouts as the Shop currency and retires the heart claim", () => {
		expect(onboarding).toContain("snouts to spend in the Shop");
		expect(onboarding).not.toContain("Each tickle earns a heart");
		expect(onboarding).not.toContain("Spend hearts in the shop");
	});

	test("Friends opens on friends while retaining explicit segment deep links", () => {
		expect(friendsHub).toMatch(
			/useState<Segment>\(targetSeg \?\? "friends"\)/,
		);
		expect(friendsHub).toContain(
			'const SEGMENT_KEYS: Segment[] = ["board", "inbox", "friends", "sounder"]',
		);
	});

	test("the leaderboard uses a descriptive visible label", () => {
		expect(friendsHub).toContain(
			'{ key: "board", label: "Rankings", icon: "ranks" }',
		);
		expect(friendsHub).toContain(
			'board: { kicker: "all-time tickles", title: "Rankings" }',
		);
	});
});
