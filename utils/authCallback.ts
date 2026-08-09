// OAuth callback URL parsing — one home for the defensive read both callback
// surfaces need (GoogleAuth, which catches the redirect in the auth-session
// browser, and app/auth-callback, the deep-link route Android falls through to).
//
// Supabase's implicit flow returns access_token/refresh_token in the URL
// FRAGMENT; PKCE returns `code` in the QUERY. The client currently defaults to
// implicit (utils/supabase.ts sets no `flowType`), so the fragment path is
// primary — but both are merged so a later flip to PKCE keeps working.

export function paramsFromUrl(url: string): URLSearchParams {
	const merged = new URLSearchParams();
	try {
		const u = new URL(url);
		u.searchParams.forEach((v, k) => merged.set(k, v));
		const frag = u.hash.startsWith("#") ? u.hash.slice(1) : u.hash;
		if (frag) {
			new URLSearchParams(frag).forEach((v, k) => merged.set(k, v));
		}
	} catch {
		// Malformed callback URL — fall through to an empty set. Callers treat that
		// as "no session came back": the friendly note, or a redirect home.
	}
	return merged;
}
