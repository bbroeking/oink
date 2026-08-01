// Render print-sized Tickle the Pig trading-card mockups with deterministic,
// scannable QR codes. Artwork comes from the shipped game assets; ImageMagick
// rasterizes the SVG compositions at 1500x2100 (2.5x3.5in at 600dpi).
//
// Run:
//   node scripts/render-trading-card-mocks.mjs

import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "docs/marketing/trading-cards");
const APP_STORE_URL =
	"https://apps.apple.com/us/app/tickle-the-pig/id6740339848";

const cards = [
	{
		file: "01-meet-rosie-app-store",
		kind: "APP STORE",
		title: "Meet Rosie",
		subtitle: "The pig who always has time for one more tickle.",
		cta: "SCAN TO PLAY FREE",
		footer: "TICKLE • COLLECT • CONNECT",
		target: APP_STORE_URL,
		art: "assets/images/sprites/rosie/wave_1.png",
		accent: "#D94A62",
		accent2: "#FFB8C5",
		badge: "STARTER",
	},
	{
		file: "02-join-the-herd-app-store",
		kind: "APP STORE",
		title: "Join the Herd",
		subtitle: "Dress Rosie, trade tickles, and make a little mischief.",
		cta: "SCAN TO JOIN",
		footer: "A COZY DAILY GAME FOR IPHONE",
		target: APP_STORE_URL,
		art: "assets/images/sprites/rosie/happy_2.png",
		accent: "#537F69",
		accent2: "#B9E2C8",
		badge: "SOCIAL",
	},
	{
		file: "03-ticket-takers-cap-reward",
		kind: "GOLDEN TICKET",
		title: "Ticket Taker's Cap",
		subtitle: "A smart red usher's cap with a golden ticket in the band.",
		cta: "SCAN IN THE SHOP TO CLAIM",
		footer: "GIFTED • NEVER SOLD",
		target: "https://ticklethepig.com/redeem/PIG-G9HJ-2EMF",
		code: "PIG-G9HJ-2EMF",
		art: "assets/images/hats/ticket_takers_cap.png",
		accent: "#C84C42",
		accent2: "#F4B547",
		badge: "RARE",
	},
	{
		file: "04-release-party-crown-reward",
		kind: "GOLDEN TICKET",
		title: "Release Party Crown",
		subtitle: "A gilded launch-party keepsake, handed out to the first herd.",
		cta: "SCAN IN THE SHOP TO CLAIM",
		footer: "LEGENDARY • EXPIRES SEP 1, 2026",
		target: "https://ticklethepig.com/redeem/PIG-GXF8-ST7N",
		code: "PIG-GXF8-ST7N",
		art: "assets/images/hats/release_party_crown.png",
		accent: "#7550A5",
		accent2: "#F3C64F",
		badge: "LEGENDARY",
	},
];

const xml = (value) =>
	String(value)
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");

async function dataUri(relativePath) {
	const absolutePath = path.join(ROOT, relativePath);
	const ext = path.extname(relativePath).slice(1);
	const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
	return `data:${mime};base64,${(await readFile(absolutePath)).toString("base64")}`;
}

async function renderCard(card) {
	const art = await dataUri(card.art);
	const qr = await QRCode.toDataURL(card.target, {
		errorCorrectionLevel: "H",
		margin: 3,
		width: 520,
		color: { dark: "#2D2027", light: "#FFFDF8" },
	});
	const isReward = Boolean(card.code);
	const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="2100" viewBox="0 0 1500 2100">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${card.accent2}"/>
      <stop offset=".52" stop-color="#FFF7E7"/>
      <stop offset="1" stop-color="${card.accent}" stop-opacity=".68"/>
    </linearGradient>
    <radialGradient id="glow">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity=".98"/>
      <stop offset=".72" stop-color="#FFFDF8" stop-opacity=".58"/>
      <stop offset="1" stop-color="#FFFDF8" stop-opacity="0"/>
    </radialGradient>
    <pattern id="dots" width="62" height="62" patternUnits="userSpaceOnUse">
      <circle cx="12" cy="12" r="5" fill="#FFFFFF" opacity=".28"/>
      <circle cx="43" cy="38" r="3" fill="#442D38" opacity=".09"/>
    </pattern>
  </defs>

  <rect width="1500" height="2100" rx="90" fill="url(#bg)"/>
  <rect width="1500" height="2100" rx="90" fill="url(#dots)"/>
  <rect x="38" y="38" width="1424" height="2024" rx="66" fill="none" stroke="#442D38" stroke-width="18"/>
  <rect x="66" y="66" width="1368" height="1968" rx="50" fill="none" stroke="#FFFDF8" stroke-width="7" opacity=".9"/>

  <text x="112" y="164" fill="#442D38" font-family="Arial Rounded MT Bold,Arial,sans-serif"
    font-size="46" font-weight="900" letter-spacing="9">${xml(card.kind)}</text>
  <rect x="1120" y="104" width="260" height="82" rx="41" fill="${card.accent}"/>
  <text x="1250" y="158" text-anchor="middle" fill="#FFFDF8"
    font-family="Arial Rounded MT Bold,Arial,sans-serif" font-size="34" font-weight="900">${xml(card.badge)}</text>

  <text x="104" y="285" fill="#442D38" font-family="Arial Rounded MT Bold,Arial,sans-serif"
    font-size="${card.title.length > 20 ? 82 : 100}" font-weight="900">${xml(card.title)}</text>

  <rect x="112" y="364" width="1296" height="850" rx="62" fill="#442D38" opacity=".18"/>
  <rect x="102" y="342" width="1296" height="850" rx="62" fill="#FFFDF8" stroke="#442D38" stroke-width="12"/>
  <ellipse cx="750" cy="750" rx="510" ry="360" fill="url(#glow)"/>
  <circle cx="750" cy="752" r="330" fill="${card.accent2}" opacity=".43"/>
  <circle cx="750" cy="752" r="280" fill="#FFFDF8" opacity=".55" stroke="${card.accent}" stroke-width="7" stroke-dasharray="14 18"/>
  <image href="${art}" x="${isReward ? 415 : 340}" y="${isReward ? 430 : 405}"
    width="${isReward ? 670 : 820}" height="${isReward ? 670 : 720}" preserveAspectRatio="xMidYMid meet"/>
  ${isReward ? `<text x="750" y="1132" text-anchor="middle" fill="${card.accent}" font-family="Arial Rounded MT Bold,Arial,sans-serif" font-size="38" font-weight="900">ONE PER PLAYER • WHILE SUPPLIES LAST</text>` : ""}

  <text x="122" y="1278" fill="#442D38" font-family="Arial,sans-serif" font-size="40" font-weight="700">
    <tspan x="122" dy="0">${xml(card.subtitle.split(", ")[0])}${card.subtitle.includes(", ") ? "," : ""}</tspan>
    ${card.subtitle.includes(", ") ? `<tspan x="122" dy="54">${xml(card.subtitle.split(", ").slice(1).join(", "))}</tspan>` : ""}
  </text>

  <rect x="108" y="1432" width="1304" height="470" rx="52" fill="#442D38" opacity=".18"/>
  <rect x="98" y="1410" width="1304" height="470" rx="52" fill="#FFFDF8" stroke="#442D38" stroke-width="12"/>
  <image href="${qr}" x="130" y="1438" width="416" height="416"/>
  <text x="600" y="1516" fill="${card.accent}" font-family="Arial Rounded MT Bold,Arial,sans-serif"
    font-size="35" font-weight="900" letter-spacing="3">${xml(card.cta)}</text>
  <text x="600" y="1614" fill="#442D38" font-family="Arial Rounded MT Bold,Arial,sans-serif"
    font-size="${isReward ? 52 : 62}" font-weight="900">${isReward ? "Golden Ticket" : "Tickle the Pig"}</text>
  ${isReward
		? `<rect x="598" y="1660" width="724" height="98" rx="24" fill="#FFF3BE" stroke="#E3A631" stroke-width="5" stroke-dasharray="12 10"/>
       <text x="960" y="1726" text-anchor="middle" fill="#442D38" font-family="Courier New,monospace" font-size="48" font-weight="900">${xml(card.code)}</text>`
		: `<text x="600" y="1692" fill="#6B5360" font-family="Arial,sans-serif" font-size="34" font-weight="700">Free on the App Store</text>
       <text x="600" y="1752" fill="#6B5360" font-family="Arial,sans-serif" font-size="30">ticklethepig.com</text>`}

  <text x="750" y="1978" text-anchor="middle" fill="#442D38" font-family="Arial Rounded MT Bold,Arial,sans-serif"
    font-size="32" font-weight="900" letter-spacing="5">${xml(card.footer)}</text>
</svg>`;

	const svgPath = path.join(OUT, `${card.file}.svg`);
	const pngPath = path.join(OUT, `${card.file}.png`);
	await writeFile(svgPath, svg);
	execFileSync("magick", [svgPath, "-density", "600", "-units", "PixelsPerInch", pngPath]);
	return { ...card, svgPath, pngPath };
}

await mkdir(OUT, { recursive: true });
const rendered = [];
for (const card of cards) rendered.push(await renderCard(card));

const manifest = [
	"file,kind,title,qr_target,printed_code",
	...rendered.map((card) =>
		[
			`${card.file}.png`,
			card.kind,
			`"${card.title.replaceAll('"', '""')}"`,
			card.target,
			card.code ?? "",
		].join(",")
	),
].join("\n");
await writeFile(path.join(OUT, "manifest.csv"), `${manifest}\n`);

execFileSync("magick", [
	...rendered.map((card) => card.pngPath),
	"+append",
	"-resize",
	"1500x525",
	path.join(OUT, "contact-sheet.png"),
]);

console.log(`Rendered ${rendered.length} cards to ${path.relative(ROOT, OUT)}/`);
