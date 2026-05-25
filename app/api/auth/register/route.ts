import { NextRequest, NextResponse } from "next/server";
import { hashPassword, isAdult, signToken } from "@/lib/auth";
import { ensureSchema, getPool } from "@/lib/db";
import { createLocalUser } from "@/lib/server/local-db";
import { hostedDatabaseMissingResponse, isHostedDatabaseMissing, secureCookieOptions } from "@/lib/server/runtime";

type RegisterPayload = {
  email: string;
  login: string;
  password: string;
  confirmPassword: string;
  dateOfBirth: string;
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

function normalize(payload: RegisterPayload) {
  return {
    email: payload.email.trim().toLowerCase(),
    login: payload.login.trim(),
    password: payload.password,
    confirmPassword: payload.confirmPassword,
    dateOfBirth: payload.dateOfBirth
  };
}

function validate(payload: ReturnType<typeof normalize>) {
  if (!payload.email || !payload.login || payload.password.length < 8 || payload.password !== payload.confirmPassword) {
    return "Проверь email, логин и пароль.";
  }
  if (!isAdult(payload.dateOfBirth)) {
    return "Регистрация доступна только пользователям 18+.";
  }
  return null;
}

async function parsePayload(request: NextRequest): Promise<{ data: RegisterPayload; asJson: boolean }> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const data = (await request.json()) as RegisterPayload;
    return { data, asJson: true };
  }
  const form = await request.formData();
  return {
    asJson: false,
    data: {
      email: String(form.get("email") ?? ""),
      login: String(form.get("login") ?? ""),
      password: String(form.get("password") ?? ""),
      confirmPassword: String(form.get("confirmPassword") ?? ""),
      dateOfBirth: String(form.get("dateOfBirth") ?? "")
    }
  };
}

export async function POST(request: NextRequest) {
  const { data, asJson } = await parsePayload(request);
  const payload = normalize(data);
  const validationError = validate(payload);
  if (validationError) {
    if (asJson) return NextResponse.json({ error: validationError }, { status: 400 });
    return NextResponse.redirect(new URL("/register?error=validation", request.url));
  }

  const pool = getPool();
  const passwordHash = hashPassword(payload.password);
  let user: { id: number; email: string; login: string; role: "user" | "admin" } = {
    id: 1,
    email: payload.email,
    login: payload.login,
    role: "user"
  };

  if (pool) {
    await ensureSchema(pool);
    try {
      const [result] = await pool.execute(
        "INSERT INTO users (email, login, password_hash, date_of_birth) VALUES (?, ?, ?, ?)",
        [payload.email, payload.login, passwordHash, payload.dateOfBirth]
      );
      user = { ...user, id: Number((result as { insertId: number }).insertId) };
    } catch {
      if (asJson) {
        return NextResponse.json({ error: "Пользователь с таким email или логином уже существует." }, { status: 409 });
      }
      return NextResponse.redirect(new URL("/register?error=exists", request.url));
    }
  } else {
    if (isHostedDatabaseMissing()) return hostedDatabaseMissingResponse();
    const localResult = await createLocalUser({
      email: payload.email,
      login: payload.login,
      passwordHash,
      dateOfBirth: payload.dateOfBirth
    });

    if (!localResult.ok) {
      if (asJson) {
        return NextResponse.json({ error: "Пользователь с таким email или логином уже существует." }, { status: 409 });
      }
      return NextResponse.redirect(new URL("/register?error=exists", request.url));
    }

    user = {
      id: localResult.user.id,
      email: localResult.user.email,
      login: localResult.user.login,
      role: localResult.user.role
    };
  }

  const token = signToken(user);
  if (asJson) {
    const response = NextResponse.json({ ok: true, user });
    setAuthCookie(response, token);
    return response;
  }

  const response = NextResponse.redirect(new URL("/profile", request.url));
  setAuthCookie(response, token);
  return response;
}
