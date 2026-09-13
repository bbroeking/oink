export const MOTE_MACHINE_RIVE = {
  artboard: "MOTE MACHINE",
  stateMachine: "MoteMachine",
  viewModel: "MoteMachineViewModel",
  viewModelInstance: "Default",
  animations: {
    spin: "Machine Spin",
    reducedMotion: "Machine Settle",
  },
  properties: {
    requestPlay: "requestPlay",
    spin: "spin",
    /** Legacy authored name; used only as the numeric reel selector. */
    resultValue: "tickles",
    motes: "motes",
    reduceMotion: "reduceMotion",
    presenting: "presenting",
    busy: "busy",
    canPlay: "canPlay",
    hasError: "hasError",
    motesLabel: "motesLabel",
    /** Legacy authored name; bound to Contraption-fuel copy. */
    rewardLabel: "ticklesLabel",
    actionLabel: "actionLabel",
    statusLabel: "statusLabel",
    mode: "mode",
    stakeMotes: "stakeMotes",
    outcomeCode: "outcomeCode",
    leftStop: "leftStop",
    centerStop: "centerStop",
    rightStop: "rightStop",
    newlyUnlocked: "newlyUnlocked",
    replayedReceipt: "replayedReceipt",
    reset: "reset",
    enter: "enter",
    phase: "phase",
  },
} as const;

export type MoteMachineRiveViewModel = {
  spinToken: number;
  resultValue: number;
  motes: number;
  reduceMotion: boolean;
  presenting: boolean;
  busy: boolean;
  canPlay: boolean;
  hasError: boolean;
  motesLabel: string;
  rewardLabel: string;
  actionLabel: string;
  statusLabel: string;
  mode?: number;
  stakeMotes?: number;
  outcomeCode?: number;
  leftStop?: number;
  centerStop?: number;
  rightStop?: number;
  newlyUnlocked?: boolean;
  replayedReceipt?: boolean;
  phase?: number;
  resetToken?: number;
  enterToken?: number;
  confirmedRewardLabel?: string;
  uncertainPlay?: boolean;
  onRequestPlay: () => void;
  onOpenInventory?: () => void;
  onRetryRuntime?: () => void;
  onRuntimeReady?: (presentationVersion?: string) => void;
  onRuntimeError?: () => void;
  forceFailure?: boolean;
};
