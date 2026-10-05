// Picks the store from config.

import type { ServerConfig } from "../config";
import type { Logger } from "../log";
import { MemoryStore } from "./memory";
import { SupabaseStore } from "./supabase";
import type { Store } from "./types";

export function createStore(config: ServerConfig, log: Logger, fetchImpl?: typeof fetch): Store {
	if (config.store === "supabase") {
		if (!config.supabaseUrl || !config.supabaseKey) throw new Error("STORE=supabase needs SUPABASE_URL and a secret key");
		return new SupabaseStore({ url: config.supabaseUrl, key: config.supabaseKey, log, fetch: fetchImpl });
	}
	return new MemoryStore(config.storeFile);
}

export { MemoryStore } from "./memory";
export { SupabaseStore } from "./supabase";
export type * from "./types";
