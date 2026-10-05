// The invite landing. Expo Router maps https://ticklethepig.com/play/<CODE>
// and ticklethepig://play/<CODE> here with no handler, and an invite push's
// tap routes here through utils/notificationRouting.ts. The code is parsed
// leniently (a pasted link or a lowercase code still lands); anything that is
// not a code shows the warm "couldn't find that table" state.
import { useLocalSearchParams } from "expo-router";
import { InviteLanding } from "@/components/play/InviteLanding";
import { parseInviteCode } from "@/multiplayer/links";

export default function PlayInviteRoute() {
	const { code } = useLocalSearchParams<{ code?: string | string[] }>();
	const raw = Array.isArray(code) ? code[0] : code;
	return <InviteLanding code={parseInviteCode(raw ?? null)} />;
}
