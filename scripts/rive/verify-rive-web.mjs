import {
	existsSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, URL } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const outputDirectory = mkdtempSync(join(tmpdir(), "oink-rive-web-smoke-"));
const forbiddenRuntimeMarkers = ["rive-react-native", "RiveReactNativeView"];

function collectJavaScriptFiles(directory) {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);

		if (entry.isDirectory()) {
			return collectJavaScriptFiles(path);
		}

		return entry.isFile() && path.endsWith(".js") ? [path] : [];
	});
}

try {
	const result = spawnSync(
		process.platform === "win32" ? "npx.cmd" : "npx",
		["expo", "export", "--platform", "web", "--output-dir", outputDirectory],
		{
			cwd: repoRoot,
			encoding: "utf8",
			env: {
				...process.env,
				NODE_OPTIONS: "--max-old-space-size=16384",
			},
			maxBuffer: 20 * 1024 * 1024,
		},
	);

	if (result.status !== 0) {
		process.stderr.write(result.stdout);
		process.stderr.write(result.stderr);
		throw new Error(`Expo web export failed with status ${result.status ?? "unknown"}.`);
	}

	const indexPath = join(outputDirectory, "index.html");
	if (!existsSync(indexPath)) {
		throw new Error("Expo web export did not produce index.html.");
	}

	const javaScriptFiles = collectJavaScriptFiles(outputDirectory);
	if (javaScriptFiles.length === 0) {
		throw new Error("Expo web export did not produce a JavaScript bundle.");
	}

	for (const path of javaScriptFiles) {
		const bundle = readFileSync(path, "utf8");
		const forbiddenMarker = forbiddenRuntimeMarkers.find((marker) =>
			bundle.includes(marker),
		);

		if (forbiddenMarker) {
			throw new Error(
				`Web bundle contains native-only Rive marker "${forbiddenMarker}" in ${path}.`,
			);
		}
	}

	console.log(
		`Rive web smoke passed: ${javaScriptFiles.length} bundle(s), no native runtime leakage.`,
	);
} finally {
	rmSync(outputDirectory, { recursive: true, force: true });
}
