// The Exterior's doorway — the state machine behind "tap the barn, walk in".
//
// Two things move together and neither can be read off the other: the barn
// SPRITE'S own little doors (`structure`) and the full-screen THRESHOLD panels
// that close over the home tab on the way in (`phase`). The sprite opens first,
// the threshold follows a feedback beat later, and the route push happens
// behind fully closed doors so the cut to the interior is invisible.
//
// It lives in a hook rather than inside Barn.tsx because the sequencing is the
// part with the bug surface — a second tap mid-close must be swallowed, the
// push must happen exactly once, and a pending timer must not fire into an
// unmounted screen. Barn.tsx is not mountable in a unit test; this is.
//
// The phase, not a boolean, is the admission gate: `enter()` is accepted only
// from `open`, and it answers whether it took the tap so the caller can fire
// haptics for an accepted press and stay silent for a swallowed one.
// [A-07] (2026-09-12)
import { useCallback, useEffect, useRef, useState } from "react";
import type { BarnStructureState } from "@/components/BarnStructure";
import type { HabitatDoorDirection } from "@/components/habitat/HabitatDoorTransition";
import { MOTION_DURATION } from "@/hooks/useMotionPolicy";

/** open = standing outside · closing = walking in · closed = route pushed · opening = back home. */
export type BarnThresholdPhase = "open" | "closing" | "closed" | "opening";

export interface BarnThreshold {
  phase: BarnThresholdPhase;
  /** What the barn sprite is doing right now. */
  structure: BarnStructureState;
  /** The `direction` the threshold panels should be swinging toward. */
  direction: HabitatDoorDirection;
  /** Take a tap on the barn. Answers false when the tap was swallowed. */
  enter: () => boolean;
  /** The threshold panels finished closing — push the route from here. */
  onClosed: () => void;
  /** The threshold panels finished opening — everything is back at rest. */
  onOpened: () => void;
  /** The Exterior regained focus (the player came back out of the room). */
  onFocusRegained: () => void;
}

export function useBarnThreshold({
  push,
  beckon = false,
}: {
  /** Navigates to the interior. Called exactly once per accepted entry. */
  push: () => void;
  /** The journal is holding something new — rest in the beckon pose. */
  beckon?: boolean;
}): BarnThreshold {
  const [phase, setPhase] = useState<BarnThresholdPhase>("open");
  const [structure, setStructure] = useState<BarnStructureState>("closed");
  // The phase is read inside callbacks that a fast double-tap can fire twice in
  // one commit, so the gate reads a ref that moves in the same statement as the
  // state — a stale render closure would let the second tap through.
  const live = useRef<BarnThresholdPhase>("open");
  const settle = useCallback((next: BarnThresholdPhase) => {
    live.current = next;
    setPhase(next);
  }, []);
  const handoff = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearHandoff = () => {
    if (handoff.current) clearTimeout(handoff.current);
    handoff.current = null;
  };
  useEffect(() => clearHandoff, []);

  const enter = useCallback(() => {
    if (live.current !== "open") return false;
    // The sprite's doors part first and alone: a feedback beat of "the thing you
    // touched answered" before the screen-sized panels take over.
    setStructure("opening");
    clearHandoff();
    handoff.current = setTimeout(() => {
      handoff.current = null;
      settle("closing");
    }, MOTION_DURATION.feedback);
    return true;
  }, [settle]);

  const onClosed = useCallback(() => {
    // Only a close we asked for pushes. The panels also report `onClosed` when
    // they settle shut for any other reason, and a second push would stack a
    // duplicate interior on the stack.
    if (live.current !== "closing") return;
    settle("closed");
    setStructure("open");
    push();
  }, [push, settle]);

  const onOpened = useCallback(() => {
    // A mounted-open threshold reports `onOpened` on its very first frame; that
    // is the rest pose, not a return, so only a swing we started counts.
    if (live.current !== "opening") return;
    settle("open");
    setStructure("closed");
  }, [settle]);

  const onFocusRegained = useCallback(() => {
    if (live.current !== "closed") return;
    settle("opening");
    setStructure("closing");
  }, [settle]);

  // Beckon is a REST pose, never a transition: it dresses the sprite only when
  // it is standing still, so a New item can never interrupt a swing in flight.
  const atRest = structure === "closed" || structure === "beckon";
  return {
    phase,
    structure: atRest ? (beckon ? "beckon" : "closed") : structure,
    direction: phase === "closing" || phase === "closed" ? "exit" : "enter",
    enter,
    onClosed,
    onOpened,
    onFocusRegained,
  };
}
