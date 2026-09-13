import fs from "node:fs";
import path from "node:path";

const walletSql = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260813010000_mote_machine.sql",
  ),
  "utf8",
);
const contraptionSql = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260829000000_contraptions_and_streaks.sql",
  ),
  "utf8",
);

describe("Mote Machine and Contraption migrations", () => {
  it("keeps shimmer crediting and the real Mote wallet", () => {
    expect(walletSql).toContain("ADD COLUMN IF NOT EXISTS mote_balance");
    expect(walletSql).toContain("OLD.submitted_at IS NULL");
    expect(walletSql).toContain("NEW.submitted_at IS NOT NULL");
    expect(walletSql).toContain("SET mote_balance = mote_balance + 1");
  });

  it("replaces alchemy input with one idempotent server-authored result", () => {
    expect(contraptionSql).toContain(
      "CREATE OR REPLACE FUNCTION public.spin_mote_machine(p_request_id text)",
    );
    expect(contraptionSql).toContain("FOR UPDATE");
    expect(contraptionSql).toContain("SET mote_balance = mote_balance - 1");
    expect(contraptionSql).toContain(
      "ON CONFLICT (user_id, contraption_id) DO UPDATE",
    );
    expect(contraptionSql).toContain("reward_amount := CASE");
    expect(contraptionSql).toContain("WHEN draw < 0.50 THEN 1");
    expect(contraptionSql).toContain("ELSE 5");
    expect(contraptionSql).not.toContain("p_warmth int");
    expect(contraptionSql).not.toContain("zero_weight");
    expect(contraptionSql).toContain("DROP COLUMN IF EXISTS warmth");
    expect(contraptionSql).toContain("ADD COLUMN IF NOT EXISTS contraption_id");
    expect(contraptionSql).not.toContain(
      "user_id, request_id, warmth, whirl, resonance, reward_tickles",
    );
  });

  it("gives each stored helper its own resource and timed activation", () => {
    expect(contraptionSql).toContain("resource_id text NOT NULL UNIQUE");
    expect(contraptionSql).toContain("resource_balance int NOT NULL DEFAULT 0");
    expect(contraptionSql).toContain("p_duration = 'day'");
    expect(contraptionSql).toContain("p_duration = 'week'");
    expect(contraptionSql).toContain("interval '1 day'");
    expect(contraptionSql).toContain("interval '7 days'");
  });

  it("keeps Auto-Tickler at cap minus five and out of manual Streak", () => {
    expect(contraptionSql).toContain("reserve_val := GREATEST(0, cap_val - 5)");
    expect(contraptionSql).toContain("tickles_earned = tickles_earned + spent");
    expect(contraptionSql).toContain("counter = counter + spent");
    const autoSection = contraptionSql.slice(
      contraptionSql.indexOf(
        "CREATE OR REPLACE FUNCTION public._process_auto_tickler_user",
      ),
      contraptionSql.indexOf(
        "CREATE OR REPLACE FUNCTION public.sweep_auto_ticklers",
      ),
    );
    expect(autoSection).not.toContain("_apply_manual_streak_bump");
    expect(contraptionSql).toContain("'contraption-auto-tickler'");
  });

  it("exposes mutations only through authenticated RPCs", () => {
    expect(contraptionSql).toContain(
      "GRANT EXECUTE ON FUNCTION public.spin_mote_machine(text) TO authenticated",
    );
    expect(contraptionSql).toContain(
      "GRANT EXECUTE ON FUNCTION public.activate_contraption(text, text) TO authenticated",
    );
    expect(contraptionSql).toContain(
      "REVOKE ALL ON FUNCTION public._process_auto_tickler_user(uuid)",
    );
  });
});
