import AsyncStorage from "@react-native-async-storage/async-storage";
import React from "react";
import { Pressable } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { SafeAreaProvider } from "react-native-safe-area-context";

const metrics = {
  frame: { x: 0, y: 0, width: 320, height: 568 },
  insets: { top: 20, left: 0, right: 0, bottom: 16 },
};

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (callback: () => void | (() => void)) => {
    const React = require("react");
    React.useEffect(callback, [callback]);
  },
}));

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: { Success: "success" },
}));

jest.mock("@/utils/interactionAnalytics", () => ({
  trackInteraction: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/components/ui/AdaptiveModalScaffold", () => ({
  AdaptiveModalScaffold: () => null,
}));

jest.mock("@/utils/guestbookStamps", () => {
  const actual = jest.requireActual("@/utils/guestbookStamps");
  return {
    ...actual,
    fetchMyGuestbook: jest.fn().mockResolvedValue({
      total: 1,
      entries: [
        {
          id: 42,
          stampId: "heart",
          visitorName: "Poppy",
          stampedAt: "2026-08-01T12:00:00Z",
        },
      ],
    }),
  };
});

import { BarnGuestbook } from "@/components/BarnGuestbook";

async function render(component: React.ReactElement) {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <SafeAreaProvider initialMetrics={metrics}>{component}</SafeAreaProvider>,
    );
  });
  await act(async () => Promise.resolve());
  return renderer;
}

describe("dismissible Barn notices", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("removes the guestbook notice without opening it", async () => {
    const renderer = await render(<BarnGuestbook />);
    const buttons = () =>
      renderer.root
        .findAllByType(Pressable)
        .filter((node) => node.props.testID === "barn-guestbook-open");

    expect(buttons()).toHaveLength(1);
    act(() =>
      renderer.root.findByProps({ testID: "barn-guestbook-dismiss" }).props.onPress(),
    );

    expect(buttons()).toHaveLength(0);
  });
});
