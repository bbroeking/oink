// The Exterior doorway's sequencing contract: tapping the barn must not push
// the interior route until the threshold panels are fully shut, must push
// exactly once, and must swallow every further tap while the doors are moving.
//
// Barn.tsx itself is not mountable in a unit test (supabase session, audio,
// rewarded ads, the pig bridge, a dozen focus fetches), so the sequencing lives
// in `useBarnThreshold` and this harness wires it exactly the way Barn does: the
// real hook, a mocked HabitatDoorTransition that renders its children and hands
// the test the two settle callbacks, and a stand-in for the barn sprite.
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Pressable, Text } from "react-native";
import { router } from "expo-router";
import { useBarnThreshold } from "@/hooks/useBarnThreshold";
import { MOTION_DURATION } from "@/hooks/useMotionPolicy";

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));

// The doors, reduced to their contract: children always render, and the test
// fires the settle callbacks by hand so no real timing is involved.
type DoorProps = {
  children: React.ReactNode;
  direction?: "enter" | "exit";
  onClosed?: () => void;
  onOpened?: () => void;
};
const doors: { props: DoorProps | null } = { props: null };
function MockDoors(props: DoorProps) {
  doors.props = props;
  return <>{props.children}</>;
}

function Harness() {
  const threshold = useBarnThreshold({
    push: React.useCallback(
      () =>
        router.push({
          pathname: "/barn-interior",
          params: { entry: "structure" },
        }),
      [],
    ),
  });
  return (
    <MockDoors
      direction={threshold.direction}
      onClosed={threshold.onClosed}
      onOpened={threshold.onOpened}
    >
      <Pressable testID="barn-structure" onPress={threshold.enter}>
        <Text testID="structure-state">{threshold.structure}</Text>
      </Pressable>
      {/* Stands in for Barn's useFocusEffect — the Exterior coming back. */}
      <Pressable testID="barn-refocus" onPress={threshold.onFocusRegained} />
    </MockDoors>
  );
}

const push = router.push as unknown as jest.Mock;
const press = (tree: TestRenderer.ReactTestRenderer, testID: string) =>
  act(() => {
    tree.root.findByProps({ testID }).props.onPress();
  });
const tap = (tree: TestRenderer.ReactTestRenderer) => press(tree, "barn-structure");
const structureState = (tree: TestRenderer.ReactTestRenderer) =>
  tree.root.findByProps({ testID: "structure-state" }).props.children;
const beat = () =>
  act(() => {
    jest.advanceTimersByTime(MOTION_DURATION.feedback);
  });

describe("tapping the barn structure to enter", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    doors.props = null;
    push.mockClear();
  });
  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("holds the route until the threshold doors have finished closing", () => {
    const tree = TestRenderer.create(<Harness />);
    expect(doors.props?.direction).toBe("enter");

    tap(tree);
    // The sprite answers the touch first; nothing has navigated yet.
    expect(structureState(tree)).toBe("opening");
    expect(push).not.toHaveBeenCalled();

    beat();
    // Panels are now closing over the scene — still no push.
    expect(doors.props?.direction).toBe("exit");
    expect(push).not.toHaveBeenCalled();

    act(() => doors.props?.onClosed?.());
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith({
      pathname: "/barn-interior",
      params: { entry: "structure" },
    });
    // The cut happens behind shut doors, with the barn held open.
    expect(structureState(tree)).toBe("open");
    act(() => tree.unmount());
  });

  it("swallows every further tap while the doors are moving, and pushes once", () => {
    const tree = TestRenderer.create(<Harness />);
    tap(tree);
    tap(tree);
    tap(tree);
    beat();
    tap(tree);
    act(() => doors.props?.onClosed?.());
    act(() => doors.props?.onClosed?.());
    tap(tree);

    expect(push).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });

  it("reopens on regained focus and settles both doors back at rest", () => {
    const tree = TestRenderer.create(<Harness />);
    // A threshold mounted open reports `onOpened` on its very first frame; that
    // is the rest pose, not a return, so it must disturb nothing.
    act(() => doors.props?.onOpened?.());
    expect(structureState(tree)).toBe("closed");
    expect(doors.props?.direction).toBe("enter");

    tap(tree);
    beat();
    act(() => doors.props?.onClosed?.());

    // Coming back out of the room: focus swings the panels open, the barn shuts.
    press(tree, "barn-refocus");
    expect(doors.props?.direction).toBe("enter");
    expect(structureState(tree)).toBe("closing");

    act(() => doors.props?.onOpened?.());
    expect(structureState(tree)).toBe("closed");
    expect(push).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });

  it("drops a pending handoff when the Exterior unmounts mid-tap", () => {
    const tree = TestRenderer.create(<Harness />);
    tap(tree);
    act(() => tree.unmount());
    expect(() => jest.advanceTimersByTime(MOTION_DURATION.feedback)).not.toThrow();
    expect(push).not.toHaveBeenCalled();
  });
});
