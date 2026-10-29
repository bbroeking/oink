import {
	resolvePigStageAssetAspect,
	resolveSlot,
	type EquippedItem,
} from "../components/ui/PigStage";
import {
	HAT_IMAGES,
	HAT_REL,
	PIG_CANVAS,
	PIG_FRAME_ANCHORS,
	resolveAnchor,
	resolveWearablePose,
} from "../constants/hats";
import { HAT_SIDE_IMAGES } from "../constants/hat_side.generated";
import type { PigAnimationKey, RelSpec } from "../constants/hat_overlay_types";
import { PIG_IDS } from "../utils/pigs";

const ANIMATIONS = Object.keys(PIG_FRAME_ANCHORS) as PigAnimationKey[];
const HEAD_ITEMS = Object.entries(HAT_REL).filter(
	(entry): entry is [string, RelSpec] =>
		entry[1].anchor === "head" && HAT_IMAGES[entry[0]] !== undefined,
);

const slot = (id: string, category = "hat"): EquippedItem => ({
	id,
	category,
	emoji: null,
});

function rotatedPivot(
	overlay: NonNullable<ReturnType<typeof resolveSlot>>["overlay"] | undefined,
	rel: RelSpec,
) {
	if (!overlay) throw new Error("expected an overlay");
	const radians = ((overlay.rotate ?? 0) * Math.PI) / 180;
	const pivotX = rel.pivot.x * overlay.width;
	const pivotY = rel.pivot.y * overlay.height;
	const fromCenterX = pivotX - overlay.width / 2;
	const fromCenterY = pivotY - overlay.height / 2;
	return {
		x:
			overlay.left +
			overlay.width / 2 +
			fromCenterX * Math.cos(radians) -
			fromCenterY * Math.sin(radians),
		y:
			PIG_CANVAS - overlay.bottom - overlay.height +
			overlay.height / 2 +
			fromCenterX * Math.sin(radians) +
			fromCenterY * Math.cos(radians),
	};
}

describe("pig attachment geometry", () => {
	test("extreme Rosie poses use measured crown centers instead of silhouette-edge points", () => {
		const samples = [
			["sad", 0, 158, 118],
			["jump", 0, 159, 128],
			["tired", 0, 161, 192],
		] as const;
		for (const [animation, frame, expected, rejected] of samples) {
			const x = resolveAnchor(animation, frame, "head", "rosie").x;
			expect(x).toBeGreaterThan(140);
			expect(x).toBeLessThan(170);
			expect(Math.abs(x - expected)).toBeLessThan(Math.abs(x - rejected));
		}
	});

	test.each(PIG_IDS)("%s keeps rigid hat width constant within each pose family", (pigId) => {
		for (const animation of ANIMATIONS) {
			const widths = PIG_FRAME_ANCHORS[animation].map((_, frame) =>
				resolveSlot(slot("crown"), animation, frame, {}, pigId)?.overlay?.width,
			);
			expect(new Set(widths.map((width) => width?.toFixed(6))).size).toBe(1);
		}
	});

	test("head items inherit measured crown tilt, capped at eight degrees", () => {
		for (const pigId of PIG_IDS) {
			for (const animation of ANIMATIONS) {
				for (let frame = 0; frame < PIG_FRAME_ANCHORS[animation].length; frame += 1) {
					const overlay = resolveSlot(slot("crown"), animation, frame, {}, pigId)?.overlay;
					const crownPose = resolveWearablePose(animation, frame, "head", pigId);
					expect(overlay?.rotate ?? 0).toBeCloseTo(crownPose.rotate, 5);
					expect(Math.abs(overlay?.rotate ?? 0)).toBeLessThanOrEqual(8);
				}
			}
		}
		const headTilt = resolveWearablePose("sad", 0, "head", "rosie").rotate;
		const eyeTilt = resolveWearablePose("sad", 0, "eyes", "rosie").rotate;
		expect(headTilt).not.toBeCloseTo(eyeTilt, 1);
	});

	test("every generated head item pins its rotated pivot to every measured crown frame", () => {
		for (const [itemId, baseRel] of HEAD_ITEMS) {
			for (const pigId of PIG_IDS) {
				for (const animation of ANIMATIONS) {
					const rel = { ...baseRel, ...(baseRel.perAnim?.[animation] ?? {}) };
					for (let frame = 0; frame < PIG_FRAME_ANCHORS[animation].length; frame += 1) {
						const overlay = resolveSlot(slot(itemId), animation, frame, {}, pigId)?.overlay;
						const actual = rotatedPivot(overlay, rel);
						const expected = resolveAnchor(animation, frame, "head", pigId);
						expect(actual.x).toBeCloseTo(expected.x, 5);
						expect(actual.y).toBeCloseTo(expected.y, 5);
					}
				}
			}
		}
	});

	test("astronaut helmet expands around lowered sad and tired faces", () => {
		const rel = HAT_REL.astronaut;
		expect(rel.perAnim?.sad?.widthFrac).toBeCloseTo(1.15, 5);
		expect(rel.perAnim?.sad?.pivot?.y).toBeCloseTo(0.2, 5);
		expect(rel.perAnim?.tired?.widthFrac).toBeCloseTo(1.05, 5);
		expect(rel.perAnim?.tired?.pivot?.y).toBeCloseTo(0.2, 5);

		for (const pigId of PIG_IDS) {
			for (const animation of ["sad", "tired"] as const) {
				for (let frame = 0; frame < PIG_FRAME_ANCHORS[animation].length; frame += 1) {
					const overlay = resolveSlot(
						slot("astronaut"),
						animation,
						frame,
						{},
						pigId,
					)?.overlay;
					expect(overlay).toBeDefined();
					if (!overlay) continue;

					// The expanded helmet must contain both facial landmarks with usable
					// room inside its outer silhouette, including every lowered frame.
					for (const anchor of ["eyes", "snout"] as const) {
						const point = resolveAnchor(animation, frame, anchor, pigId);
						const top = PIG_CANVAS - overlay.bottom - overlay.height;
						expect(point.x).toBeGreaterThan(overlay.left + overlay.width * 0.12);
						expect(point.x).toBeLessThan(overlay.left + overlay.width * 0.88);
						expect(point.y).toBeGreaterThan(top + overlay.height * 0.12);
						expect(point.y).toBeLessThan(top + overlay.height * 0.88);
					}
				}
			}
		}
	});

	test("side artwork remains selected on every turned source frame", () => {
		for (const [itemId, source] of Object.entries(HAT_SIDE_IMAGES)) {
			if (!HAT_REL[itemId] || source === undefined) continue;
			for (const animation of ["face", "face_sit"] as const) {
				for (let frame = 0; frame < PIG_FRAME_ANCHORS[animation].length; frame += 1) {
					expect(resolveSlot(slot(itemId), animation, frame)?.imageSrc).toBe(source);
				}
			}
		}
	});

	test("authored pivots preserve the original Rosie idle baseline", () => {
		for (const [itemId, rel] of HEAD_ITEMS) {
			const overlay = resolveSlot(slot(itemId), "idle", 0)?.overlay;
			const actual = rotatedPivot(overlay, rel);
			const baseline = resolveAnchor("idle", 0, "head", "rosie");
			expect(actual.x).toBeCloseTo(baseline.x, 5);
			expect(actual.y).toBeCloseTo(baseline.y, 5);
		}
	});

	test("a legacy hat without RelSpec follows pig-specific movement, rotation, and family scale", () => {
		const itemId = "wallow_sovereign_crown";
		expect(HAT_REL[itemId]).toBeUndefined();
		const idle = resolveSlot(slot(itemId), "idle", 0, {}, "rosie")?.overlay;
		const sad = resolveSlot(slot(itemId), "sad", 0, {}, "rosie")?.overlay;
		const pepperTired = resolveSlot(slot(itemId), "tired", 0, {}, "pepper")?.overlay;
		const rosieTired = resolveSlot(slot(itemId), "tired", 0, {}, "rosie")?.overlay;
		expect(sad?.left).not.toBe(idle?.left);
		expect(sad?.rotate ?? 0).toBeCloseTo(
			resolveWearablePose("sad", 0, "head", "rosie").rotate,
			5,
		);
		expect(sad?.width).not.toBe(idle?.width);
		expect(pepperTired?.left).not.toBe(rosieTired?.left);
	});

	test("non-head categories retain the existing shared anatomy table", () => {
		for (const anchor of ["eyes", "snout", "neck", "body", "hand_r"] as const) {
			for (const animation of ANIMATIONS) {
				for (let frame = 0; frame < PIG_FRAME_ANCHORS[animation].length; frame += 1) {
					const rosie = resolveAnchor(animation, frame, anchor, "rosie");
					for (const pigId of PIG_IDS) {
						expect(resolveAnchor(animation, frame, anchor, pigId)).toEqual(rosie);
					}
				}
			}
		}
	});

	test("direct image sources preserve their authored aspect without a resolver", () => {
		const direct = { width: 240, height: 120 } as unknown as number;
		expect(resolvePigStageAssetAspect(direct)).toBe(0.5);
		expect(resolvePigStageAssetAspect(direct, jest.fn())).toBe(0.5);
	});
});
