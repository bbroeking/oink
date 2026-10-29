import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import type {
  OpeningPresentationAction,
  OpeningPresentationState,
} from "../../../features/cards/domain/openingPresentation";

export interface OpeningPlaybackOptions {
  opening: OpeningPresentationState | null;
  active: boolean;
  reduceMotion: boolean;
  onAction: (action: OpeningPresentationAction) => void;
  onReveal: () => void;
}

export interface OpeningPlayback {
  reveal: () => void;
  cancel: () => void;
  settle: (openingId: string, index: number) => void;
}

// The first card rises behind the wrapper during its 700 ms exit.
const AUTO_FIRST_MS = 350;
const SETTLE_FALLBACK_MS = 450;

export function useOpeningPlayback({
  opening,
  active,
  reduceMotion,
  onAction,
  onReveal,
}: OpeningPlaybackOptions): OpeningPlayback {
  const openingRef = useRef(opening);
  const activeRef = useRef(active);
  const reduceMotionRef = useRef(reduceMotion);
  const actionRef = useRef(onAction);
  const revealCueRef = useRef(onReveal);
  const foregroundRef = useRef(AppState.currentState === "active");
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockedRequest = useRef<string | null>(null);
  const [foregroundRevision, setForegroundRevision] = useState(0);

  useEffect(() => { openingRef.current = opening; }, [opening]);
  useEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => { reduceMotionRef.current = reduceMotion; }, [reduceMotion]);
  useEffect(() => { actionRef.current = onAction; }, [onAction]);
  useEffect(() => { revealCueRef.current = onReveal; }, [onReveal]);

  const clearTimers = useCallback(() => {
    if (autoTimer.current) clearTimeout(autoTimer.current);
    if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
    autoTimer.current = null;
    fallbackTimer.current = null;
  }, []);

  const cancel = useCallback(() => {
    clearTimers();
    lockedRequest.current = null;
  }, [clearTimers]);

  const settle = useCallback((openingId: string, index: number) => {
    const current = openingRef.current;
    if (
      !activeRef.current || !foregroundRef.current || !current ||
      current.openingId !== openingId || current.phase !== "revealing" ||
      !current.revealPending || current.revealedCount !== index
    ) return;
    if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
    fallbackTimer.current = null;
    lockedRequest.current = null;
    actionRef.current({ type: "cardSettled" });
  }, []);

  const reveal = useCallback(() => {
    const current = openingRef.current;
    if (
      !activeRef.current || !foregroundRef.current || !current ||
      current.phase !== "revealing" || current.revealPending || current.revealedCount >= current.cardCount
    ) return;
    const requestKey = `${current.openingId}:${current.revealedCount}`;
    if (lockedRequest.current === requestKey) return;
    lockedRequest.current = requestKey;
    if (autoTimer.current) clearTimeout(autoTimer.current);
    autoTimer.current = null;
    actionRef.current({ type: "requestReveal" });
    revealCueRef.current();
    const openingId = current.openingId;
    const index = current.revealedCount;
    if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
    fallbackTimer.current = setTimeout(
      () => settle(openingId, index),
      reduceMotionRef.current ? 0 : SETTLE_FALLBACK_MS,
    );
  }, [settle]);

  useEffect(() => {
    const sync = (next: string) => {
      foregroundRef.current = next === "active";
      if (!foregroundRef.current) cancel();
      else setForegroundRevision((value) => value + 1);
    };
    sync(AppState.currentState);
    const subscription = AppState.addEventListener("change", sync);
    return () => subscription.remove();
  }, [cancel]);

  useEffect(() => {
    clearTimers();
    const current = opening;
    if (!active || !foregroundRef.current || !current || current.phase !== "revealing") {
      lockedRequest.current = null;
      return;
    }

    if (current.revealPending && current.revealedCount < current.cardCount) {
      const requestKey = `${current.openingId}:${current.revealedCount}`;
      lockedRequest.current = requestKey;
      fallbackTimer.current = setTimeout(
        () => settle(current.openingId, current.revealedCount),
        reduceMotion ? 0 : SETTLE_FALLBACK_MS,
      );
      return;
    }

    lockedRequest.current = null;
    if (current.revealedCount === 0) {
      autoTimer.current = setTimeout(reveal, reduceMotion ? 0 : AUTO_FIRST_MS);
    }
  }, [active, clearTimers, foregroundRevision, opening, reduceMotion, reveal, settle]);

  useEffect(() => cancel, [cancel]);

  return { reveal, cancel, settle };
}
