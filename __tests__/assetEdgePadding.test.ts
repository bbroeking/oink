import fs from "node:fs";
import path from "node:path";
import { inflateSync } from "node:zlib";

type Png = {
	width: number;
	height: number;
	colorType: number;
	rows: Buffer[];
	transparency: Buffer | null;
};

function paeth(a: number, b: number, c: number): number {
	const p = a + b - c;
	const pa = Math.abs(p - a);
	const pb = Math.abs(p - b);
	const pc = Math.abs(p - c);
	return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function readPng(file: string): Png {
	const bytes = fs.readFileSync(file);
	expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
	let offset = 8;
	let width = 0;
	let height = 0;
	let bitDepth = 0;
	let colorType = 0;
	let transparency: Buffer | null = null;
	const idat: Buffer[] = [];
	while (offset < bytes.length) {
		const length = bytes.readUInt32BE(offset);
		const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
		const data = bytes.subarray(offset + 8, offset + 8 + length);
		offset += 12 + length;
		if (type === "IHDR") {
			width = data.readUInt32BE(0);
			height = data.readUInt32BE(4);
			bitDepth = data[8];
			colorType = data[9];
			expect(data[12]).toBe(0); // non-interlaced
		} else if (type === "IDAT") {
			idat.push(data);
		} else if (type === "tRNS") {
			transparency = data;
		} else if (type === "IEND") {
			break;
		}
	}
	expect(bitDepth).toBe(8);
	const bytesPerPixel: Record<number, number> = {
		0: 1,
		2: 3,
		3: 1,
		4: 2,
		6: 4,
	};
	const bpp = bytesPerPixel[colorType];
	expect(bpp).toBeDefined();
	const stride = width * bpp;
	const inflated = inflateSync(Buffer.concat(idat));
	const rows: Buffer[] = [];
	let cursor = 0;
	for (let y = 0; y < height; y += 1) {
		const filter = inflated[cursor++];
		const encoded = inflated.subarray(cursor, cursor + stride);
		cursor += stride;
		const row = Buffer.alloc(stride);
		const previous = rows[y - 1];
		for (let x = 0; x < stride; x += 1) {
			const left = x >= bpp ? row[x - bpp] : 0;
			const above = previous?.[x] ?? 0;
			const upperLeft = x >= bpp ? previous?.[x - bpp] ?? 0 : 0;
			const predictor =
				filter === 0
					? 0
					: filter === 1
						? left
						: filter === 2
							? above
							: filter === 3
								? Math.floor((left + above) / 2)
								: filter === 4
									? paeth(left, above, upperLeft)
									: NaN;
			if (!Number.isFinite(predictor)) {
				throw new Error(`Unsupported PNG row filter ${filter} in ${file}`);
			}
			row[x] = (encoded[x] + predictor) & 0xff;
		}
		rows.push(row);
	}
	return { width, height, colorType, rows, transparency };
}

function alphaAt(png: Png, x: number, y: number): number {
	const row = png.rows[y];
	if (png.colorType === 6) return row[x * 4 + 3];
	if (png.colorType === 4) return row[x * 2 + 1];
	if (png.colorType === 3) return png.transparency?.[row[x]] ?? 255;
	if (png.colorType === 2 && png.transparency) {
		const i = x * 3;
		return row[i] === png.transparency[1] &&
			row[i + 1] === png.transparency[3] &&
			row[i + 2] === png.transparency[5]
			? 0
			: 255;
	}
	if (png.colorType === 0 && png.transparency) {
		return row[x] === png.transparency[1] ? 0 : 255;
	}
	return 255;
}

function pngFiles(dir: string): string[] {
	return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const target = path.join(dir, entry.name);
		return entry.isDirectory()
			? pngFiles(target)
			: entry.isFile() && entry.name.endsWith(".png")
				? [target]
				: [];
	});
}

describe("sticker asset padding", () => {
	const roots = [
		path.join(process.cwd(), "assets/images/glyphs"),
		path.join(process.cwd(), "assets/images/emoji"),
		path.join(process.cwd(), "assets/images/visit-emotes"),
	];
	const wallowRewards = fs
		.readdirSync(path.join(process.cwd(), "assets/images/hats"))
		.filter((name) => name.startsWith("wallow_") && name.endsWith(".png"))
		.map((name) => path.join(process.cwd(), "assets/images/hats", name));

	it.each([...roots.flatMap(pngFiles), ...wallowRewards])("%s keeps opaque art off every canvas edge", (file) => {
		const png = readPng(file);
		let edgeAlpha = 0;
		for (let x = 0; x < png.width; x += 1) {
			edgeAlpha = Math.max(
				edgeAlpha,
				alphaAt(png, x, 0),
				alphaAt(png, x, png.height - 1),
			);
		}
		for (let y = 0; y < png.height; y += 1) {
			edgeAlpha = Math.max(
				edgeAlpha,
				alphaAt(png, 0, y),
				alphaAt(png, png.width - 1, y),
			);
		}
		expect(edgeAlpha).toBe(0);
	});
});
