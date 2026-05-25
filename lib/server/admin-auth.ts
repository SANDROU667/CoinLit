import { NextRequest, NextResponse } from "next/server";
import { signToken, verifyToken, type SessionUser } from "@/lib/auth";
import { secureCookieOptions } from "@/lib/server/runtime";

export const ADMIN_COOKIE_NAME = "coinlit_admin_token";
export const ADMIN_LOGIN = process.env.ADMIN_LOGIN ?? "admin";
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "admin123321";

export function createAdminSession() {
  return signToken(
    {
      id: 0,
      email: "admin@coinlit.local",
      login: ADMIN_LOGIN,
      role: "admin"
    },
    60 * 60 * 24 * 30
  );
}

function asAdmin(user: SessionUser | null) {
  return user?.role === "admin" ? user : null;
}

export function getAdminUserFromRequest(request: NextRequest) {
  const fromAdminCookie = asAdmin(verifyToken(request.cookies.get(ADMIN_COOKIE_NAME)?.value));
  if (fromAdminCookie) return fromAdminCookie;
  return asAdmin(verifyToken(request.cookies.get("coinlit_token")?.value));
}

type CookieReader = {
  get(name: string): { value: string } | undefined;
};

export function getAdminUserFromCookiesStore(cookiesStore: CookieReader) {
  const fromAdminCookie = asAdmin(verifyToken(cookiesStore.get(ADMIN_COOKIE_NAME)?.value));
  if (fromAdminCookie) return fromAdminCookie;
  return asAdmin(verifyToken(cookiesStore.get("coinlit_token")?.value));
}

export function setAdminCookie(response: NextResponse, token: string) {
  response.cookies.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    ...secureCookieOptions()
  });
}

export function clearAdminCookie(response: NextResponse) {
  response.cookies.set(ADMIN_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    ...secureCookieOptions()
  });
}
