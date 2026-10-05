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

// The receipt sheet is a SECOND native Modal, presented from the dig's own.
// iOS dismisses the topmost presented controller first: closing the dig while
// the sheet was up dismissed the SHEET and stranded the dig's controller —
// invisible over the whole app, eating every touch ("the app freezes after I
// close out of dig", 2026-09-20). Leaving now hides the sheet first and closes
// the dig from the sheet's onDismiss (or a fallback timer).
describe("leaving from the receipt lets the sheet go before the dig", () => {
	const dig = read("components/mudwar/SnoutDeepDig.tsx");
	const sheets = read("components/mudwar/SnoutDeepSheets.tsx");

	it("hides the sheet, then closes the dig on its dismissal or the fallback", () => {
		expect(dig).toMatch(/const RECEIPT_RELEASE_MS = MOTION_DURATION\.modal \* 3;/);
		expect(dig).toMatch(/const \[leaving, setLeaving\] = useState\(false\);/);
		// A leave with a sheet up parks the close and hides the sheet.
		const leaveAt = dig.indexOf("const leave = useCallback(");
		expect(dig.indexOf("afterLeaveRef.current = done;", leaveAt)).toBeGreaterThan(leaveAt);
		expect(dig.indexOf("setLeaving(true);", leaveAt)).toBeGreaterThan(leaveAt);
		expect(dig).toMatch(/setTimeout\(finishLeave, RECEIPT_RELEASE_MS\)/);
		// The sheet reports its dismissal into the same release.
		expect(dig).toMatch(/<DigReceiptSheet[\s\S]{0,400}onDismiss=\{finishLeave\}/);
		expect(dig).toMatch(/<DigReceiptSheet[\s\S]{0,200}visible=\{!leaving\}/);
	});

	it("every way out of a finished dig goes through leave — never onClose directly", () => {
		expect(dig).toMatch(/onExit=\{exit\}/);
		expect(dig).toMatch(/onPrimary=\{exit\}/);
		expect(dig).toMatch(/onClose=\{exit\}/);
		// The join waits out the dig's slide (the close queues the Barn tab) and
		// goes to Friends ▸ Sounder, never the Season page, which has no herd door.
		expect(dig).toMatch(
			/const join = useCallback\(\s*\(\) => leave\(\(\) => setTimeout\(\(\) => router\.push\(JOIN_PATH\), POPUP_HANDOFF_GAP_MS\)\),\s*\[leave\],\s*\);/,
		);
		expect(dig).toMatch(/const JOIN_PATH = \{ pathname: "\/\(tabs\)\/friends", params: \{ seg: "sounder" \} \} as const;/);
		// The host's own close (accessibility escape) is routed through it too.
		expect(dig).toMatch(/registerLeave\?\.\(async \(\) => leave\(\)\);/);
		expect(read("components/mudwar/useFeedingCta.tsx")).toMatch(
			/<SnoutDeepDig[\s\S]{0,400}registerLeave=\{registerLeave\}/,
		);
	});

	it("the receipt sheet forwards the native dismissal", () => {
		expect(sheets).toMatch(/<AdaptiveModalScaffold[\s\S]{0,200}onDismiss=\{onDismiss\}/);
		expect(sheets).toMatch(/animationType=\{animationType\}/);
	});

	it("the unmanaged-modal hold outlives the close by the handoff gap", () => {
		const queue = read("components/ui/PopupQueue.tsx");
		const at = queue.indexOf("export function useUnmanagedModalHold(");
		expect(queue.indexOf("setTimeout(() => setHeld(false), POPUP_HANDOFF_GAP_MS)", at)).toBeGreaterThan(at);
		expect(queue.indexOf("usePopupHold(open || held);", at)).toBeGreaterThan(at);
	});
});
