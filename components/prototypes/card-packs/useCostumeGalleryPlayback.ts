import { useCallback, useEffect, useState } from "react";
import { usePigPlayback } from "@/components/ui/usePigPlayback";

export interface CostumeGalleryPlaybackOptions {
  active: boolean;
  reduceMotion: boolean;
}

export interface CostumeGalleryPlayback {
  frameIndex: number;
  frameCount: number;
  playing: boolean;
  play: () => void;
  pause: () => void;
  step: (delta: number) => void;
}

/** One parent-owned idle clock for every costume stage in the gallery. */
export function useCostumeGalleryPlayback({
  active,
  reduceMotion,
}: CostumeGalleryPlaybackOptions): CostumeGalleryPlayback {
  const [wantsPlayback, setWantsPlayback] = useState(!reduceMotion);
  const [offset, setOffset] = useState(0);
  const [savedFrame, setSavedFrame] = useState(0);
  const playing = active && wantsPlayback && !reduceMotion;

  const playback = usePigPlayback({
    animation: "idle",
    active: playing,
    reduced: false,
    tempo: 1,
    frameIdx: playing ? undefined : savedFrame,
    onFrame: (rawFrame) => {
      if (playing) setSavedFrame((offset + rawFrame) % 12);
    },
  });
  const frameCount = playback.frames.length;
  const frameIndex = playing
    ? (offset + playback.frameIdx) % frameCount
    : savedFrame % frameCount;

  useEffect(() => {
    setOffset(0);
    setSavedFrame(0);
    setWantsPlayback(!reduceMotion);
  }, [reduceMotion]);

  useEffect(() => {
    if (!active) setOffset(savedFrame);
  }, [active, savedFrame]);

  const play = useCallback(() => {
    if (reduceMotion) return;
    setOffset(savedFrame);
    setWantsPlayback(true);
  }, [reduceMotion, savedFrame]);

  const pause = useCallback(() => {
    setSavedFrame(frameIndex);
    setWantsPlayback(false);
  }, [frameIndex]);

  const step = useCallback((delta: number) => {
    const next = ((frameIndex + delta) % frameCount + frameCount) % frameCount;
    setSavedFrame(next);
    setOffset(next);
    setWantsPlayback(false);
  }, [frameCount, frameIndex]);

  return { frameIndex, frameCount, playing, play, pause, step };
}
