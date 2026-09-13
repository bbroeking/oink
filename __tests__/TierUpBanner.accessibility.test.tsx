import React, { createRef } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { AccessibilityInfo, Animated, Platform } from "react-native";

import {
  TierUpBanner,
  type TierUpBannerHandle,
} from "../components/ui/TierUpBanner";

jest.mock("expo-audio", () => ({
  useAudioPlayer: () => ({ seekTo: jest.fn(), play: jest.fn() }),
}));
jest.mock("expo-haptics", () => ({
  NotificationFeedbackType: { Success: "success" },
  notificationAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 59, right: 0, bottom: 34, left: 0 }),
}));
jest.mock("../hooks/useMotionPolicy", () => ({
  MOTION_DURATION: { crossfade: 0 },
  useMotionPolicy: () => ({ reduceMotion: true, allowDecorativeMotion: false }),
}));

describe("TierUpBanner accessibility announcements", () => {
  const originalOS = Platform.OS;
  let animationSpy: jest.SpyInstance;
  let announceSpy: jest.SpyInstance;

  beforeEach(() => {
    animationSpy = jest.spyOn(Animated, "sequence").mockReturnValue({
      start: jest.fn(),
      stop: jest.fn(),
      reset: jest.fn(),
    } as never);
    announceSpy = jest
      .spyOn(AccessibilityInfo, "announceForAccessibilityWithOptions")
      .mockImplementation(() => {});
  });

  afterEach(() => {
    Object.defineProperty(Platform, "OS", { value: originalOS });
    animationSpy.mockRestore();
    announceSpy.mockRestore();
  });

  test("queues exactly one consolidated announcement per iOS unlock", () => {
    Object.defineProperty(Platform, "OS", { value: "ios" });
    const ref = createRef<TierUpBannerHandle>();
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<TierUpBanner ref={ref} />);
    });
    act(() => ref.current?.fire(7));

    expect(announceSpy).toHaveBeenCalledTimes(1);
    expect(announceSpy).toHaveBeenCalledWith(
      "Snout Season tier 7 unlocked. New reward waiting below.",
      { queue: true },
    );
    const banner = renderer.root.findByProps({
      accessibilityLabel:
        "Snout Season tier 7 unlocked. New reward waiting below.",
    });
    expect(banner.props.accessibilityLiveRegion).toBeUndefined();
    act(() => renderer.unmount());
  });

  test("non-iOS relies on the polite live region without imperative speech", () => {
    Object.defineProperty(Platform, "OS", { value: "android" });
    const ref = createRef<TierUpBannerHandle>();
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<TierUpBanner ref={ref} />);
    });
    act(() => ref.current?.fire(4));

    expect(announceSpy).not.toHaveBeenCalled();
    const banner = renderer.root.findByProps({
      accessibilityLabel:
        "Snout Season tier 4 unlocked. New reward waiting below.",
    });
    expect(banner.props.accessibilityRole).toBe("alert");
    expect(banner.props.accessibilityLiveRegion).toBe("polite");
    act(() => renderer.unmount());
  });
});
