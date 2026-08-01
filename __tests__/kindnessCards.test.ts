import {
  kindnessCardFailureCopy,
  parseKindnessCardOffer,
} from "@/utils/kindnessCards";

describe("Barn kindness cards", () => {
  it("accepts only an eligible current blessing offer", () => {
    expect(
      parseKindnessCardOffer({
        ok: true,
        eligible: true,
        blessing_kind: "mud_wrap",
        bless_remaining: 2,
      }),
    ).toEqual({ blessingKind: "mud_wrap", remaining: 2 });

    expect(
      parseKindnessCardOffer({
        ok: true,
        eligible: false,
        blessing_kind: "mud_wrap",
        bless_remaining: 2,
      }),
    ).toBeNull();
    expect(
      parseKindnessCardOffer({
        ok: true,
        eligible: true,
        blessing_kind: "chorus_glow",
        bless_remaining: 2,
      }),
    ).toBeNull();
  });

  it("uses gentle failure copy for cooldowns and retryable errors", () => {
    expect(kindnessCardFailureCopy("daily_cap")).toContain("warmth");
    expect(kindnessCardFailureCopy("already_blessed_today")).toContain(
      "already",
    );
    expect(kindnessCardFailureCopy("network")).toContain("Try once more");
  });
});
