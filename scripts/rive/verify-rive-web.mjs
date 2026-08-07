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
const approvedWebRuntime = "@rive-app/react-webgl2";
const nativeImportPattern = /(?:from\s*|require\()\s*["']rive-react-native["']/;

function collectSourceFiles(directory) {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) return collectSourceFiles(path);
		return entry.isFile() && /\.(?:js|mjs|ts|tsx)$/.test(path) ? [path] : [];
	});
}

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
	const packageJson = readFileSync(join(repoRoot, "package.json"), "utf8");
	if (!packageJson.includes(`"${approvedWebRuntime}"`)) {
		throw new Error(`package.json is missing approved web runtime ${approvedWebRuntime}.`);
	}

	const guardedRoots = ["app", "components", "hooks", "utils", "scripts/prototypes"]
		.map((path) => join(repoRoot, path))
		.filter(existsSync);
	for (const path of guardedRoots.flatMap(collectSourceFiles)) {
		const source = readFileSync(path, "utf8");
		if (source.includes(approvedWebRuntime) && !/\.web\.(?:ts|tsx|js)$/.test(path)) {
			throw new Error(`Approved web Rive runtime must stay in a .web boundary: ${path}.`);
		}
		if (
			nativeImportPattern.test(source) &&
			!/\.native\.(?:ts|tsx|js)$/.test(path) &&
			!path.endsWith("verify-rive-web.mjs")
		) {
			throw new Error(`Native Rive import or marker escaped a .native boundary: ${path}.`);
		}
	}

	const homegrownBoundaries = [
		"components/prototypes/homegrown-adventures/HomegrownRiveScene.web.tsx",
		"components/prototypes/homegrown-adventures/AdventureGlowrootRive.web.tsx",
	];
	for (const boundary of homegrownBoundaries) {
		const boundarySource = readFileSync(join(repoRoot, boundary), "utf8");
		if (!boundarySource.includes(approvedWebRuntime) || !boundarySource.includes("useRive")) {
			throw new Error(`Homegrown Adventures web boundary does not isolate the approved useRive runtime: ${boundary}`);
		}
	}
	const adventureGlowrootSource = readFileSync(join(repoRoot, homegrownBoundaries[1]), "utf8");
	if (
		!adventureGlowrootSource.includes("Glowroot Home Flourish") ||
		!adventureGlowrootSource.includes("data-rive-glowroot-motion")
	) {
		throw new Error("The Adventure Glowroot boundary is missing its authored flourish or observable motion state.");
	}

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
		`Rive web smoke passed: ${javaScriptFiles.length} Expo bundle(s), approved WebGL2 boundaries present, no native runtime leakage.`,
	);
} finally {
	rmSync(outputDirectory, { recursive: true, force: true });
}
