#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const queuePath = resolve(
	process.env.RELEASE_FOLLOWUPS_FILE ?? "docs/release-followups.json",
);

function fail(message) {
	console.error(`release-followups: ${message}`);
	process.exit(1);
}

function readQueue() {
	let queue;
	try {
		queue = JSON.parse(readFileSync(queuePath, "utf8"));
	} catch (error) {
		fail(`cannot read ${queuePath}: ${error.message}`);
	}
	validateQueue(queue);
	return queue;
}

function validateQueue(queue) {
	if (queue?.version !== 1 || !Array.isArray(queue.items)) {
		fail("queue must have version 1 and an items array");
	}
	const ids = new Set();
	for (const item of queue.items) {
		if (!item.id || !item.title || !item.summary || !Array.isArray(item.checks)) {
			fail("every item needs id, title, summary, and checks");
		}
		if (ids.has(item.id)) fail(`duplicate id: ${item.id}`);
		ids.add(item.id);
		if (!["queued", "included", "notified"].includes(item.status)) {
			fail(`invalid status for ${item.id}: ${item.status}`);
		}
		if (item.status !== "queued" && (!item.build || !item.releaseVersion)) {
			fail(`${item.id} is ${item.status} but has no build/releaseVersion`);
		}
	}
}

function writeQueue(queue) {
	queue.updatedAt = new Date().toISOString();
	writeFileSync(queuePath, `${JSON.stringify(queue, null, 2)}\n`);
}

function options(args) {
	const parsed = { _: [] };
	for (let index = 0; index < args.length; index += 1) {
		const token = args[index];
		if (!token.startsWith("--")) {
			parsed._.push(token);
			continue;
		}
		const key = token.slice(2);
		if (key === "no-notify") {
			parsed[key] = true;
			continue;
		}
		const value = args[index + 1];
		if (!value || value.startsWith("--")) fail(`missing value for --${key}`);
		parsed[key] = value;
		index += 1;
	}
	return parsed;
}

function requireOption(parsed, key) {
	if (!parsed[key]) fail(`--${key} is required`);
	return parsed[key];
}

function notify(title, message, disabled) {
	if (disabled || process.platform !== "darwin") return;
	try {
		execFileSync("osascript", [
			"-e",
			"on run argv",
			"-e",
			"display notification (item 2 of argv) with title (item 1 of argv)",
			"-e",
			"end run",
			title,
			message,
		]);
	} catch (error) {
		console.warn(`release-followups: notification failed: ${error.message}`);
	}
}

function printItems(items) {
	if (items.length === 0) {
		console.log("No release follow-ups.");
		return;
	}
	for (const item of items) {
		const release = item.build
			? `build ${item.build} / v${item.releaseVersion}`
			: "not yet assigned to a build";
		console.log(`[${item.status}] ${item.id}: ${item.title} (${release})`);
	}
}

const [command = "list", ...rest] = process.argv.slice(2);
const parsed = options(rest);
const queue = readQueue();

switch (command) {
	case "check":
		console.log(`Release follow-up queue is valid (${queue.items.length} items).`);
		break;

	case "list": {
		const items = parsed.status
			? queue.items.filter((item) => item.status === parsed.status)
			: queue.items;
		printItems(items);
		break;
	}

	case "enqueue": {
		const id = requireOption(parsed, "id");
		if (queue.items.some((item) => item.id === id)) fail(`id already exists: ${id}`);
		const now = new Date().toISOString();
		queue.items.push({
			id,
			title: requireOption(parsed, "title"),
			summary: requireOption(parsed, "summary"),
			owner: parsed.owner ?? "Brian",
			checks: requireOption(parsed, "checks")
				.split("|")
				.map((check) => check.trim())
				.filter(Boolean),
			status: "queued",
			queuedAt: now,
			build: null,
			releaseVersion: null,
			releasedAt: null,
			notifiedAt: null,
		});
		writeQueue(queue);
		console.log(`Queued ${id}.`);
		break;
	}

	case "include": {
		const id = requireOption(parsed, "id");
		const item = queue.items.find((candidate) => candidate.id === id);
		if (!item) fail(`unknown id: ${id}`);
		item.build = Number(requireOption(parsed, "build"));
		if (!Number.isInteger(item.build) || item.build <= 0) fail("build must be positive");
		item.releaseVersion = requireOption(parsed, "version");
		item.status = "included";
		writeQueue(queue);
		console.log(`Included ${id} in build ${item.build} / v${item.releaseVersion}.`);
		break;
	}

	case "release": {
		const releaseVersion = requireOption(parsed, "version");
		const matches = queue.items.filter(
			(item) => item.status === "included" && item.releaseVersion === releaseVersion,
		);
		if (matches.length === 0) fail(`no included items for v${releaseVersion}`);
		const now = parsed.at ?? new Date().toISOString();
		for (const item of matches) {
			item.status = "notified";
			item.releasedAt = now;
			item.notifiedAt = new Date().toISOString();
		}
		writeQueue(queue);
		const titles = matches.map((item) => item.title).join("; ");
		notify(
			`Tickle the Pig v${releaseVersion} is live`,
			`Post-release checks are ready: ${titles}`,
			parsed["no-notify"],
		);
		console.log(`RELEASE FOLLOW-UP: v${releaseVersion} is live.`);
		for (const item of matches) {
			console.log(`\n${item.title}`);
			for (const check of item.checks) console.log(`  - ${check}`);
		}
		break;
	}

	default:
		fail(`unknown command: ${command}`);
}
