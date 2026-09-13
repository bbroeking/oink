import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Image } from "react-native";
import { router } from "expo-router";
import { HabitatCabinetControl, HabitatWorkshopCabinet } from "@/components/habitat/HabitatWorkshopCabinet";
import { HABITAT_CHROME_ASSETS } from "@/constants/habitat";
import { fetchContraptionInventory } from "@/utils/moteMachine";

let mockVisible = true;
jest.mock("@/constants/featureFlags", () => ({
  get MOTE_MACHINE_VISIBLE() {
    return mockVisible;
  },
}));
jest.mock("@/utils/moteMachine", () => ({
  fetchContraptionInventory: jest.fn(),
}));
// The chooser is the storybook ActionSheet (wave 0 of the 2026-09 audit: Alert
// is for nothing). Stub it to a host element so the test reads its props
// without mounting SlideUpSheet's native Modal.
jest.mock("@/components/ui/ActionSheet", () => ({
  ActionSheet: (props: Record<string, unknown>) =>
    require("react").createElement("ActionSheet", props),
}));
jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
  useFocusEffect: (effect: () => void) =>
    require("react").useEffect(effect, [effect]),
}));
const fetchInventory = jest.mocked(fetchContraptionInventory);

describe("housing workshop isolation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVisible = true;
    fetchInventory.mockResolvedValue({ ok: true, items: [], events: [] });
  });
  it("renders a compact image control without a wrapping Workshop label", () => {
    const tree = TestRenderer.create(<HabitatCabinetControl state="Auto-Tickler is locked" onPress={jest.fn()} />);
    const control = tree.root.findByProps({ testID: "habitat-cabinet-control" });
    expect(control.props.accessibilityLabel).toBe("Workshop cabinet. Auto-Tickler is locked");
    expect(control.props.accessibilityHint).toBe("Opens the Mote Machine and Contraption Inventory");
    expect(control.props.style({ pressed: false })).toEqual(expect.arrayContaining([expect.objectContaining({ minWidth: 44, minHeight: 88 })]));
    expect(tree.root.findByType(Image).props.source).toBe(HABITAT_CHROME_ASSETS.workshopCabinet);
    expect(tree.root.findAllByProps({ children: "Workshop" })).toHaveLength(0);
    act(() => tree.unmount());
  });
  it.each([true, false])(
    "never requests inventory for visitor when machine visible=%s",
    async (visible) => {
      mockVisible = visible;
      let tree!: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(<HabitatWorkshopCabinet owner={false} />);
      });
      expect(tree.toJSON()).toBeNull();
      expect(fetchInventory).not.toHaveBeenCalled();
      act(() => tree.unmount());
    },
  );
  it("disabled machine has no owner hotspot or request", async () => {
    mockVisible = false;
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(<HabitatWorkshopCabinet />);
    });
    expect(tree.toJSON()).toBeNull();
    expect(fetchInventory).not.toHaveBeenCalled();
    act(() => tree.unmount());
  });
  it("keeps both owner routes available after an inventory error", async () => {
    fetchInventory.mockRejectedValue(new Error("offline"));
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(<HabitatWorkshopCabinet />);
    });
    const sheet = () => tree.root.findByType("ActionSheet" as never);
    expect(sheet().props.open).toBe(false);
    act(() => tree.root.findByProps({ testID: "habitat-cabinet-control" }).props.onPress());
    expect(sheet().props.open).toBe(true);
    expect(sheet().props.subtitle).toContain("Your Barn is ready to decorate");
    const items = sheet().props.items as { label: string; onPress: () => void }[];
    expect(items.map((item) => item.label)).toEqual(["Mote Machine", "Workshop shelf"]);
    act(() => items[0].onPress());
    act(() => items[1].onPress());
    expect(router.push).toHaveBeenNthCalledWith(1, "/mote-machine");
    expect(router.push).toHaveBeenNthCalledWith(2, "/contraptions");
    act(() => sheet().props.onClose());
    expect(sheet().props.open).toBe(false);
    act(() => tree.unmount());
  });
});
