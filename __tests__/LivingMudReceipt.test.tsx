import React from "react";
import TestRenderer, { act } from "react-test-renderer";

jest.mock("@/components/ui", () => {
  const ReactModule = require("react");
  const { Pressable, Text, View } = require("react-native");
  return {
    T: ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactModule.createElement(Text, props, children),
    Button: ({ children, onPress, disabled, loading, ...props }: any) =>
      ReactModule.createElement(
        Pressable,
        {
          ...props,
          onPress,
          disabled: disabled || loading,
          accessibilityState: { disabled: !!(disabled || loading) },
        },
        children,
      ),
    IconButton: ({ label, onPress, disabled }: any) =>
      ReactModule.createElement(Pressable, {
        accessibilityLabel: label,
        onPress,
        disabled,
      }),
    SpritePig: (props: any) => ReactModule.createElement(View, props),
  };
});

import { AccessibilityInfo, Image, Text } from "react-native";
import { HAT_IMAGES } from "@/constants/hats";
import type { RootingOutcome } from "@/hooks/useRooting";
import {
  LivingMudReceipt,
  LivingMudRecovery,
} from "@/components/mudwar/LivingMudReceipt";
import { LivingMudPouch } from "@/components/mudwar/LivingMudScene";

const outcome = (overrides: Partial<RootingOutcome> = {}): RootingOutcome => ({
  drain: 3,
  credited: 2,
  truffles: 0,
  echo: false,
  blessed: false,
  practice: false,
  ...overrides,
});

const textOf = (tree: TestRenderer.ReactTestRenderer) =>
  tree.root
    .findAllByType(Text)
    .map((node) => node.props.children)
    .flat(Infinity)
    .filter((part) => typeof part === "string")
    .join(" ");

describe("Living Mud receipt", () => {
  beforeEach(() => {
    jest
      .spyOn(AccessibilityInfo, "announceForAccessibility")
      .mockImplementation(jest.fn());
  });

  afterEach(() => jest.restoreAllMocks());

  test("pouch only shows truffle art for a truthful truffle count", () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<LivingMudPouch count={4} truffleCount={0} />);
    });
    expect(
      tree.root
        .findAllByType(Image)
        .filter((image) => image.props.source === HAT_IMAGES.golden_truffle),
    ).toHaveLength(0);

    act(() => tree.update(<LivingMudPouch count={1} truffleCount={2} />));
    expect(
      tree.root
        .findAllByType(Image)
        .filter((image) => image.props.source === HAT_IMAGES.golden_truffle),
    ).toHaveLength(1);
    act(() => tree.unmount());
  });

  test("practice without the existing gift outcome invents no gift", () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <LivingMudReceipt
          outcome={outcome({ practice: true, credited: 3 })}
          onClose={jest.fn()}
        />,
      );
    });
    expect(textOf(tree)).toContain("These were practice finds");
    expect(textOf(tree)).not.toContain("gift is yours");
    expect(
      tree.root
        .findAllByType(Image)
        .filter((image) => image.props.source === HAT_IMAGES.golden_truffle),
    ).toHaveLength(0);
    act(() => tree.unmount());
  });

  test("storage failure explains pre-submission safety and retry is disabled while busy", () => {
    const onRetry = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <LivingMudRecovery
          busy={false}
          reason="storage_failed"
          onRetry={onRetry}
          onClose={jest.fn()}
        />,
      );
    });
    expect(textOf(tree)).toContain("Saving failed before submission");
    const retry = tree.root
      .findAll((node) => node.props.onPress === onRetry)
      .at(0);
    expect(retry).toBeDefined();
    act(() => retry?.props.onPress());
    expect(onRetry).toHaveBeenCalledTimes(1);

    act(() => {
      tree.update(
        <LivingMudRecovery
          busy
          reason="storage_failed"
          onRetry={onRetry}
          onClose={jest.fn()}
        />,
      );
    });
    const busyButtons = tree.root.findAll(
      (node) =>
        node.props.accessibilityState?.disabled &&
        typeof node.props.onPress === "function",
    );
    expect(busyButtons).toHaveLength(2);
    expect(busyButtons.every((button) => button.props.disabled)).toBe(true);
    act(() => tree.unmount());
  });

  test("expired recovery says only that no new dig was banked", () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <LivingMudRecovery busy={false} reason="expired" onClose={jest.fn()} />,
      );
    });
    expect(textOf(tree)).toContain("No new dig was banked");
    expect(textOf(tree)).not.toContain("finds were lost");
    act(() => tree.unmount());
  });
});
