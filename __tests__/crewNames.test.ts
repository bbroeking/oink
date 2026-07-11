// randomCrewName — always within the server's 24-char crew-name cap, and
// varied enough that the reroll affordance actually changes the name.

import { randomCrewName } from "../utils/crewNames";

describe("randomCrewName", () => {
	it("every generated name is 1..24 chars", () => {
		for (let i = 0; i < 200; i++) {
			const n = randomCrewName();
			expect(n.length).toBeGreaterThanOrEqual(1);
			expect(n.length).toBeLessThanOrEqual(24);
		}
	});

	it("produces at least 2 distinct names over 50 draws", () => {
		const seen = new Set<string>();
		for (let i = 0; i < 50; i++) seen.add(randomCrewName());
		expect(seen.size).toBeGreaterThanOrEqual(2);
	});
});
