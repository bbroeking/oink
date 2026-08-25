import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "oink-ios-export-"));
const outputDir = path.join(temporaryRoot, "export");
const keep = process.argv.includes("--keep");

function runExport() {
	return new Promise((resolve, reject) => {
		const child = spawn(
			"npx",
			[
				"expo",
				"export",
				"--platform",
				"ios",
				"--output-dir",
				outputDir,
				"--source-maps",
			],
			{
				cwd: root,
				env: {
					...process.env,
					NODE_OPTIONS: "--max-old-space-size=16384",
				},
				stdio: ["ignore", "pipe", "pipe"],
			},
		);
		let output = "";
		child.stdout.on("data", (chunk) => (output += chunk));
		child.stderr.on("data", (chunk) => (output += chunk));
		child.on("error", reject);
		child.on("exit", (code, signal) => {
			if (code === 0) resolve(output);
			else reject(new Error(`Expo export failed (${signal ?? code})\n${output}`));
		});
	});
}

function filesUnder(directory) {
	if (!fs.existsSync(directory)) return [];
	return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const target = path.join(directory, entry.name);
		return entry.isDirectory() ? filesUnder(target) : [target];
	});
}

const startedAt = performance.now();
try {
	const output = await runExport();
	const files = filesUnder(outputDir);
	const assetFiles = filesUnder(path.join(outputDir, "assets"));
	const bundle = files.find((file) => file.endsWith(".hbc"));
	const sourceMap = files.find((file) => file.endsWith(".hbc.map"));
	const statSize = (file) => (file ? fs.statSync(file).size : 0);
	const sum = (targets) => targets.reduce((total, file) => total + statSize(file), 0);
	const bundled = output.match(/iOS Bundled\s+(\d+)ms[\s\S]*?\((\d+) modules\)/);

	console.log(
		JSON.stringify(
			{
				wallMs: Math.round(performance.now() - startedAt),
				metroBundleMs: bundled ? Number(bundled[1]) : null,
				modules: bundled ? Number(bundled[2]) : null,
				assetCount: assetFiles.length,
				assetBytes: sum(assetFiles),
				hermesBytes: statSize(bundle),
				sourceMapBytes: statSize(sourceMap),
				totalExportBytes: sum(files),
				outputDir: keep ? outputDir : undefined,
			},
			null,
			2,
		),
	);
} finally {
	if (!keep) fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
