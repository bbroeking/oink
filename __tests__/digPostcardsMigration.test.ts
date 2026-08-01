import fs from "fs";
import path from "path";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260788000000_dig_postcards.sql",
  ),
  "utf8",
);

describe("dig postcards migration", () => {
  it("keeps artifacts durable and mutations RPC-only", () => {
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS public.dig_postcards",
    );
    expect(migration).toContain(
      "ALTER TABLE public.dig_postcards ENABLE ROW LEVEL SECURITY",
    );
    expect(migration).not.toMatch(
      /CREATE POLICY[\s\S]*FOR (?:INSERT|UPDATE|DELETE)/,
    );
    expect(migration).not.toMatch(/DELETE FROM public\.dig_postcards/);
  });

  it("verifies a submitted rooting and accepted friendship before creation", () => {
    expect(migration).toContain("r.submitted_at IS NOT NULL");
    expect(migration).toContain("f.status = 'accepted'");
    expect(migration).toContain(
      "CONSTRAINT dig_postcards_one_per_dig UNIQUE (sender_id, feeding_number)",
    );
  });

  it("allows only the recipient to leave the one non-economic cheer", () => {
    expect(migration).toContain("AND recipient_id = auth.uid()");
    expect(migration).toContain("AND cheered_at IS NULL");
    expect(migration).not.toMatch(/tickles|truffles_minted|mint_truffles/i);
  });

  it("honors blocks across direct reads and every postcard RPC", () => {
    expect(migration).toContain(
      "AND NOT public.are_blocked(sender_id, recipient_id)",
    );
    expect(migration).toContain(
      "IF public.are_blocked(caller_id, p_recipient_id) THEN",
    );
    expect(
      migration.match(
        /NOT public\.are_blocked\((?:d\.)?sender_id, (?:d\.)?recipient_id\)/g,
      ),
    ).toHaveLength(5);
  });

  it("exposes all four RPCs only to authenticated players", () => {
    for (const fn of [
      "create_dig_postcard",
      "my_dig_postcards",
      "open_dig_postcards",
      "cheer_dig_postcard",
    ]) {
      expect(migration).toContain(`GRANT EXECUTE ON FUNCTION public.${fn}(`);
    }
  });
});
