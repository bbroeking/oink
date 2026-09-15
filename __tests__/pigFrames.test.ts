import fs from "fs";
import path from "path";
import { PIG_FRAMES, PIG_LOUNGE_FRAMES } from "../constants/pigFrames.generated";
import { PIG_FRAMES_EXTRA } from "../constants/pigFramesExtra";
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

	// 32 main frames (eight families × 4) + 8 more idle frames + 22 lounge frames
	// + 8 turned frames (face / face_sit, 2026-09-15).
	test("Rosie's production pack has the expected 70 frames", () => {
		expect(relative).toHaveLength(70);
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

		// The generated map carries the four-frame rig; the twelve-frame idle's
		// extra frames are registered beside it in pigFramesExtra.
		const registered = { ...PIG_FRAMES[pigId], ...PIG_FRAMES_EXTRA[pigId] };
		expect(Object.keys(registered).sort()).toEqual(mainKeys.sort());
		expect(Object.keys(PIG_LOUNGE_FRAMES[pigId]).sort()).toEqual(loungeKeys.sort());
	});
});
