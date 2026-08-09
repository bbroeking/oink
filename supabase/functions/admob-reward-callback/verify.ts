const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface AdMobRewardCallback {
	attemptId: string;
	transactionId: string;
	adUnit: string;
	rewardAmount: number;
	rewardItem: string;
	timestampMs: number;
}

function decodeBase64Url(value: string): Uint8Array {
	const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
	const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
	const binary = atob(padded);
	return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

// WebCrypto verifies ECDSA as fixed-width IEEE-P1363 (r || s). Google's
// verifier signs with SHA256withECDSA and can supply ASN.1 DER, so normalize
// either representation without accepting malformed integers.
export function ecdsaSignatureToP1363(signature: Uint8Array): Uint8Array {
	if (signature.length === 64) return signature;
	if (signature.length < 8 || signature[0] !== 0x30) {
		throw new Error("invalid_signature_encoding");
	}
	let cursor = 1;
	let sequenceLength = signature[cursor++];
	if (sequenceLength & 0x80) {
		const bytes = sequenceLength & 0x7f;
		if (bytes < 1 || bytes > 2) throw new Error("invalid_signature_encoding");
		sequenceLength = 0;
		for (let index = 0; index < bytes; index += 1) {
			sequenceLength = sequenceLength * 256 + signature[cursor++];
		}
	}
	if (cursor + sequenceLength !== signature.length || signature[cursor++] !== 0x02) {
		throw new Error("invalid_signature_encoding");
	}
	const rLength = signature[cursor++];
	const r = signature.slice(cursor, cursor + rLength);
	cursor += rLength;
	if (signature[cursor++] !== 0x02) throw new Error("invalid_signature_encoding");
	const sLength = signature[cursor++];
	const s = signature.slice(cursor, cursor + sLength);
	if (cursor + sLength !== signature.length) throw new Error("invalid_signature_encoding");

	const normalize = (integer: Uint8Array) => {
		let value = integer;
		while (value.length > 32 && value[0] === 0) value = value.slice(1);
		if (value.length > 32) throw new Error("invalid_signature_encoding");
		const out = new Uint8Array(32);
		out.set(value, 32 - value.length);
		return out;
	};
	const out = new Uint8Array(64);
	out.set(normalize(r), 0);
	out.set(normalize(s), 32);
	return out;
}

function signedQuery(url: string): { content: string; params: URLSearchParams } {
	const queryStart = url.indexOf("?");
	const signatureStart = url.indexOf("&signature=", queryStart);
	if (queryStart < 0 || signatureStart < 0) throw new Error("missing_signature");
	return {
		content: url.slice(queryStart + 1, signatureStart),
		params: new URL(url).searchParams,
	};
}

export async function verifyAdMobRewardCallback(
	url: string,
	{
		resolveKey,
		expectedAdUnit,
		expectedRewardAmount,
		expectedRewardItem,
		nowMs = Date.now(),
	}: {
		resolveKey: (keyId: string) => Promise<CryptoKey | null>;
		expectedAdUnit: string;
		expectedRewardAmount: number;
		expectedRewardItem: string;
		nowMs?: number;
	}
): Promise<AdMobRewardCallback> {
	const { content, params } = signedQuery(url);
	const signatureText = params.get("signature");
	const keyId = params.get("key_id");
	if (!signatureText || !keyId) throw new Error("missing_signature");
	const publicKey = await resolveKey(keyId);
	if (!publicKey) throw new Error("unknown_key");
	const verified = await crypto.subtle.verify(
		{ name: "ECDSA", hash: "SHA-256" },
		publicKey,
		ecdsaSignatureToP1363(decodeBase64Url(signatureText)),
		new TextEncoder().encode(content)
	);
	if (!verified) throw new Error("invalid_signature");

	const attemptId = params.get("custom_data") ?? "";
	const transactionId = params.get("transaction_id") ?? "";
	const adUnit = params.get("ad_unit") ?? "";
	const rewardAmount = Number(params.get("reward_amount"));
	const rewardItem = params.get("reward_item") ?? "";
	const timestampMs = Number(params.get("timestamp"));
	if (!UUID_RE.test(attemptId)) throw new Error("invalid_attempt");
	if (!transactionId || transactionId.length > 200) throw new Error("invalid_transaction");
	if (adUnit !== expectedAdUnit) throw new Error("invalid_ad_unit");
	if (rewardAmount !== expectedRewardAmount) throw new Error("invalid_reward_amount");
	if (rewardItem !== expectedRewardItem) throw new Error("invalid_reward_item");
	if (
		!Number.isSafeInteger(timestampMs) ||
		timestampMs > nowMs + 5 * 60_000 ||
		timestampMs < nowMs - 48 * 60 * 60_000
	) {
		throw new Error("invalid_timestamp");
	}
	return { attemptId, transactionId, adUnit, rewardAmount, rewardItem, timestampMs };
}
