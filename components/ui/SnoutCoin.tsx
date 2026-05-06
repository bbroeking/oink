import React from "react";
import Svg, { Defs, RadialGradient, Stop, Circle, Ellipse } from "react-native-svg";

export function SnoutCoin({ size = 22 }: { size?: number }) {
	return (
		<Svg width={size} height={size} viewBox="0 0 24 24">
			<Defs>
				<RadialGradient id="coinG" cx="0.4" cy="0.35" r="0.75">
					<Stop offset="0" stopColor="#FFE8A0" />
					<Stop offset="0.6" stopColor="#F5C44A" />
					<Stop offset="1" stopColor="#C99B23" />
				</RadialGradient>
				<RadialGradient id="snoutInner" cx="0.4" cy="0.35" r="0.7">
					<Stop offset="0" stopColor="#FFD0DC" />
					<Stop offset="0.7" stopColor="#F0B8C8" />
					<Stop offset="1" stopColor="#C47A8E" />
				</RadialGradient>
			</Defs>
			<Circle cx="12" cy="12" r="10.5" fill="url(#coinG)" stroke="#8B6818" strokeWidth="1" />
			<Ellipse cx="12" cy="13" rx="6" ry="5" fill="url(#snoutInner)" stroke="#A05A72" strokeWidth="1" />
			<Ellipse cx="9.5" cy="12.5" rx="1" ry="1.4" fill="#1A1A1A" />
			<Ellipse cx="14.5" cy="12.5" rx="1" ry="1.4" fill="#1A1A1A" />
		</Svg>
	);
}

export function TickleIcon({ size = 18 }: { size?: number }) {
	return (
		<Svg width={size} height={size} viewBox="0 0 24 24">
			<Defs>
				<RadialGradient id="tickle_snout" cx="0.4" cy="0.35" r="0.7">
					<Stop offset="0" stopColor="#FFD0DC" />
					<Stop offset="0.7" stopColor="#F0B8C8" />
					<Stop offset="1" stopColor="#C47A8E" />
				</RadialGradient>
			</Defs>
			<Ellipse
				cx="12"
				cy="13"
				rx="9"
				ry="7"
				fill="url(#tickle_snout)"
				stroke="#A05A72"
				strokeWidth="1.4"
			/>
			<Ellipse cx="9" cy="13" rx="1.3" ry="1.8" fill="#1A1A1A" />
			<Ellipse cx="15" cy="13" rx="1.3" ry="1.8" fill="#1A1A1A" />
		</Svg>
	);
}
