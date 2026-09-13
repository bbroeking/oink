import React from "react";
import TestRenderer from "react-test-renderer";
import { Animated, Text } from "react-native";
import { MOTION_SPRING } from "@/constants/theme";
import { MotionPolicyProvider } from "@/hooks/useMotionPolicy";
import { HabitatDoorTransition, habitatDoorMotion } from "@/components/habitat/HabitatDoorTransition";

describe("Habitat door transition motion contract", () => {
  test("opens and closes with the standard barn-door travel", () => {
    expect(habitatDoorMotion(false, "enter")).toEqual({ from: 0, to: 1, duration: 450, travel: 105, spring: MOTION_SPRING.settle });
    expect(habitatDoorMotion(false, "exit")).toEqual({ from: 1, to: 0, duration: 450, travel: 105, spring: MOTION_SPRING.settle });
  });

  test("the room tempo is the default", () => {
    expect(habitatDoorMotion(false, "enter", "room")).toEqual(habitatDoorMotion(false, "enter"));
    expect(habitatDoorMotion(false, "exit", "room")).toEqual(habitatDoorMotion(false, "exit"));
  });

  test("the threshold tempo runs the same doors at the brisker state step", () => {
    expect(habitatDoorMotion(false, "enter", "threshold")).toEqual({ from: 0, to: 1, duration: 220, travel: 105, spring: MOTION_SPRING.tap });
    expect(habitatDoorMotion(false, "exit", "threshold")).toEqual({ from: 1, to: 0, duration: 220, travel: 105, spring: MOTION_SPRING.tap });
  });

  // The room is the arrival and takes the softer, longer `settle`; the
  // threshold is something you pass through and takes the quicker `tap`. Same
  // doors, two weights — the assertion that keeps the two tempos distinct.
  test("the two tempos swing on two different springs", () => {
    expect(habitatDoorMotion(false, "enter", "room").spring).not.toEqual(
      habitatDoorMotion(false, "enter", "threshold").spring,
    );
  });

  test("Reduced Motion uses the short crossfade without panel travel", () => {
    expect(habitatDoorMotion(true, "enter")).toEqual({ from: 0, to: 1, duration: 150, travel: 0, spring: null });
    expect(habitatDoorMotion(true, "exit")).toEqual({ from: 1, to: 0, duration: 150, travel: 0, spring: null });
  });

  test("Reduced Motion collapses both tempos to the one crossfade", () => {
    expect(habitatDoorMotion(true, "enter", "threshold")).toEqual({ from: 0, to: 1, duration: 150, travel: 0, spring: null });
    expect(habitatDoorMotion(true, "exit", "threshold")).toEqual({ from: 1, to: 0, duration: 150, travel: 0, spring: null });
  });

  // Reduce Motion is the one case these doors do NOT spring: no travel, so
  // there is nothing to overshoot, and `duration` runs a plain crossfade.
  test("Reduce Motion is the one un-sprung swing", () => {
    expect(habitatDoorMotion(false, "enter").spring).not.toBeNull();
    expect(habitatDoorMotion(true, "enter").spring).toBeNull();
  });
});

describe("Habitat door transition swing", () => {
  const swing = (reduceMotion: boolean) => {
    const spring = jest.spyOn(Animated, "spring");
    const timing = jest.spyOn(Animated, "timing");
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        <MotionPolicyProvider reduceMotion={reduceMotion}>
          <HabitatDoorTransition>
            <Text>Habitat</Text>
          </HabitatDoorTransition>
        </MotionPolicyProvider>,
      );
    });
    const calls = { spring: spring.mock.calls.length, timing: timing.mock.calls.length };
    TestRenderer.act(() => tree.unmount());
    spring.mockRestore();
    timing.mockRestore();
    return calls;
  };

  test("full motion springs the panels rather than ramping them", () => {
    const calls = swing(false);
    expect(calls.spring).toBe(1);
    expect(calls.timing).toBe(0);
  });

  test("Reduce Motion runs the crossfade on a timing", () => {
    const calls = swing(true);
    expect(calls.spring).toBe(0);
    expect(calls.timing).toBe(1);
  });

  // The spring settles when the physics say so, not on a clock — but it hands
  // back the same `finished` flag, so the swing still reports itself exactly
  // once (and never on a swing that was stopped). That report is what pushes
  // the interior route, so a double fire would stack a duplicate screen.
  test("a sprung swing reports opened once, and only when it finishes", () => {
    let settle: ((result: { finished: boolean }) => void) | undefined;
    const spring = jest.spyOn(Animated, "spring").mockImplementation(
      () =>
        ({
          start: (callback?: (result: { finished: boolean }) => void) => {
            settle = callback;
          },
          stop: () => {},
          reset: () => {},
        }) as unknown as Animated.CompositeAnimation,
    );
    const onOpened = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        <HabitatDoorTransition onOpened={onOpened}>
          <Text>Habitat</Text>
        </HabitatDoorTransition>,
      );
    });
    // Mid-swing: nothing reported yet.
    expect(onOpened).not.toHaveBeenCalled();
    // A swing that was cut short reports nothing either.
    TestRenderer.act(() => settle?.({ finished: false }));
    expect(onOpened).not.toHaveBeenCalled();
    // The physics settle.
    TestRenderer.act(() => settle?.({ finished: true }));
    expect(onOpened).toHaveBeenCalledTimes(1);
    TestRenderer.act(() => tree.unmount());
    spring.mockRestore();
  });
});

function contentOpacity(tree: TestRenderer.ReactTestRenderer) {
  const root = tree.root.findByProps({ testID: "habitat-door-transition" });
  const content = root.findAllByType(Animated.View)[0];
  const style = Array.isArray(content.props.style) ? Object.assign({}, ...content.props.style) : content.props.style;
  return style.opacity;
}

describe("Habitat door transition mount pose", () => {
  test("mountedOpen shows its children straight away, with no swing to play", () => {
    let tree!: TestRenderer.ReactTestRenderer;
    const onOpened = jest.fn();
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        <HabitatDoorTransition mountedOpen tempo="threshold" onOpened={onOpened}>
          <Text>Exterior</Text>
        </HabitatDoorTransition>,
      );
    });
    // The doors are already open: content at full opacity on the first frame.
    expect(contentOpacity(tree).__getValue()).toBe(1);
    // ...and the opened callback still fires exactly once, without the wait.
    expect(onOpened).toHaveBeenCalledTimes(1);
  });

  test("the default mount starts closed and opens", () => {
    let tree!: TestRenderer.ReactTestRenderer;
    const onOpened = jest.fn();
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        <HabitatDoorTransition onOpened={onOpened}>
          <Text>Habitat</Text>
        </HabitatDoorTransition>,
      );
    });
    expect(contentOpacity(tree).__getValue()).toBe(0);
    expect(onOpened).not.toHaveBeenCalled();
  });
});
