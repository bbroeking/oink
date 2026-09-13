import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Modal, Text } from "react-native";
import { HabitatExpansionDiscovery } from "@/components/habitat/HabitatExpansionDiscovery";
import { POPUP_HANDOFF_GAP_MS } from "@/components/ui/PopupQueue";

const mockRelease = jest.fn();
const mockAcknowledge = jest.fn();
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@/hooks/useFeatureFlags", () => ({
  useFeatureFlagState: () => ({ loaded: true, visible: true }),
}));
jest.mock("@/hooks/useHabitatExpansionDiscovery", () => ({
  useHabitatExpansionDiscovery: () => ({
    available: true,
    pending: true,
    version: "barn100:v1",
    loading: false,
    error: null,
    acknowledge: mockAcknowledge,
  }),
}));
jest.mock("@/components/ui/PopupQueue", () => ({
  POPUP_HANDOFF_GAP_MS: 700,
  POPUP_TEARDOWN_MS: 500,
  usePopupSlot: () => ({ visible: true, release: mockRelease }),
}));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: ({ children }: any) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

describe("HabitatExpansionDiscovery", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockAcknowledge.mockResolvedValue(true);
  });
  afterEach(() => jest.useRealTimers());

  it("uses the adaptive scaffold and keeps supporting details compact", () => {
    const tree = TestRenderer.create(
      <HabitatExpansionDiscovery accountId="a" enabledOverride />,
    );

    expect(
      tree.root.findByProps({ testID: "habitat-expansion-discovery" }),
    ).toBeTruthy();
    const copy = tree.root
      .findAllByType(Text)
      .map((node) => node.props.children)
      .flat(Infinity)
      .filter((part) => typeof part === "string")
      .join(" ");
    expect(copy).toContain("Your Barn is ready");
    expect(copy).toContain("Rosie’s sketch");
    expect(copy).toContain("Your room starts empty");
    expect(copy).toContain("Friends");
    expect(copy).toContain("Decorate");
    act(() => tree.unmount());
  });

  it("acknowledges before dismissing and waits for popup teardown before navigation", async () => {
    const onOpenShop = jest.fn();
    const tree = TestRenderer.create(
      <HabitatExpansionDiscovery
        accountId="a"
        enabledOverride
        onOpenShop={onOpenShop}
      />,
    );
    const shop = tree.root.findByProps({
      accessibilityLabel: "Shop Barn furnishings",
    });
    await act(async () => shop.props.onPress());
    expect(mockAcknowledge).toHaveBeenCalledTimes(1);
    expect(mockRelease).toHaveBeenCalledTimes(1);
    expect(onOpenShop).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(POPUP_HANDOFF_GAP_MS));
    expect(onOpenShop).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });

  it("leads with the free starter room and enters it after acknowledging", async () => {
    const onEnterBarn = jest.fn();
    const tree = TestRenderer.create(
      <HabitatExpansionDiscovery
        accountId="a"
        enabledOverride
        onEnterBarn={onEnterBarn}
      />,
    );
    const copy = tree.root
      .findAllByType(Text)
      .map((node) => node.props.children)
      .flat(Infinity)
      .join(" ");
    expect(copy).toContain("yours for free");
    expect(copy).toContain("their pig and yours together");
    const buttons = tree.root.findAll(
      (node) =>
        typeof node.type === "string" &&
        node.props.accessibilityRole === "button",
    );
    expect(buttons[0].props.accessibilityLabel).toBe("Enter Barn");
    await act(async () =>
      tree.root
        .findByProps({ accessibilityLabel: "Enter Barn" })
        .props.onPress(),
    );
    expect(mockAcknowledge).toHaveBeenCalledTimes(1);
    expect(onEnterBarn).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(POPUP_HANDOFF_GAP_MS));
    expect(onEnterBarn).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });
  it("lets the optional announcement dismiss through the durable action", async () => {
    const tree = TestRenderer.create(
      <HabitatExpansionDiscovery accountId="a" enabledOverride />,
    );
    await act(async () =>
      tree.root
        .findByProps({
          accessibilityLabel: "Dismiss Barn furnishings announcement",
        })
        .props.onPress(),
    );
    expect(mockRelease).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });

  it("uses the same durable dismissal for Android back and states the catalog split", async () => {
    const tree = TestRenderer.create(
      <HabitatExpansionDiscovery accountId="a" enabledOverride />,
    );
    const copy = tree.root
      .findAllByType(Text)
      .map((node) => node.props.children)
      .flat(Infinity)
      .filter((part) => typeof part === "string")
      .join(" ");
    expect(copy).toContain("80 designs for Snouts");
    expect(copy).toContain("20 bonus designs");
    expect(copy).toContain("No Motes needed");

    await act(async () => tree.root.findByType(Modal).props.onRequestClose());
    expect(mockAcknowledge).toHaveBeenCalledTimes(1);
    expect(mockRelease).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });

  it("accepts only one rapid action while acknowledgement is pending", async () => {
    let resolve!: (accepted: boolean) => void;
    mockAcknowledge.mockReturnValue(
      new Promise<boolean>((done) => {
        resolve = done;
      }),
    );
    const tree = TestRenderer.create(
      <HabitatExpansionDiscovery accountId="a" enabledOverride />,
    );
    const shop = tree.root.findByProps({
      accessibilityLabel: "Shop Barn furnishings",
    });
    act(() => {
      shop.props.onPress();
      shop.props.onPress();
    });
    expect(mockAcknowledge).toHaveBeenCalledTimes(1);
    await act(async () => resolve(true));
    expect(mockRelease).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });

  it("cancels delayed navigation when the account changes", async () => {
    const onOpenShop = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <HabitatExpansionDiscovery
          accountId="a"
          enabledOverride
          onOpenShop={onOpenShop}
        />,
      );
    });
    await act(async () => {
      await tree.root
        .findByProps({ accessibilityLabel: "Shop Barn furnishings" })
        .props.onPress();
    });
    act(() =>
      tree.update(
        <HabitatExpansionDiscovery
          accountId="b"
          enabledOverride
          onOpenShop={onOpenShop}
        />,
      ),
    );
    act(() => jest.advanceTimersByTime(POPUP_HANDOFF_GAP_MS));
    expect(onOpenShop).not.toHaveBeenCalled();
    act(() => tree.unmount());
  });
});
