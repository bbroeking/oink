#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "../..");
const preview = path.join(root, "artifacts/accessory-attachment-preview");
const command = process.argv[2] ?? "help";
const rest = process.argv.slice(3);

function run(bin, args) {
	const result = spawnSync(bin, args, { cwd: root, stdio: "inherit" });
	if (result.error) throw result.error;
	if (result.status !== 0) process.exit(result.status ?? 1);
}

function exportPlacements() {
	run(process.execPath, ["scripts/accessory-audit/export.mjs"]);
}

switch (command) {
	case "studio": run("python3", ["tools/placement_studio.py", ...rest]); break;
	case "calibrate": run("python3", ["scripts/accessory-audit/measure-heads.py", ...rest]); break;
	case "export": run(process.execPath, ["scripts/accessory-audit/export.mjs", ...rest]); break;
	case "sheets":
		exportPlacements();
		run("python3", ["scripts/accessory-audit/render.py", "--all-hats", ...rest]);
		break;
	case "build":
		exportPlacements();
		run(process.execPath, ["scripts/accessory-audit/build-preview.mjs"]);
		break;
	case "serve": {
		const port = rest[0] ?? "4176";
		if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
			console.error(`Invalid port: ${port}. Expected an integer from 1 to 65535.`);
			process.exit(2);
		}
		if (!fs.existsSync(path.join(preview, "index.html"))) {
			console.error("Preview is not built. Run `npm run accessory:preview:build` first.");
			process.exit(1);
		}
		run("python3", ["-m", "http.server", port, "--bind", "127.0.0.1", "--directory", preview]);
		break;
	}
	case "validate":
		run("python3", ["-c", "import PIL,numpy"]);
		exportPlacements();
		run("python3", ["scripts/accessory-audit/render.py", "--items", "astronaut", "--pigs", "rosie"]);
		run(process.execPath, ["scripts/accessory-audit/build-preview.mjs"]);
		run("npm", ["test", "--", "--runInBand", "--watchman=false", "__tests__/pigAttachmentGeometry.test.ts"]);
		break;
	case "help":
		console.log(`Accessory placement tools\n\nCommands:\n  studio       Run the official authoring server at http://127.0.0.1:8124\n  calibrate    Regenerate measured per-pig crown attachment data\n  export       Export the current production resolver to audit JSON\n  sheets       Export, then render all 48-frame item/pig contact sheets\n  build        Export and build the 300px playback preview\n  serve [port] Serve an existing preview (default 4176)\n  validate     Check dependencies, export/render/build, and run geometry tests`);
		break;
	default:
		console.error(`Unknown accessory command: ${command}. Run with \`help\` for available commands.`);
		process.exit(2);
}
