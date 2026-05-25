import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";
import { findLocalUserById, listLocalUsers, updateLocalUserBlocked } from "@/lib/server/local-db";
import { getAdminUserFromRequest } from "@/lib/server/admin-auth";
import { hostedDatabaseMissingResponse, isHostedDatabaseMissing } from "@/lib/server/runtime";

type AdminUserDto = {
  id: number;
  email: string;
  login: string;
  role: "user" | "admin";
  blocked: boolean;
  createdAt: string;
};

function assertAdmin(request: NextRequest) {
  const user = getAdminUserFromRequest(request);
  return user?.role === "admin" ? user : null;
}

function toSearchTerm(value: string) {
  return `%${value.replace(/[%_]/g, "\\$&")}%`;
}

export async function GET(request: NextRequest) {
  if (!assertAdmin(request)) return NextResponse.json({ error: "Нужны права admin." }, { status: 403 });

  const query = (request.nextUrl.searchParams.get("q") ?? "").trim();
  const pool = getPool();

  if (!pool) {
    if (isHostedDatabaseMissing()) return hostedDatabaseMissingResponse();
    const users = (await listLocalUsers(query)).map((user) => ({
      id: user.id,
      email: user.email,
      login: user.login,
      role: user.role,
      blocked: user.blocked,
      createdAt: user.createdAt
    })) satisfies AdminUserDto[];

    return NextResponse.json({ users, source: "local-file-db" });
  }

  await ensureSchema(pool);
  const searchTerm = query ? toSearchTerm(query) : "";
  const [rows] = await pool.execute(
    `SELECT id, email, login, role, blocked, created_at
     FROM users
     WHERE (? = '' OR email LIKE ? ESCAPE '\\\\' OR login LIKE ? ESCAPE '\\\\' OR CAST(id AS CHAR) LIKE ? ESCAPE '\\\\')
     ORDER BY created_at DESC
     LIMIT 200`,
    [query, searchTerm, searchTerm, searchTerm]
  );

  const users = (
    rows as Array<{
      id: number;
      email: string;
      login: string;
      role: "user" | "admin";
      blocked: boolean;
      created_at: string;
    }>
  ).map((row) => ({
    id: row.id,
    email: row.email,
    login: row.login,
    role: row.role,
    blocked: Boolean(row.blocked),
    createdAt: new Date(row.created_at).toISOString()
  })) satisfies AdminUserDto[];

  return NextResponse.json({ users, source: "mysql" });
}

export async function PATCH(request: NextRequest) {
  if (!assertAdmin(request)) return NextResponse.json({ error: "Нужны права admin." }, { status: 403 });

  const payload = (await request.json()) as { userId?: number; blocked?: boolean };
  const userId = Number(payload.userId);
  const blocked = Boolean(payload.blocked);
  if (!Number.isFinite(userId) || userId <= 0) {
    return NextResponse.json({ error: "Некорректный userId." }, { status: 400 });
  }

  const pool = getPool();
  if (!pool) {
    if (isHostedDatabaseMissing()) return hostedDatabaseMissingResponse();
    const target = await findLocalUserById(userId);
    if (!target) return NextResponse.json({ error: "Пользователь не найден." }, { status: 404 });
    if (target.role === "admin") {
      return NextResponse.json({ error: "Нельзя блокировать администратора." }, { status: 400 });
    }

    const updated = await updateLocalUserBlocked(userId, blocked);
    if (!updated.ok) return NextResponse.json({ error: "Пользователь не найден." }, { status: 404 });
    return NextResponse.json({
      ok: true,
      user: {
        id: updated.user.id,
        email: updated.user.email,
        login: updated.user.login,
        role: updated.user.role,
        blocked: updated.user.blocked,
        createdAt: updated.user.createdAt
      },
      source: "local-file-db"
    });
  }

  await ensureSchema(pool);
  const [rows] = await pool.execute("SELECT id, role FROM users WHERE id = ? LIMIT 1", [userId]);
  const target = (rows as Array<{ id: number; role: "user" | "admin" }>)[0];
  if (!target) return NextResponse.json({ error: "Пользователь не найден." }, { status: 404 });
  if (target.role === "admin") {
    return NextResponse.json({ error: "Нельзя блокировать администратора." }, { status: 400 });
  }

  await pool.execute("UPDATE users SET blocked = ? WHERE id = ?", [blocked ? 1 : 0, userId]);
  const [updatedRows] = await pool.execute(
    "SELECT id, email, login, role, blocked, created_at FROM users WHERE id = ? LIMIT 1",
    [userId]
  );
  const updated = (
    updatedRows as Array<{
      id: number;
      email: string;
      login: string;
      role: "user" | "admin";
      blocked: boolean;
      created_at: string;
    }>
  )[0];

  return NextResponse.json({
    ok: true,
    user: {
      id: updated.id,
      email: updated.email,
      login: updated.login,
      role: updated.role,
      blocked: Boolean(updated.blocked),
      createdAt: new Date(updated.created_at).toISOString()
    },
    source: "mysql"
  });
}
