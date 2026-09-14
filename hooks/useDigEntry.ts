// The one-step Truffle Patch entry point — "pull up the digging", wherever the
// control happens to stand.
//
// Two lanes, one decision, made here so no surface re-derives it:
//   CREWED   — the dig opens IN PLACE. `useFeedingCta` owns the window clock,
//              the already-dug state and the TrufflePatch modal, so a crewed
//              player never navigates to a tab to reach their own dig.
//   UNCREWED — digging is crew-gated, so the control is a door: the Season tab,
//              where the practice dig and the join path live. With the
//              `snout_deep` flag on, the server opens the same dig for an
//              uncrewed player (things + XP, no Golden Truffles — spec §1.7),
//              so the uncrewed lane opens IN PLACE too, through the same
//              `start()`; the receipt carries the join line.
//
// This is the decision the retired Barn chip made inline. It moved here when the
// Barn's own dig control needed the same behaviour: one source of truth for
// "what does pressing dig do", rather than two controls that drift apart.
// (2026-09-12)
import { useCallback, type ReactNode } from "react";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useSeason1Active } from "@/hooks/useSeason1Active";
import { useFeatureFlag } from "@/hooks/useFeatureFlags";
import { useSounderPath } from "@/hooks/useSounderPath";
import { useFeedingCta } from "@/components/mudwar/useFeedingCta";
import type { SounderStep } from "@/hooks/useSounderPath";

// Where an uncrewed player is sent to start digging: the Season tab carries the
// practice dig and the join path. It reads no params, so there are none to pass.
const SEASON_TAB = "/(tabs)/season";

export type DigBlocked = null | "shut" | "dug" | "no_crew";

export interface DigEntry {
  /**
   * The derived onboarding step, or null until the one-shot crew read lands —
   * so a surface that self-gates never flashes the wrong lane pre-confirm.
   */
  step: SounderStep | null;
  /** The player has a Sounder: pressing dig opens the patch here, in place. */
  crewed: boolean;
  /** Crewed, inside the feeding window, and not yet dug — the dig is live now. */
  open: boolean;
  /** Whether a primary dig trigger belongs on the current surface. */
  visible: boolean;
  /**
   * Why a dig can't happen right now, or null when it can. Drives the Barn
   * button's disabled face: "shut" = the patch is in its guarded phase,
   * "dug" = already dug this Feeding, "no_crew" = an uncrewed player before
   * Snout Deep (the press is a door to the Season tab, not a dig).
   */
  blocked: DigBlocked;
  /** The one hand line that explains `blocked` on a disabled control. */
  blockedLine: string | null;
  /** What the dig is, right now ("Dig for Golden Truffles" / the cooldown). */
  title: string;
  /** The payoff line under it — what a find is worth, personally and to the herd. */
  detail: string;
  /** A gentle inline note after a refused open (already dug / shut / retry). */
  note: string | null;
  /** The accessibility hint for a control labelled with the Patch's name. */
  hint: string;
  /** Pull up the digging: the patch in place, or the door to the Season tab. */
  openDig: () => void;
  /** The dig modal. Render it ONCE beside whichever trigger you show. */
  modal: ReactNode;
}

/** The hint a crewed control carries: the dig happens right here. */
export const DIG_HINT_CREWED = "Opens the dig";
/** The hint an uncrewed control carries: it is a door, and it says so. */
export const DIG_HINT_UNCREWED = "Opens the Season tab to start digging";

export function useDigEntry(): DigEntry {
  // The same Season-1 switch the Season tab + Sounder segment + launch nudge
  // use. Loading/failure reads false, so no surface flashes pre-confirm.
  const coopDig = useSeason1Active();

  // The path hook does the one-shot crew read and distinguishes the crewless
  // onboarding doors from the normal, crewed digging loop.
  const sounderPath = useSounderPath(coopDig);
  const { step } = sounderPath;
  const cta = useFeedingCta(sounderPath.refresh);

  const crewed = coopDig && (step === "first_dig" || step === "done");
  // Snout Deep: the uncrewed player digs too (the server decides at open —
  // the flag here only routes the press). Loading reads false → the door.
  const snoutDeep = useFeatureFlag("snout_deep");
  const inPlace = crewed || (coopDig && snoutDeep);
  const open = inPlace && cta.phaseOpen && !cta.dugThisWindow;
  // Completion retires the primary action for the rest of this feeding. The
  // collection/history surfaces remain independent, and useRooting's
  // reconciliation clears dugThisWindow when the next window becomes current.
  const visible = !inPlace || !cta.dugThisWindow;
  // The one reason the face wears when it can't dig. Order matters: a dug
  // Feeding beats a shut patch (you dug, that's why it's over), and the door
  // for the uncrewed is never "shut" — it opens whenever the tab does.
  const blocked: DigBlocked = !inPlace
    ? "no_crew"
    : cta.dugThisWindow
      ? "dug"
      : cta.phaseOpen
        ? null
        : "shut";
  const blockedLine =
    blocked === "shut"
      ? `the patch opens in ${cta.countdown}`
      : blocked === "dug"
        ? "dug this Feeding · back next one"
        : blocked === "no_crew"
          ? "truffles are for herds — find yours"
          : null;

  // An uncrewed Snout Deep dig pays things and XP, never Golden Truffles —
  // the control says so rather than promising the herd's prize.
  const uncrewedDig = inPlace && !crewed;
  const title = cta.dugThisWindow
    ? "Dug this feeding"
    : cta.phaseOpen
      ? uncrewedDig
        ? "Dig the Truffle Patch"
        : "Dig for Golden Truffles"
      : `Dig opens in ${cta.countdown}`;
  const detail = cta.dugThisWindow
    ? "20 Pass XP banked · back next feeding"
    : cta.phaseOpen
      ? `+20 Pass XP · closes in ${cta.countdown}`
      : uncrewedDig
        ? "finds + 20 Pass XP · truffles are for herds"
        : "Golden Truffles · +20 Pass XP · Sounder spoils";

  const start = cta.start;
  const openDig = useCallback(() => {
    if (inPlace) {
      // `start` carries its own haptic and its own honest refusal: a shut
      // patch or an already-dug feeding comes back as `note`, never as a
      // silent no-op.
      void start();
      return;
    }
    Haptics.selectionAsync().catch(() => {});
    router.push(SEASON_TAB);
  }, [inPlace, start]);

  return {
    step,
    crewed,
    open,
    visible,
    blocked,
    blockedLine,
    title,
    detail,
    note: cta.note,
    hint: inPlace ? DIG_HINT_CREWED : DIG_HINT_UNCREWED,
    openDig,
    modal: cta.modal,
  };
}
