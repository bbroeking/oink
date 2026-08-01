import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Rive, { Alignment, Fit, type RNRiveError } from "rive-react-native";
import { Button } from "@/components/ui/Button";
import { SPACE, TYPE, WHIMSY } from "@/constants/theme";

const OFFICIAL_RIVE_SAMPLE = require("../../assets/rive/prototype/runtime-sample.riv");

type ProbeStatus = "idle" | "loading" | "rendering" | "error";

/**
 * Development-only native-runtime proof. This intentionally uses Rive's
 * official hosted sample so the app can validate its linked native view before
 * a local pig.riv exists. It is mounted only from /ui-audit in development.
 */
export function RiveRuntimeProbe({ autoStart = false }: { autoStart?: boolean }) {
	const [mounted, setMounted] = useState(autoStart);
	const [status, setStatus] = useState<ProbeStatus>(
		autoStart ? "loading" : "idle",
	);
	const [error, setError] = useState<string | null>(null);

	const start = () => {
		setError(null);
		setStatus("loading");
		setMounted(true);
	};

	const stop = () => {
		setMounted(false);
		setStatus("idle");
		setError(null);
	};

	return (
		<View style={styles.group}>
			<Text style={styles.title}>Rive native-runtime probe</Text>
			<Text style={styles.body}>
				Loads a locally bundled copy of Rive&apos;s official avatar sample
				through the native iOS view. This proves runtime and Metro asset
				linkage only; it does not validate the pig rig.
			</Text>
			<Text
				testID="rive-runtime-status"
				style={[
					styles.status,
					status === "error" ? styles.error : null,
				]}
			>
				{status === "idle" && "Not started"}
				{status === "loading" && "Loading native Rive view…"}
				{status === "rendering" && "Native Rive view is rendering"}
				{status === "error" && `Rive error: ${error ?? "unknown error"}`}
			</Text>

			{mounted ? (
				<>
					<View style={styles.stage} testID="rive-runtime-stage">
						<Rive
							source={OFFICIAL_RIVE_SAMPLE}
							artboardName="Avatar 1"
							stateMachineName="avatar"
							fit={Fit.Contain}
							alignment={Alignment.Center}
							autoplay
							style={styles.rive}
							onPlay={() => setStatus("rendering")}
							onError={(riveError: RNRiveError) => {
								setError(riveError.message);
								setStatus("error");
							}}
						/>
					</View>
					<Button full variant="ghost" onPress={stop}>
						Stop Rive probe
					</Button>
				</>
			) : (
				<Button full onPress={start}>
					Start Rive probe
				</Button>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	group: {
		gap: SPACE.md,
	},
	title: {
		...TYPE.sectionTitle,
		color: WHIMSY.ink,
	},
	body: {
		...TYPE.body,
		color: WHIMSY.ink,
	},
	status: {
		...TYPE.label,
		color: WHIMSY.ink,
	},
	error: {
		color: WHIMSY.accent,
	},
	stage: {
		height: 260,
		alignItems: "center",
		justifyContent: "center",
		overflow: "hidden",
		borderRadius: 14,
		backgroundColor: WHIMSY.paper,
	},
	rive: {
		width: 240,
		height: 240,
	},
});
