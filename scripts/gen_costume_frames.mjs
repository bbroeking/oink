#!/usr/bin/env node
// Costume skins (Halloween 2026): scan assets/images/sprites/costumes/ and emit
// constants/costumeFrames.generated.ts, the
//   costume hat id -> pig id -> { frameName: require(...) }
// map PigStage swaps in for the drawn pig's own frames.
//
// Where a skin lives: Rosie's at the costume folder's top level
// (`<slug>/<family>_<n>.png`), every other pig's in its own folder
// (`<slug>/<pig>/<family>_<n>.png`; pigs: bandit, biscuit, copper, pepper,
// pickles). Each (costume, pig) pair is judged on its own.
//
// A pair is emitted only when it is COMPLETE: all six families, four frames
// each (idle, happy, surprise front; face, face_sit, walk turned/side), so a
// costumed pig never falls back to its bare self mid-animation. Extra frames
// that follow the same `<family>_<n>.png` naming ride along. A costume is
// emitted when at least one pig has a complete pair. A pair missing here is
// not wearable on that pig in this binary (utils/costumeFit.ts): that pig
// keeps its ordinary outfit, never another pig's skin.
//
// Rerun at freeze, after the art lands; it is deterministic (sorted costumes,
// pigs in COSTUME_PIGS order, frames by family then number) and writes only
// when the text changes.
//
// Usage: node scripts/gen_costume_frames.mjs [--check] [--tracked]
//   --check exits 1 if the generated file is stale (for CI / pre-freeze).
//   --tracked counts only frames git tracks, so a manifest committed while
//     the art is still landing never requires a file that is not in the
//     commit (pass it to --check too when checking such a manifest).
//   Either way it prints the coverage: which pigs each costume fits, and every
//   started-but-incomplete pair with the frames it still lacks.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKINS_DIR = path.join(ROOT, "assets/images/sprites/costumes");
const OUT = path.join(ROOT, "constants/costumeFrames.generated.ts");

export const REQUIRED_FAMILIES = ["idle", "happy", "surprise", "face", "face_sit", "walk"];
export const FRAMES_PER_FAMILY = 4;
const FRAME_FILE = /^([a-z]+(?:_[a-z]+)*)_(\d+)\.png$/;

/** `hollow-jack` -> `halloween_2026_hollow_jack_costume` (the hats row id). */
export function costumeIdForSlug(slug) {
	return `halloween_2026_${slug.replace(/-/g, "_")}_costume`;
}

/** Frame names (sorted) a skin directory holds, from its file list. */
export function frameNamesFrom(files) {
	return files
		.map((file) => FRAME_FILE.exec(file))
		.filter(Boolean)
		.map((m) => ({ name: `${m[1]}_${Number(m[2])}`, family: m[1], n: Number(m[2]) }))
		.sort((a, b) => (a.family === b.family ? a.n - b.n : a.family < b.family ? -1 : 1))
		.map((f) => f.name);
}

/** The required frames a skin is missing (empty = complete). */
export function missingFrames(names) {
	const have = new Set(names);
	const missing = [];
	for (const family of REQUIRED_FAMILIES) {
		for (let n = 1; n <= FRAMES_PER_FAMILY; n += 1) {
			if (!have.has(`${family}_${n}`)) missing.push(`${family}_${n}`);
		}
	}
	return missing;
}

/** The pigs a skin can be drawn for, in emit order (Rosie first). */
export const COSTUME_PIGS = ["rosie", "bandit", "biscuit", "copper", "pepper", "pickles"];
/** Rosie's skin sits at the costume folder's top level. */
export const TOP_LEVEL_PIG = "rosie";

/** A pair's folder, relative to the skins dir: `<slug>` or `<slug>/<pig>`. */
export function pairDir(slug, pig) {
	return pig === TOP_LEVEL_PIG ? slug : `${slug}/${pig}`;
}

function frameFiles(absDir, include) {
	if (!fs.existsSync(absDir) || !fs.statSync(absDir).isDirectory()) return [];
	return fs
		.readdirSync(absDir)
		.filter(
			(file) =>
				FRAME_FILE.test(file) &&
				fs.statSync(path.join(absDir, file)).isFile() &&
				include(path.join(absDir, file)),
		);
}

/** Absolute paths git tracks under the skins dir (for --tracked). */
export function trackedFiles(dir = SKINS_DIR) {
	const out = execFileSync("git", ["ls-files", "-z", "--", path.relative(ROOT, dir)], { cwd: ROOT, encoding: "utf8" });
	return new Set(out.split("\0").filter(Boolean).map((rel) => path.join(ROOT, rel)));
}

/**
 * Every complete (costume, pig) pair, judged pair by pair:
 *   complete:   { costumeId: { slug, pigs: { pig: [{ name, file }] } } }
 *   incomplete: { "<slug>" | "<slug>/<pig>": missing frame names } for a pair
 *               with at least one frame but not the full set
 *   ignored:    folder names under a costume that are not a known pig
 * A pair with no frames at all is simply absent (not started). `include`
 * filters frame files by absolute path (the --tracked mode).
 */
export function scanSkins(dir = SKINS_DIR, { include = () => true } = {}) {
	const complete = {};
	const incomplete = {};
	const ignored = [];
	if (!fs.existsSync(dir)) return { complete, incomplete, ignored };
	for (const slug of fs.readdirSync(dir).sort()) {
		const skinDir = path.join(dir, slug);
		if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !fs.statSync(skinDir).isDirectory()) continue;
		for (const entry of fs.readdirSync(skinDir).sort()) {
			if (COSTUME_PIGS.includes(entry) && entry !== TOP_LEVEL_PIG) continue;
			if (fs.statSync(path.join(skinDir, entry)).isDirectory()) ignored.push(`${slug}/${entry}`);
		}
		const pigs = {};
		for (const pig of COSTUME_PIGS) {
			const rel = pairDir(slug, pig);
			const files = frameFiles(path.join(dir, rel), include);
			if (files.length === 0) continue;
			const names = frameNamesFrom(files);
			const missing = missingFrames(names);
			if (missing.length > 0) {
				incomplete[rel] = missing;
				continue;
			}
			const byName = new Map(
				files.map((file) => {
					const m = FRAME_FILE.exec(file);
					return [`${m[1]}_${Number(m[2])}`, file];
				}),
			);
			pigs[pig] = names.map((name) => ({ name, file: byName.get(name) }));
		}
		if (Object.keys(pigs).length > 0) complete[costumeIdForSlug(slug)] = { slug, pigs };
	}
	return { complete, incomplete, ignored };
}

export function render(complete) {
	const lines = [
		"/* eslint-disable @typescript-eslint/no-require-imports */",
		"// Generated by scripts/gen_costume_frames.mjs. Do not edit by hand.",
		"// Costume skins, costume id -> pig id -> frames: each pig wearing each full",
		"// costume, drawn on that pig's own canvas (same scale, camera and baseline),",
		"// swapped in for its frames by PigStage. Only complete pairs (idle, happy,",
		"// surprise, face, face_sit, walk; four frames each) are listed; a pair",
		"// missing here is not wearable on that pig in this binary.",
		"export const COSTUME_FRAMES: Readonly<",
		"\tRecord<string, Readonly<Record<string, Readonly<Record<string, number>>>>>",
		"> = {",
	];
	for (const id of Object.keys(complete).sort()) {
		const { slug, pigs } = complete[id];
		lines.push(`\t${id}: {`);
		for (const pig of COSTUME_PIGS) {
			const frames = pigs[pig];
			if (!frames) continue;
			lines.push(`\t\t${pig}: {`);
			for (const { name, file } of frames) {
				lines.push(`\t\t\t${name}: require("../assets/images/sprites/costumes/${pairDir(slug, pig)}/${file}"),`);
			}
			lines.push("\t\t},");
		}
		lines.push("\t},");
	}
	lines.push("};", "");
	return lines.join("\n");
}

/** One line per costume: the pigs it fits, `-` for a pig it does not. */
export function coverageReport(complete) {
	const ids = Object.keys(complete).sort();
	const lines = [];
	for (const pig of COSTUME_PIGS) {
		const n = ids.filter((id) => complete[id].pigs[pig]).length;
		lines.push(`  ${pig.padEnd(8)} ${n}/${ids.length}`);
	}
	return lines;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
	const tracked = process.argv.includes("--tracked") ? trackedFiles() : null;
	const { complete, incomplete, ignored } = scanSkins(SKINS_DIR, tracked ? { include: (file) => tracked.has(file) } : {});
	const text = render(complete);
	const check = process.argv.includes("--check");
	const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
	const ids = Object.keys(complete);
	const pairs = ids.reduce((n, id) => n + Object.keys(complete[id].pigs).length, 0);
	console.log(`costume skins emitted: ${ids.length} costumes, ${pairs} (costume, pig) pairs`);
	for (const line of coverageReport(complete)) console.log(line);
	for (const [rel, missing] of Object.entries(incomplete)) {
		console.log(`  skipped ${rel}: missing ${missing.length} (${missing.slice(0, 6).join(", ")}${missing.length > 6 ? ", ..." : ""})`);
	}
	for (const rel of ignored) console.log(`  ignored ${rel}: not a pig folder`);
	if (check) {
		if (current !== text) {
			console.error("constants/costumeFrames.generated.ts is stale; run node scripts/gen_costume_frames.mjs");
			process.exit(1);
		}
	} else if (current !== text) {
		fs.writeFileSync(OUT, text);
	}
}
