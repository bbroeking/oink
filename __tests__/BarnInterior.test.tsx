import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { StyleSheet, Text } from "react-native";
import { router } from "expo-router";
import { BarnInterior } from "@/app/barn-interior";
import {
  HABITAT_CATALOG,
  HABITAT_STARTER_POSITIONS,
} from "@/constants/habitat";
import type { HabitatSnapshot } from "@/utils/habitat";

const mockParams: { position?: string; purchasedItemId?: string } = {};
let mockMutateParams = true;
jest.mock("expo-router", () => ({
  Stack: { Screen: () => null },
  router: {
    setParams: jest.fn((next) => {
      if (mockMutateParams) Object.assign(mockParams, next);
    }),
    push: jest.fn(),
    canGoBack: () => true,
    back: jest.fn(),
    replace: jest.fn(),
  },
  useLocalSearchParams: () => mockParams,
}));
jest.mock("expo-router/react-navigation", () => ({ useIsFocused: () => true }));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: any) => children,
  SafeAreaProvider: ({ children }: any) => children,
  useSafeAreaInsets: () => ({ top: 47, right: 0, bottom: 34, left: 0 }),
}));
jest.mock("@/components/habitat/HabitatDoorTransition", () => ({
  HabitatDoorTransition: ({ children }: any) => children,
}));
jest.mock("@/components/habitat/HabitatOwnerPig", () => ({
  HabitatOwnerPig: () => null,
}));
jest.mock("@/components/habitat/HabitatWorkshopCabinet", () => ({
  HabitatWorkshopCabinet: () => null,
}));
// Which spot the mock's tap reports (the scene says where a tapped furnishing
// stands, 2026-10-04); undefined keeps the old one-argument call.
let mockInspectPosition: string | undefined;
jest.mock("@/components/habitat/HabitatScene", () => ({
  HabitatScene: ({ onInspect }: any) => {
    const { Pressable } = require("react-native");
    return (
      <Pressable
        testID="habitat-scene-mock"
        onPress={() =>
          onInspect?.(
            {
              name: "Penny Portrait",
              description: "A pencil portrait of Rosie.",
            },
            mockInspectPosition,
          )
        }
      />
    );
  },
}));
jest.mock("@/components/habitat/HabitatEditor", () => ({
  HabitatEditor: (props: object) =>
    require("react").createElement("HabitatEditor", props),
}));
jest.mock("@/components/habitat/HabitatGiftReveal", () => ({
  HabitatGiftReveal: (props: object) =>
    require("react").createElement("HabitatGiftReveal", props),
}));
jest.mock("@/components/habitat/HabitatPresetSheet", () => ({
  HabitatPresetSheet: (props: object) =>
    require("react").createElement("HabitatPresetSheet", props),
}));
const mockMarkSeen = jest.fn();
jest.mock("@/hooks/useHabitatJournal", () => ({
  useHabitatJournal: () => ({
    acquisitions: [
      {
        id: "gift-1",
        itemId: "hay_bale",
        source: "habitat_prestige",
        newlyOwned: true,
        seen: false,
        presented: true,
      },
    ],
    wishlist: [],
    newItemIds: new Set(["hay_bale"]),
    supported: true,
    markSeen: mockMarkSeen,
  }),
}));
jest.mock("@/utils/interactionAnalytics", () => ({
  trackInteraction: jest.fn(),
}));

const byId = Object.fromEntries(HABITAT_CATALOG.map((i) => [i.id, i]));
const snapshot: HabitatSnapshot = {
  ownerId: "a",
  revision: 1,
  positions: Object.fromEntries(
    Object.entries(HABITAT_STARTER_POSITIONS).map(([p, id]) => [
      p,
      id ? byId[id] : null,
    ]),
  ) as HabitatSnapshot["positions"],
};
const mockPlace = jest.fn();
const mockHabitat: any = {
  data: {
    snapshot,
    owned: [...HABITAT_CATALOG],
    catalog: [...HABITAT_CATALOG],
    currentSnouts: 1000,
  },
  draft: { positions: HABITAT_STARTER_POSITIONS, history: [], baseRevision: 1 },
  preview: snapshot,
  loading: true,
  offline: false,
  saving: false,
  error: null,
  conflict: null,
  dirty: false,
  place: mockPlace,
  remove: jest.fn(),
  undo: jest.fn(),
  cancel: jest.fn(),
  save: jest.fn(),
  refresh: jest.fn(),
  reviewLatest: jest.fn(),
  reapply: jest.fn(),
  starterWelcomePending: false,
  dismissStarterWelcome: jest.fn(),
};
jest.mock("@/hooks/useHabitat", () => ({ useHabitat: () => mockHabitat }));

describe("BarnInterior purchase return", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .spyOn(require("react-native"), "useWindowDimensions")
      .mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: 1 });
    mockHabitat.loading = true;
    mockMutateParams = true;
    mockHabitat.starterWelcomePending = false;
    mockParams.position = "floor_right";
    mockParams.purchasedItemId = "hay_bale";
  });
  it("waits for refresh before selecting the purchased item and clears params once", () => {
    let tree = TestRenderer.create(
      <BarnInterior accountId="a" workshop={null} pig={null} />,
    );
    expect(mockPlace).not.toHaveBeenCalled();
    expect(router.setParams).not.toHaveBeenCalled();
    mockHabitat.loading = false;
    act(() =>
      tree.update(<BarnInterior accountId="a" workshop={null} pig={null} />),
    );
    expect(mockPlace).toHaveBeenCalledTimes(1);
    expect(mockPlace).toHaveBeenCalledWith("floor_right", byId.hay_bale);
    expect(mockMarkSeen).toHaveBeenCalledWith(["gift-1"]);
    expect(router.setParams).toHaveBeenCalledTimes(1);
    expect(router.setParams).toHaveBeenCalledWith({
      position: undefined,
      purchasedItemId: undefined,
    });
    act(() =>
      tree.update(<BarnInterior accountId="a" workshop={null} pig={null} />),
    );
    expect(mockPlace).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });

  it("chooses a compatible open slot for an owned gift handoff", () => {
    mockHabitat.loading = false;
    mockParams.position = undefined;
    mockParams.purchasedItemId = "hay_bale";
    const tree = TestRenderer.create(
      <BarnInterior accountId="a" workshop={null} pig={null} />,
    );
    expect(mockPlace).toHaveBeenCalledWith("floor_left", byId.hay_bale);
    expect(
      tree.root.findByType("HabitatEditor" as never).props.initialPosition,
    ).toBe("floor_left");
    act(() => tree.unmount());
  });

  it("consumes a route handoff once while cleared params propagate", () => {
    mockHabitat.loading = false;
    mockMutateParams = false;
    const tree = TestRenderer.create(
      <BarnInterior accountId="a" workshop={null} pig={null} />,
    );
    act(() =>
      tree.update(<BarnInterior accountId="a" workshop={null} pig={null} />),
    );
    expect(mockPlace).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });

  it("places a revealed gift into the draft without saving it", () => {
    mockHabitat.loading = false;
    mockParams.position = undefined;
    mockParams.purchasedItemId = undefined;
    const tree = TestRenderer.create(
      <BarnInterior accountId="a" workshop={null} pig={null} />,
    );
    const reveal = tree.root.findByType("HabitatGiftReveal" as never);
    act(() => reveal.props.onPreview(byId.hay_bale));
    expect(mockPlace).toHaveBeenCalledWith("floor_left", byId.hay_bale);
    expect(mockHabitat.save).not.toHaveBeenCalled();
    expect(
      tree.root.findByType("HabitatEditor" as never).props.newItemIds,
    ).toEqual(new Set(["hay_bale"]));
    act(() => tree.unmount());
  });

  it("refreshes the authoritative Barn and closes editing after preset activation", async () => {
    mockHabitat.loading = false;
    mockParams.position = undefined;
    mockParams.purchasedItemId = undefined;
    mockHabitat.refresh.mockResolvedValue(undefined);
    const tree = TestRenderer.create(
      <BarnInterior accountId="a" workshop={null} pig={null} />,
    );
    act(() =>
      tree.root
        .find((node) => node.props.accessibilityLabel === "Decorate")
        .props.onPress(),
    );
    expect(tree.root.findAllByType("HabitatEditor" as never)).toHaveLength(1);
    await act(async () =>
      tree.root
        .findByType("HabitatPresetSheet" as never)
        .props.onActivated({ ...snapshot, revision: 2 }),
    );
    expect(mockHabitat.refresh).toHaveBeenCalledTimes(1);
    expect(tree.root.findAllByType("HabitatEditor" as never)).toHaveLength(0);
    act(() => tree.unmount());
  });

  it("matches the owner action names to their visible labels", () => {
    mockHabitat.loading = false;
    mockParams.position = undefined;
    mockParams.purchasedItemId = undefined;
    const onCollection = jest.fn();
    const tree = TestRenderer.create(
      <BarnInterior
        accountId="a"
        workshop={null}
        pig={null}
        onCollection={onCollection}
      />,
    );
    const button = (label: string) =>
      tree.root.find(
        (node) =>
          node.props.accessibilityRole === "button" &&
          node.props.accessibilityLabel === label,
      );
    expect(button("Home").props.accessibilityHint).toContain("Home");
    expect(button("Decorate")).toBeTruthy();
    const visibleLabels = tree.root
      .findAllByType(Text)
      .map((node) => node.props.children);
    expect(visibleLabels).toEqual(
      expect.arrayContaining(["Home", "Furnishings", "Decorate"]),
    );
    act(() => button("Furnishings").props.onPress());
    expect(onCollection).toHaveBeenCalledWith();
    act(() => tree.unmount());
  });

  it("enters explicit spatial editing from the compact owner control", () => {
    mockHabitat.loading = false;
    mockParams.position = undefined;
    mockParams.purchasedItemId = undefined;
    const tree = TestRenderer.create(
      <BarnInterior accountId="a" workshop={null} pig={null} />,
    );
    const decorate = tree.root.find(
      (node) => node.props.accessibilityLabel === "Decorate",
    );
    act(() => decorate.props.onPress());
    expect(
      tree.root.findByType(
        require("@/components/habitat/HabitatEditor").HabitatEditor,
      ).props.initialList,
    ).toBe(false);
    expect(
      tree.root.findAll((node) => node.props.accessibilityLabel === "Home"),
    ).toHaveLength(0);
    act(() => tree.unmount());
  });

  it("keeps compact owner controls reachable at large text", () => {
    (require("react-native").useWindowDimensions as jest.Mock).mockReturnValue({
      width: 390,
      height: 844,
      scale: 3,
      fontScale: 2,
    });
    mockHabitat.loading = false;
    mockParams.position = undefined;
    mockParams.purchasedItemId = undefined;
    const onCollection = jest.fn();
    const tree = TestRenderer.create(
      <BarnInterior
        accountId="a"
        workshop={null}
        pig={null}
        onCollection={onCollection}
      />,
    );
    const named = (label: string) =>
      tree.root.find(
        (node) =>
          node.props.accessibilityRole === "button" &&
          node.props.accessibilityLabel === label,
      );
    expect(named("Decorate")).toBeTruthy();
    expect(named("Home")).toBeTruthy();
    expect(
      StyleSheet.flatten(
        tree.root.findByProps({ testID: "barn-owner-top-controls" }).props
          .style,
      ),
      // The safe-area inset now positions the bar (`top`) and the gap above the
      // controls is a spacing token (`paddingTop`), so the two are no longer
      // summed into an off-scale value.
    ).toMatchObject({
      flexDirection: "row",
      flexWrap: "wrap",
      top: 47,
      paddingTop: 4,
    });
    act(() => named("Furnishings").props.onPress());
    expect(onCollection).toHaveBeenCalledWith();
    act(() => tree.unmount());
  });

  it("rides the half of the room the furnishing is not in, speaks it, and leaves for Decorate", () => {
    mockHabitat.loading = false;
    mockParams.position = undefined;
    mockParams.purchasedItemId = undefined;
    const announce = jest
      .spyOn(require("react-native").AccessibilityInfo, "announceForAccessibility")
      .mockImplementation(() => {});
    const tree = TestRenderer.create(
      <BarnInterior accountId="a" workshop={null} pig={null} />,
    );
    const card = () =>
      StyleSheet.flatten(
        tree.root.findByProps({ testID: "habitat-item-details" }).props.style,
      );
    // A floor furnishing stands at Rosie's level: its card rides the top,
    // under the Home / Furnishings controls.
    mockInspectPosition = "floor_left";
    act(() =>
      tree.root.findByProps({ testID: "habitat-scene-mock" }).props.onPress(),
    );
    expect(card()).toMatchObject({ top: 47, marginTop: 56 });
    expect(card().bottom).toBeUndefined();
    expect(announce).toHaveBeenCalledWith(
      "Penny Portrait. A pencil portrait of Rosie.",
    );
    // A wall furnishing: the card rides the floor, clear of the Decorate dock.
    mockInspectPosition = "wall";
    act(() =>
      tree.root.findByProps({ testID: "habitat-scene-mock" }).props.onPress(),
    );
    expect(card()).toMatchObject({ bottom: 34, marginBottom: 64 });
    // The card belongs to the room at rest; Decorate takes the room.
    act(() =>
      tree.root
        .find((node) => node.props.accessibilityLabel === "Decorate")
        .props.onPress(),
    );
    expect(
      tree.root.findAllByProps({ testID: "habitat-item-details" }),
    ).toHaveLength(0);
    mockInspectPosition = undefined;
    announce.mockRestore();
    act(() => tree.unmount());
  });

  it("says a failed Barn read in words, never as its reason code", () => {
    mockHabitat.loading = false;
    mockParams.position = undefined;
    mockParams.purchasedItemId = undefined;
    mockHabitat.error = "invalid_response";
    const tree = TestRenderer.create(
      <BarnInterior accountId="a" workshop={null} pig={null} />,
    );
    const words = tree.root
      .findAllByType(Text)
      .map((node) => node.props.children)
      .flat()
      .filter((part: unknown) => typeof part === "string")
      .join(" ");
    expect(words).toContain("Couldn't reach your Barn just now.");
    expect(words).not.toContain("invalid response");
    expect(words).not.toContain("Barn error");
    mockHabitat.error = null;
    act(() => tree.unmount());
  });

  it("exposes inspected furnishing details and a clear dismissal action", () => {
    mockHabitat.loading = false;
    mockParams.position = undefined;
    mockParams.purchasedItemId = undefined;
    const tree = TestRenderer.create(
      <BarnInterior accountId="a" workshop={null} pig={null} />,
    );
    act(() =>
      tree.root.findByProps({ testID: "habitat-scene-mock" }).props.onPress(),
    );
    // The card reads its name as a title and its story under it (they used to
    // be one secondary string with no emphasis, 2026-10-04); the dismissal
    // keeps its verbatim label and hint.
    expect(
      tree.root.findAll(
        (node) =>
          node.props.children === "Penny Portrait" &&
          node.props.accessibilityRole === "header",
      ).length,
    ).toBeGreaterThan(0);
    expect(
      tree.root.findAllByProps({ children: "A pencil portrait of Rosie." })
        .length,
    ).toBeGreaterThan(0);
    const details = tree.root.findAll(
      (node) =>
        node.props.accessibilityRole === "button" &&
        node.props.accessibilityLabel === "Close item details",
    )[0];
    expect(details.props.accessibilityHint).toContain("Dismisses");
    act(() => details.props.onPress());
    expect(
      tree.root.findAllByProps({ accessibilityLabel: "Close item details" }),
    ).toHaveLength(0);
    act(() => tree.unmount());
  });
});
