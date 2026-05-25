import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_LOGIN,
  ADMIN_PASSWORD,
  createAdminSession,
  setAdminCookie
} from "@/lib/server/admin-auth";

type AdminLoginPayload = {
  login?: string;
  password?: string;
};

async function parsePayload(request: NextRequest): Promise<{ asJson: boolean; data: AdminLoginPayload }> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return {
      asJson: true,
      data: (await request.json()) as AdminLoginPayload
    };
  }

  const form = await request.formData();
  return {
    asJson: false,
    data: {
      login: String(form.get("login") ?? ""),
      password: String(form.get("password") ?? "")
    }
  };
}

export async function POST(request: NextRequest) {
  const { data, asJson } = await parsePayload(request);
  const login = String(data.login ?? "").trim();
  const password = String(data.password ?? "");
  const valid = login === ADMIN_LOGIN && password === ADMIN_PASSWORD;

  if (!valid) {
    if (asJson) {
      return NextResponse.json({ error: "Неверный логин или пароль администратора." }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/admin?error=bad-admin-credentials", request.url));
  }

  const token = createAdminSession();
  if (asJson) {
    const response = NextResponse.json({ ok: true });
    setAdminCookie(response, token);
    return response;
  }

  const response = NextResponse.redirect(new URL("/admin", request.url));
  setAdminCookie(response, token);
  return response;
}
