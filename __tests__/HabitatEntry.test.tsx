import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { router } from "expo-router";
import { HabitatEntry } from "@/components/habitat/HabitatEntry";
import { Button } from "@/components/ui/Button";

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@/hooks/useFeatureFlags", () => ({ useFeatureFlag: () => true }));

describe("clear Barn entry points", () => {
  it.each([
    [false, "Enter Barn", "/barn-interior"],
    [true, "Browse Barn furnishings", "/barn-collection"],
  ] as const)("takes the %s entry to the correct destination", async (collection, label, destination) => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => { tree = TestRenderer.create(<HabitatEntry collection={collection} />); });
    const action = tree.root.findByType(Button);
    expect(action.props.accessibilityLabel).toBe(label);
    act(() => action.props.onPress());
    expect(router.push).toHaveBeenLastCalledWith(destination);
    act(() => tree.unmount());
  });
});
