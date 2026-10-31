// Bullion's Market — the bull's poses and the corkboard, plus the two price
// drawings: the counter row's sparkline and a find's chart (the price, his
// two prices as a band, every trade as a dot).
//
// Art: Bullion is the prototype's painted 256² sticker family (the trader's
// family: ink outline, cel shade, two sparkles), five poses — standing,
// behind his counter, the gavel (a sale lands), cheering (a pig beat his
// counter, or you moved the price), and the shrug (a refusal).
import { Image, StyleSheet, View } from "react-native";
import Svg, { Circle, Line, Polygon, Polyline, Text as SvgText } from "react-native-svg";
import { BORDER, FONTS, RADII, SPACE, TYPE, WHIMSY, inkAlpha } from "@/constants/theme";
import { askAt, bidAt, fmtPrice, type MarketTuning } from "@/constants/market";
import type { PricePoint, TradeKind } from "@/utils/market";
import type { BullionPose } from "./marketCopy";

const POSES: Readonly<Record<BullionPose, number>> = {
	stand: require("../../assets/images/market/bullion.png"),
	counter: require("../../assets/images/market/bullion_counter.png"),
	gavel: require("../../assets/images/market/bullion_gavel.png"),
	cheer: require("../../assets/images/market/bullion_cheer.png"),
	shrug: require("../../assets/images/market/bullion_shrug.png"),
};
const CORKBOARD = require("../../assets/images/market/corkboard.png");

/** Bullion, in one of his poses. Decorative: the words beside him carry the meaning. */
export function BullionArt({ pose = "stand", size }: { pose?: BullionPose; size: number }) {
	return (
		<Image
			source={POSES[pose]}
			style={{ width: size, height: size }}
			resizeMode="contain"
			accessibilityElementsHidden
			importantForAccessibility="no"
		/>
	);
}

export function CorkboardArt({ size }: { size: number }) {
	return (
		<Image
			source={CORKBOARD}
			style={{ width: size, height: size }}
			resizeMode="contain"
			accessibilityElementsHidden
			importantForAccessibility="no"
		/>
	);
}

// ── The sparkline ─────────────────────────────────────────────────────────────
// Drawing geometry for one small chart, in points.
const SPARK_W = 66;
const SPARK_H = 24;
const SPARK_PAD = 3;
const SPARK_DOT = 2.6;

/** The last day of a price, its usual price as a faint line, on chalk. */
export function Sparkline({ points, usual, ink = WHIMSY.barkText }: { points: PricePoint[]; usual: number; ink?: string }) {
	if (points.length === 0) return <View style={{ width: SPARK_W, height: SPARK_H }} />;
	const ps = points.map((s) => s.p);
	let lo = Math.min(...ps);
	let hi = Math.max(...ps);
	const span = 0.06 * usual;
	if (hi - lo < span) {
		const c = (hi + lo) / 2;
		lo = c - span / 2;
		hi = c + span / 2;
	}
	const n = ps.length;
	const x = (i: number) => SPARK_PAD + (n <= 1 ? 0 : (i * (SPARK_W - 2 * SPARK_PAD)) / (n - 1));
	const y = (p: number) => SPARK_PAD + ((hi - p) / (hi - lo)) * (SPARK_H - 2 * SPARK_PAD);
	const uy = y(usual);
	return (
		<Svg width={SPARK_W} height={SPARK_H} viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} accessibilityElementsHidden importantForAccessibility="no">
			{uy >= 0 && uy <= SPARK_H ? (
				<Line x1={0} x2={SPARK_W} y1={uy} y2={uy} stroke={ink} strokeOpacity={0.3} strokeWidth={BORDER.hair} strokeDasharray="2 3" />
			) : null}
			<Polyline
				points={ps.map((p, i) => `${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(" ")}
				fill="none"
				stroke={ink}
				strokeWidth={BORDER.thin}
				strokeLinejoin="round"
				strokeLinecap="round"
			/>
			<Circle cx={x(n - 1)} cy={y(ps[n - 1])} r={SPARK_DOT} fill={WHIMSY.sun} />
		</Svg>
	);
}

// ── The find's chart ──────────────────────────────────────────────────────────
const CHART_H = 140;
const CHART_H_MINI = 112;
const PAD_L = 26;
const PAD_R = 66;
const PAD_T = 10;
const PAD_B = 18;
const LABEL_GAP = 14;
const DOT_TRADE = 3.4;
const DOT_PRINT = 2.2;
const DOT_LAST = 5.5;
const AXIS_FONT = 10;

export interface PriceChartProps {
	width: number;
	usual: number;
	price: number;
	ask: number;
	bid: number;
	hist: PricePoint[];
	marks?: { t: number; kind: TradeKind; price: number }[];
	tuning: MarketTuning;
	ticksPerDay: number;
	/** A day's line on the onboarding card: shorter, no trade dots. */
	mini?: boolean;
	weekdayOf?: (tick: number) => string;
	/** Does this tick start the player's local day? (Ticks count from UTC.) */
	isDayStart?: (tick: number) => boolean;
	accessibilityLabel: string;
}

/**
 * The price over the last day or two on chalk: Bullion's selling and buying
 * prices as a lit band (his cut is the gap), the price as the line through
 * it, a dot for every trade (sun: the counter, rose: a pig sale, chalk: the
 * townsfolk), and his three numbers labelled at the right edge.
 */
export function PriceChart({
	width,
	usual,
	price,
	ask,
	bid,
	hist,
	marks = [],
	tuning,
	ticksPerDay,
	mini = false,
	weekdayOf,
	isDayStart = (tick: number) => tick % ticksPerDay === 0,
	accessibilityLabel,
}: PriceChartProps) {
	const H = mini ? CHART_H_MINI : CHART_H;
	const W = Math.max(PAD_L + PAD_R + 40, width);
	const hs = hist.length > 0 ? hist : [{ t: 0, p: price }];
	const asks = hs.map((h) => askAt(usual, h.p, tuning));
	const bids = hs.map((h) => bidAt(usual, h.p, tuning));
	const shown = mini ? [] : marks.slice(-80);
	let lo = Math.min(...bids, ...shown.map((m) => m.price));
	let hi = Math.max(...asks, ...shown.map((m) => m.price));
	lo = Math.floor(lo - 1);
	hi = Math.ceil(hi + 1);
	const n = hs.length;
	const t0 = hs[0].t;
	const t1 = hs[n - 1].t;
	const x = (t: number) => PAD_L + (t1 === t0 ? W - PAD_L - PAD_R : ((t - t0) * (W - PAD_L - PAD_R)) / (t1 - t0));
	const y = (p: number) => PAD_T + ((hi - p) / (hi - lo)) * (H - PAD_T - PAD_B);
	const up = hs.map((h, i) => `${x(h.t).toFixed(1)},${y(asks[i]).toFixed(1)}`);
	const dn = hs.map((h, i) => `${x(h.t).toFixed(1)},${y(bids[i]).toFixed(1)}`);
	const grid = [usual, Math.round(usual * tuning.price.lo), Math.round(usual * tuning.price.hi)];
	const ly = y(price);
	let ya = y(ask) + 4;
	const yp = ly + 4;
	let yb = y(bid) + 4;
	if (yp - ya < LABEL_GAP) ya = yp - LABEL_GAP;
	if (yb - yp < LABEL_GAP) yb = yp + LABEL_GAP;
	const chalk = WHIMSY.barkText;
	const chalkMute = WHIMSY.barkMute;
	const axisText = { fontFamily: FONTS.body, fontSize: AXIS_FONT };
	const labelText = { fontFamily: FONTS.bodyExtra, fontSize: TYPE.label.fontSize };

	return (
		<Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
			{grid.map((g, i) => (
				<Line
					key={`g${i}`}
					x1={PAD_L}
					x2={W - PAD_R + 4}
					y1={y(g)}
					y2={y(g)}
					stroke={chalkMute}
					strokeOpacity={i === 0 ? 0.6 : 0.25}
					strokeWidth={BORDER.hair}
					strokeDasharray={i === 0 ? "4 4" : undefined}
				/>
			))}
			{grid.map((g, i) => (
				<SvgText key={`gt${i}`} x={PAD_L - 5} y={y(g) + 4} textAnchor="end" fill={chalkMute} {...axisText}>
					{String(g)}
				</SvgText>
			))}
			{!mini && weekdayOf
				? hs
						.filter((h, i) => i > 0 && isDayStart(h.t))
						.map((h) => (
							<SvgText key={`d${h.t}`} x={x(h.t) + 3} y={H - 5} fill={chalkMute} {...axisText}>
								{weekdayOf(h.t)}
							</SvgText>
						))
				: null}
			<Polygon points={up.concat(dn.slice().reverse()).join(" ")} fill={WHIMSY.sun} fillOpacity={0.14} />
			<Polyline points={up.join(" ")} fill="none" stroke={WHIMSY.roseDeep} strokeWidth={BORDER.thin} />
			<Polyline points={dn.join(" ")} fill="none" stroke={WHIMSY.sage} strokeWidth={BORDER.thin} />
			<Polyline
				points={hs.map((h) => `${x(h.t).toFixed(1)},${y(h.p).toFixed(1)}`).join(" ")}
				fill="none"
				stroke={chalk}
				strokeWidth={BORDER.ink}
				strokeLinejoin="round"
			/>
			{shown.map((m, i) => (
				<Circle
					key={`m${i}`}
					cx={x(Math.max(t0, m.t))}
					cy={y(m.price)}
					r={m.kind === "print" ? DOT_PRINT : DOT_TRADE}
					fill={m.kind === "counter" ? WHIMSY.sun : m.kind === "pig" ? WHIMSY.roseDeep : inkAlpha(0)}
					stroke={m.kind === "print" ? chalkMute : WHIMSY.ink}
					strokeWidth={BORDER.hair}
				/>
			))}
			<Circle cx={x(t1)} cy={ly} r={DOT_LAST} fill={WHIMSY.sun} stroke={WHIMSY.ink} strokeWidth={BORDER.thin} />
			<SvgText x={W - PAD_R + 10} y={ya} fill={WHIMSY.roseDeep} {...labelText}>{`I sell ${ask}`}</SvgText>
			<SvgText x={W - PAD_R + 10} y={yp} fill={chalk} {...labelText}>{`price ${fmtPrice(price)}`}</SvgText>
			<SvgText x={W - PAD_R + 10} y={yb} fill={WHIMSY.sage} {...labelText}>{`I buy ${bid}`}</SvgText>
		</Svg>
	);
}

export const chartStyles = StyleSheet.create({
	legendDot: { width: SPACE.sm, height: SPACE.sm, borderRadius: RADII.pill, borderWidth: BORDER.hair, borderColor: WHIMSY.ink },
});
