import {
  BLESSING_META,
  type BlessingKind,
} from "@/utils/rituals";

export interface KindnessCardOffer {
  blessingKind: BlessingKind;
  remaining: number;
}

export function parseKindnessCardOffer(value: unknown): KindnessCardOffer | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (
    row.ok !== true ||
    row.eligible !== true ||
    typeof row.blessing_kind !== "string" ||
    !(row.blessing_kind in BLESSING_META) ||
    row.blessing_kind === "chorus_glow" ||
    typeof row.bless_remaining !== "number" ||
    !Number.isInteger(row.bless_remaining) ||
    row.bless_remaining < 1
  ) {
    return null;
  }
  return {
    blessingKind: row.blessing_kind as BlessingKind,
    remaining: row.bless_remaining,
  };
}

export function kindnessCardFailureCopy(reason: string | undefined): string {
  if (reason === "already_blessed_today") {
    return "You already left this friend a little warmth today.";
  }
  if (reason === "daily_cap") {
    return "All today’s warmth has found a home.";
  }
  return "That warmth didn’t stick. Try once more?";
}
