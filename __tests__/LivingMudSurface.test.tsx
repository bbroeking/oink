import React from "react";
import TestRenderer, { act } from "react-test-renderer";

jest.mock("@shopify/react-native-skia", () => {
  const ReactModule = require("react");
  const host = (name: string) => (props: { children?: React.ReactNode }) =>
    ReactModule.createElement(name, props, props.children);
  return {
    Canvas: host("SkiaCanvas"),
    Circle: host("SkiaCircle"),
    Group: host("SkiaGroup"),
    Image: host("SkiaImage"),
    Path: host("SkiaPath"),
    Rect: host("SkiaRect"),
    Skia: {
      Path: {
        Make: () => ({
          moveTo: jest.fn(),
          cubicTo: jest.fn(),
          close: jest.fn(),
        }),
      },
    },
    useImage: () => ({ width: () => 1254, height: () => 1254 }),
  };
});

import { AppState, Image, PanResponder, View } from "react-native";
import { LivingMudSurface } from "@/components/mudwar/LivingMudSurface";
import { HAT_IMAGES } from "@/constants/hats";
import { generateBoard } from "@/utils/rooting";

const event = (x: number, y: number, touches = 1) => ({
  nativeEvent: {
    locationX: x,
    locationY: y,
    touches: Array.from({ length: touches }),
    layout: { width: 300, height: 350 },
  },
});

describe("LivingMudSurface", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(0);
    jest.spyOn(PanResponder, "create").mockImplementation(
      (handlers) =>
        ({
          panHandlers: {
            onStartShouldSetResponder: handlers.onStartShouldSetPanResponder,
            onMoveShouldSetResponder: handlers.onMoveShouldSetPanResponder,
            onResponderGrant: handlers.onPanResponderGrant,
            onResponderMove: handlers.onPanResponderMove,
            onResponderRelease: handlers.onPanResponderRelease,
            onResponderTerminate: handlers.onPanResponderTerminate,
          },
        }) as never,
    );
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test("exposes 30 reachable 44pt accessibility targets", () => {
    const board = generateBoard(42);
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <LivingMudSurface
          board={board}
          layers={board.layers}
          collected={[]}
          disabled={false}
          reduceMotion
          onAction={jest.fn()}
          aspectRatio={0.86}
        />,
      );
    });
    const targets = tree.root.findAll(
      (node) =>
        node.type === View &&
        node.props.accessibilityLabel === "Patch spot, buried in mud" &&
        typeof node.props.onAccessibilityAction === "function",
    );
    expect(targets).toHaveLength(30);
    targets.forEach((target) => {
      expect(target.props.style.minWidth).toBe(44);
      expect(target.props.style.minHeight).toBe(44);
    });
    act(() => tree.unmount());
  });

  test("emits one semantic tap and reports interaction lifecycle", () => {
    const board = generateBoard(42);
    const onAction = jest.fn();
    const onInteractionChange = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <LivingMudSurface
          board={board}
          layers={board.layers}
          collected={[]}
          disabled={false}
          reduceMotion={false}
          onAction={onAction}
          onInteractionChange={onInteractionChange}
        />,
      );
    });
    const surface = tree.root.findByProps({ testID: "living-mud-surface" });
    act(() => surface.props.onLayout(event(0, 0)));
    act(() => surface.props.onResponderGrant(event(25, 25)));
    jest.setSystemTime(100);
    act(() => surface.props.onResponderRelease(event(25, 25, 0)));
    expect(onAction).toHaveBeenCalledWith({
      kind: "rub",
      index: 0,
      point: { x: 25, y: 25 },
    });
    expect(onInteractionChange).toHaveBeenCalledWith(true);
    expect(onInteractionChange).toHaveBeenLastCalledWith(false);
    act(() => tree.unmount());
  });

  test("shows one truffle only after its whole cluster is cleared", () => {
    const board = generateBoard(42);
    const cluster = board.truffleL.length ? board.truffleL : board.truffleD;
    const partial = [...board.layers];
    cluster.slice(0, -1).forEach((index) => {
      partial[index] = 0;
    });
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <LivingMudSurface
          board={board}
          layers={partial}
          collected={[]}
          disabled={false}
          reduceMotion
          onAction={jest.fn()}
        />,
      );
    });
    const truffleArt = () =>
      tree.root
        .findAllByType(Image)
        .filter((image) => image.props.source === HAT_IMAGES.golden_truffle);
    expect(truffleArt()).toHaveLength(0);

    const cleared = [...partial];
    cluster.forEach((index) => {
      cleared[index] = 0;
    });
    act(() => {
      tree.update(
        <LivingMudSurface
          board={board}
          layers={cleared}
          collected={[board.truffleL.length ? "truffle_l" : "truffle_d"]}
          disabled={false}
          reduceMotion
          onAction={jest.fn()}
        />,
      );
    });
    expect(truffleArt()).toHaveLength(1);
    act(() => tree.unmount());
  });

  test("background cancels an active gesture and disabled refuses another", () => {
    let appStateListener: ((state: string) => void) | null = null;
    jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_event, listener) => {
        appStateListener = listener as (state: string) => void;
        return { remove: jest.fn() } as never;
      });
    const board = generateBoard(42);
    const onAction = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <LivingMudSurface
          board={board}
          layers={board.layers}
          collected={[]}
          disabled={false}
          reduceMotion
          onAction={onAction}
        />,
      );
    });
    const surface = tree.root.findByProps({ testID: "living-mud-surface" });
    act(() => surface.props.onLayout(event(0, 0)));
    act(() => surface.props.onResponderGrant(event(25, 25)));
    act(() => appStateListener?.("background"));
    jest.setSystemTime(100);
    act(() => surface.props.onResponderRelease(event(25, 25, 0)));
    expect(onAction).not.toHaveBeenCalled();

    act(() => {
      tree.update(
        <LivingMudSurface
          board={board}
          layers={board.layers}
          collected={[]}
          disabled
          reduceMotion
          onAction={onAction}
        />,
      );
    });
    expect(
      tree.root
        .findByProps({ testID: "living-mud-surface" })
        .props.onStartShouldSetResponder(),
    ).toBe(false);
    act(() => tree.unmount());
  });
});
