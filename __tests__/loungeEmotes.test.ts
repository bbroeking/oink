import fs from "node:fs";
import path from "node:path";

describe("Slop Club lounge emotes", () => {
	it("renders the sender's fresh selection above their own pig", () => {
		const source = fs.readFileSync(
			path.join(process.cwd(), "app/lounge.tsx"),
			"utf8",
		);

		expect(source).toMatch(/const myEmoteImage\s*=/);
		expect(source).toMatch(/image=\{myEmoteImage\}/);
		expect(source).toMatch(/x=\{bubbleX\}/);
		expect(source).toMatch(/y=\{bubbleY\}/);
	});
});
