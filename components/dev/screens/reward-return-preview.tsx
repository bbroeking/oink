// Dev preview for the reward return (components/RewardReturn.tsx): a pig comes
// home with a find, the card pops, the coin hops to the bag. Fake grant, so
// every branch — landed, refused once, two items, Reduce Motion — can be seen
// on the sim without a server. Route: /reward-return-preview (dev only).
// (2026-09-18)

import { useRef, useState } from "react";
import { SafeAreaView, StyleSheet, View } from "react-native";
import { RewardReturn } from "@/components/RewardReturn";
import { Body, Button, Glyph, Hand, KickerPill, PageHeader, Sticker } from "@/components/ui";
import { MotionPolicyProvider } from "@/hooks/useMotionPolicy";
import { PAGE_PAD, RADII, SPACE, WHIMSY } from "@/constants/theme";
import type { PigId } from "@/utils/pigs";
import type { GrantResult, Point, RewardItem } from "@/utils/rewardReturn";

const FEATHER: RewardItem = { id: "blue_feather", kind: "find", name: "blue feather" };
const PEBBLES: RewardItem = { id: "river_pebble", kind: "find", name: "river pebble", count: 2 };
const FAKE_GRANT_MS = 700;

export default function RewardReturnPreview() {
	const [open, setOpen] = useState(false);
	const [pig, setPig] = useState<PigId>("bandit");
	const [two, setTwo] = useState(false);
	const [failOnce, setFailOnce] = useState(false);
	const [reduce, setReduce] = useState(false);
	const [log, setLog] = useState<string[]>([]);
	const failed = useRef(false);
	const bag = useRef<View>(null);
	const [target, setTarget] = useState<Point | null>(null);

	const items = two ? [FEATHER, PEBBLES] : [FEATHER];

	const start = () => {
		failed.current = false;
		bag.current?.measureInWindow((x, y, w, h) => setTarget({ x: x + w / 2, y: y + h / 2 }));
		setOpen(true);
	};

	const grant = (): Promise<GrantResult> =>
		new Promise((resolve) =>
			setTimeout(() => {
				if (failOnce && !failed.current) {
					failed.current = true;
					resolve({ ok: false, reason: "bag_full", retryable: true });
				} else resolve({ ok: true });
			}, FAKE_GRANT_MS)
		);

	return (
		<MotionPolicyProvider reduceMotion={reduce}>
			<SafeAreaView style={styles.page}>
				<PageHeader kicker="dev" title="Reward return" />
				<View style={styles.body}>
					{/* The bag the coins fly to — measured for the target. */}
					<View style={styles.bagRow}>
						<View ref={bag} collapsable={false}>
							<Sticker color="sun" rotate={2} radius={RADII.md} shadow="sm" style={styles.bag}>
								<Glyph name="digBag" size={24} />
								<Hand>satchel</Hand>
							</Sticker>
						</View>
					</View>

					<KickerPill>who comes home</KickerPill>
					<View style={styles.row}>
						{(["rosie", "bandit", "pickles"] as PigId[]).map((p) => (
							<Button key={p} variant={pig === p ? "gold" : "ghost"} size="sm" onPress={() => setPig(p)}>
								{p}
							</Button>
						))}
					</View>
					<KickerPill>branches</KickerPill>
					<View style={styles.row}>
						<Button variant={two ? "gold" : "ghost"} size="sm" onPress={() => setTwo((v) => !v)}>
							two items
						</Button>
						<Button variant={failOnce ? "gold" : "ghost"} size="sm" onPress={() => setFailOnce((v) => !v)}>
							refuse once
						</Button>
						<Button variant={reduce ? "gold" : "ghost"} size="sm" onPress={() => setReduce((v) => !v)}>
							reduce motion
						</Button>
					</View>
					<Button variant="gold" size="md" full onPress={start} accessibilityLabel="Play the return">
						{pig} comes home
					</Button>
					{log.map((l, i) => (
						<Body key={i} tone="secondary">
							{l}
						</Body>
					))}
				</View>

				<RewardReturn
					open={open}
					pigId={pig}
					carry={items[0]}
					items={items}
					kicker="he found it"
					title={two ? "a blue feather, and pebbles" : "a blue feather"}
					body="the one Maya’s Pickles is hoping for"
					primaryLabel="Give it to Maya"
					primaryBusyLabel="Handing it over…"
					secondaryLabel="Keep it"
					grantedLine="Maya’s pig has its feather · you both got 3 tickles"
					target={target}
					onGrant={grant}
					onDone={(outcome) => {
						setOpen(false);
						setLog((l) => [`${new Date().toLocaleTimeString()} · ${outcome}`, ...l].slice(0, 5));
					}}
				/>
			</SafeAreaView>
		</MotionPolicyProvider>
	);
}

const styles = StyleSheet.create({
	page: { flex: 1, backgroundColor: WHIMSY.cream },
	body: { padding: PAGE_PAD, gap: SPACE.sm },
	bagRow: { alignItems: "flex-end", marginBottom: SPACE.md },
	bag: { paddingHorizontal: SPACE.md, paddingVertical: SPACE.xs, flexDirection: "row", gap: SPACE.xs, alignItems: "center" },
	row: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.xs },
});
