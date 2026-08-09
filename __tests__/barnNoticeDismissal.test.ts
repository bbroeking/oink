import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  dismissBarnNotice,
  guestbookNoticeSignature,
  isBarnNoticeDismissed,
  shouldClearOnRelease,
} from "@/utils/barnNoticeDismissal";
import type { GuestbookEntry } from "@/utils/guestbookStamps";

const entry = (id: number): GuestbookEntry => ({
  id,
  stampId: "heart",
  visitorName: "Poppy",
  stampedAt: "2026-08-01T12:00:00Z",
});

describe("Barn notice dismissal", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("keeps a dismissed notice hidden across launches", async () => {
    expect(await isBarnNoticeDismissed("guestbook", "2:4")).toBe(false);

    await dismissBarnNotice("guestbook", "2:4");

    expect(await isBarnNoticeDismissed("guestbook", "2:4")).toBe(true);
  });

  it("re-arms the surface when its content signature changes", async () => {
    await dismissBarnNotice("guestbook", "2:9");

    expect(await isBarnNoticeDismissed("guestbook", "2:9")).toBe(true);
    expect(await isBarnNoticeDismissed("guestbook", "3:12")).toBe(false);
  });

  it("changes the guestbook signature only when its durable snapshot changes", () => {
    expect(guestbookNoticeSignature(2, [entry(9), entry(4)])).toBe("2:9");
    expect(guestbookNoticeSignature(2, [entry(4), entry(9)])).toBe("2:9");
    expect(guestbookNoticeSignature(3, [entry(12), entry(9)])).toBe("3:12");
  });

  it("clears on a far drag in either direction", () => {
    expect(shouldClearOnRelease(150, 0, 340)).toBe(true);
    expect(shouldClearOnRelease(-150, 0, 340)).toBe(true);
    expect(shouldClearOnRelease(120, 0, 340)).toBe(false);
  });

  it("clears on a fast fling but not on a fast twitch", () => {
    expect(shouldClearOnRelease(40, 1.2, 340)).toBe(true);
    expect(shouldClearOnRelease(-40, -1.2, 340)).toBe(true);
    expect(shouldClearOnRelease(10, 2.0, 340)).toBe(false);
  });

  it("keeps a slow, short drag", () => {
    expect(shouldClearOnRelease(30, 0.2, 340)).toBe(false);
  });
});
