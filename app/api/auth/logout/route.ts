import { NextResponse } from "next/server";
import { secureCookieOptions } from "@/lib/server/runtime";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("coinlit_token", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    ...secureCookieOptions()
  });
  return response;
}
