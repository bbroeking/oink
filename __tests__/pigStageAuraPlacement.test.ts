import { resolveSlot } from "../components/ui/PigStage";

describe("PigStage aura placement", () => {
	it("honors an aura RelSpec instead of forcing the category-sized box", () => {
		const slot = resolveSlot(
			{ id: "fire_aura", category: "aura", emoji: null },
			"idle",
			0,
			{
				fire_aura: {
					pivot: { x: 0.5, y: 0.5 },
					widthFrac: 1,
					anchor: "body",
					behind: true,
				},
			},
		);

		expect(slot?.overlay?.width).toBe(300);
		expect(slot?.overlay?.anchor).toBe("body");
		expect(slot?.overlay?.behind).toBe(true);
	});
});
