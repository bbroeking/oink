import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { QUALITY_CONFIG } from "./quality.config.mjs";

const EXCLUDED_DIRS = new Set(["dev", "prototypes", "tools"]);

function walkFiles(root, relative, accept) {
	const absolute = path.join(root, relative);
	if (!fs.existsSync(absolute)) return [];
	const files = [];
	for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
		const child = path.join(relative, entry.name);
		if (entry.isDirectory()) {
			if (!EXCLUDED_DIRS.has(entry.name)) {
				files.push(...walkFiles(root, child, accept));
			}
		} else if (entry.isFile() && accept(child)) {
			files.push(child);
		}
	}
	return files;
}

function matches(source, expression) {
	return source.match(expression)?.length ?? 0;
}

function productionTsxFiles(root) {
	return ["app", "components"].flatMap((directory) =>
		walkFiles(
			root,
			directory,
			(file) =>
				file.endsWith(".tsx") &&
				!file.toLowerCase().includes("prototype") &&
				!file.includes("Debug"),
		),
	);
}

export function inspectLayout(root) {
	const files = productionTsxFiles(root);
	const totals = {
		shrinkToFit: 0,
		sub11LiteralFonts: 0,
		textLineClamps: 0,
		rawModalUses: 0,
		dimensionsGetCalls: 0,
		adaptiveModalConsumers: 0,
		iconButtonConsumers: 0,
		segmentedControlConsumers: 0,
	};
	const evidence = {
		shrinkToFit: [],
		sub11LiteralFonts: [],
	};

	for (const file of files) {
		const source = fs.readFileSync(path.join(root, file), "utf8");
		const shrink = matches(
			source,
			/\b(?:adjustsFontSizeToFit|minimumFontScale)\b/g,
		);
		const sub11 = matches(
			source,
			/fontSize:\s*(?:[0-9](?:\.[0-9]+)?|10(?:\.[0-9]+)?)\b/g,
		);
		totals.shrinkToFit += shrink;
		totals.sub11LiteralFonts += sub11;
		totals.textLineClamps += matches(
			source,
			/numberOfLines=\{?\d+\}?/g,
		);
		totals.rawModalUses += matches(source, /<Modal\b/g);
		totals.dimensionsGetCalls += matches(source, /Dimensions\.get\(/g);
		if (
			file !== "components/ui/AdaptiveModalScaffold.tsx" &&
			/<AdaptiveModalScaffold\b/.test(source)
		) {
			totals.adaptiveModalConsumers += 1;
		}
		if (
			file !== "components/ui/IconButton.tsx" &&
			/<IconButton\b/.test(source)
		) {
			totals.iconButtonConsumers += 1;
		}
		if (
			file !== "components/ui/SegmentedControl.tsx" &&
			/<SegmentedControl\b/.test(source)
		) {
			totals.segmentedControlConsumers += 1;
		}
		if (shrink) evidence.shrinkToFit.push(file);
		if (sub11) evidence.sub11LiteralFonts.push(file);
	}

	return { totals, evidence, filesScanned: files.length };
}

function layoutFailures(result, config) {
	const { totals, evidence } = result;
	const failures = [];
	const max = (key, value, label, details = []) => {
		if (totals[key] > value) {
			failures.push(
				`${label}: ${totals[key]} exceeds budget ${value}${
					details.length ? ` (${details.join(", ")})` : ""
				}`,
			);
		}
	};
	const min = (key, value, label) => {
		if (totals[key] < value) {
			failures.push(
				`${label}: ${totals[key]} is below required coverage ${value}`,
			);
		}
	};

	max(
		"shrinkToFit",
		config.maxShrinkToFit,
		"shrink-to-fit text",
		evidence.shrinkToFit,
	);
	max(
		"sub11LiteralFonts",
		config.maxSub11LiteralFonts,
		"literal fonts below 11pt",
		evidence.sub11LiteralFonts,
	);
	max("textLineClamps", config.maxTextLineClamps, "text line clamps");
	max("rawModalUses", config.maxRawModalUses, "raw Modal uses");
	max("dimensionsGetCalls", config.maxDimensionsGetCalls, "Dimensions.get calls");
	min(
		"adaptiveModalConsumers",
		config.minAdaptiveModalConsumers,
		"AdaptiveModalScaffold consumers",
	);
	min(
		"iconButtonConsumers",
		config.minIconButtonConsumers,
		"IconButton consumers",
	);
	min(
		"segmentedControlConsumers",
		config.minSegmentedControlConsumers,
		"SegmentedControl consumers",
	);
	return failures;
}

function migrationFiles(root) {
	const directory = path.join(root, "supabase/migrations");
	if (!fs.existsSync(directory)) return [];
	return fs
		.readdirSync(directory)
		.filter((file) => file.endsWith(".sql"))
		.sort();
}

function functionBlocks(sql) {
	const starts = [
		...sql.matchAll(
			/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.([a-zA-Z0-9_]+)\s*\(/gi,
		),
	];
	return starts.map((match, index) => ({
		name: match[1],
		source: sql.slice(match.index, starts[index + 1]?.index ?? sql.length),
	}));
}

function hasFunctionRevoke(sql, name) {
	return new RegExp(
		`REVOKE[\\s\\S]{0,180}FUNCTION\\s+public\\.${name}\\s*\\(`,
		"i",
	).test(sql);
}

export function inspectSecurity(root, config = QUALITY_CONFIG.security) {
	const files = migrationFiles(root);
	const versions = new Map();
	const failures = [];
	const recent = [];

	for (const file of files) {
		const version = file.match(/^(\d{14})_[a-z0-9_]+\.sql$/)?.[1];
		if (!version) {
			failures.push(`invalid migration filename: ${file}`);
			continue;
		}
		if (versions.has(version)) {
			failures.push(
				`duplicate migration version ${version}: ${versions.get(version)}, ${file}`,
			);
		} else {
			versions.set(version, file);
		}
		if (version >= config.migrationFloor) {
			recent.push({
				file,
				sql: fs.readFileSync(
					path.join(root, "supabase/migrations", file),
					"utf8",
				),
			});
		}
	}

	const recentChain = recent.map(({ sql }) => sql).join("\n");
	let securityDefiners = 0;
	let unrevokedTriggerDefiners = 0;
	let createdTables = 0;

	for (const { file, sql } of recent) {
		if (/DISABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(sql)) {
			failures.push(`${file}: disables row-level security`);
		}
		for (const grant of sql.matchAll(
			/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.([a-zA-Z0-9_]+)\s*\([^;]*?\)\s+TO\s+([^;]+);/gi,
		)) {
			const [, name, roles] = grant;
			if (/\bPUBLIC\b/.test(roles)) {
				failures.push(`${file}: grants ${name} execution to PUBLIC`);
			}
			if (
				/\banon\b/i.test(roles) &&
				!config.allowedAnonFunctions.has(name)
			) {
				failures.push(`${file}: anon execution is not allowlisted for ${name}`);
			}
		}

		for (const table of sql.matchAll(
			/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.([a-zA-Z0-9_]+)/gi,
		)) {
			createdTables += 1;
			const name = table[1];
			const rls = new RegExp(
				`ALTER\\s+TABLE\\s+public\\.${name}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`,
				"i",
			);
			if (!rls.test(sql)) {
				failures.push(`${file}: new table ${name} does not enable RLS`);
			}
		}

		for (const block of functionBlocks(sql)) {
			if (!/SECURITY\s+DEFINER/i.test(block.source)) continue;
			securityDefiners += 1;
			if (!/SET\s+search_path\s*(?:=|TO)/i.test(block.source)) {
				failures.push(
					`${file}: SECURITY DEFINER ${block.name} has no fixed search_path`,
				);
			}
			const intentionallyAnon = config.allowedAnonFunctions.has(block.name);
			const revoked = hasFunctionRevoke(recentChain, block.name);
			const returnsTrigger = /RETURNS\s+trigger\b/i.test(block.source);
			if (!intentionallyAnon && !revoked) {
				if (returnsTrigger) {
					unrevokedTriggerDefiners += 1;
				} else {
					failures.push(
						`${file}: SECURITY DEFINER ${block.name} is not revoked from default roles`,
					);
				}
			}
		}
	}

	if (
		unrevokedTriggerDefiners >
		config.maxUnrevokedSecurityDefinerTriggers
	) {
		failures.push(
			`unrevoked SECURITY DEFINER triggers: ${unrevokedTriggerDefiners} exceeds budget ${config.maxUnrevokedSecurityDefinerTriggers}`,
		);
	}

	return {
		totals: {
			migrationsScanned: recent.length,
			createdTables,
			securityDefiners,
			unrevokedTriggerDefiners,
		},
		failures,
	};
}

export function evaluateContracts(root, scope = "all") {
	const sections = {};
	const failures = [];
	if (scope === "all" || scope === "layout") {
		const result = inspectLayout(root);
		const sectionFailures = layoutFailures(result, QUALITY_CONFIG.layout);
		sections.layout = { ...result, failures: sectionFailures };
		failures.push(...sectionFailures.map((failure) => `layout: ${failure}`));
	}
	if (scope === "all" || scope === "security") {
		const result = inspectSecurity(root);
		sections.security = result;
		failures.push(...result.failures.map((failure) => `security: ${failure}`));
	}
	return { ok: failures.length === 0, scope, sections, failures };
}

function printResult(result) {
	if (result.sections.layout) {
		const { totals, filesScanned } = result.sections.layout;
		console.log(
			`layout contracts: ${filesScanned} files; ${totals.rawModalUses} raw modals; ` +
				`${totals.textLineClamps} clamps; ${totals.dimensionsGetCalls} dimension snapshots`,
		);
	}
	if (result.sections.security) {
		const { totals } = result.sections.security;
		console.log(
			`security contracts: ${totals.migrationsScanned} recent migrations; ` +
				`${totals.createdTables} new tables; ${totals.securityDefiners} SECURITY DEFINER functions`,
		);
	}
	if (result.ok) {
		console.log("quality contracts: PASS");
		return;
	}
	for (const failure of result.failures) {
		console.error(`- ${failure}`);
	}
	console.error("quality contracts: FAIL");
}

const isMain =
	process.argv[1] &&
	pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
	const scopeArg = process.argv.indexOf("--scope");
	const scope = scopeArg >= 0 ? process.argv[scopeArg + 1] : "all";
	if (!["all", "layout", "security"].includes(scope)) {
		console.error(`invalid scope: ${scope}`);
		process.exit(2);
	}
	const result = evaluateContracts(process.cwd(), scope);
	printResult(result);
	if (!result.ok) process.exit(1);
}
