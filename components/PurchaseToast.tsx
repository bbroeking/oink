// Compat shim. The toast is now the `components/ui/Toast` primitive; this file
// keeps the ~20 shop / account / mote-machine call sites (and their `type`
// spelling) working while they migrate to `showToast({ tone })`.
//
// New code should import from "@/components/ui/Toast".

import { showToast, ToastHost, type ToastTone } from "./ui/Toast";

export interface PurchaseToastOpts {
	// The pre-primitive spelling of `tone`. "info" was never available here.
	type: Extract<ToastTone, "success" | "fail">;
	title?: string;
	text?: string;
	cost?: number;
}

export type AppToastOpts = PurchaseToastOpts;

export function showAppToast({ type, ...rest }: AppToastOpts): void {
	showToast({ tone: type, ...rest });
}

// Kept as the shop-facing name so existing purchase call sites remain clear.
export const showPurchaseToast = showAppToast;

export const PurchaseToastHost = ToastHost;
