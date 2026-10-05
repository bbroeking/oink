// A refusal is a toast (design-system spec §3.4): a short title for what was
// tried, and the protocol's one line for why (errorCopy), so "That table is
// full." reads the same from the hub, the landing and the table.

import { showToast } from "@/components/ui";
import { errorCopy } from "@/utils/multiplayer/copy";
import type { PlayErrorCode } from "@/utils/multiplayer/client";
import { REFUSAL_TITLE } from "./playCopy";

export type RefusalKind = keyof typeof REFUSAL_TITLE;

export function showRefusal(kind: RefusalKind, code: PlayErrorCode | null | undefined): void {
	showToast({ tone: "fail", title: REFUSAL_TITLE[kind], text: errorCopy(code) });
}
