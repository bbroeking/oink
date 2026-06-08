// Server-side fetch of the aggregate analytics blob from Supabase.
// Uses the public anon key (already shipped in the app) to call the
// SECURITY DEFINER analytics_overview() RPC. No service-role secret needed.

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://wbcnhvvakptoinwkulmn.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndiY25odnZha3B0b2lud2t1bG1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU4NzQ4NDAsImV4cCI6MjA1MTQ1MDg0MH0.tFthqZOKZaBVd5NYhNbF5LHTGpm5hClfLl8F5QESv9o";

export async function getOverview() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/analytics_overview`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: "{}",
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`analytics_overview failed (${res.status}): ${text}`);
  }
  return res.json();
}
