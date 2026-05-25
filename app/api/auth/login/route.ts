import { NextRequest, NextResponse } from "next/server";
import { signToken, verifyPassword } from "@/lib/auth";
import { ensureSchema, getPool } from "@/lib/db";
import { findLocalUserByEmail } from "@/lib/server/local-db";
import { hostedDatabaseMissingResponse, isHostedDatabaseMissing, secureCookieOptions } from "@/lib/server/runtime";

type LoginPayload = {
  email: string;
  password: string;
};

function setAuthCookie(response: NextResponse, token: string) {
  response.cookies.set("coinlit_token", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    ...secureCookieOptions()
  });
}

async function parsePayload(request: NextRequest): Promise<{ data: LoginPayload; asJson: boolean }> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const data = (await request.json()) as LoginPayload;
    return { data, asJson: true };
  }
  const form = await request.formData();
  return {
    asJson: false,
    data: {
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? "")
    }
  };
}

export async function POST(request: NextRequest) {
  const { data, asJson } = await parsePayload(request);
  const email = data.email.trim().toLowerCase();
  const password = data.password;
  const pool = getPool();
  const credentialsError = "Неверный email или пароль.";
  const blockedError = "Аккаунт заблокирован администратором.";

  if (pool) {
    await ensureSchema(pool);
    const [rows] = await pool.execute(
      "SELECT id, email, login, role, password_hash, blocked FROM users WHERE email = ? LIMIT 1",
      [email]
    );
    const user = (
      rows as Array<{
        id: number;
        email: string;
        login: string;
        role: "user" | "admin";
        password_hash: string;
        blocked: boolean;
      }>
    )[0];

    if (!user) {
      if (asJson) return NextResponse.json({ error: credentialsError }, { status: 401 });
      return NextResponse.redirect(new URL("/login?error=bad-credentials", request.url));
    }

    if (user.blocked) {
      if (asJson) return NextResponse.json({ error: blockedError }, { status: 403 });
      return NextResponse.redirect(new URL("/login?error=blocked", request.url));
    }

    if (!verifyPassword(password, user.password_hash)) {
      if (asJson) return NextResponse.json({ error: credentialsError }, { status: 401 });
      return NextResponse.redirect(new URL("/login?error=bad-credentials", request.url));
    }

    const token = signToken({ id: user.id, email: user.email, login: user.login, role: user.role });
    if (asJson) {
      const response = NextResponse.json({ ok: true, user: { id: user.id, email: user.email, login: user.login, role: user.role } });
      setAuthCookie(response, token);
      return response;
    }

    const response = NextResponse.redirect(new URL("/profile", request.url));
    setAuthCookie(response, token);
    return response;
  }

  if (isHostedDatabaseMissing()) return hostedDatabaseMissingResponse();

  const localUser = await findLocalUserByEmail(email);
  if (!localUser) {
    if (asJson) return NextResponse.json({ error: credentialsError }, { status: 401 });
    return NextResponse.redirect(new URL("/login?error=bad-credentials", request.url));
  }

  if (localUser.blocked) {
    if (asJson) return NextResponse.json({ error: blockedError }, { status: 403 });
    return NextResponse.redirect(new URL("/login?error=blocked", request.url));
  }

  if (!verifyPassword(password, localUser.passwordHash)) {
    if (asJson) return NextResponse.json({ error: credentialsError }, { status: 401 });
    return NextResponse.redirect(new URL("/login?error=bad-credentials", request.url));
  }

  const localSessionUser = {
    id: localUser.id,
    email: localUser.email,
    login: localUser.login,
    role: localUser.role
  } as const;

  const token = signToken(localSessionUser);

  if (asJson) {
    const response = NextResponse.json({ ok: true, user: localSessionUser, source: "local-file-db" });
    setAuthCookie(response, token);
    return response;
  }

  const response = NextResponse.redirect(new URL("/profile", request.url));
  setAuthCookie(response, token);
  return response;
}
