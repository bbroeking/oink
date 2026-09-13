import {
	foregroundNotificationBehavior,
	foregroundNotificationMode,
} from "@/utils/notificationPolicy";

describe("foreground notification policy", () => {
	it("is quiet by default, including unknown and legacy payloads", () => {
		expect(foregroundNotificationMode(undefined)).toBe("quiet");
		expect(foregroundNotificationMode({ kind: "legacy_push" })).toBe("quiet");
		expect(foregroundNotificationBehavior({ kind: "hunger_stage_reward" })).toEqual({
			shouldShowAlert: false,
			shouldShowBanner: false,
			shouldShowList: false,
			shouldPlaySound: false,
			shouldSetBadge: false,
		});
	});

	it("only interrupts when the producer explicitly opts in", () => {
		expect(
			foregroundNotificationBehavior({ foreground: "alert" })
		).toEqual({
			shouldShowAlert: true,
			shouldShowBanner: true,
			shouldShowList: true,
			shouldPlaySound: true,
			shouldSetBadge: true,
		});
	});

	it("does not treat arbitrary truthy values as permission to interrupt", () => {
		expect(foregroundNotificationMode({ foreground: true })).toBe("quiet");
		expect(foregroundNotificationMode({ foreground: "loud" })).toBe("quiet");
	});
});
