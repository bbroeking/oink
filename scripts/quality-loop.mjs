#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { runQualityCheck } from "./quality/runner.mjs";

function parseArgs(argv) {
	const scopeAt = argv.indexOf("--scope");
	const scope = scopeAt >= 0 ? argv[scopeAt + 1] : "all";
	if (!["all", "layout", "security"].includes(scope)) {
		throw new Error(`invalid --scope ${scope}; expected all, layout, or security`);
	}
	return {
		once: argv.includes("--once"),
		full: argv.includes("--full"),
		scope,
	};
}

const options = parseArgs(process.argv.slice(2));
const root = process.cwd();

async function runOnce() {
	const report = await runQualityCheck(root, options);
	if (!report.ok) process.exitCode = 1;
	return report;
}

if (options.once) {
	await runOnce();
} else {
	console.log(
		`quality loop watching layout + security (${options.scope}, ${
			options.full ? "full" : "fast"
		})`,
	);
	console.log("Press Ctrl-C to stop.");

	let running = false;
	let rerun = false;
	let timer = null;

	const run = async () => {
		if (running) {
			rerun = true;
			return;
		}
		running = true;
		await runQualityCheck(root, options);
		running = false;
		if (rerun) {
			rerun = false;
			await run();
		}
	};

	const schedule = () => {
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => void run(), 350);
	};

	const watched = [
		"app",
		"components",
		"constants",
		"hooks",
		"utils",
		"supabase/migrations",
		"__tests__",
		"scripts/quality",
	].filter((relative) => fs.existsSync(path.join(root, relative)));

	const watchers = watched.map((relative) =>
		fs.watch(
			path.join(root, relative),
			{ recursive: true },
			(_event, filename) => {
				if (!filename) return;
				if (
					filename.includes("node_modules") ||
					filename.startsWith(".quality")
				) {
					return;
				}
				schedule();
			},
		),
	);

	const close = () => {
		for (const watcher of watchers) watcher.close();
		if (timer) clearTimeout(timer);
	};
	process.on("SIGINT", () => {
		close();
		process.exit(0);
	});
	process.on("SIGTERM", () => {
		close();
		process.exit(0);
	});

	await run();
}
