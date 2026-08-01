import fs from "fs";
import path from "path";
import { PIG_FRAMES, PIG_LOUNGE_FRAMES } from "../constants/pigFrames.generated";
import { PIG_IDS } from "../utils/pigs";

const ROOT = path.join(__dirname, "..", "assets", "images", "sprites");

function pngSize(file: string) {
	const header = fs.readFileSync(file).subarray(0, 24);
	return {
		width: header.readUInt32BE(16),
		height: header.readUInt32BE(20),
	};
}

function pngFiles(dir: string): string[] {
	return fs
		.readdirSync(dir, { withFileTypes: true })
		.flatMap((entry) =>
			entry.isDirectory()
				? pngFiles(path.join(dir, entry.name))
				: entry.name.endsWith(".png")
					? [path.join(dir, entry.name)]
					: []
		)
		.sort();
}

describe("baked pig animation packs", () => {
	const rosieFiles = pngFiles(path.join(ROOT, "rosie"));
	const relative = rosieFiles.map((file) => path.relative(path.join(ROOT, "rosie"), file));

	test("Rosie's production pack has the expected 54 frames", () => {
		expect(relative).toHaveLength(54);
	});

	test.each(PIG_IDS)("%s has every frame with Rosie's canvas dimensions", (pigId) => {
		const pigRoot = path.join(ROOT, pigId);
		const files = pngFiles(pigRoot);
		expect(files.map((file) => path.relative(pigRoot, file))).toEqual(relative);

		for (const frame of relative) {
			expect(pngSize(path.join(pigRoot, frame))).toEqual(
				pngSize(path.join(ROOT, "rosie", frame))
			);
		}
	});

	test.each(PIG_IDS)("%s has every frame statically registered with Expo", (pigId) => {
		const mainKeys = relative
			.filter((frame) => !frame.startsWith(`lounge${path.sep}`))
			.map((frame) => path.basename(frame, ".png"));
		const loungeKeys = relative
			.filter((frame) => frame.startsWith(`lounge${path.sep}`))
			.map((frame) => path.basename(frame, ".png"));

		expect(Object.keys(PIG_FRAMES[pigId]).sort()).toEqual(mainKeys.sort());
		expect(Object.keys(PIG_LOUNGE_FRAMES[pigId]).sort()).toEqual(loungeKeys.sort());
	});
});
