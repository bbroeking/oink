const mockGetPermissions = jest.fn();
const mockRequestPermissions = jest.fn();
const mockGetToken = jest.fn();
const mockCancelScheduled = jest.fn();
const mockRpcAction = jest.fn();
const mockGetItem = jest.fn();
const mockSetItem = jest.fn();
const mockRemoveItem = jest.fn();

jest.mock("expo-notifications", () => ({
  SchedulableTriggerInputTypes: { TIME_INTERVAL: "timeInterval" },
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: (...args: unknown[]) => mockGetPermissions(...args),
  requestPermissionsAsync: (...args: unknown[]) =>
    mockRequestPermissions(...args),
  getExpoPushTokenAsync: (...args: unknown[]) => mockGetToken(...args),
  cancelScheduledNotificationAsync: (...args: unknown[]) =>
    mockCancelScheduled(...args),
  scheduleNotificationAsync: jest.fn(),
}));

jest.mock("react-native", () => ({ Platform: { OS: "ios" } }));
jest.mock("expo-constants", () => ({
  expoConfig: { extra: { eas: { projectId: "project-id" } } },
  easConfig: null,
}));
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (...args: unknown[]) => mockGetItem(...args),
    setItem: (...args: unknown[]) => mockSetItem(...args),
    removeItem: (...args: unknown[]) => mockRemoveItem(...args),
  },
}));
jest.mock("../utils/rpc", () => ({
  rpcAction: (...args: unknown[]) => mockRpcAction(...args),
}));
jest.mock("../utils/notificationPolicy", () => ({
  foregroundNotificationBehavior: jest.fn(),
}));
jest.mock("../utils/rooting", () => ({ nextOpenAtMs: jest.fn() }));

// Jest factories must install native-module mocks before this import.
// eslint-disable-next-line import/first
import {
  getFeedingPushPreference,
  setFeedingPushPreference,
} from "../utils/pushNotifications";

describe("persistent Feeding push preference", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetItem.mockResolvedValue(null);
    mockSetItem.mockResolvedValue(undefined);
    mockRemoveItem.mockResolvedValue(undefined);
    mockCancelScheduled.mockResolvedValue(undefined);
    mockGetPermissions.mockResolvedValue({ status: "granted" });
    mockRequestPermissions.mockResolvedValue({ status: "granted" });
    mockGetToken.mockResolvedValue({ data: "ExponentPushToken[test-device]" });
    mockRpcAction.mockImplementation(async (name: string, args?: unknown) => {
      if (name === "feeding_push_preference") {
        return { ok: true, enabled: true };
      }
      if (name === "set_push_token") return { ok: true };
      if (name === "set_feeding_push_preference") {
        return {
          ok: true,
          enabled: (args as { p_enabled: boolean }).p_enabled,
        };
      }
      return { ok: false, reason: "unexpected" };
    });
  });

  test("reads the account-level truth used by remounts and other devices", async () => {
    await expect(getFeedingPushPreference()).resolves.toBe(true);
    expect(mockRpcAction).toHaveBeenCalledWith("feeding_push_preference");
  });

  test("enabling registers the token before turning on every-Feeding pushes", async () => {
    await expect(setFeedingPushPreference(true)).resolves.toBe("enabled");

    expect(mockGetToken).toHaveBeenCalledWith({ projectId: "project-id" });
    expect(mockRpcAction.mock.calls).toEqual([
      ["set_push_token", { token: "ExponentPushToken[test-device]" }],
      ["set_feeding_push_preference", { p_enabled: true }],
    ]);
    expect(mockCancelScheduled).toHaveBeenCalledWith("patch-open-reminder");
  });

  test("a denied device never writes a false enabled preference", async () => {
    mockGetPermissions.mockResolvedValue({ status: "denied" });

    await expect(setFeedingPushPreference(true)).resolves.toBe("denied");
    expect(mockRpcAction).toHaveBeenCalledWith("set_push_token", {
      token: null,
    });
    expect(mockRpcAction).not.toHaveBeenCalledWith(
      "set_feeding_push_preference",
      { p_enabled: true },
    );
    expect(mockRemoveItem).toHaveBeenCalled();
  });

  test("disabling needs no permission and cancels an old local reminder", async () => {
    mockGetPermissions.mockRejectedValue(new Error("must not be read"));

    await expect(setFeedingPushPreference(false)).resolves.toBe("disabled");
    expect(mockGetPermissions).not.toHaveBeenCalled();
    expect(mockRpcAction).toHaveBeenCalledWith("set_feeding_push_preference", {
      p_enabled: false,
    });
    expect(mockCancelScheduled).toHaveBeenCalledWith("patch-open-reminder");
  });

  test("a cached token is revalidated against OS permission and server state", async () => {
    mockGetItem.mockResolvedValue("ExponentPushToken[cached-device]");

    await expect(setFeedingPushPreference(true)).resolves.toBe("enabled");
    expect(mockGetPermissions).toHaveBeenCalled();
    expect(mockGetToken).not.toHaveBeenCalled();
    expect(mockRpcAction.mock.calls[0]).toEqual([
      "set_push_token",
      { token: "ExponentPushToken[cached-device]" },
    ]);
  });
});
