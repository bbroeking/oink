// Render the nine-card "Rosie's Loadout" equipment battler armory.
// Every card carries the same isolated, supply-capped Release Party Crown
// reward link for redemption through the in-app Shop scanner.

import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "docs/marketing/trading-cards/equipment-game");

const CROWN_REDEEM_URL =
	"https://ticklethepig.com/redeem/PIG-GXF8-ST7N";
const CARD_REWARD = {
	target: CROWN_REDEEM_URL,
	label: "SCAN TO CLAIM IN TICKLE THE PIG",
	detail: "RELEASE PARTY CROWN • 10 OWNERS MAX",
	code: "PIG-GXF8-ST7N",
	expiry: "CLAIM BY SEPTEMBER 1, 2026",
};

const INK = "#21181B";
const PAPER = "#FFF9ED";
const GOLD = "#F7C857";

const SLOTS = {
	HEAD: { accent: "#F19B61", label: "HEAD", icon: "♛" },
	HELD: { accent: "#72D5C1", label: "HELD", icon: "✦" },
	AURA: { accent: "#B89AF4", label: "AURA", icon: "◌" },
};

const STATS = [
	{ key: "bash", label: "BASH", accent: "#FA716B", icon: "✦" },
	{ key: "guard", label: "GUARD", accent: "#63CBE2", icon: "◆" },
	{ key: "flair", label: "FLAIR", accent: "#F7C857", icon: "✶" },
];

const cards = [
	{
		slot: "HEAD",
		title: "Ticket Taker's Cap",
		role: "STURDY SHOWPIECE",
		flavor: "Rosie kept the ticket. Ate the stub.",
		pattern: "ORCHARD SPOT ROSIE",
		art: "01-ticket-takers-cap.png",
		stats: { bash: 1, guard: 3, flair: 2 },
	},
	{
		slot: "HEAD",
		title: "Bog Helmet",
		role: "FORTRESS FIT",
		flavor: "Mud-tested. Pig-approved.",
		pattern: "SANDY PATCH ROSIE",
		art: "02-bog-helmet.png",
		stats: { bash: 1, guard: 4, flair: 1 },
	},
	{
		slot: "HEAD",
		title: "Release Party Crown",
		role: "ROYAL FLAIR",
		flavor: "Worn once. Bragged about forever.",
		pattern: "CLASSIC ROSIE",
		art: "03-release-party-crown.png",
		stats: { bash: 2, guard: 1, flair: 3 },
		fullArt: true,
	},
	{
		slot: "HELD",
		title: "Toy Sword",
		role: "BIG BASH",
		flavor: "Foam blade. Real battle face.",
		pattern: "ORCHARD SPOT ROSIE",
		art: "04-toy-sword.png",
		stats: { bash: 4, guard: 1, flair: 1 },
	},
	{
		slot: "HELD",
		title: "Mud Shovel",
		role: "MUDDY MUSCLE",
		flavor: "One scoop for the bog. One for trouble.",
		pattern: "CLASSIC ROSIE",
		art: "05-mud-shovel.png",
		stats: { bash: 3, guard: 2, flair: 1 },
	},
	{
		slot: "HELD",
		title: "Golden Truffle",
		role: "GOLDEN FLAIR",
		flavor: "Too precious to eat. Rosie is considering it.",
		pattern: "HALO SPOT ROSIE",
		art: "06-golden-truffle.png",
		stats: { bash: 1, guard: 1, flair: 4 },
		fullArt: true,
	},
	{
		slot: "AURA",
		title: "Shadow Aura",
		role: "SNEAK ATTACK",
		flavor: "Rosie insists the shadow moved first.",
		pattern: "MIDNIGHT POINTS ROSIE",
		art: "07-shadow-aura.png",
		stats: { bash: 3, guard: 1, flair: 2 },
	},
	{
		slot: "AURA",
		title: "Firefly Aura",
		role: "BRIGHT STYLE",
		flavor: "Every firefly volunteered. Allegedly.",
		pattern: "CLASSIC ROSIE",
		art: "08-firefly-aura.png",
		stats: { bash: 1, guard: 2, flair: 3 },
	},
	{
		slot: "AURA",
		title: "Golden Bog Aura",
		role: "PERFECT BALANCE",
		flavor: "The bog cleaned itself up for this.",
		pattern: "SADDLE STRIPE ROSIE",
		art: "09-golden-bog-aura.png",
		stats: { bash: 2, guard: 2, flair: 2 },
		fullArt: true,
	},
];

const xml = (value) =>
	String(value)
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");

const FONT_CONFIG_PATH = path.join(os.tmpdir(), "tickle-card-fonts.conf");
const FONT_DIRS = [
	"node_modules/@expo-google-fonts/caprasimo/400Regular",
	"node_modules/@expo-google-fonts/fredoka/700Bold",
	"node_modules/@expo-google-fonts/nunito/800ExtraBold",
	"node_modules/@expo-google-fonts/patrick-hand/400Regular",
];

await writeFile(
	FONT_CONFIG_PATH,
	`<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
${FONT_DIRS.map((dir) => `  <dir>${xml(path.join(ROOT, dir))}</dir>`).join("\n")}
  <cachedir>${xml(path.join(os.tmpdir(), "tickle-card-font-cache"))}</cachedir>
</fontconfig>
`
);

function slug(card, index) {
	return `${String(index + 1).padStart(2, "0")}-${card.slot.toLowerCase()}-${card.title
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, "-")
		.replaceAll(/^-|-$/g, "")}`;
}

function validateArmory() {
	if (cards.length !== 9) throw new Error("Armory must contain nine cards.");
	const names = new Set();
	for (const slot of Object.keys(SLOTS)) {
		if (cards.filter((card) => card.slot === slot).length !== 3) {
			throw new Error(`${slot} must contain exactly three cards.`);
		}
	}
	for (const card of cards) {
		if (names.has(card.title)) throw new Error(`Duplicate card: ${card.title}`);
		names.add(card.title);
		const budget = Object.values(card.stats).reduce((sum, value) => sum + value, 0);
		if (budget !== 6) {
			throw new Error(`${card.title} has ${budget} stat points; expected 6.`);
		}
	}
	if (CARD_REWARD.target !== CROWN_REDEEM_URL) {
		throw new Error("Every armory card must use the Crown reward.");
	}
}

function titleSize(title) {
	if (title.length > 19) return 67;
	if (title.length > 14) return 76;
	return 88;
}

function statsMarkup(card) {
	return STATS.map((stat, index) => {
		const x = 92 + index * 438;
		const divider =
			index === 0
				? ""
				: `<path d="M${x - 22} 1745 V1867" stroke="${PAPER}" stroke-opacity=".24"
					stroke-width="3"/>`;
		return `
		<g>
			${divider}
			<text x="${x}" y="1811" fill="${stat.accent}" font-family="Fredoka"
				font-size="39">${stat.icon}</text>
			<text x="${x + 52}" y="1808" fill="${PAPER}" fill-opacity=".78"
				font-family="Nunito" font-size="25" letter-spacing="2">${stat.label}</text>
			<text x="${x + 350}" y="1834" text-anchor="end" fill="${PAPER}"
				font-family="Caprasimo" font-size="86">${card.stats[stat.key]}</text>
		</g>`;
	}).join("");
}

function cardSvg(card, index, art) {
	const slot = SLOTS[card.slot];
	const specialStroke = card.fullArt ? GOLD : PAPER;
	const artMarkup = art
		? `<image xlink:href="${xml(art)}" x="0" y="0" width="1500" height="2100"
			preserveAspectRatio="xMidYMid slice"/>`
		: "";
	const specialStamp = card.fullArt
		? `<g transform="translate(100 354)">
				<rect width="390" height="64" rx="32" fill="${GOLD}" stroke="${INK}" stroke-width="5"/>
				<text x="195" y="43" text-anchor="middle" fill="${INK}" font-family="Nunito"
					font-size="25" letter-spacing="2">SPECIAL ILLUSTRATION</text>
			</g>`
		: "";

	return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
	width="1500" height="2100" viewBox="0 0 1500 2100">
	<defs>
		<clipPath id="cardClip"><rect width="1500" height="2100" rx="88"/></clipPath>
		<linearGradient id="topShade" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0" stop-color="#100B10" stop-opacity=".82"/>
			<stop offset=".62" stop-color="#100B10" stop-opacity=".18"/>
			<stop offset="1" stop-color="#100B10" stop-opacity="0"/>
		</linearGradient>
		<linearGradient id="bottomShade" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0" stop-color="#100B10" stop-opacity="0"/>
			<stop offset=".26" stop-color="#100B10" stop-opacity=".56"/>
			<stop offset=".55" stop-color="#100B10" stop-opacity=".93"/>
			<stop offset="1" stop-color="#100B10"/>
		</linearGradient>
	</defs>

	<g clip-path="url(#cardClip)">
		${artMarkup}
		<rect width="1500" height="610" fill="url(#topShade)"/>
		<rect y="1330" width="1500" height="770" fill="url(#bottomShade)"/>

		<g transform="translate(88 82)">
			<rect width="236" height="76" rx="38" fill="${slot.accent}"
				stroke="${PAPER}" stroke-width="5"/>
			<text x="44" y="52" fill="${INK}" font-family="Fredoka" font-size="37">${slot.icon}</text>
			<text x="92" y="51" fill="${INK}" font-family="Nunito"
				font-size="29" letter-spacing="3">${slot.label}</text>
		</g>

		<text x="1410" y="132" text-anchor="end" fill="${PAPER}" font-family="Nunito"
			font-size="25" letter-spacing="3">ROSIE'S LOADOUT • ${String(index + 1).padStart(2, "0")}/09</text>
		<text x="91" y="279" fill="${INK}" fill-opacity=".82" font-family="Caprasimo"
			font-size="${titleSize(card.title)}">${xml(card.title)}</text>
		<text x="86" y="273" fill="${PAPER}" font-family="Caprasimo"
			font-size="${titleSize(card.title)}">${xml(card.title)}</text>
		<text x="90" y="327" fill="${slot.accent}" font-family="Nunito"
			font-size="24" letter-spacing="3">${card.pattern}</text>
		${specialStamp}

		<path d="M90 1574 H132" stroke="${slot.accent}" stroke-width="12"
			stroke-linecap="round"/>
		<text x="156" y="1584" fill="${slot.accent}" font-family="Nunito"
			font-size="25" letter-spacing="3">${card.role}</text>
		<text x="92" y="1680" fill="${PAPER}" font-family="Patrick Hand"
			font-size="51">${xml(card.flavor)}</text>

		<rect x="72" y="1720" width="1356" height="174" rx="30"
			fill="#100B10" fill-opacity=".82" stroke="${PAPER}" stroke-opacity=".22"
			stroke-width="3"/>
		${statsMarkup(card)}

		<text x="90" y="1985" fill="${GOLD}" font-family="Caprasimo"
			font-size="42">TICKLE THE PIG</text>
		<text x="1410" y="1978" text-anchor="end" fill="${PAPER}" font-family="Fredoka"
			font-size="29">1 HEAD  +  1 HELD  +  1 AURA</text>
		<text x="1410" y="2022" text-anchor="end" fill="${PAPER}" fill-opacity=".7"
			font-family="Nunito" font-size="20" letter-spacing="2">EQUIP • REVEAL • BATTLE</text>
	</g>

	<rect x="26" y="26" width="1448" height="2048" rx="70" fill="none"
		stroke="${INK}" stroke-width="30"/>
	<rect x="52" y="52" width="1396" height="1996" rx="52" fill="none"
		stroke="${specialStroke}" stroke-width="${card.fullArt ? 12 : 7}"/>
</svg>`;
}

function cardBackSvg(qrData, crownData) {
	return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="2100" viewBox="0 0 1500 2100">
	<defs>
		<radialGradient id="halo" cx="50%" cy="34%" r="66%">
			<stop offset="0" stop-color="#7C304F"/>
			<stop offset=".48" stop-color="#43192D"/>
			<stop offset="1" stop-color="#21131C"/>
		</radialGradient>
		<linearGradient id="goldBand" x1="0" y1="0" x2="1" y2="0">
			<stop offset="0" stop-color="#E59A31"/>
			<stop offset=".5" stop-color="#FFE18B"/>
			<stop offset="1" stop-color="#E59A31"/>
		</linearGradient>
		<clipPath id="backClip"><rect width="1500" height="2100" rx="88"/></clipPath>
	</defs>
	<g clip-path="url(#backClip)">
		<rect width="1500" height="2100" fill="url(#halo)"/>
		<circle cx="750" cy="620" r="440" fill="none" stroke="${GOLD}"
			stroke-opacity=".2" stroke-width="70"/>
		<circle cx="750" cy="620" r="340" fill="none" stroke="${PAPER}"
			stroke-opacity=".1" stroke-width="3" stroke-dasharray="12 20"/>
		<text x="750" y="140" text-anchor="middle" fill="${GOLD}" font-family="Nunito"
			font-size="24" letter-spacing="6">TICKLE THE PIG</text>
		<text x="750" y="245" text-anchor="middle" fill="${PAPER}" font-family="Caprasimo"
			font-size="78">ROSIE'S LOADOUT</text>

		<image href="${crownData}" x="500" y="350" width="500" height="500"
			preserveAspectRatio="xMidYMid meet"/>

		<text x="750" y="885" text-anchor="middle" fill="${GOLD}" font-family="Nunito"
			font-size="27" letter-spacing="3">A RELEASE-PARTY KEEPSAKE</text>
		<text x="750" y="960" text-anchor="middle" fill="${PAPER}" font-family="Fredoka"
			font-size="48">A Crown for the first ten owners.</text>

		<rect x="390" y="1020" width="720" height="720" rx="44"
			fill="${PAPER}" stroke="url(#goldBand)" stroke-width="12"/>
		<text x="750" y="1086" text-anchor="middle" fill="${INK}" font-family="Nunito"
			font-size="27" letter-spacing="2">${CARD_REWARD.label}</text>
		<image href="${qrData}" x="485" y="1110" width="530" height="530"
			preserveAspectRatio="xMidYMid meet"/>
		<text x="750" y="1682" text-anchor="middle" fill="${INK}" font-family="Nunito"
			font-size="23" letter-spacing="2">${CARD_REWARD.code}</text>
		<text x="750" y="1720" text-anchor="middle" fill="#A53E38" font-family="Nunito"
			font-size="21" letter-spacing="1">${CARD_REWARD.expiry}</text>

		<text x="750" y="1838" text-anchor="middle" fill="${PAPER}" font-family="Fredoka"
			font-size="31">Use your phone camera or the Shop scanner.</text>
		<text x="750" y="1888" text-anchor="middle" fill="${PAPER}" fill-opacity=".75"
			font-family="Nunito" font-size="23">No app yet? Install, then scan again or enter the code.</text>
		<text x="750" y="1992" text-anchor="middle" fill="${GOLD}" font-family="Nunito"
			font-size="21" letter-spacing="4">BUILD • REVEAL • BATTLE • BEST OF THREE</text>
	</g>
	<rect x="26" y="26" width="1448" height="2048" rx="70" fill="none"
		stroke="${INK}" stroke-width="30"/>
	<rect x="52" y="52" width="1396" height="1996" rx="52" fill="none"
		stroke="url(#goldBand)" stroke-width="12"/>
</svg>`;
}

async function makeQr(target) {
	return QRCode.toDataURL(target, {
		errorCorrectionLevel: "H",
		margin: 4,
		width: 520,
		color: {
			dark: "#21181B",
			light: "#FFF9ED",
		},
	});
}

async function render(card, index) {
	const art = `art/${card.art}`;
	const target = CARD_REWARD.target;
	const outputName = slug(card, index);
	const svgPath = path.join(OUT, `${outputName}.svg`);
	const pngPath = path.join(OUT, `${outputName}.png`);
	await writeFile(svgPath, cardSvg(card, index, art));
	const overlaySvgPath = path.join(os.tmpdir(), `${outputName}-overlay.svg`);
	const overlayPngPath = path.join(os.tmpdir(), `${outputName}-overlay.png`);
	await writeFile(overlaySvgPath, cardSvg(card, index, null));
	execFileSync("magick", ["-background", "none", overlaySvgPath, overlayPngPath], {
		env: { ...process.env, FONTCONFIG_FILE: FONT_CONFIG_PATH },
	});
	execFileSync("magick", [
		path.join(OUT, "art", card.art),
		"-resize",
		"1500x2100^",
		"-gravity",
		"center",
		"-extent",
		"1500x2100",
		overlayPngPath,
		"-compose",
		"over",
		"-composite",
		pngPath,
	]);
	return { ...card, target, outputName, pngPath };
}

async function renderBack() {
	const qrData = await makeQr(CARD_REWARD.target);
	const crownBytes = await readFile(
		path.join(ROOT, "assets/images/hats/release_party_crown.png")
	);
	const crownData = `data:image/png;base64,${crownBytes.toString("base64")}`;
	const svgPath = path.join(OUT, "card-back-crown-reward.svg");
	const pngPath = path.join(OUT, "card-back-crown-reward.png");
	await writeFile(svgPath, cardBackSvg(qrData, crownData));
	execFileSync("magick", [svgPath, pngPath], {
		env: { ...process.env, FONTCONFIG_FILE: FONT_CONFIG_PATH },
	});
	return pngPath;
}

validateArmory();
await mkdir(OUT, { recursive: true });

const rendered = [];
for (const [index, card] of cards.entries()) {
	rendered.push(await render(card, index));
}
await renderBack();

execFileSync(
	"magick",
	[
		"montage",
		...rendered.map((card) => card.pngPath),
		"-thumbnail",
		"360x504",
		"-tile",
		"3x3",
		"-geometry",
		"+18+18",
		"-font",
		path.join(
			ROOT,
			"node_modules/@expo-google-fonts/nunito/800ExtraBold/Nunito_800ExtraBold.ttf"
		),
		"-background",
		"#F2E4CD",
		path.join(OUT, "contact-sheet.png"),
	],
	{ env: { ...process.env, FONTCONFIG_FILE: FONT_CONFIG_PATH } }
);

const manifest = [
	"file,slot,title,pattern,bash,guard,flair,qr_kind,qr_target",
	...rendered.map((card) =>
		[
			`${card.outputName}.png`,
			card.slot,
			`"${card.title}"`,
			`"${card.pattern}"`,
			card.stats.bash,
			card.stats.guard,
			card.stats.flair,
			"reward",
			card.target,
		].join(",")
	),
].join("\n");
await writeFile(path.join(OUT, "manifest.csv"), `${manifest}\n`);

console.log(`Rendered ${rendered.length} equipment cards to ${path.relative(ROOT, OUT)}/`);
