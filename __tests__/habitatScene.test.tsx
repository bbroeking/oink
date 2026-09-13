import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { StyleSheet, Text } from "react-native";
import {
  HabitatScene,
  habitatRect,
  resolveHabitatCanvas,
} from "@/components/habitat/HabitatScene";
import {
  HABITAT_CATALOG,
  HABITAT_CATALOG_BY_ID,
  HABITAT_DECOR_POSITIONS,
  HABITAT_POSITIONS,
  HABITAT_POSITION_META,
  HABITAT_STARTER_ITEM_IDS,
  HABITAT_STARTER_POSITIONS,
  habitatItemAsset,
  positionAcceptsCategory,
} from "@/constants/habitat";
import type { HabitatPosition, HabitatSnapshot } from "@/utils/habitat";
import { WHIMSY } from "@/constants/theme";

const snapshot = (
  positions: Partial<Record<HabitatPosition, string | null>> = {},
): HabitatSnapshot => ({
  ownerId: "owner",
  revision: 1,
  positions: Object.fromEntries(
    HABITAT_POSITIONS.map((position) => {
      const id =
        positions[position] === undefined
          ? HABITAT_STARTER_POSITIONS[position]
          : positions[position];
      return [position, id ? HABITAT_CATALOG_BY_ID[id] : null];
    }),
  ) as HabitatSnapshot["positions"],
});

describe("Habitat scene contract", () => {
  test("ships the exact complete launch catalog and empty starter room", () => {
    expect(HABITAT_CATALOG).toHaveLength(122);
    expect(new Set(HABITAT_CATALOG.map((item) => item.id)).size).toBe(122);
    expect(
      HABITAT_CATALOG.filter((item) => item.category === "interior_background"),
    ).toHaveLength(3);
    expect(
      HABITAT_CATALOG.filter((item) => item.snoutCost > 0).reduce(
        (sum, item) => sum + item.snoutCost,
        0,
      ),
    ).toBe(8625);
    expect(HABITAT_STARTER_ITEM_IDS).toEqual([
      "warm_plank_barn",
      "rosies_pencil_sketch",
      "sunflower_crock",
      "patchwork_rug",
    ]);
    expect(HABITAT_STARTER_POSITIONS).toEqual({
      interior_background: "warm_plank_barn",
      wall: null,
      ceiling: null,
      floor_centerpiece: null,
      floor_left: null,
      floor_right: null,
      surface: null,
    });
  });

  test("keepsakes inscribe the host's current rank, including ranks beyond the final art milestone", () => {
    const saved = {
      ...snapshot({ surface: "wallow_keepsake_celestial" }),
      wallowRank: 17,
    };
    const renderer = TestRenderer.create(
      <HabitatScene snapshot={saved} onInspect={jest.fn()} />,
    );
    expect(
      renderer.root.findByProps({ testID: "habitat-keepsake-rank" }).props
        .children,
    ).toBe(17);
    expect(
      renderer.root.findByProps({ testID: "habitat-position-surface" }).props
        .accessibilityLabel,
    ).toContain("Wallow Rank 17");
    act(() =>
      renderer.update(
        <HabitatScene snapshot={{ ...saved, wallowRank: undefined }} />,
      ),
    );
    expect(
      renderer.root.findAllByProps({ testID: "habitat-keepsake-rank" }),
    ).toHaveLength(0);
    renderer.unmount();
  });

  test("every position accepts exactly its declared category", () => {
    for (const position of HABITAT_POSITIONS) {
      for (const category of [
        ...new Set(HABITAT_CATALOG.map((item) => item.category)),
      ]) {
        expect(positionAcceptsCategory(position, category)).toBe(
          HABITAT_POSITION_META[position].category === category,
        );
      }
    }
    expect(HABITAT_POSITION_META.floor_left.category).toBe(
      HABITAT_POSITION_META.floor_right.category,
    );
  });

  test("anchors preserve at least a 44 point target on small canvases", () => {
    const canvas = resolveHabitatCanvas({ width: 320, height: 568 });
    for (const position of HABITAT_DECOR_POSITIONS) {
      const rect = habitatRect(position, canvas);
      expect(rect.width).toBeGreaterThanOrEqual(44);
      expect(rect.height).toBeGreaterThanOrEqual(44);
    }
  });

  test("scales caller-supplied 300 point pig stages into separate scene anchors", () => {
    const renderer = TestRenderer.create(
      <HabitatScene
        snapshot={snapshot()}
        hostPig={<Text>host</Text>}
        visitorPig={<Text>visitor</Text>}
      />,
    );
    const host = renderer.root.findByProps({ testID: "habitat-host-pig" });
    const visitor = renderer.root.findByProps({
      testID: "habitat-visitor-pig",
    });
    expect(host.props.style[1].transform[0].scale).toBeCloseTo(
      (390 * 0.36) / 300,
    );
    expect(visitor.props.style[1].transform[0].scale).toBeCloseTo(
      (390 * 0.3) / 300,
    );
    expect(host.props.style[1].left).not.toBe(visitor.props.style[1].left);
  });

  test("visitor scene shows explicitly placed items and both supplied pigs without edit markers", () => {
    const renderer = TestRenderer.create(
      <HabitatScene
        snapshot={snapshot({
          wall: "rosies_pencil_sketch",
          floor_centerpiece: "patchwork_rug",
          floor_left: "sunflower_crock",
        })}
        hostPig={<Text testID="host">host</Text>}
        visitorPig={<Text testID="visitor">visitor</Text>}
      />,
    );
    expect(renderer.root.findByProps({ testID: "host" })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: "visitor" })).toBeTruthy();
    expect(
      renderer.root.findAllByProps({ accessibilityLabel: "Rafters, empty" }),
    ).toHaveLength(0);
    expect(
      renderer.root.findByProps({ testID: "habitat-item-patchwork_rug" }),
    ).toBeTruthy();
    expect(
      renderer.root.findByProps({ testID: "habitat-room-summary" }).props
        .accessibilityLabel,
    ).toContain("3 of 6 decorating spots furnished");
  });

  test("edit scene exposes all seven named controls and only selects through its callback", () => {
    const onSelectPosition = jest.fn();
    const renderer = TestRenderer.create(
      <HabitatScene
        snapshot={snapshot()}
        editing
        onSelectPosition={onSelectPosition}
      />,
    );
    expect(
      HABITAT_POSITIONS.map((position) =>
        renderer.root.findByProps({ testID: `habitat-position-${position}` }),
      ),
    ).toHaveLength(7);
    const emptyRafters = renderer.root.findByProps({
      accessibilityLabel: "Rafters, empty",
    });
    expect(emptyRafters.props.style({ pressed: false })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ width: 44, height: 44, zIndex: 80 }),
      ]),
    );
    emptyRafters.props.onPress();
    expect(onSelectPosition).toHaveBeenCalledWith("ceiling");
  });

  test("keeps the room selector below the safe-area editor toolbar", () => {
    const renderer = TestRenderer.create(
      <HabitatScene
        snapshot={snapshot()}
        editing
        controlInsetTop={62}
        onSelectPosition={jest.fn()}
      />,
    );
    const marker = renderer.root.findByProps({
      testID: "habitat-position-interior_background",
    });
    expect(StyleSheet.flatten(marker.props.style({ pressed: false })).top).toBe(
      118,
    );
  });

  test("the room centres on cream by default and pins to the floor on request", () => {
    // Centred, the fixed 390x844 room splits its leftover top and bottom over a
    // cream frame — right when the Habitat IS the screen. On the visit's short
    // stage that bottom half showed as a pale band above the action bar, so the
    // visit anchors the room to the floor and paints nothing: the leftover goes
    // to the top, under the header's fade, and the host's background owns it.
    // (2026-09-12)
    const centred = TestRenderer.create(<HabitatScene snapshot={snapshot()} />);
    const centredFrame = StyleSheet.flatten(
      centred.root.findByProps({ testID: "habitat-scene" }).props.style,
    );
    expect(centredFrame.justifyContent).toBe("center");
    expect(centredFrame.backgroundColor).toBe(WHIMSY.cream2);

    const pinned = TestRenderer.create(
      <HabitatScene snapshot={snapshot()} anchor="bottom" />,
    );
    const pinnedFrame = StyleSheet.flatten(
      pinned.root.findByProps({ testID: "habitat-scene" }).props.style,
    );
    expect(pinnedFrame.justifyContent).toBe("flex-end");
    expect(pinnedFrame.backgroundColor).toBe("transparent");
    // The room itself is untouched — only where it sits in the frame changed.
    expect(pinnedFrame.overflow).toBe("hidden");
    expect(pinnedFrame.alignItems).toBe("center");
  });

  test("unknown asset keys resolve to the visible fallback", () => {
    expect(habitatItemAsset("missing-from-bundle")).toBeDefined();
  });

  test("unknown room art falls back to Warm Plank Barn instead of furniture missing-art", () => {
    const malformed = snapshot({ interior_background: null });
    malformed.positions.interior_background = {
      ...HABITAT_CATALOG_BY_ID.warm_plank_barn,
      assetKey: "unknown-theme",
    };
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    const renderer = TestRenderer.create(<HabitatScene snapshot={malformed} />);
    expect(
      renderer.root.findByProps({ testID: "habitat-room-theme" }).props.source,
    ).toBe(habitatItemAsset("warm_plank_barn"));
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("using Warm Plank Barn"),
    );
    error.mockRestore();
  });
});
