// Global popup queue. iOS can only reliably present ONE native <Modal> at a
// time — mounting a second while the first is up (or mid-dismiss) leaves an
// invisible modal that still eats touches, so the player gets stuck. The launch
// + home popups live in two different component trees (root _layout vs the Barn
// tab), so a local guard in either one can't see the other.
//
// This provider is the single arbiter: every popup declares "I want to show"
// via usePopupSlot(id, want, priority); only the highest-priority waiter is told
// it's `visible`. On dismiss the slot calls release(), which clears it AND holds
// a short beat so the outgoing modal fully unmounts before the next mounts.
// Result: anything that wants to pop shows strictly one-by-one.
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from "react";

type Req = { id: string; priority: number };

interface QueueApi {
	request: (id: string, priority: number) => void;
	drop: (id: string) => void;
	release: (id: string) => void;
	activeId: string | null;
}

const PopupCtx = createContext<QueueApi | null>(null);

export function PopupQueueProvider({ children }: { children: ReactNode }) {
	const [reqs, setReqs] = useState<Req[]>([]);
	const [gap, setGap] = useState(false);
	const gapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const request = useCallback((id: string, priority: number) => {
		setReqs((r) => (r.some((x) => x.id === id) ? r : [...r, { id, priority }]));
	}, []);

	const drop = useCallback((id: string) => {
		setReqs((r) => r.filter((x) => x.id !== id));
	}, []);

	const release = useCallback((id: string) => {
		setReqs((r) => r.filter((x) => x.id !== id));
		setGap(true);
		if (gapTimer.current) clearTimeout(gapTimer.current);
		gapTimer.current = setTimeout(() => setGap(false), 380);
	}, []);

	useEffect(
		() => () => {
			if (gapTimer.current) clearTimeout(gapTimer.current);
		},
		[]
	);

	// Lowest priority number wins; ties keep request order (stable sort).
	const activeId = useMemo(() => {
		if (gap || reqs.length === 0) return null;
		return [...reqs].sort((a, b) => a.priority - b.priority)[0].id;
	}, [reqs, gap]);

	const value = useMemo<QueueApi>(
		() => ({ request, drop, release, activeId }),
		[request, drop, release, activeId]
	);

	return <PopupCtx.Provider value={value}>{children}</PopupCtx.Provider>;
}

// Declare a popup. `want` = its own trigger condition (state). Returns whether
// it's allowed to be on screen right now (`visible`) and `release()` to call on
// dismiss. Lower `priority` shows first when several want to show at once.
export function usePopupSlot(id: string, want: boolean, priority = 100) {
	const ctx = useContext(PopupCtx);

	useEffect(() => {
		if (!ctx) return;
		if (want) ctx.request(id, priority);
		else ctx.drop(id);
		return () => ctx.drop(id);
	}, [ctx, id, want, priority]);

	const visible = !!ctx && want && ctx.activeId === id;
	const release = useCallback(() => ctx?.release(id), [ctx, id]);
	return { visible, release };
}
