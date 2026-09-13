import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { resolveMoteRosiePerformance, MoteRosieStage } from "@/components/mote-machine/MoteRosieStage";

const mockPigStage = jest.fn((_props: unknown) => null);
let mockPresentation: React.ReactNode = null;
jest.mock("@/components/ui/PigStage", () => ({ PigStage: (props: unknown) => mockPigStage(props) }));
jest.mock("@/hooks/useHabitatPigBridge", () => ({ useHabitatPigConsumer: () => ({ presentation: mockPresentation }) }));

describe("MoteRosieStage", () => {
  beforeEach(() => { mockPresentation = null; mockPigStage.mockClear(); });
  it("keeps authored intent separate from temporary shared-rig fallbacks", () => {
    expect(resolveMoteRosiePerformance("result", "jackpot", false)).toMatchObject({ authored: "hoof_clap", fallback: "jump" });
    expect(resolveMoteRosiePerformance("stop_left", "big", true)).toMatchObject({ authored: "track_left", fallback: null });
    expect(resolveMoteRosiePerformance("result", "big", true)).toMatchObject({ authored: "proud_jump", fallback: null, animation: "idle" });
  });

  it("preserves the player's resting mood and complete supported equipment identity", () => {
    const hat = { id: "hat-1", category: "hat", emoji: null };
    const held = { id: "held-1", category: "held", emoji: null };
    mockPresentation = React.createElement("PlayerPig", { pigId: "patch", restingAnim: "sad", equipped: hat, equippedHeld: held });
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<MoteRosieStage phase={0} outcome={null} receiptId={null}
      newlyUnlocked={false} replayed={false} reduceMotion={false} presentationVersion="mote-animation-v4" active />); });
    expect(mockPigStage).toHaveBeenLastCalledWith(expect.objectContaining({ pigId: "patch", pigMood: "sad", pigAnimation: "idle", equipped: hat, equippedHeld: held }));
    act(() => renderer.unmount());
  });

  it("suppresses motion beats for Reduced Motion and keeps the stage passive", () => {
    mockPresentation = React.createElement("PlayerPig", { pigId: "rosie", restingAnim: "tired" });
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<MoteRosieStage phase={4} outcome="big" receiptId="reduced-result"
      newlyUnlocked={false} replayed={false} reduceMotion presentationVersion="mote-animation-v4" active />); });
    expect(mockPigStage).toHaveBeenLastCalledWith(expect.objectContaining({ pigMood: "tired", pigAnimation: "idle", pigReaction: null, pigFrozen: true, pigFrameIdx: 0, active: true }));
    expect(renderer.root.findByProps({ testID: "mote-rosie-stage" }).props.pointerEvents).toBe("none");
    act(() => renderer.unmount());
  });

  it("uses one receipt-and-beat reaction id and cancels scheduled work on unmount", () => {
    jest.useFakeTimers();
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<MoteRosieStage phase={3} outcome="big" receiptId="receipt-1"
      newlyUnlocked={false} replayed={false} reduceMotion={false} presentationVersion="mote-animation-v4" active />); });
    act(() => jest.advanceTimersByTime(4_900));
    const reaction = jest.mocked(mockPigStage).mock.calls.at(-1)?.[0] as { pigReaction?: { id: number; kind: string } };
    expect(reaction.pigReaction).toMatchObject({ kind: "jump" });
    act(() => renderer.unmount());
    expect(jest.getTimerCount()).toBe(0);
    jest.useRealTimers();
  });
});
