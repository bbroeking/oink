import React from "react";
import TestRenderer, { act } from "react-test-renderer";

let mockRiveViewRef: { playIfNeeded?: jest.Mock } = {
  playIfNeeded: jest.fn(),
};
const mockSetValue = jest.fn();
const mockTrigger = jest.fn();

jest.mock("@rive-app/react-native", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    __esModule: true,
    Alignment: { Center: "center" },
    Fit: { Contain: "contain", Layout: "layout" },
    DataBindByName: class DataBindByName {},
    RiveView: (props: Record<string, unknown>) =>
      React.createElement(View, { ...props, testID: "mock-rive-view" }),
    useRiveFile: () => ({ riveFile: {}, isLoading: false, error: null }),
    useRive: () => ({ riveViewRef: mockRiveViewRef, setHybridRef: jest.fn() }),
    useViewModelInstance: () => ({ instance: {}, error: null }),
    useRiveNumber: () => ({ setValue: mockSetValue, error: null }),
    useRiveBoolean: () => ({ setValue: mockSetValue, error: null }),
    useRiveString: () => ({ setValue: mockSetValue, error: null }),
    useRiveTrigger: () => ({ trigger: mockTrigger, error: null }),
  };
});

const { MoteMachineRive } =
  require("@/components/mote-machine/MoteMachineRive.native") as typeof import("@/components/mote-machine/MoteMachineRive.native");

const baseProps = {
  spinToken: 1,
  resultValue: 3,
  motes: 7,
  reduceMotion: false,
  presenting: false,
  busy: false,
  canPlay: true,
  hasError: false,
  motesLabel: "7 MOTES",
  rewardLabel: "1 CLOCKWORK ACORN",
  actionLabel: "SPIN ANOTHER",
  statusLabel: "1 Clockwork Acorn · 7 Motes left",
  confirmedRewardLabel: "1 Clockwork Acorn",
  onRequestPlay: jest.fn(),
};

describe("MoteMachineRive native fallback transition", () => {
  beforeEach(() => {
    mockRiveViewRef = { playIfNeeded: jest.fn() };
    mockSetValue.mockClear();
    mockTrigger.mockClear();
  });

  it("does not call a removed native view method while entering the post-confirmation fallback", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<MoteMachineRive {...baseProps} />);
    });

    mockRiveViewRef = {};
    expect(() => {
      act(() => {
        renderer!.update(<MoteMachineRive {...baseProps} forceFailure />);
      });
    }).not.toThrow();

    expect(
      renderer!.root.findByProps({ accessibilityRole: "alert" }),
    ).toBeTruthy();
    act(() => renderer!.unmount());
  });
});
