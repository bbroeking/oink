#!/usr/bin/env node
// Design-system conformance scorecard (docs/design/design-system-spec.md §4).
//
// Runs ESLint over app/ + components/ + features/, counts the eslint-plugin-ttp
// warnings per file, groups them by the 2026-09 audit areas, and writes
// docs/design/audit-2026-09/02-conformance-scorecard.md. A file is conformant
// when every count is 0 (and its lint has been flipped to error).
//
//   npm run scorecard            → rewrite the markdown + print area totals
//   npm run scorecard -- --json  → print the per-file counts as JSON instead

import { execFileSync } from "node:child_process";
import { readdirSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = join(ROOT, "docs/design/audit-2026-09/02-conformance-scorecard.md");

const RULES = [
  ["no-raw-style-literal", "literals"],
  ["pressable-needs-a11y", "a11y"],
  ["no-space-arithmetic", "space±"],
  ["no-raw-modal", "Modal"],
  ["no-activity-indicator", "spinner"],
  ["animated-needs-motion-policy", "motion"],
  ["no-legacy-palette", "legacy"],
];

// Area membership mirrors the auditor briefs in docs/design/audit-2026-09.
const AREAS = [
  ["A · Home / Barn / Habitat", /^(app\/\(tabs\)\/index\.tsx|components\/Barn|app\/barn-|components\/habitat\/|components\/ActiveEffects|components\/HoofprintsSheet|components\/CleanseModal|components\/RitualPicker|components\/WhileAwayModal|components\/PurchaseToast)/],
  ["B · Friends / Social / Sounder", /^(app\/\(tabs\)\/friends|components\/Friends|components\/UserSheet|components\/Inbox|components\/FriendInvitePicker|components\/PlayerInvitePicker|components\/BlockedUsersSheet|app\/sounder|components\/SounderCard|components\/SounderOinkSheet|components\/JoinableSounders|components\/TransferLeadershipSheet|components\/PigRosterPicker|app\/lounge\.tsx|app\/porch-round|components\/PorchRoundLaunchCard)/],
  ["C · Season / Contend / Dig", /^(app\/\(tabs\)\/season|components\/season1\/|app\/race-standings|components\/Leaderboard|components\/GreatHunger|components\/SeasonEndModal|components\/JudgementDayModal|components\/AlignmentSchismModal|components\/AlignmentExplainerModal|components\/mudwar\/|app\/dig-collection|app\/digging-stats|components\/DigPostcardInbox|components\/TruffleButton|components\/BuryTruffleSheet|components\/BuriedTruffleSheet|components\/TruffleCatalogSheet|components\/EnemyBreakdownSheet|components\/TickleBreakdownSheet|components\/BountyBoard|components\/BountyCard|app\/expedition|components\/expedition\/|app\/contraptions)/],
  ["D · Shop / Collect / Rewards", /^(app\/\(tabs\)\/shop|components\/ClosetView|components\/ItemPreviewModal|components\/PigPenView|components\/PigFriendsLaunchModal|components\/TroughSection|components\/BattlePassSaleModal|components\/LuckyPigModal|components\/MysteryHatReveal|app\/achievements|components\/AchievementDigestModal|components\/TitlesSection|app\/rosie-gallery|app\/mote-machine\.tsx|components\/mote-machine\/|app\/ad-refill-preview|features\/rewarded-ads\/)/],
  ["E · Account / Onboarding / Shell", /^(app\/\(tabs\)\/account|components\/Account|components\/Onboarding|components\/UsernameSetup|components\/SupaAuth|components\/AppleAuth|components\/GoogleAuth|components\/ReferralCodeEntry|components\/ReleaseNotesModal|app\/_layout|app\/\(tabs\)\/_layout|app\/scan-code|app\/i\/|app\/\+not-found|app\/auth-callback|components\/SwipeElement)/],
  ["F · Primitives (components/ui)", /^components\/ui\//],
];
const OTHER = "Z · Other";

const EXCLUDED = (rel) =>
  /\/(dev|prototypes)\//.test(rel) || rel.endsWith("-prototype.tsx") || rel.endsWith("ui-audit.tsx");

function areaOf(rel) {
  for (const [name, rx] of AREAS) if (rx.test(rel)) return name;
  return OTHER;
}

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      yield* walk(full);
    } else if (entry.name.endsWith(".tsx")) yield full;
  }
}

const lintJson = execFileSync(
  "npx",
  ["eslint", "app", "components", "features", "--ext", ".ts,.tsx", "-f", "json"],
  { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] },
);
const results = JSON.parse(lintJson);

const perFile = new Map();
for (const entry of results) {
  const rel = relative(ROOT, entry.filePath).split(sep).join("/");
  if (EXCLUDED(rel)) continue;
  for (const m of entry.messages) {
    const id = (m.ruleId ?? "").replace(/^ttp\//, "");
    if (!m.ruleId?.startsWith("ttp/")) continue;
    if (!perFile.has(rel)) perFile.set(rel, Object.fromEntries(RULES.map(([r]) => [r, 0])));
    perFile.get(rel)[id] = (perFile.get(rel)[id] ?? 0) + 1;
  }
}

const scope = [];
for (const dir of ["app", "components", "features"]) {
  for (const f of walk(join(ROOT, dir))) {
    const rel = relative(ROOT, f).split(sep).join("/");
    if (!EXCLUDED(rel)) scope.push(rel);
  }
}
const clean = scope.filter((f) => !perFile.has(f)).sort();

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(Object.fromEntries(perFile), null, 1));
  process.exit(0);
}

const total = (c) => Object.values(c).reduce((a, b) => a + b, 0);
const header = `| File | Total | ${RULES.map(([, s]) => s).join(" | ")} |\n| --- | --- | ${RULES.map(() => "---").join(" | ")} |`;
const row = (label, c) => `| ${label} | ${total(c)} | ${RULES.map(([r]) => c[r] ?? 0).join(" | ")} |`;

const byArea = new Map();
for (const [f, c] of perFile) {
  const a = areaOf(f);
  if (!byArea.has(a)) byArea.set(a, []);
  byArea.get(a).push([f, c]);
}
const areaOrder = [...AREAS.map(([n]) => n), OTHER].filter((a) => byArea.has(a));
const grand = Object.fromEntries(RULES.map(([r]) => [r, 0]));
const areaTotals = areaOrder.map((a) => {
  const t = Object.fromEntries(RULES.map(([r]) => [r, 0]));
  for (const [, c] of byArea.get(a)) for (const [r] of RULES) t[r] += c[r] ?? 0;
  for (const [r] of RULES) grand[r] += t[r];
  return [a, byArea.get(a).length, t];
});

const today = new Date().toISOString().slice(0, 10);
const md = [];
md.push(`# Conformance scorecard — ${today}\n`);
md.push("Per-file `eslint-plugin-ttp` warn counts, grouped by audit area. A file is **conformant** when every count is 0 and its lint flips to error. Within each area, files are sorted by total debt; the section-by-section passes (waves 3–4) start at the top of each table.\n");
md.push("Columns: literals = raw hex / size / radius / pad; a11y = pressables without role + label; space± = `SPACE.x ± n`; Modal = raw `<Modal>`; spinner = `ActivityIndicator`; motion = `Animated` without `useMotionPolicy`; legacy = retired palette imports.\n");
md.push("Regenerate with `npm run scorecard` (`scripts/conformance-scorecard.mjs`).\n");
md.push("## Totals by area\n");
md.push(`| Area | Files with debt | Total | ${RULES.map(([, s]) => s).join(" | ")} |\n| --- | --- | --- | ${RULES.map(() => "---").join(" | ")} |`);
for (const [a, n, t] of areaTotals) md.push(`| ${a} | ${n} | ${total(t)} | ${RULES.map(([r]) => t[r]).join(" | ")} |`);
md.push(`| **All** | ${perFile.size} | ${total(grand)} | ${RULES.map(([r]) => grand[r]).join(" | ")} |\n`);
md.push(`**Already conformant: ${clean.length} of ${scope.length} in-scope files** carry zero warnings (list at the end).\n`);
for (const a of areaOrder) {
  md.push(`## ${a}\n`);
  md.push(header);
  for (const [f, c] of byArea.get(a).sort((x, y) => total(y[1]) - total(x[1]))) md.push(row(`\`${f}\``, c));
  md.push("");
}
md.push(`## Already conformant (${clean.length} files)\n`);
md.push(clean.map((f) => `\`${f}\``).join(", ") + "\n");
writeFileSync(OUT, md.join("\n"));

console.log(`scorecard → ${relative(ROOT, OUT)}`);
for (const [a, n, t] of areaTotals) console.log(`${String(total(t)).padStart(5)}  ${a}  (${n} files)`);
console.log(`${String(total(grand)).padStart(5)}  all  ·  ${clean.length}/${scope.length} files conformant`);
