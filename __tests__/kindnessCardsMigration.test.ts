import fs from "node:fs";
import path from "node:path";

const sql = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260790000000_barn_kindness_cards.sql",
  ),
  "utf8",
);

describe("Barn kindness cards migration", () => {
  it("anchors a card to one visit stamp and one real blessing", () => {
    expect(sql).toContain(
      "ADD COLUMN blessing_id uuid REFERENCES public.blessings(id)",
    );
    expect(sql).toContain("UNIQUE (blessing_id)");
    expect(sql).toContain("FROM public.barn_guestbook_stamps s");
    expect(sql).toContain("s.visit_started_at");
  });

  it("delegates casting to the existing server-authoritative ritual", () => {
    expect(sql).toContain(
      "blessing_result := public.send_blessing(p_host)",
    );
    expect(sql).toContain("blessing_result->>'blessing_id'");
    expect(sql).not.toMatch(/INSERT INTO public\.blessings/i);
  });

  it("offers only an eligible, unblessed completed visit", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.barn_kindness_card_status");
    expect(sql).toContain("s.blessing_id IS NULL");
    expect(sql).toContain("JOIN public.barn_visits bv");
    expect(sql).toContain("bv.visit_started_at = s.visit_started_at");
    expect(sql).toContain("b.sent_on = (now() AT TIME ZONE 'UTC')::date");
  });

  it("returns the blessing on the existing owner-only guestbook read model", () => {
    expect(sql).toContain("'blessing_kind', b.kind");
    expect(sql).toContain("'blessing_sent_at', b.sent_at");
    expect(sql).toContain("WHERE s.host_id = caller_id");
  });

  it("exposes only constrained RPCs to authenticated players", () => {
    expect(sql).toContain(
      "GRANT EXECUTE ON FUNCTION public.barn_kindness_card_status(uuid) TO authenticated",
    );
    expect(sql).toContain(
      "GRANT EXECUTE ON FUNCTION public.leave_barn_kindness_card(uuid) TO authenticated",
    );
    expect(sql).not.toMatch(
      /GRANT\s+(?:INSERT|UPDATE|DELETE|ALL)[^;]*barn_guestbook_stamps[^;]*authenticated/i,
    );
  });
});
