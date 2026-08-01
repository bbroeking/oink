import fs from "node:fs";
import path from "node:path";

const migrationPath = path.join(
	process.cwd(),
	"supabase/migrations/20260786000000_interaction_analytics.sql"
);

describe("interaction analytics migration", () => {
	const sql = fs.readFileSync(migrationPath, "utf8");

	it("keeps raw analytics private and exposes only the validated write RPC", () => {
		expect(sql).toContain(
			"REVOKE ALL ON TABLE public.interaction_analytics_events FROM PUBLIC, anon, authenticated"
		);
		expect(sql).toContain("ALTER TABLE public.interaction_analytics_events ENABLE ROW LEVEL SECURITY");
		expect(sql).toMatch(
			/GRANT EXECUTE ON FUNCTION public\.record_interaction_event\([\s\S]*?\) TO authenticated;/
		);
		expect(sql).not.toMatch(
			/GRANT\s+SELECT\s+ON\s+(?:TABLE\s+)?public\.interaction_analytics_events/i
		);
	});

	it("uses the authenticated caller and server clock rather than client identity/time", () => {
		expect(sql).toContain("caller_id uuid := auth.uid()");
		expect(sql).toContain("occurred_at timestamptz NOT NULL DEFAULT now()");
		expect(sql).not.toMatch(/p_user_id|p_occurred_at/);
	});

	it("allow-lists events, properties, and aggregate-only dashboard metrics", () => {
		expect(sql).toContain("('barn_opened', 'barn')");
		expect(sql).toContain("('visit_stamp_left', 'visit')");
		expect(sql).toContain(
			"WHERE key NOT IN ('count', 'is_member', 'item_kind', 'share_method', 'source', 'variant')"
		);
		expect(sql).toContain("CREATE OR REPLACE FUNCTION public.analytics_interaction_overview");
		expect(sql).toContain("'conversion_pct'");
		expect(sql).toContain("repeat_7d_pct");
		expect(sql).toContain("actor_return_7d_pct");
		expect(sql).toContain("occurred_at < now() - interval '180 days'");
		expect(sql).toContain(
			"GRANT EXECUTE ON FUNCTION public.analytics_interaction_overview(integer) TO authenticated"
		);
		expect(sql).not.toMatch(
			/GRANT EXECUTE ON FUNCTION public\.analytics_interaction_overview\(integer\) TO[^;]*anon/
		);
	});
});
