import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Modal } from "react-native";
import { HabitatExpansionDiscovery } from "@/components/habitat/HabitatExpansionDiscovery";
import { showHabitatIntro } from "@/utils/habitatIntro";

const mockAcknowledge = jest.fn();
const mockRelease = jest.fn();
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@/hooks/useFeatureFlags", () => ({
  useFeatureFlagState: () => ({ loaded: true, visible: true }),
}));
jest.mock("@/hooks/useHabitatExpansionDiscovery", () => ({
  useHabitatExpansionDiscovery: () => ({
    // A dismissed intro can be reread even while an offline refresh is pending.
    available: false,
    pending: false,
    loading: true,
    error: null,
    acknowledge: mockAcknowledge,
  }),
}));
jest.mock("@/components/ui/PopupQueue", () => ({
  POPUP_HANDOFF_GAP_MS: 700,
  POPUP_TEARDOWN_MS: 500,
  usePopupSlot: (_id: string, want: boolean) => ({
    visible: want,
    release: mockRelease,
  }),
}));
jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual("react-native");
  return {
    SafeAreaProvider: View,
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 }),
  };
});

describe("Barn introduction replay", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });
  afterEach(() => jest.useRealTimers());

  it("reopens repeatedly and navigates without acknowledging or resetting discovery", async () => {
    const onEnterBarn = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <HabitatExpansionDiscovery accountId="a" onEnterBarn={onEnterBarn} />,
      );
    });
    expect(tree.root.findByType(Modal).props.visible).toBe(false);
    expect(tree.toJSON()).toBeNull(); // Hidden root modal must take no screen space.
    act(() => showHabitatIntro("a"));
    expect(tree.root.findByType(Modal).props.visible).toBe(true);
    await act(async () => tree.root.findByType(Modal).props.onRequestClose());
    act(() => jest.advanceTimersByTime(700));
    expect(tree.root.findByType(Modal).props.visible).toBe(false);

    act(() => showHabitatIntro("a"));
    expect(tree.root.findByType(Modal).props.visible).toBe(true);
    await act(async () =>
      tree.root
        .findByProps({ accessibilityLabel: "Enter Barn" })
        .props.onPress(),
    );
    expect(onEnterBarn).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(700));
    expect(onEnterBarn).toHaveBeenCalledTimes(1);
    expect(mockAcknowledge).not.toHaveBeenCalled();
    expect(mockRelease).toHaveBeenCalledTimes(2);
    act(() => tree.unmount());
  });

  it("rejects another account and clears an open replay on account switch", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(<HabitatExpansionDiscovery accountId="a" />);
    });
    act(() => showHabitatIntro("b"));
    expect(tree.root.findByType(Modal).props.visible).toBe(false);
    act(() => showHabitatIntro("a"));
    expect(tree.root.findByType(Modal).props.visible).toBe(true);
    act(() => tree.update(<HabitatExpansionDiscovery accountId="b" />));
    expect(tree.root.findByType(Modal).props.visible).toBe(false);
    act(() => tree.unmount());
  });

  it("keeps replay unavailable when the feature is disabled", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <HabitatExpansionDiscovery accountId="a" enabledOverride={false} />,
      );
    });
    act(() => showHabitatIntro("a"));
    expect(tree.root.findByType(Modal).props.visible).toBe(false);
    act(() => tree.unmount());
  });
});
