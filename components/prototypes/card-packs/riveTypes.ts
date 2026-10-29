export const CARD_PACK_RIVE = {
  artboard: "CardPackReveal",
  stateMachine: "CardPackRevealMachine",
  viewModel: "CardPackRevealViewModel",
  viewModelInstance: "Default",
  properties: {
    tearProgress: "tearProgress",
    revealIndex: "revealIndex",
    tiltX: "tiltX",
    tiltY: "tiltY",
    cardArt: "cardArt",
    finish: "finish",
    reduceMotion: "reduceMotion",
    open: "open",
    reveal: "reveal",
    inspect: "inspect",
    reset: "reset",
    tearComplete: "tearComplete",
    cardSettled: "cardSettled",
    inspectComplete: "inspectComplete",
    sequenceComplete: "sequenceComplete",
  },
} as const;

export type CardPackFinish = "standard" | "foil" | "living";
export type CardPackRiveFinish = "Standard" | "Foil" | "Living";
export type CardPackAction = "open" | "reveal" | "inspect" | "reset";
export type CardPackPhase =
  | "sealed"
  | "tearing"
  | "opening"
  | "revealing"
  | "inspecting"
  | "complete";
export type CardPackSignal =
  | "tearComplete"
  | "cardSettled"
  | "inspectComplete"
  | "sequenceComplete";

export type CardArtSource = string | number | { uri: string };

export type CardPackRiveProps = {
  tearProgress: number;
  revealIndex: number;
  tiltX: number;
  tiltY: number;
  finish: CardPackFinish;
  reduceMotion: boolean;
  active: boolean;
  phase: CardPackPhase;
  actionToken: number;
  action: CardPackAction;
  cardArt: CardArtSource;
  /** Optional web/standalone asset URL. Native always uses the bundled file. */
  sourcePath?: string;
  onReady?: () => void;
  onError?: (error: Error) => void;
  onSignal?: (signal: CardPackSignal) => void;
};

export function riveFinish(finish: CardPackFinish): CardPackRiveFinish {
  if (finish === "foil") return "Foil";
  if (finish === "living") return "Living";
  return "Standard";
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
