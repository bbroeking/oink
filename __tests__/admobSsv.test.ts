import { webcrypto } from "node:crypto";
import { verifyAdMobRewardCallback } from "@/supabase/functions/admob-reward-callback/verify";

const bytesToBase64Url = (bytes: ArrayBuffer) =>
	Buffer.from(bytes).toString("base64url");

describe("AdMob signed reward callback", () => {
	it("accepts the exact signed query and rejects tampering", async () => {
		Object.defineProperty(global, "crypto", { value: webcrypto, configurable: true });
		const pair = await webcrypto.subtle.generateKey(
			{ name: "ECDSA", namedCurve: "P-256" },
			false,
			["sign", "verify"]
		);
		const now = 1_786_000_000_000;
		const content = [
			"ad_network=123",
			"ad_unit=test-unit",
			"custom_data=00000000-0000-4000-8000-0000000000ad",
			"reward_amount=3",
			"reward_item=personal_tickles",
			`timestamp=${now}`,
			"transaction_id=transaction-1",
			"user_id=",
		].join("&");
		const signature = await webcrypto.subtle.sign(
			{ name: "ECDSA", hash: "SHA-256" },
			pair.privateKey,
			new TextEncoder().encode(content)
		);
		const url = `https://example.test/callback?${content}&signature=${bytesToBase64Url(
			signature
		)}&key_id=7`;
		const options = {
			resolveKey: async (keyId: string) => (keyId === "7" ? pair.publicKey : null),
			expectedAdUnit: "test-unit",
			expectedRewardAmount: 3,
			expectedRewardItem: "personal_tickles",
			nowMs: now,
		};

		expect(await verifyAdMobRewardCallback(url, options)).toMatchObject({
			transactionId: "transaction-1",
			rewardAmount: 3,
		});
		await expect(
			verifyAdMobRewardCallback(url.replace("reward_amount=3", "reward_amount=5"), options)
		).rejects.toThrow("invalid_signature");
	});
});
