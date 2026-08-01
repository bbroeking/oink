import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const SOURCE_ROOTS = ["app", "components"];
const NATIVE_RIVE_IMPORT =
	/(?:from\s+|require\(\s*)["']rive-react-native["']/;

function sourceFiles(directory: string): string[] {
	return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const absolute = path.join(directory, entry.name);
		if (entry.isDirectory()) return sourceFiles(absolute);
		return /\.[jt]sx?$/.test(entry.name) ? [absolute] : [];
	});
}

describe("Rive web boundary", () => {
	it("keeps the native runtime inside platform-native modules", () => {
		const offenders = SOURCE_ROOTS.flatMap((directory) =>
			sourceFiles(path.join(ROOT, directory)),
		)
			.filter((file) => !file.endsWith(".native.tsx"))
			.filter((file) => NATIVE_RIVE_IMPORT.test(fs.readFileSync(file, "utf8")))
			.map((file) => path.relative(ROOT, file));

		expect(offenders).toEqual([]);
	});

	it("provides explicit native and web adapters for both Rive entry points", () => {
		expect(
			[
				"components/ui/RivePig.native.tsx",
				"components/ui/RivePig.web.tsx",
				"components/prototypes/RiveRuntimeProbe.native.tsx",
				"components/prototypes/RiveRuntimeProbe.web.tsx",
			].filter((file) => !fs.existsSync(path.join(ROOT, file))),
		).toEqual([]);
	});
});
