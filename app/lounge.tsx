// The Slop Club Lounge — P1 scaffold (docs/lounge-farm-spec.md).
//
// A walkable field rendered on a Skia canvas: tap a spot, Rosie trots there
// (founder call: tap-to-walk, no thumbstick). Camera follows with clamping.
// Members only — gated on profiles.is_vip, same flag the Barn chip gates on.
//
// P1 scope: solo walk on a placeholder ground (homestead_barn backdrop until
// the painted farm scene lands), south-facing strip for every direction until
// the N/E/W strips are sliced. Realtime presence (P2) and emotes (P3) layer
// onto the same shared-value state.
import React, { useEffect, useRef, useState } from "react";
import { Dimensions, Pressable, StyleSheet, View } from "react-native";
import {
	Canvas,
	Group,
	Image as SkiaImage,
	Text as SkiaText,
	useFont,
	useImage,
} from "@shopify/react-native-skia";
import {
	Gesture,
	GestureDetector,
	GestureHandlerRootView,
} from "react-native-gesture-handler";
import {
	runOnJS,
	useDerivedValue,
	useFrameCallback,
	useSharedValue,
} from "react-native-reanimated";
import { Stack, router } from "expo-router";
import { supabase } from "@/utils/supabase";
import { useLoungePeers } from "@/hooks/useLoungePeers";
import { Icon } from "@/components/ui/Icon";
import { Glyph, glyphSource, type GlyphName } from "@/components/ui/Glyph";
import { WHIMSY } from "@/constants/theme";

const { width: SW, height: SH } = Dimensions.get("window");
// lounge_farm.png native size drawn at 1:2 (432×910 pt world) — generated
// farm playfield (fence border, mud wallow, barn, trough). The fence is the
// walkable border: walk targets clamp inside FENCE_INSET.
const WORLD_W = 432;
const WORLD_H = 910;
const FENCE_INSET = 46;
const PIG = 96; // on-screen pig box (pt); frames are square 256s
// The seesaw station (P2b/c) — pivot point in world coords, a seat at each
// plank end. Both seats full -> every client runs the same sine ride
// anchored to the later sitter's `since` (zero extra network traffic).
const SEESAW = { x: 216, y: 640 };
const SEAT_DX = 54;
const SEESAW_TAP_R = 55;
const SPEED = 170; // walk speed, pt/s
const FRAME_MS = 125; // 8 fps walk cycle

export default function LoungeScreen() {
	// Member gate — same source of truth as the Barn chip (profiles.is_vip).
	// Non-members are bounced straight back; the chip that routes here is
	// itself member-gated, so this only fires on deep links / stale sessions.
	const [allowed, setAllowed] = useState(false);
	const [me, setMe] = useState<{ uid: string; username: string } | null>(null);
	useEffect(() => {
		let cancelled = false;
		(async () => {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) {
				router.back();
				return;
			}
			const { data } = await supabase
				.from("profiles")
				.select("is_vip, username")
				.eq("id", user.id)
				.single();
			if (cancelled) return;
			if (data?.is_vip) {
				setMe({ uid: user.id, username: data.username ?? "a pig" });
				setAllowed(true);
			} else router.back();
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	// P2a — realtime peers. Presence + 10 Hz pos broadcast while walking;
	// remote pigs animate off their movedAt recency (see ticker below).
	const { peers, sendPos, sendEmote, setStation } = useLoungePeers(
		me?.uid ?? null,
		me?.username ?? "a pig",
		{ x: WORLD_W / 2, y: WORLD_H / 2 }
	);

	const ground = useImage(
		require("../assets/images/backgrounds/lounge_farm.png")
	);
	// 4 directions × 4 frames. Hook count is static — the arrays are fixed.
	const sImgs = [
		useImage(require("../assets/images/sprites/rosie/lounge/walk_s_1.png")),
		useImage(require("../assets/images/sprites/rosie/lounge/walk_s_2.png")),
		useImage(require("../assets/images/sprites/rosie/lounge/walk_s_3.png")),
		useImage(require("../assets/images/sprites/rosie/lounge/walk_s_4.png")),
	];
	const nImgs = [
		useImage(require("../assets/images/sprites/rosie/lounge/walk_n_1.png")),
		useImage(require("../assets/images/sprites/rosie/lounge/walk_n_2.png")),
		useImage(require("../assets/images/sprites/rosie/lounge/walk_n_3.png")),
		useImage(require("../assets/images/sprites/rosie/lounge/walk_n_4.png")),
	];
	const eImgs = [
		useImage(require("../assets/images/sprites/rosie/lounge/walk_e_1.png")),
		useImage(require("../assets/images/sprites/rosie/lounge/walk_e_2.png")),
		useImage(require("../assets/images/sprites/rosie/lounge/walk_e_3.png")),
		useImage(require("../assets/images/sprites/rosie/lounge/walk_e_4.png")),
	];
	const wImgs = [
		useImage(require("../assets/images/sprites/rosie/lounge/walk_w_1.png")),
		useImage(require("../assets/images/sprites/rosie/lounge/walk_w_2.png")),
		useImage(require("../assets/images/sprites/rosie/lounge/walk_w_3.png")),
		useImage(require("../assets/images/sprites/rosie/lounge/walk_w_4.png")),
	];
	const dirImgs = [sImgs, nImgs, eImgs, wImgs]; // index = DIR_S/N/E/W
	const idleImgs = [
		useImage(require("../assets/images/sprites/rosie/lounge/idle_s_1.png")),
		useImage(require("../assets/images/sprites/rosie/lounge/idle_s_2.png")),
		useImage(require("../assets/images/sprites/rosie/lounge/idle_s_3.png")),
		useImage(require("../assets/images/sprites/rosie/lounge/idle_s_4.png")),
	];

	// Emotes (P3) — one-shot broadcast; bubble floats over the pig ~1.8s.
	const EMOTES: GlyphName[] = ["heart", "sparkles", "coffee"];
	const emoteImgs = [
		useImage(glyphSource("heart")),
		useImage(glyphSource("sparkles")),
		useImage(glyphSource("coffee")),
	];
	const tagFont = useFont(
		require("../assets/fonts/SpaceMono-Regular.ttf"),
		11
	);
	const [myEmote, setMyEmote] = useState<{ i: number; at: number } | null>(
		null
	);

	const seesawBase = useImage(require("../assets/images/lounge/seesaw_base.png"));
	const seesawPlank = useImage(require("../assets/images/lounge/seesaw_plank.png"));
	const [myStation, setMyStation] = useState<{
		slot: number;
		since: number;
	} | null>(null);
	const pendingSeat = useRef<number | null>(null);

	// Pig position (feet point) + walk target, all on the UI thread.
	const px = useSharedValue(WORLD_W / 2);
	const py = useSharedValue(WORLD_H / 2);
	const tx = useSharedValue(WORLD_W / 2);
	const ty = useSharedValue(WORLD_H / 2);
	const frame = useSharedValue(0);
	const walkClock = useSharedValue(0);
	// 0=S 1=N 2=E 3=W — indexes dirImgs. Faces the walk direction; keeps the
	// last facing at rest.
	const dir = useSharedValue(0);
	const resting = useSharedValue(1);
	// 0 empty · 1 left only · 2 right only · 3 both (ride!)
	const seatMode = useSharedValue(0);
	const rideSince = useSharedValue(0);
	const seesawRot = useSharedValue(0);

	useFrameCallback((info) => {
		"worklet";
		const dtMs = info.timeSincePreviousFrame ?? 16;
		const dx = tx.value - px.value;
		const dy = ty.value - py.value;
		const dist = Math.hypot(dx, dy);
		if (dist > 2) {
			const step = Math.min(dist, (SPEED * dtMs) / 1000);
			px.value += (dx / dist) * step;
			py.value += (dy / dist) * step;
			walkClock.value += dtMs;
			resting.value = 0;
			frame.value = Math.floor(walkClock.value / FRAME_MS) % 4;
			dir.value =
				Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 3) : dy > 0 ? 0 : 1;
		} else {
			// At rest: gentle S-facing idle loop (other facings hold frame 1).
			resting.value = 1;
			walkClock.value += dtMs;
			frame.value = Math.floor(walkClock.value / (FRAME_MS * 3)) % 4;
		}
		// Seesaw plank: deterministic on every client — pure f(now, since).
		seesawRot.value =
			seatMode.value === 3
				? Math.sin((Date.now() - rideSince.value) / 450) * 0.2
				: seatMode.value === 1
				? -0.16
				: seatMode.value === 2
				? 0.16
				: 0;
	});

	// Camera: keep the pig centered until the world edge clamps the view.
	const camX = useDerivedValue(() =>
		Math.min(Math.max(px.value - SW / 2, 0), Math.max(WORLD_W - SW, 0))
	);
	const camY = useDerivedValue(() =>
		Math.min(Math.max(py.value - SH / 2, 0), Math.max(WORLD_H - SH, 0))
	);
	const camTransform = useDerivedValue(() => [
		{ translateX: -camX.value },
		{ translateY: -camY.value },
	]);

	// Screen tap → world-space walk target, clamped inside the field.
	// Station logic runs on JS (it needs peers state): tapping near the
	// seesaw walks to a free seat; anywhere else stands up + walks.
	const handleTap = (wx: number, wy: number) => {
		const nearSeesaw =
			Math.hypot(wx - SEESAW.x, wy - SEESAW.y) < SEESAW_TAP_R;
		if (nearSeesaw) {
			const taken = new Set(
				peers
					.filter((pr) => pr.station?.id === "seesaw")
					.map((pr) => pr.station!.slot)
			);
			if (myStation) taken.add(myStation.slot);
			const slot = !taken.has(0) ? 0 : !taken.has(1) ? 1 : null;
			if (slot !== null) {
				pendingSeat.current = slot;
				tx.value = SEESAW.x + (slot === 0 ? -SEAT_DX : SEAT_DX);
				ty.value = SEESAW.y - 6;
				return;
			}
		}
		if (myStation) {
			setMyStation(null);
			setStation(null);
			pendingSeat.current = null;
		}
		tx.value = Math.min(
			Math.max(wx, FENCE_INSET + PIG / 2),
			WORLD_W - FENCE_INSET - PIG / 2
		);
		ty.value = Math.min(
			Math.max(wy, FENCE_INSET + PIG),
			WORLD_H - FENCE_INSET
		);
	};
	const tap = Gesture.Tap().onEnd((e) => {
		"worklet";
		runOnJS(handleTap)(e.x + camX.value, e.y + camY.value);
	});

	// Frame swap via per-(direction,frame) opacity — 16 stacked images, one
	// visible. (Deliberately avoids animating the `image` prop itself.)
	const s0 = useDerivedValue(() => (dir.value === 0 && !resting.value && frame.value === 0 ? 1 : 0));
	const s1 = useDerivedValue(() => (dir.value === 0 && !resting.value && frame.value === 1 ? 1 : 0));
	const s2 = useDerivedValue(() => (dir.value === 0 && !resting.value && frame.value === 2 ? 1 : 0));
	const s3 = useDerivedValue(() => (dir.value === 0 && !resting.value && frame.value === 3 ? 1 : 0));
	const i0 = useDerivedValue(() => (dir.value === 0 && resting.value && frame.value === 0 ? 1 : 0));
	const i1 = useDerivedValue(() => (dir.value === 0 && resting.value && frame.value === 1 ? 1 : 0));
	const i2 = useDerivedValue(() => (dir.value === 0 && resting.value && frame.value === 2 ? 1 : 0));
	const i3 = useDerivedValue(() => (dir.value === 0 && resting.value && frame.value === 3 ? 1 : 0));
	const idleOpacities = [i0, i1, i2, i3];
	const n0 = useDerivedValue(() => (dir.value === 1 && frame.value === 0 ? 1 : 0));
	const n1 = useDerivedValue(() => (dir.value === 1 && frame.value === 1 ? 1 : 0));
	const n2 = useDerivedValue(() => (dir.value === 1 && frame.value === 2 ? 1 : 0));
	const n3 = useDerivedValue(() => (dir.value === 1 && frame.value === 3 ? 1 : 0));
	const e0 = useDerivedValue(() => (dir.value === 2 && frame.value === 0 ? 1 : 0));
	const e1 = useDerivedValue(() => (dir.value === 2 && frame.value === 1 ? 1 : 0));
	const e2 = useDerivedValue(() => (dir.value === 2 && frame.value === 2 ? 1 : 0));
	const e3 = useDerivedValue(() => (dir.value === 2 && frame.value === 3 ? 1 : 0));
	const w0 = useDerivedValue(() => (dir.value === 3 && frame.value === 0 ? 1 : 0));
	const w1 = useDerivedValue(() => (dir.value === 3 && frame.value === 1 ? 1 : 0));
	const w2 = useDerivedValue(() => (dir.value === 3 && frame.value === 2 ? 1 : 0));
	const w3 = useDerivedValue(() => (dir.value === 3 && frame.value === 3 ? 1 : 0));
	const opacities = [
		[s0, s1, s2, s3],
		[n0, n1, n2, n3],
		[e0, e1, e2, e3],
		[w0, w1, w2, w3],
	];

	const plankTransform = useDerivedValue(() => [
		{ rotate: seesawRot.value },
	]);
	const pigX = useDerivedValue(() => px.value - PIG / 2);
	const pigY = useDerivedValue(() => py.value - PIG);
	const bubbleX = useDerivedValue(() => px.value - 14);
	const bubbleY = useDerivedValue(() => py.value - PIG - 34);

	// Publish my position at 10 Hz while moving (shared values are readable
	// from JS). Also drives an 8 fps tick that re-renders remote walk frames.
	const [remoteTick, setRemoteTick] = useState(0);
	const lastSent = useRef({ x: 0, y: 0 });
	useEffect(() => {
		if (!me) return;
		const pub = setInterval(() => {
			const x = px.value;
			const y = py.value;
			if (
				Math.abs(x - lastSent.current.x) > 1 ||
				Math.abs(y - lastSent.current.y) > 1
			) {
				lastSent.current = { x, y };
				sendPos(x, y, dir.value);
			}
			// Seat arrival → claim it via presence.
			if (pendingSeat.current !== null) {
				const sx = SEESAW.x + (pendingSeat.current === 0 ? -SEAT_DX : SEAT_DX);
				if (Math.hypot(x - sx, y - (SEESAW.y - 6)) < 7) {
					const st = {
						id: "seesaw",
						slot: pendingSeat.current,
						since: Date.now(),
					};
					setMyStation({ slot: st.slot, since: st.since });
					setStation(st);
					pendingSeat.current = null;
				}
			}
		}, 100);
		const tick = setInterval(() => setRemoteTick((t) => t + 1), FRAME_MS);
		return () => {
			clearInterval(pub);
			clearInterval(tick);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [me]);
	const now = Date.now();
	// Mirror seesaw occupancy into UI-thread values for the plank worklet.
	useEffect(() => {
		const sitters = peers
			.filter((pr) => pr.station?.id === "seesaw")
			.map((pr) => pr.station!);
		if (myStation) sitters.push({ id: "seesaw", ...myStation });
		// Conflict rule (spec): earliest `since` keeps a double-claimed seat;
		// the loser quietly stands up and the seat shows one pig everywhere.
		if (myStation) {
			const rival = peers.find(
				(pr) =>
					pr.station?.id === "seesaw" &&
					pr.station.slot === myStation.slot &&
					pr.station.since < myStation.since
			);
			if (rival) {
				setMyStation(null);
				setStation(null);
			}
		}
		const left = sitters.some((st) => st.slot === 0);
		const right = sitters.some((st) => st.slot === 1);
		seatMode.value = left && right ? 3 : left ? 1 : right ? 2 : 0;
		rideSince.value = sitters.length
			? Math.max(...sitters.map((st) => st.since))
			: 0;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [peers, myStation]);

	return (
		<GestureHandlerRootView style={styles.root}>
			<Stack.Screen options={{ headerShown: false }} />
			{allowed && (
				<GestureDetector gesture={tap}>
					<Canvas style={styles.canvas}>
						<Group transform={camTransform}>
							{ground && (
								<SkiaImage
									image={ground}
									x={0}
									y={0}
									width={WORLD_W}
									height={WORLD_H}
									fit="fill"
								/>
							)}
							{/* Seesaw — base, then the plank rotating around the pivot.
						    Drawn under the pigs so riders sit on top. */}
						{seesawBase && (
							<SkiaImage
								image={seesawBase}
								x={SEESAW.x - 26}
								y={SEESAW.y - 42}
								width={52}
								height={41}
							/>
						)}
						{seesawPlank && (
							<Group
								origin={{ x: SEESAW.x, y: SEESAW.y - 34 }}
								transform={plankTransform}
							>
								<SkiaImage
									image={seesawPlank}
									x={SEESAW.x - 75}
									y={SEESAW.y - 52}
									width={150}
									height={37}
								/>
							</Group>
						)}
						{/* Remote pigs — plain props re-rendered at ~10 Hz; walk
						    frames advance while their last pos event is fresh. */}
						{peers.map((peer) => {
							const moving = now - peer.movedAt < 250;
							const img =
								dirImgs[peer.dir]?.[moving ? remoteTick % 4 : 0];
							if (!img) return null;
							const emoteFresh =
								peer.emote && now - peer.emote.at < 1800;
							const eimg = emoteFresh
								? emoteImgs[peer.emote!.i]
								: null;
							return (
								<Group key={peer.key}>
									<SkiaImage
										image={img}
										x={peer.x - PIG / 2}
										y={peer.y - PIG}
										width={PIG}
										height={PIG}
									/>
									{tagFont && (
										<SkiaText
											text={peer.username}
											font={tagFont}
											x={peer.x - peer.username.length * 3.3}
											y={peer.y + 14}
											color="#4a3325"
										/>
									)}
									{eimg && (
										<SkiaImage
											image={eimg}
											x={peer.x - 14}
											y={peer.y - PIG - 34}
											width={28}
											height={28}
										/>
									)}
								</Group>
							);
						})}
						{idleImgs.map(
							(img, i) =>
								img && (
									<SkiaImage
										key={`idle-${i}`}
										image={img}
										x={pigX}
										y={pigY}
										width={PIG}
										height={PIG}
										opacity={idleOpacities[i]}
									/>
								)
						)}
						{dirImgs.map((imgs, d) =>
								imgs.map(
									(img, i) =>
										img && (
											<SkiaImage
												key={`${d}-${i}`}
												image={img}
												x={pigX}
												y={pigY}
												width={PIG}
												height={PIG}
												opacity={opacities[d][i]}
											/>
										)
								)
							)}
						</Group>
					</Canvas>
				</GestureDetector>
			)}
			{/* Emote bar — one-shot bubbles, broadcast to the room. */}
			{allowed && (
				<View style={styles.emoteBar}>
					{EMOTES.map((g, i) => (
						<Pressable
							key={g}
							onPress={() => {
								setMyEmote({ i, at: Date.now() });
								sendEmote(i);
							}}
							style={({ pressed }) => [
								styles.emoteBtn,
								pressed && { opacity: 0.8 },
							]}
						>
							<Glyph name={g} size={22} />
						</Pressable>
					))}
				</View>
			)}

			{/* Exit — back to the Barn. */}
			<Pressable
				onPress={() => router.back()}
				style={({ pressed }) => [styles.exit, pressed && { opacity: 0.8 }]}
				hitSlop={8}
			>
				<Icon name="x" size={18} color={WHIMSY.ink} strokeWidth={2.4} />
			</Pressable>
		</GestureHandlerRootView>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: "#9ec27a" },
	canvas: { flex: 1 },
	emoteBar: {
		position: "absolute",
		bottom: 42,
		alignSelf: "center",
		flexDirection: "row",
		gap: 14,
	},
	emoteBtn: {
		width: 46,
		height: 46,
		borderRadius: 23,
		backgroundColor: WHIMSY.paper,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
	},
	exit: {
		position: "absolute",
		top: 58,
		right: 18,
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: WHIMSY.paper,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
	},
});
