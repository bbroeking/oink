// The connection banner: one quiet strip that says what the socket is doing
// when it is not simply open (usePlayConnection().banner: connecting,
// reconnecting, or stopped, in utils/multiplayer/copy's words). A stop that a
// fresh dial can fix carries "Try again"; an update or a signed-out stop
// does not pretend a tap will help. Announced when its words change, because
// a strip that appears without a sound is news a screen reader never hears.

import { useEffect } from "react";
import { AccessibilityInfo, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Button, Hand, Sticker } from "@/components/ui";
import { CHROME_TYPE_CAP, RADII, SPACE } from "@/constants/theme";
import type { PlayConnection } from "@/hooks/useMultiplayer";
import { HUB_COPY } from "./playCopy";

export function ConnectionBanner({
	connection,
	quietWhileConnecting = false,
	style,
	testID = "play-connection-banner",
}: {
	connection: PlayConnection;
	/** The hub works without a socket (Practice, the cards): the first dial is
	 *  not news there, only a drop or a stop is. */
	quietWhileConnecting?: boolean;
	style?: StyleProp<ViewStyle>;
	testID?: string;
}) {
	const line = quietWhileConnecting && connection.status === "connecting" ? null : connection.banner;
	useEffect(() => {
		if (line) AccessibilityInfo.announceForAccessibility(line);
	}, [line]);
	if (!line) return null;
	const stopped = connection.status === "stopped";
	const canRetry = stopped && connection.reason !== "protocol_mismatch" && connection.reason !== "signed_out";
	return (
		<View accessibilityLiveRegion="polite" style={style} testID={testID}>
			<Sticker color={stopped ? "rose" : "sky"} rotate={0} radius={RADII.md} shadow="sm" style={styles.strip}>
				<Hand style={styles.line} maxFontSizeMultiplier={CHROME_TYPE_CAP}>
					{line}
				</Hand>
				{canRetry ? (
					<Button
						variant="ghost"
						size="xs"
						onPress={connection.retry}
						accessibilityHint={HUB_COPY.retryHint}
						maxFontSizeMultiplier={CHROME_TYPE_CAP}
						testID={`${testID}-retry`}
					>
						{HUB_COPY.retry}
					</Button>
				) : null}
			</Sticker>
		</View>
	);
}

const styles = StyleSheet.create({
	strip: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.xs,
	},
	line: { flex: 1, minWidth: 0 },
});
