// Matchmade play art: every sticker components/play/playArt.ts requires is
// real art, framed like the rest of the painted family. 256×256 RGBA, a
// transparent box edge (the sticker padding rule), and no placeholder left:
// a file byte-identical to glyphs/dig/bag.png is the stand-in the registry
// shipped with before tools/gen_play_art.py painted it. The board pieces that
// repeat many times on one board are bare: no gold sparkles (lead, 2026-10-04).

import fs from "node:fs";
import path from "node:path";
import { inflateSync } from "node:zlib";

const ROOT = path.join(__dirname, "../..");
const REGISTRY = path.join(ROOT, "components/play/playArt.ts");
const PLACEHOLDER = fs.readFileSync(path.join(ROOT, "assets/images/glyphs/dig/bag.png"));

/** Drawn many times on one board, so drawn without the house's two sparkles. */
const BARE = [
	"assets/images/play/fence_the_pen/rail.png", // up to 40 on a board
	"assets/images/play/fence_the_pen/post.png", // 25
	"assets/images/play/fence_the_pen/pen_truffle.png", // up to 16
	"assets/images/play/mud_volley/lane_post.png", // 3, side by side
];

type Header = { width: number; height: number; bitDepth: number; colorType: number; interlace: number };

function readHeader(bytes: Buffer): Header {
	expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
	// The first chunk is always IHDR: length(4) type(4) then the fields.
	expect(bytes.subarray(12, 16).toString("ascii")).toBe("IHDR");
	return {
		width: bytes.readUInt32BE(16),
		height: bytes.readUInt32BE(20),
		bitDepth: bytes[24],
		colorType: bytes[25],
		interlace: bytes[28],
	};
}

function paeth(a: number, b: number, c: number): number {
	const p = a + b - c;
	const pa = Math.abs(p - a);
	const pb = Math.abs(p - b);
	const pc = Math.abs(p - c);
	return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Pixel rows (RGBA, 4 bytes a pixel) of an 8-bit, non-interlaced RGBA PNG. */
function pixelRows(bytes: Buffer, { width, height }: Header): Uint8Array[] {
	const idat: Buffer[] = [];
	for (let offset = 8; offset < bytes.length; ) {
		const length = bytes.readUInt32BE(offset);
		const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
		if (type === "IDAT") idat.push(bytes.subarray(offset + 8, offset + 8 + length));
		if (type === "IEND") break;
		offset += 12 + length;
	}
	const data = inflateSync(Buffer.concat(idat));
	const bpp = 4;
	const stride = width * bpp;
	const rows: Uint8Array[] = [];
	let previous = new Uint8Array(stride);
	for (let y = 0, cursor = 0; y < height; y += 1) {
		const filter = data[cursor++];
		const row = new Uint8Array(stride);
		for (let x = 0; x < stride; x += 1) {
			const left = x >= bpp ? row[x - bpp] : 0;
			const above = previous[x];
			const upperLeft = x >= bpp ? previous[x - bpp] : 0;
			const predictor = [0, left, above, (left + above) >> 1, paeth(left, above, upperLeft)][filter];
			if (predictor === undefined) throw new Error(`unsupported PNG row filter ${filter}`);
			row[x] = (data[cursor + x] + predictor) & 0xff;
		}
		cursor += stride;
		rows.push(row);
		previous = row;
	}
	return rows;
}

/** Saturated sparkle gold (~(249, 208, 80) at the core); one house sparkle is
 * ~25–60 of these at 256², while wood, mud and cream stay far below it. */
function sparkleGold(rows: Uint8Array[]): number {
	let n = 0;
	for (const row of rows) {
		for (let i = 0; i < row.length; i += 4) {
			const [r, g, b, a] = [row[i], row[i + 1], row[i + 2], row[i + 3]];
			if (a > 128 && r >= 235 && g >= 185 && g <= 230 && b <= 110 && r - g >= 20) n += 1;
		}
	}
	return n;
}

const referenced = [...fs.readFileSync(REGISTRY, "utf8").matchAll(/require\("([^"]+\.png)"\)/g)].map((m) =>
	path.relative(ROOT, path.resolve(path.dirname(REGISTRY), m[1])),
);

describe("matchmade play art", () => {
	it("the registry names all 25 stickers", () => {
		expect(new Set(referenced).size).toBe(25);
	});

	it.each(referenced)("%s is a finished 256² RGBA sticker", (file) => {
		const abs = path.join(ROOT, file);
		expect(fs.existsSync(abs)).toBe(true);
		const bytes = fs.readFileSync(abs);
		expect(bytes.equals(PLACEHOLDER)).toBe(false);

		const header = readHeader(bytes);
		expect(header).toEqual({ width: 256, height: 256, bitDepth: 8, colorType: 6, interlace: 0 });

		const alpha = pixelRows(bytes, header).map((row) => row.filter((_, i) => i % 4 === 3));
		const last = 255;
		expect([alpha[0][0], alpha[0][last], alpha[last][0], alpha[last][last]]).toEqual([0, 0, 0, 0]);
		let edge = 0;
		for (let i = 0; i <= last; i += 1) {
			edge = Math.max(edge, alpha[0][i], alpha[last][i], alpha[i][0], alpha[i][last]);
		}
		expect(edge).toBe(0);
	});

	it.each(BARE)("%s is bare: no gold sparkles", (file) => {
		expect(referenced).toContain(file);
		const bytes = fs.readFileSync(path.join(ROOT, file));
		expect(sparkleGold(pixelRows(bytes, readHeader(bytes)))).toBeLessThan(16);
	});
});
