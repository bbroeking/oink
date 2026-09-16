// The dig modal's exit (2026-09-16). close() nulls the live session in the
// same tick the scaffold's `visible` goes false, and the native Modal keeps
// rendering its children through the exit animation — so with the session
// gone the tree fell through to LivingMudRecovery and "Let's check your
// finds" flashed over the Barn after every dig. The CTA now slides out with
// the session it was showing (`exiting`), released when the Modal reports
// its dismissal (or by a timer where it never does). Source-scan guards, the
// repo's habit for a hook this wired (useRooting, the clock, AsyncStorage).

import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(__dirname, "..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

describe("the dig modal slides out with the screen it was showing", () => {
	const cta = read("components/mudwar/useFeedingCta.tsx");

	it("parks the live session as `exiting` when closing, and the tree reads it", () => {
		expect(cta).toMatch(/const \[exiting, setExiting\] = useState<RootingSession \| null>\(null\)/);
		// close() captures the session BEFORE clear() nulls it.
		const closeAt = cta.indexOf("const close = useCallback(");
		const parkAt = cta.indexOf("setExiting(session);", closeAt);
		const clearAt = cta.indexOf("clear();", closeAt);
		expect(parkAt).toBeGreaterThan(closeAt);
		expect(parkAt).toBeLessThan(clearAt);
		// The shown session: live while visible, the parked one while sliding out.
		expect(cta).toMatch(/const shown = session \?\? \(visible \? null : exiting\);/);
		// Both digs, and the recovered-receipt gate, render from `shown`.
		expect(cta).toMatch(/shown && shown\.mode === "snout_deep" \? \(/);
		expect(cta).toMatch(/<SnoutDeepDig[\s\S]{0,200}session=\{shown\}/);
		expect(cta).toMatch(/<TrufflePatch[\s\S]{0,200}session=\{shown\}/);
		expect(cta).not.toMatch(/session=\{session\}/);
	});

	it("keeps the presented MODE through the slide — a dismissing dig never turns into a card", () => {
		expect(cta).toMatch(/const deep = shown\?\.mode === "snout_deep";/);
		expect(cta).toMatch(/bare=\{!deep\}/);
		expect(cta).toMatch(/fullScreen=\{deep\}/);
		expect(cta).toMatch(/animationType=\{deep \? "slide" : "fade"\}/);
	});

	it("releases the parked session on the Modal's dismissal, or by the fallback timer", () => {
		expect(cta).toMatch(/const dismissed = useCallback\(\(\) => setExiting\(null\), \[\]\);/);
		expect(cta).toMatch(/onDismiss=\{dismissed\}/);
		expect(cta).toMatch(/const DISMISS_RELEASE_MS = MOTION_DURATION\.modal \* 3;/);
		expect(cta).toMatch(/setTimeout\(dismissed, DISMISS_RELEASE_MS\)/);
	});

	it("the scaffold forwards onDismiss to the native Modal", () => {
		const scaffold = read("components/ui/AdaptiveModalScaffold.tsx");
		expect(scaffold).toMatch(/onDismiss\?: \(\) => void;/);
		expect(scaffold).toMatch(/<Modal[\s\S]{0,300}onDismiss=\{onDismiss\}/);
	});
});

describe("a surfaced thing's reveal never enters the patch's scroll flow", () => {
	it("is an absolute, pointer-transparent overlay rendered beside the ScrollView", () => {
		const patch = read("components/mudwar/SnoutDeepPatch.tsx");
		const scrollClose = patch.indexOf("</ScrollView>");
		const overlayAt = patch.indexOf('<View style={styles.revealOverlay} pointerEvents="none">');
		expect(overlayAt).toBeGreaterThan(scrollClose);
		expect(patch).toMatch(/revealOverlay: \{\s*position: "absolute",/);
	});
});
