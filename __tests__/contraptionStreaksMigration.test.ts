import fs from "node:fs";
import path from "node:path";

const sql = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260829000000_contraptions_and_streaks.sql",
  ),
  "utf8",
);

describe("personal and Visit Streak migration", () => {
  it("credits personal Streak only from the manual Home tickle wrapper", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public._apply_manual_streak_bump");
    expect(sql).toContain("now() < last_credit + interval '24 hours'");
    expect(sql).toContain("now() <= last_credit + interval '36 hours'");
    const manualWrapper = sql.slice(
      sql.indexOf("CREATE OR REPLACE FUNCTION public.update_profile_and_item_count(uid uuid)"),
      sql.indexOf("ALTER FUNCTION public.home_stats()"),
    );
    expect(manualWrapper).toContain("auth.uid() <> uid");
    expect(manualWrapper).toContain("public._apply_manual_streak_bump(uid)");
  });

  it("keeps the visible count growing while capping only the regen benefit", () => {
    expect(sql).toContain("current_streak = new_value");
    expect(sql).toContain("WHEN p_streak >= 30 THEN 0.75");
    expect(sql).toContain("(p_streak - 1) * (0.25 / 29.0)");
  });

  it("uses one unordered shared Visit Streak for either visit direction", () => {
    expect(sql).toContain("PRIMARY KEY (user_low, user_high)");
    expect(sql).toContain("low_id := LEAST(p_user_a, p_user_b)");
    expect(sql).toContain("high_id := GREATEST(p_user_a, p_user_b)");
    expect(sql).toContain("public.are_friends(p_user_a, p_user_b)");
    expect(sql).toContain("AFTER INSERT ON public.barn_visits");
    expect(sql).toContain("COALESCE(NEW.visit_started_at, NEW.created_at)");
  });

  it("prevents same-day double credit and banks the longest flame", () => {
    expect(sql).toContain(
      "p_visited_at < streak_row.last_credit_at + interval '24 hours'",
    );
    expect(sql).toContain("GREATEST(longest_streak, new_value)");
    expect(sql).toContain("friend_visit_streaks(p_targets uuid[])");
  });
});
