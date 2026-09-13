import React from "react";
import { AppState } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { RasterPig } from "@/components/ui/RasterPig";
import { SpritePig } from "@/components/ui/SpritePig";
import { WaitingRosie } from "@/components/ui/WaitingRosie";
import { PigRenderer } from "@/components/ui/PigRenderer";
import { LoadingBeat } from "@/components/ui/EmptyState";
import { useRivePigPlayback, type PigPlaybackPort } from "@/components/ui/useRivePigPlayback";
import type { RivePigProps } from "@/components/ui/rivePigContract";
import { MotionPolicyProvider } from "@/hooks/useMotionPolicy";

function render(node: React.ReactElement) {
  let view!: TestRenderer.ReactTestRenderer;
  act(() => { view = TestRenderer.create(node); });
  return view;
}
function Playback({ port, ...props }: RivePigProps & { port: PigPlaybackPort }) {
  useRivePigPlayback(port, props, (error) => { throw error; });
  return null;
}

describe("Pig presentation lifecycle", () => {
  beforeEach(() => { jest.useFakeTimers(); AppState.currentState = "active"; });
  afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

  it("restarts the same raster reaction and returns to the newest mood", () => {
    const complete = jest.fn();
    const view = render(<RasterPig animation="idle" mood="content" reaction={{ id: 1, kind: "wave" }} onComplete={complete} />);
    act(() => { jest.advanceTimersByTime(750); });
    act(() => view.update(<RasterPig animation="idle" mood="sad" reaction={{ id: 2, kind: "wave" }} onComplete={complete} />));
    expect(view.root.findByType(SpritePig).props.playbackKey).toBe(2);
    act(() => { jest.advanceTimersByTime(400); });
    expect(complete).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(600); });
    expect(complete).toHaveBeenCalledTimes(1);
    expect(view.root.findByType(SpritePig).props.animation).toBe("sad");
    act(() => view.unmount());
  });

  it("Reduce Motion completes reactions without starting a frame interval", () => {
    const interval = jest.spyOn(global, "setInterval");
    const complete = jest.fn();
    const view = render(<MotionPolicyProvider reduceMotion><RasterPig animation="idle" mood="tired" reaction={{ id: 1, kind: "jump" }} onComplete={complete} /></MotionPolicyProvider>);
    expect(interval).not.toHaveBeenCalled();
    expect(complete).toHaveBeenCalledTimes(1);
    expect(view.root.findByType(SpritePig).props.animation).toBe("tired");
    act(() => view.unmount());
    interval.mockRestore();
  });

  it("hidden sprites schedule no intervals, including off-page onboarding", () => {
    const interval = jest.spyOn(global, "setInterval");
    const view = render(<SpritePig animation="wave" active={false} />);
    expect(interval).not.toHaveBeenCalled();
    act(() => view.update(<SpritePig animation="wave" active />));
    expect(interval).toHaveBeenCalledTimes(1);
    act(() => view.unmount());
    interval.mockRestore();
  });

  it("exposes loading text immediately but skips animation initialization for fast requests", () => {
    const view = render(<LoadingBeat label="gathering your helpers" />);
    expect(view.root.findByProps({ accessibilityRole: "progressbar" }).props.accessibilityState.busy).toBe(true);
    expect(view.root.findByType(PigRenderer).props.frameIdx).toBe(0);
    act(() => { jest.advanceTimersByTime(80); view.unmount(); });
    expect(jest.getTimerCount()).toBe(0);
    const slow = render(<WaitingRosie />);
    act(() => { jest.advanceTimersByTime(200); });
    expect(slow.root.findByType(PigRenderer).props.frameIdx).toBeUndefined();
    act(() => slow.unmount());
  });

  it("holds sprites in the background, resumes in foreground, and removes subscriptions", () => {
    let notify: (state: "active" | "background") => void = () => {};
    const remove = jest.fn();
    const subscription = jest.spyOn(AppState, "addEventListener").mockImplementation((_event, listener) => {
      notify = listener;
      return { remove };
    });
    const frame = jest.fn();
    const view = render(<SpritePig animation="wave" onFrame={frame} />);
    act(() => { jest.advanceTimersByTime(250); });
    act(() => { AppState.currentState = "background"; notify("background"); });
    frame.mockClear();
    act(() => { jest.advanceTimersByTime(3000); });
    expect(frame).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
    act(() => { AppState.currentState = "active"; notify("active"); });
    act(() => { jest.advanceTimersByTime(250); });
    expect(frame).toHaveBeenCalled();
    act(() => view.unmount());
    expect(remove).toHaveBeenCalledTimes(1);
    subscription.mockRestore();
  });

  it("writes persistent state without refiring, retriggers identical requests, and pauses the runtime", () => {
    let finish = () => {};
    const port: PigPlaybackPort = {
      number: jest.fn(), fire: jest.fn(), play: jest.fn(), pause: jest.fn(),
      onComplete: (listener) => { finish = listener; return jest.fn(); },
    };
    const complete = jest.fn();
    const props = { source: 1, animation: "idle" as const, reaction: { id: 1, kind: "jump" as const }, onComplete: complete };
    const view = render(<Playback {...props} port={port} mood="content" />);
    expect(port.fire).toHaveBeenCalledTimes(1);
    act(() => view.update(<Playback {...props} port={port} mood="tired" />));
    expect(port.number).toHaveBeenCalledWith("rest", 2);
    expect(port.fire).toHaveBeenCalledTimes(1);
    act(() => view.update(<Playback {...props} reaction={{ id: 2, kind: "jump" }} port={port} mood="happy" active={false} />));
    expect(port.fire).toHaveBeenCalledTimes(2);
    expect(port.pause).toHaveBeenCalledTimes(1);
    expect(port.number).toHaveBeenCalledWith("rest", 3);
    act(() => finish());
    act(() => finish());
    expect(complete).toHaveBeenCalledTimes(1);
    act(() => view.unmount());
  });
});
