import { NextResponse } from "next/server";

export async function POST(req) {
  const { password } = await req.json().catch(() => ({}));
  const pw = process.env.DASHBOARD_PASSWORD;

  if (!pw || password !== pw) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("dash_auth", pw, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
