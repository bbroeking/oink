const mockGetItem = jest.fn();
const mockSetItem = jest.fn();
const mockRpc = jest.fn();

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (...args: unknown[]) => mockGetItem(...args),
    setItem: (...args: unknown[]) => mockSetItem(...args),
  },
}));
jest.mock("../utils/rpc", () => ({
  rpc: (...args: unknown[]) => mockRpc(...args),
}));

import {
  applyEffectiveFeedingTimeZone,
  feedingTimeZone,
  hydrateFeedingTimeZone,
  registerDeviceFeedingTimeZone,
  resetFeedingTimeZoneSession,
  zonedCivilParts,
  zonedCivilToEpochMs,
} from "../utils/feedingTimeZone";

beforeEach(() => {
  mockGetItem.mockReset();
  mockSetItem.mockReset();
  mockRpc.mockReset();
  resetFeedingTimeZoneSession();
});

describe("IANA civil-time conversion", () => {
  test("uses PostgreSQL's later instant in a fall-back fold", () => {
    const instant = zonedCivilToEpochMs(
      { year: 2026, month: 11, day: 1, hour: 1, minute: 30 },
      "America/New_York",
    );
    expect(new Date(instant).toISOString()).toBe("2026-11-01T06:30:00.000Z");
  });

  test("moves a missing spring-forward time through the gap", () => {
    const instant = zonedCivilToEpochMs(
      { year: 2026, month: 3, day: 8, hour: 2, minute: 30 },
      "America/New_York",
    );
    expect(zonedCivilParts(instant, "America/New_York")).toMatchObject({
      year: 2026,
      month: 3,
      day: 8,
      hour: 3,
      minute: 30,
    });
  });
});

describe("effective feeding timezone lifecycle", () => {
  test("hydrates a per-user effective zone and resets between accounts", async () => {
    mockGetItem.mockResolvedValue("Europe/London");
    await hydrateFeedingTimeZone("pig-a");
    expect(feedingTimeZone()).toBe("Europe/London");
    expect(mockGetItem).toHaveBeenCalledWith("feeding_time_zone_v1:pig-a");

    resetFeedingTimeZoneSession("pig-b");
    expect(feedingTimeZone()).toBe("America/New_York");
  });

  test("uses the server effective zone, never the pending/device zone", async () => {
    resetFeedingTimeZoneSession("pig-a");
    mockRpc.mockResolvedValue({
      ok: true,
      feeding_time_zone: "America/New_York",
      pending_feeding_time_zone: "America/Los_Angeles",
      pending_effective_at: "2026-09-14T00:00:00Z",
    });
    await registerDeviceFeedingTimeZone("pig-a");
    expect(mockRpc).toHaveBeenCalledWith("set_feeding_time_zone", {
      p_time_zone: expect.any(String),
    });
    expect(feedingTimeZone()).toBe("America/New_York");
    expect(mockSetItem).toHaveBeenCalledWith(
      "feeding_time_zone_v1:pig-a",
      "America/New_York",
    );
  });

  test("a missing pre-migration RPC keeps the safe Eastern default", async () => {
    resetFeedingTimeZoneSession("pig-a");
    mockRpc.mockRejectedValue(new Error("missing function"));
    await expect(registerDeviceFeedingTimeZone("pig-a")).resolves.toBe(false);
    expect(feedingTimeZone()).toBe("America/New_York");
  });

  test("rejects malformed zones", () => {
    expect(applyEffectiveFeedingTimeZone("Mars/Olympus_Mons")).toBe(false);
    expect(feedingTimeZone()).toBe("America/New_York");
  });
});


test("late timezone registration cannot overwrite a newer effective zone", async () => {
  resetFeedingTimeZoneSession("pig-a");
  let resolve!: (value: { feeding_time_zone: string }) => void;
  mockRpc.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
  const older = registerDeviceFeedingTimeZone("pig-a");
  mockRpc.mockResolvedValueOnce({ feeding_time_zone: "Europe/London" });
  await registerDeviceFeedingTimeZone("pig-a");
  resolve({ feeding_time_zone: "America/New_York" });
  await expect(older).resolves.toBe(false);
  expect(feedingTimeZone()).toBe("Europe/London");
});

test("cache hydration cannot overwrite a zone already confirmed by the server", async () => {
  resetFeedingTimeZoneSession("pig-a");
  let resolve!: (value: string) => void;
  mockGetItem.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
  const hydration = hydrateFeedingTimeZone("pig-a");
  mockRpc.mockResolvedValueOnce({ feeding_time_zone: "Europe/London" });
  await registerDeviceFeedingTimeZone("pig-a");
  resolve("America/New_York");
  await hydration;
  expect(feedingTimeZone()).toBe("Europe/London");
});
