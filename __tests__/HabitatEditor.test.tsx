import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import * as ReactNative from "react-native";
import { HabitatEditor } from "@/components/habitat/HabitatEditor";
import { POPUP_HANDOFF_GAP_MS } from "@/components/ui/PopupQueue";
import {
  HABITAT_CATALOG,
  HABITAT_DECOR_POSITIONS,
  HABITAT_STARTER_POSITIONS,
} from "@/constants/habitat";
import type { HabitatSnapshot } from "@/utils/habitat";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 20, left: 0 }),
}));
jest.mock("@/hooks/useMotionPolicy", () => ({
  useMotionPolicy: () => ({ reduceMotion: true }),
}));
jest.mock("@/components/habitat/HabitatScene", () => ({
  HabitatScene: ({
    onSelectPosition,
  }: {
    onSelectPosition?: (p: string) => void;
  }) => {
    const React = require("react"),
      { Pressable, Text, View } = require("react-native");
    return React.createElement(
      View,
      null,
      [
        "interior_background",
        "wall",
        "ceiling",
        "floor_left",
        "floor_right",
        "floor_centerpiece",
        "surface",
      ].map((p) =>
        React.createElement(
          Pressable,
          {
            key: p,
            accessibilityRole: "button",
            accessibilityLabel: `Room position ${p}`,
            accessibilityState: { disabled: !onSelectPosition },
            disabled: !onSelectPosition,
            onPress: () => onSelectPosition?.(p),
          },
          React.createElement(Text, null, p),
        ),
      ),
    );
  },
}));

const byId = Object.fromEntries(HABITAT_CATALOG.map((i) => [i.id, i]));
const furnishedPositions = {
  ...HABITAT_STARTER_POSITIONS,
  wall: "rosies_pencil_sketch",
  floor_centerpiece: "patchwork_rug",
  floor_left: "sunflower_crock",
};
const snapshot: HabitatSnapshot = {
  ownerId: "a",
  revision: 1,
  positions: Object.fromEntries(
    Object.entries(furnishedPositions).map(([p, id]) => [
      p,
      id ? byId[id] : null,
    ]),
  ) as HabitatSnapshot["positions"],
};
const baseProps = {
  snapshot,
  owned: [...HABITAT_CATALOG],
  dirty: true,
  canUndo: true,
  saving: false,
  offline: false,
  onPlace: jest.fn(),
  onRemove: jest.fn(),
  onUndo: jest.fn(),
  onCancel: jest.fn(),
  onSave: jest.fn(),
  onFindMore: jest.fn(),
  onOpenCollection: jest.fn(),
};
const button = (tree: TestRenderer.ReactTestRenderer, label: string) =>
  tree.root.findAll(
    (n) =>
      n.props.accessibilityRole === "button" &&
      n.props.accessibilityLabel === label,
  )[0];

describe("HabitatEditor parity and save safety", () => {
  beforeEach(() => jest.clearAllMocks());
  it("keeps accessible list order independent of scene layer order", () => {
    const tree = TestRenderer.create(
      <HabitatEditor {...baseProps} initialList />,
    );
    const labels = [
      ...new Set(
        tree.root
          .findAll(
            (n) =>
              typeof n.props.accessibilityLabel === "string" &&
              /^(Choose|Change) /.test(n.props.accessibilityLabel),
          )
          .map((n) => n.props.accessibilityLabel),
      ),
    ];
    expect(labels).toEqual([
      "Change Room",
      "Change Back wall",
      "Choose Rafters",
      "Change Left floor",
      "Choose Right floor",
      "Change Center floor",
      "Choose Shelf",
    ]);
    act(() => tree.unmount());
  });
  it.each([
    { initialList: false, trigger: "Room position floor_right" },
    { initialList: true, trigger: "Choose Right floor" },
  ])(
    "places the same item from room and list mode",
    ({ initialList, trigger }) => {
      const onPlace = jest.fn();
      const tree = TestRenderer.create(
        <HabitatEditor
          {...baseProps}
          initialList={initialList}
          onPlace={onPlace}
        />,
      );
      act(() => button(tree, trigger).props.onPress());
      const choice = tree.root.findAll((n) =>
        String(n.props.accessibilityLabel).startsWith("Hay Bale,"),
      )[0];
      expect(choice.props.accessibilityLabel).toContain("place");
      act(() => choice.props.onPress());
      expect(onPlace).toHaveBeenCalledWith("floor_right", byId.hay_bale);
      act(() => tree.unmount());
    },
  );
  it("labels moving a design and supports remove, undo, and cancel from list mode", () => {
    const onRemove = jest.fn(),
      onUndo = jest.fn(),
      onCancel = jest.fn();
    const tree = TestRenderer.create(
      <HabitatEditor
        {...baseProps}
        initialList
        onRemove={onRemove}
        onUndo={onUndo}
        onCancel={onCancel}
      />,
    );
    act(() => button(tree, "Choose Right floor").props.onPress());
    expect(
      tree.root.findAll((n) =>
        String(n.props.accessibilityLabel).startsWith("Sunflower Crock,"),
      )[0].props.accessibilityLabel,
    ).toContain("move here");
    act(() => button(tree, "Close furniture choices").props.onPress());
    act(() =>
      button(tree, "Remove Sunflower Crock from Left floor").props.onPress(),
    );
    act(() =>
      tree.root.findAll((n) => n.props.onPress === onUndo)[0].props.onPress(),
    );
    act(() =>
      tree.root.findAll((n) => n.props.onPress === onCancel)[0].props.onPress(),
    );
    expect(onRemove).toHaveBeenCalledWith("floor_left");
    expect(onUndo).toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
    act(() => tree.unmount());
  });
  it("disables every draft mutation while save is in flight but leaves mode toggle available", () => {
    const tree = TestRenderer.create(
      <HabitatEditor {...baseProps} initialList saving />,
    );
    for (const label of [
      "Change Room",
      "Change Back wall",
      "Choose Rafters",
      "Change Left floor",
      "Choose Right floor",
      "Change Center floor",
      "Choose Shelf",
      "Remove Sunflower Crock from Left floor",
    ]) {
      expect(button(tree, label).props.accessibilityState.disabled).toBe(true);
    }
    expect(
      button(tree, "Undo last decorating change").props.accessibilityState
        .disabled,
    ).toBe(true);
    expect(
      button(tree, "Cancel decorating").props.accessibilityState.disabled,
    ).toBe(true);
    expect(
      button(tree, "Arrange in room").props.accessibilityState.disabled,
    ).toBeFalsy();
    expect(
      tree.root.findAll(
        (n) =>
          n.props.accessibilityRole === "button" &&
          n.props.onPress === baseProps.onSave,
      )[0].props.disabled,
    ).toBe(true);
    act(() => tree.unmount());
  });
  it("stacks labels above wrapping actions at maximum accessibility text", () => {
    const dimensions = jest
      .spyOn(ReactNative, "useWindowDimensions")
      .mockReturnValue({ width: 320, height: 700, scale: 3, fontScale: 3 });
    const tree = TestRenderer.create(
      <HabitatEditor {...baseProps} initialList />,
    );
    for (const label of [
      "Room",
      "Back wall",
      "Rafters",
      "Left floor",
      "Right floor",
      "Center floor",
      "Shelf",
    ])
      expect(
        tree.root.findAll(
          (n) => n.type === ReactNative.Text && n.props.children === label,
        ),
      ).not.toHaveLength(0);
    const rows = tree.root.findAll(
      (n) => n.props.accessibilityRole === "summary",
    );
    expect(
      ReactNative.StyleSheet.flatten(rows[0].props.style).flexDirection,
    ).toBe("column");
    for (const label of [
      "Change Room",
      "Change Back wall",
      "Remove Sunflower Crock from Left floor",
    ]) {
      // Every control is a `Button` now, so its frame comes from the
      // primitive's pressable-style function rather than a static object.
      const target = button(tree, label);
      expect(
        ReactNative.StyleSheet.flatten(target.props.style({ pressed: false }))
          .minHeight,
      ).toBeGreaterThanOrEqual(44);
    }
    act(() => tree.unmount());
    dimensions.mockRestore();
  });
  it("describes editor actions and draft consequences to screen readers", () => {
    const tree = TestRenderer.create(
      <HabitatEditor {...baseProps} initialList />,
    );
    for (const label of [
      "Arrange in room",
      "Undo last decorating change",
      "Cancel decorating",
      "Save Barn",
      "Change Back wall",
      "Remove Sunflower Crock from Left floor",
    ]) {
      const control = button(tree, label);
      expect(control.props.accessibilityRole).toBe("button");
      expect(control.props.accessibilityHint).toEqual(expect.any(String));
      expect(control.props.accessibilityState).toBeDefined();
    }
    act(() => button(tree, "Choose Right floor").props.onPress());
    for (const label of [
      "Close furniture choices",
      "Find more for Right floor",
    ])
      expect(button(tree, label).props.accessibilityHint).toEqual(
        expect.any(String),
      );
    const hay = tree.root.findAll((n) =>
      String(n.props.accessibilityLabel).startsWith("Hay Bale,"),
    )[0];
    expect(hay.props.accessibilityHint).toContain("draft");
    act(() => tree.unmount());
  });

  it("keeps spatial editing full-frame and exposes list and collection through its action menu", () => {
    const onOpenCollection = jest.fn();
    const tree = TestRenderer.create(
      <HabitatEditor
        {...baseProps}
        initialList={false}
        onOpenCollection={onOpenCollection}
      />,
    );
    expect(
      tree.root.findByProps({
        accessibilityLabel:
          "Editing. Place items by selecting a decorating spot.",
      }),
    ).toBeTruthy();
    expect(button(tree, "Save Barn").props.accessibilityState.disabled).toBe(
      false,
    );
    act(() => button(tree, "More decorating actions").props.onPress());
    expect(button(tree, "Arrange as list")).toBeTruthy();
    jest.useFakeTimers();
    act(() => button(tree, "Barn collection").props.onPress());
    expect(onOpenCollection).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(POPUP_HANDOFF_GAP_MS));
    expect(onOpenCollection).toHaveBeenCalledTimes(1);
    act(() => button(tree, "More decorating actions").props.onPress());
    act(() => button(tree, "Arrange as list").props.onPress());
    expect(button(tree, "Arrange in room")).toBeTruthy();
    act(() => tree.unmount());
    jest.useRealTimers();
  });

  it("disables spatial draft exits and mutations while saving", () => {
    const tree = TestRenderer.create(
      <HabitatEditor {...baseProps} initialList={false} saving />,
    );
    for (const label of [
      "Cancel decorating",
      "Undo last decorating change",
      "Save Barn",
    ])
      expect(button(tree, label).props.accessibilityState.disabled).toBe(true);
    for (const position of HABITAT_DECOR_POSITIONS)
      expect(button(tree, `Room position ${position}`).props.disabled).toBe(
        true,
      );
    act(() => tree.unmount());
  });

  it("keeps the spatial editing status compact at maximum text size", () => {
    const dimensions = jest
      .spyOn(ReactNative, "useWindowDimensions")
      .mockReturnValue({ width: 320, height: 700, scale: 3, fontScale: 3 });
    const tree = TestRenderer.create(
      <HabitatEditor {...baseProps} initialList={false} />,
    );
    const status = tree.root.findByProps({
      accessibilityLabel:
        "Editing. Place items by selecting a decorating spot.",
    });
    expect(status.props.children).toBe("Editing");
    expect(status.props.numberOfLines).toBe(1);
    expect(status.props.maxFontSizeMultiplier).toBe(1.3);
    act(() => tree.unmount());
    dimensions.mockRestore();
  });

  it("opens an initial position and labels newly acquired choices", () => {
    const tree = TestRenderer.create(
      <HabitatEditor
        {...baseProps}
        initialPosition="floor_right"
        newItemIds={new Set(["hay_bale"])}
      />,
    );
    const hay = tree.root.findAll((node) =>
      String(node.props.accessibilityLabel).startsWith("Hay Bale,"),
    )[0];
    expect(hay.props.accessibilityLabel).toContain("New");
    expect(tree.root.findByProps({ children: "New" })).toBeTruthy();
    act(() => tree.unmount());
  });

  it("closes decorating actions before opening saved rooms", () => {
    jest.useFakeTimers();
    const onPress = jest.fn();
    const tree = TestRenderer.create(
      <HabitatEditor
        {...baseProps}
        presets={
          <ReactNative.Pressable
            accessibilityRole="button"
            accessibilityLabel="Saved rooms"
            onPress={onPress}
          />
        }
      />,
    );
    act(() => button(tree, "More decorating actions").props.onPress());
    act(() => button(tree, "Saved rooms").props.onPress());
    expect(onPress).not.toHaveBeenCalled();
    // The decorating actions ride a `Sheet`, which unmounts when closed.
    expect(
      tree.root.findAll(
        (n) => n.props.accessibilityLabel === "Arrange as list",
      ),
    ).toHaveLength(0);
    act(() => jest.advanceTimersByTime(POPUP_HANDOFF_GAP_MS));
    expect(onPress).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
    jest.useRealTimers();
  });
});
