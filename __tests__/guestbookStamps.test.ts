import fs from "node:fs";
import path from "node:path";
import {
  GUESTBOOK_STAMP_IDS,
  guestbookAgeLabel,
  parseGuestbookEntries,
} from "@/utils/guestbookStamps";

describe("Barn guestbook stamps", () => {
  it("parses only known, display-safe stamp rows", () => {
    expect(
      parseGuestbookEntries([
        {
          id: 7,
          stamp_id: "heart",
          visitor_name: "  Petunia  ",
          stamped_at: "2026-07-25T12:00:00Z",
          blessing_kind: "sun_beam",
          blessing_sent_at: "2026-07-25T12:01:00Z",
        },
        {
          id: 8,
          stamp_id: "future_stamp",
          visitor_name: "Nope",
          stamped_at: "2026-07-25T12:00:00Z",
        },
      ]),
    ).toEqual([
      {
        id: 7,
        stampId: "heart",
        visitorName: "Petunia",
        stampedAt: "2026-07-25T12:00:00Z",
        blessingKind: "sun_beam",
        blessingSentAt: "2026-07-25T12:01:00Z",
      },
    ]);
    expect(GUESTBOOK_STAMP_IDS).toHaveLength(4);
  });

  it("ignores unknown blessing kinds without dropping the visit stamp", () => {
    expect(
      parseGuestbookEntries([
        {
          id: 9,
          stamp_id: "sparkle",
          visitor_name: "Poppy",
          stamped_at: "2026-07-25T12:00:00Z",
          blessing_kind: "future_blessing",
          blessing_sent_at: "2026-07-25T12:01:00Z",
        },
      ]),
    ).toEqual([
      {
        id: 9,
        stampId: "sparkle",
        visitorName: "Poppy",
        stampedAt: "2026-07-25T12:00:00Z",
      },
    ]);
  });

  it("uses warm calendar language without an expiry countdown", () => {
    const now = Date.parse("2026-07-26T12:00:00Z");
    expect(guestbookAgeLabel("2026-07-26T08:00:00Z", now)).toBe("today");
    expect(guestbookAgeLabel("2026-07-25T08:00:00Z", now)).toBe("yesterday");
    expect(guestbookAgeLabel("2026-07-20T08:00:00Z", now)).toBe("6 days ago");
  });

  it("keeps writes visit-backed, additive, and owner-read-only", () => {
    const sql = fs.readFileSync(
      path.join(
        process.cwd(),
        "supabase/migrations/20260787000000_barn_guestbook_stamps.sql",
      ),
      "utf8",
    );
    expect(sql).toContain("FROM public.barn_visits bv");
    expect(sql).toContain("UNIQUE (visitor_id, host_id, visit_started_at)");
    expect(sql).toContain("WHERE s.host_id = caller_id");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).not.toMatch(
      /GRANT\s+(?:SELECT|INSERT|UPDATE|DELETE|ALL)[^;]*barn_guestbook_stamps[^;]*authenticated/i,
    );
    expect(sql).not.toMatch(
      /UPDATE public\.barn_visits|DELETE FROM public\.barn_visits/,
    );
  });

  it("unlocks an optional guestbook action without interrupting the first tickle", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "components/BarnVisitModal.tsx"),
      "utf8",
    );
    const tickleHandler = source.slice(
      source.indexOf("const tickle = async"),
      source.indexOf("const leaveGuestbookStamp"),
    );

    expect(tickleHandler).toContain("setStampOffered(true)");
    expect(tickleHandler).not.toContain("setStampOfferOpen(true)");
    expect(source).toContain('testID="visit-guestbook-open"');
    expect(source).toContain("Sign the guestbook");
  });
});
