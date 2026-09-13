import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { HabitatStarterWelcome } from "@/components/habitat/HabitatStarterWelcome";

// The welcome is an AdaptiveModalScaffold now (it was a raw full-screen Modal
// wrapping its own SafeAreaProvider), so the scaffold's inset hook is what has
// to be stubbed here.
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: ({ children }: any) => children,
  SafeAreaView: ({ children }: any) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

describe("HabitatStarterWelcome", () => {
  it("introduces four durable starter designs and dismisses explicitly", () => {
    const dismiss = jest.fn();
    const tree = TestRenderer.create(
      <HabitatStarterWelcome visible onDismiss={dismiss} />,
    );
    for (const name of [
      "Warm Plank Barn",
      "Rosie's Pencil Sketch",
      "Sunflower Crock",
      "Patchwork Rug",
    ])
      expect(
        tree.root.findAll((n) => n.props.children === name).length,
      ).toBeGreaterThan(0);
    const copy = tree.root
      .findAll((node) => typeof node.props.children === "string")
      .map((node) => node.props.children)
      .join(" ");
    expect(copy).toContain("Your Barn is a blank canvas");
    expect(copy).toContain("The room starts empty");
    const action = tree.root.findAll(
      (n) => n.props.accessibilityLabel === "Start decorating your Barn",
    )[0];
    expect(action.props.accessibilityHint).toContain("Closes this welcome");
    act(() => action.props.onPress());
    expect(dismiss).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });
});
