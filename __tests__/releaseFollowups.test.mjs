import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const script = new URL("../tools/release-followups.mjs", import.meta.url).pathname;

function fixture() {
	const directory = mkdtempSync(join(tmpdir(), "oink-release-followups-"));
	const file = join(directory, "queue.json");
	writeFileSync(file, '{"version":1,"updatedAt":null,"items":[]}\n');
	return file;
}

function run(file, ...args) {
	return execFileSync(process.execPath, [script, ...args], {
		env: { ...process.env, RELEASE_FOLLOWUPS_FILE: file },
		encoding: "utf8",
	});
}

test("queues, assigns, and releases a large-change follow-up", () => {
	const file = fixture();
	run(
		file,
		"enqueue",
		"--id",
		"large-change",
		"--title",
		"Check the large change",
		"--summary",
		"It changes production behavior.",
		"--checks",
		"Check one|Check two",
	);
	run(file, "include", "--id", "large-change", "--build", "200", "--version", "2.0");
	const output = run(file, "release", "--version", "2.0", "--no-notify");
	const queue = JSON.parse(readFileSync(file, "utf8"));

	assert.match(output, /RELEASE FOLLOW-UP: v2\.0 is live/);
	assert.deepEqual(queue.items[0].checks, ["Check one", "Check two"]);
	assert.equal(queue.items[0].status, "notified");
	assert.equal(queue.items[0].build, 200);
	assert.ok(queue.items[0].releasedAt);
	assert.ok(queue.items[0].notifiedAt);
});

test("rejects duplicate queue ids", () => {
	const file = fixture();
	const args = [
		"enqueue",
		"--id",
		"same-id",
		"--title",
		"Same",
		"--summary",
		"Same summary",
		"--checks",
		"Check",
	];
	run(file, ...args);
	assert.throws(() => run(file, ...args), /id already exists/);
});
