import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { AppState, type AppStateStatus } from "react-native";
import { createOpeningPresentation, openingPresentationReducer, type OpeningPresentationAction, type OpeningPresentationState } from "@/features/cards/domain/openingPresentation";
import { useOpeningPlayback, type OpeningPlayback } from "@/components/prototypes/card-packs/useOpeningPlayback";

jest.useFakeTimers();

let appStateListener: ((state: AppStateStatus) => void) | null = null;
const setAppState = (value: AppStateStatus) => {
  (AppState as unknown as { currentState: AppStateStatus }).currentState = value;
};
jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
  appStateListener = listener;
  return { remove: () => { appStateListener = null; } };
});

function opened(id = "opening-1") {
  return openingPresentationReducer(createOpeningPresentation(id), { type: "open" });
}

function Harness(props: {
  opening: OpeningPresentationState | null;
  active?: boolean;
  reduceMotion?: boolean;
  onAction: (action: OpeningPresentationAction) => void;
  onReveal: () => void;
  expose: (playback: OpeningPlayback) => void;
}) {
  const playback = useOpeningPlayback({
    opening: props.opening,
    active: props.active ?? true,
    reduceMotion: props.reduceMotion ?? false,
    onAction: props.onAction,
    onReveal: props.onReveal,
  });
  props.expose(playback);
  return null;
}

describe("useOpeningPlayback", () => {
  let renderer: ReactTestRenderer | null;
  let playback: OpeningPlayback;
  let state: OpeningPresentationState;
  let actions: OpeningPresentationAction[];
  let reveals: number;

  const render = (extra: Partial<React.ComponentProps<typeof Harness>> = {}) => {
    const props: React.ComponentProps<typeof Harness> = {
      opening: state,
      onAction: (action) => { actions.push(action); state = openingPresentationReducer(state, action); },
      onReveal: () => { reveals += 1; },
      expose: (value) => { playback = value; },
      ...extra,
    };
    act(() => {
      if (renderer) renderer.update(<Harness {...props} />);
      else renderer = create(<Harness {...props} />);
    });
  };

  beforeEach(() => {
    setAppState("active");
    appStateListener = null;
    renderer = null;
    playback = undefined as unknown as OpeningPlayback;
    state = opened();
    actions = [];
    reveals = 0;
    jest.clearAllTimers();
  });

  afterEach(() => {
    if (renderer) act(() => renderer?.unmount());
  });

  it("auto-requests only the first card during wrapper exit and settles through the guarded fallback", () => {
    render();
    act(() => { jest.advanceTimersByTime(349); });
    expect(actions).toEqual([]);
    act(() => { jest.advanceTimersByTime(1); });
    expect(actions).toEqual([{ type: "requestReveal" }]);
    expect(reveals).toBe(1);
    render();
    act(() => { jest.advanceTimersByTime(450); });
    expect(actions.at(-1)).toEqual({ type: "cardSettled" });
    render();
    act(() => { jest.advanceTimersByTime(1000); });
    expect(actions).toHaveLength(2);
  });

  it("uses an immediate auto-first and settle path for reduced motion and locks rapid reveals", () => {
    render({ reduceMotion: true });
    act(() => { jest.advanceTimersByTime(0); });
    expect(actions).toEqual([{ type: "requestReveal" }]);
    act(() => { playback.reveal(); playback.reveal(); });
    expect(actions).toHaveLength(1);
    expect(reveals).toBe(1);
    render({ reduceMotion: true });
    act(() => { jest.advanceTimersByTime(0); });
    expect(actions.at(-1)).toEqual({ type: "cardSettled" });
    expect(state.revealedCount).toBe(1);
    render({ reduceMotion: true });
    act(() => { jest.advanceTimersByTime(500); });
    expect(actions).toHaveLength(2);
  });

  it("accepts one exact visual settle and ignores stale callbacks", () => {
    render();
    act(() => playback.reveal());
    render();
    act(() => {
      playback.settle("other-opening", 0);
      playback.settle("opening-1", 1);
      playback.settle("opening-1", 0);
    });
    expect(actions).toEqual([{ type: "requestReveal" }, { type: "cardSettled" }]);
    render();
    act(() => { jest.advanceTimersByTime(500); });
    expect(actions).toHaveLength(2);
  });

  it("cancels in background and safely resumes a pending fallback", () => {
    render();
    act(() => playback.reveal());
    render();
    act(() => { setAppState("background"); appStateListener?.("background"); jest.advanceTimersByTime(1000); });
    expect(actions).toEqual([{ type: "requestReveal" }]);
    act(() => { setAppState("active"); appStateListener?.("active"); });
    render();
    act(() => { jest.advanceTimersByTime(450); });
    expect(actions.at(-1)).toEqual({ type: "cardSettled" });
  });

  it("stops new packets after the third card without requesting a fourth", () => {
    state = { ...createOpeningPresentation("three-card-opening", 3), phase: "revealing", tearProgress: 1, revealedCount: 2 };
    render();
    act(() => playback.reveal());
    render();
    act(() => { jest.advanceTimersByTime(450); });
    expect(state.revealedCount).toBe(3);
    render();
    act(() => { playback.reveal(); playback.reveal(); jest.advanceTimersByTime(1000); });
    expect(actions).toEqual([{ type: "requestReveal" }, { type: "cardSettled" }]);
    expect(reveals).toBe(1);
  });

  it("never reveals a sixth card or auto-advances restored counts one through four", () => {
    state = { ...opened(), revealedCount: 4 };
    render();
    act(() => { jest.advanceTimersByTime(1000); });
    expect(actions).toEqual([]);
    state = { ...state, revealedCount: 5 };
    render();
    act(() => playback.reveal());
    expect(actions).toEqual([]);
  });
});
