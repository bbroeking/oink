export type OpeningPhase = "sealed" | "tearing" | "revealing" | "inspecting" | "receipt";
export type OpeningCardCount = 3 | 5;

export interface OpeningPresentationState {
  version: 1;
  openingId: string;
  cardCount: OpeningCardCount;
  phase: OpeningPhase;
  tearProgress: number;
  revealedCount: number;
  revealPending: boolean;
  inspectingIndex: number | null;
}

export type OpeningPresentationAction =
  | { type: "tear"; progress: number }
  | { type: "open" }
  | { type: "requestReveal" }
  | { type: "cardSettled" }
  | { type: "inspect"; index: number }
  | { type: "closeInspection" }
  | { type: "skipToReceipt" }
  | { type: "showReceipt" }
  | { type: "replay" };

export const isOpeningCardCount = (value: unknown): value is OpeningCardCount => value === 3 || value === 5;

export const createOpeningPresentation = (openingId: string, cardCount: OpeningCardCount = 5): OpeningPresentationState => ({
  version: 1,
  openingId,
  cardCount,
  phase: "sealed",
  tearProgress: 0,
  revealedCount: 0,
  revealPending: false,
  inspectingIndex: null,
});

export function openingPresentationReducer(
  state: OpeningPresentationState,
  action: OpeningPresentationAction,
): OpeningPresentationState {
  switch (action.type) {
    case "tear": {
      if (state.phase !== "sealed" && state.phase !== "tearing") return state;
      if (!Number.isFinite(action.progress)) return state;
      const progress = Math.max(state.tearProgress, Math.min(1, Math.max(0, action.progress)));
      if (progress === 1) return { ...state, phase: "revealing", tearProgress: 1 };
      return { ...state, phase: progress > 0 ? "tearing" : state.phase, tearProgress: progress };
    }
    case "open":
      if (state.phase === "receipt") return state;
      return { ...state, phase: "revealing", tearProgress: 1, inspectingIndex: null };
    case "requestReveal":
      if (state.phase !== "revealing" || state.revealPending || state.revealedCount >= state.cardCount) return state;
      return { ...state, revealPending: true };
    case "cardSettled": {
      if (state.phase !== "revealing" || !state.revealPending) return state;
      const revealedCount = Math.min(state.cardCount, state.revealedCount + 1);
      return { ...state, revealedCount, revealPending: false };
    }
    case "inspect":
      if (state.revealPending || action.index < 0 || action.index >= state.revealedCount || state.phase !== "revealing") return state;
      return { ...state, phase: "inspecting", inspectingIndex: action.index };
    case "closeInspection":
      return state.phase === "inspecting" ? { ...state, phase: "revealing", inspectingIndex: null } : state;
    case "skipToReceipt":
      return { ...state, phase: "receipt", tearProgress: 1, revealedCount: state.cardCount, revealPending: false, inspectingIndex: null };
    case "showReceipt":
      return state.phase === "revealing" && state.revealedCount === state.cardCount && !state.revealPending
        ? { ...state, phase: "receipt", inspectingIndex: null }
        : state;
    case "replay":
      return createOpeningPresentation(state.openingId, state.cardCount);
  }
}

/** Restores app-owned presentation progress without trusting an interrupted animation callback. */
export function restoreOpeningPresentation(
  value: unknown,
  openingId: string,
  cardCount: OpeningCardCount = 5,
): OpeningPresentationState {
  if (!value || typeof value !== "object") return createOpeningPresentation(openingId, cardCount);
  const candidate = value as Partial<OpeningPresentationState>;
  const persistedCardCount = candidate.cardCount ?? cardCount;
  const validPhase = ["sealed", "tearing", "revealing", "inspecting", "receipt"].includes(candidate.phase ?? "");
  if (
    candidate.version !== 1 || candidate.openingId !== openingId || !validPhase ||
    !isOpeningCardCount(persistedCardCount) || persistedCardCount !== cardCount ||
    !Number.isFinite(candidate.tearProgress) || candidate.tearProgress! < 0 || candidate.tearProgress! > 1 ||
    !Number.isInteger(candidate.revealedCount) || candidate.revealedCount! < 0 || candidate.revealedCount! > cardCount
  ) return createOpeningPresentation(openingId, cardCount);
  if (candidate.phase === "inspecting" &&
    (!Number.isInteger(candidate.inspectingIndex) || candidate.inspectingIndex! < 0 || candidate.inspectingIndex! >= candidate.revealedCount!)) {
    return createOpeningPresentation(openingId, cardCount);
  }
  return {
    version: 1,
    openingId,
    cardCount,
    phase: candidate.phase!,
    tearProgress: candidate.tearProgress!,
    revealedCount: candidate.revealedCount!,
    revealPending: false,
    inspectingIndex: candidate.phase === "inspecting" ? candidate.inspectingIndex! : null,
  };
}
