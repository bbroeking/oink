import { NextResponse } from "next/server";

// Simple password gate. Every route except /login and /api/login requires the
// `dash_auth` cookie to equal DASHBOARD_PASSWORD. Set DASHBOARD_PASSWORD in the
// Vercel project env. If it's unset, the gate is open (local dev convenience).
export function proxy(req) {
  const pw = process.env.DASHBOARD_PASSWORD;
  if (!pw) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/login") || pathname.startsWith("/api/login")) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get("dash_auth")?.value;
  if (cookie === pw) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  // Run on everything except Next internals and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
