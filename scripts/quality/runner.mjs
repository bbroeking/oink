import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
	DB_HARNESS_EXTRAS,
	LAYOUT_TESTS,
	SECURITY_TESTS,
} from "./quality.config.mjs";

function command(label, executable, args, options = {}) {
	return { label, executable, args, ...options };
}

function targetedJest(label, tests) {
	return command(label, "npx", [
		"jest",
		...tests,
		"--runInBand",
		"--watch=false",
	]);
}

export function buildGates({ scope, full }) {
	const gates = [];
	gates.push(
		command("quality contract tests", process.execPath, [
			"--test",
			"scripts/quality/contracts.test.mjs",
		]),
	);
	if (scope === "all" || scope === "layout") {
		gates.push(
			command("layout contracts", process.execPath, [
				"scripts/quality/contracts.mjs",
				"--scope",
				"layout",
			]),
			command("pig sprite integrity", "python3", [
				"scripts/verify-pig-sprites.py",
			]),
		);
	}
	if (scope === "all" || scope === "security") {
		gates.push(
			command("security contracts", process.execPath, [
				"scripts/quality/contracts.mjs",
				"--scope",
				"security",
			]),
		);
	}

	if (scope !== "security") {
		gates.push(command("TypeScript", "npx", ["tsc", "--noEmit"]));
	}

	if (full && scope === "all") {
		gates.push(
			command("full Jest suite", "npx", [
				"jest",
				"--runInBand",
				"--watch=false",
			]),
			command("production TypeScript lint", "npx", [
				"eslint",
				"app",
				"components",
				"constants",
				"hooks",
				"utils",
				"__tests__",
				"--ext",
				".ts,.tsx",
			]),
			command(
				"iOS Metro export",
				process.execPath,
				["scripts/quality/verify-ios-export.mjs"],
				{ env: { NODE_OPTIONS: "--max-old-space-size=16384" } },
			),
			command("database harness", "bash", [
				"scripts/db-harness/run.sh",
				...DB_HARNESS_EXTRAS,
			]),
			command("linked database lint", "npx", [
				"supabase",
				"db",
				"lint",
				"--linked",
				"--level",
				"error",
			]),
		);
	} else if (full && scope === "layout") {
		gates.push(
			targetedJest("layout Jest suite", LAYOUT_TESTS),
			command(
				"iOS Metro export",
				process.execPath,
				["scripts/quality/verify-ios-export.mjs"],
				{ env: { NODE_OPTIONS: "--max-old-space-size=16384" } },
			),
		);
	} else if (full && scope === "security") {
		gates.push(
			targetedJest("security Jest suite", SECURITY_TESTS),
			command("database harness", "bash", [
				"scripts/db-harness/run.sh",
				...DB_HARNESS_EXTRAS,
			]),
			command("linked database lint", "npx", [
				"supabase",
				"db",
				"lint",
				"--linked",
				"--level",
				"error",
			]),
		);
	} else {
		if (scope === "all" || scope === "layout") {
			gates.push(targetedJest("layout Jest suite", LAYOUT_TESTS));
		}
		if (scope === "all" || scope === "security") {
			gates.push(targetedJest("security Jest suite", SECURITY_TESTS));
		}
	}
	return gates;
}

function runCommand(gate, root) {
	const startedAt = Date.now();
	console.log(`\n▶ ${gate.label}`);
	return new Promise((resolve) => {
		const child = spawn(gate.executable, gate.args, {
			cwd: root,
			stdio: "inherit",
			env: { ...process.env, ...gate.env },
			shell: false,
		});
		child.on("error", (error) => {
			resolve({
				label: gate.label,
				ok: false,
				exitCode: null,
				durationMs: Date.now() - startedAt,
				error: error.message,
			});
		});
		child.on("exit", (code, signal) => {
			resolve({
				label: gate.label,
				ok: code === 0,
				exitCode: code,
				signal,
				durationMs: Date.now() - startedAt,
			});
		});
	});
}

function writeReport(root, report) {
	const directory = path.join(root, ".quality");
	fs.mkdirSync(directory, { recursive: true });
	fs.writeFileSync(
		path.join(directory, "last-run.json"),
		`${JSON.stringify(report, null, 2)}\n`,
	);
}

export async function runQualityCheck(root, options) {
	const startedAt = new Date();
	const results = [];
	for (const gate of buildGates(options)) {
		const result = await runCommand(gate, root);
		results.push(result);
		console.log(
			`${result.ok ? "✓" : "✗"} ${gate.label} (${(
				result.durationMs / 1000
			).toFixed(1)}s)`,
		);
		if (!result.ok) break;
	}
	const report = {
		ok: results.every((result) => result.ok),
		scope: options.scope,
		full: options.full,
		startedAt: startedAt.toISOString(),
		finishedAt: new Date().toISOString(),
		host: os.hostname(),
		results,
	};
	writeReport(root, report);
	console.log(
		`\n${report.ok ? "QUALITY PASS" : "QUALITY FAIL"} · report: .quality/last-run.json`,
	);
	return report;
}
