import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const output = fs.mkdtempSync(path.join(os.tmpdir(), "oink-quality-export-"));

function run() {
	return new Promise((resolve) => {
		const child = spawn(
			"npx",
			["expo", "export", "--platform", "ios", "--output-dir", output],
			{
				cwd: process.cwd(),
				stdio: "inherit",
				env: {
					...process.env,
					NODE_OPTIONS: "--max-old-space-size=16384",
				},
				shell: false,
			},
		);
		child.on("error", () => resolve(1));
		child.on("exit", (code) => resolve(code ?? 1));
	});
}

try {
	const code = await run();
	if (code !== 0) process.exitCode = code;
} finally {
	if (output.startsWith(`${os.tmpdir()}${path.sep}oink-quality-export-`)) {
		fs.rmSync(output, { recursive: true, force: true });
	}
}
