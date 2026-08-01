import fs from "node:fs";
import path from "node:path";
import { groupPorchPages, parsePorchStops } from "@/utils/porchRound";

describe("Porch Round", () => {
	it("parses safe stops and groups permanent three-pig pages", () => {
		const stops = parsePorchStops([
			{
				id: 1,
				page_number: 1,
				stop_number: 1,
				target_user_id: "pig-a",
				target_name: " Rosie ",
				visited_at: "2026-07-25T10:00:00Z",
				active_hat_id: "sun_hat",
				wallow_count: 2,
			},
			{
				id: 2,
				page_number: 1,
				stop_number: 2,
				target_user_id: "pig-b",
				target_name: "",
				visited_at: "2026-07-25T11:00:00Z",
			},
			{ id: "bad" },
		]);
		expect(stops).toHaveLength(2);
		expect(stops[0]).toMatchObject({ targetName: "Rosie", activeHatId: "sun_hat" });
		expect(stops[1]).toMatchObject({ targetName: "A friendly pig", wallowCount: 0 });
		expect(groupPorchPages(stops)).toEqual([
			expect.objectContaining({ pageNumber: 1, complete: false, stops }),
		]);
	});

	it("marks exactly three stops complete and orders newest pages first", () => {
		const make = (id: number, pageNumber: number, stopNumber: number) => ({
			id,
			pageNumber,
			stopNumber,
			targetUserId: `pig-${id}`,
			targetName: `Pig ${id}`,
			visitedAt: "2026-07-25T10:00:00Z",
			activeHatId: null,
			wallowCount: 0,
		});
		const pages = groupPorchPages([
			make(1, 1, 1), make(2, 1, 2), make(3, 1, 3), make(4, 2, 1),
		]);
		expect(pages.map((p) => [p.pageNumber, p.complete])).toEqual([
			[2, false],
			[1, true],
		]);
	});

	it("keeps the scrapbook additive, visit-backed, private, and reward-free", () => {
		const sql = fs.readFileSync(
			path.join(process.cwd(), "supabase/migrations/20260789000000_porch_round_scrapbook.sql"),
			"utf8",
		);
		expect(sql).toContain("FROM public.barn_visits bv");
		expect(sql).toContain("UNIQUE (visitor_id, target_id, visit_started_at)");
		expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
		expect(sql).not.toMatch(/expires_at|DELETE FROM public\\.porch_round_stops/);
		expect(sql).not.toMatch(/UPDATE public\\.profiles|INSERT INTO public\\.user_hats/);
		expect(sql).not.toMatch(
			/GRANT\s+(?:SELECT|INSERT|UPDATE|DELETE|ALL)[^;]*porch_round_stops[^;]*authenticated/i,
		);
	});
});
