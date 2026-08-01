const mockGetPermissions = jest.fn();
const mockRequestPermissions = jest.fn();
const mockCancelScheduled = jest.fn();
const mockSchedule = jest.fn();

jest.mock("expo-notifications", () => ({
	SchedulableTriggerInputTypes: { TIME_INTERVAL: "timeInterval" },
	setNotificationHandler: jest.fn(),
	getPermissionsAsync: (...args: unknown[]) => mockGetPermissions(...args),
	requestPermissionsAsync: (...args: unknown[]) =>
		mockRequestPermissions(...args),
	cancelScheduledNotificationAsync: (...args: unknown[]) =>
		mockCancelScheduled(...args),
	scheduleNotificationAsync: (...args: unknown[]) => mockSchedule(...args),
}));

jest.mock("react-native", () => ({ Platform: { OS: "ios" } }));
jest.mock("expo-constants", () => ({ expoConfig: null, easConfig: null }));
jest.mock("@react-native-async-storage/async-storage", () => ({
	__esModule: true,
	default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
}));
jest.mock("../utils/rpc", () => ({ rpc: jest.fn() }));
jest.mock("../utils/notificationPolicy", () => ({
	foregroundNotificationBehavior: jest.fn(),
}));

const mockNextOpenAtMs = jest.fn();
jest.mock("../utils/rooting", () => ({
	nextOpenAtMs: (...args: unknown[]) => mockNextOpenAtMs(...args),
}));

import { scheduleOpenReminder } from "../utils/pushNotifications";

describe("Truffle Patch opening reminder", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockGetPermissions.mockResolvedValue({ status: "granted" });
		mockCancelScheduled.mockResolvedValue(undefined);
		mockSchedule.mockResolvedValue("patch-open-reminder");
	});

	test("schedules exactly one replaceable notification for the next server-configured opening", async () => {
		const now = 1_750_000_000_000;
		mockNextOpenAtMs.mockReturnValue(now + 90_000);

		await expect(scheduleOpenReminder(now)).resolves.toBe("scheduled");
		expect(mockNextOpenAtMs).toHaveBeenCalledWith(now);
		expect(mockCancelScheduled).toHaveBeenCalledWith("patch-open-reminder");
		expect(mockSchedule).toHaveBeenCalledWith({
			identifier: "patch-open-reminder",
			content: {
				title: "the patch is open",
				body: "the Hungerer's gorging — dig quick, dig quiet.",
			},
			trigger: {
				type: "timeInterval",
				seconds: 90,
			},
		});
	});

	test("does not schedule when notification permission is denied", async () => {
		mockGetPermissions.mockResolvedValue({ status: "denied" });

		await expect(scheduleOpenReminder()).resolves.toBe("denied");
		expect(mockSchedule).not.toHaveBeenCalled();
	});
});
