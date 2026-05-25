import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { ensureSchema, getPool } from "@/lib/db";
import { findLocalUserById } from "@/lib/server/local-db";
import { hostedDatabaseMissingResponse, isHostedDatabaseMissing } from "@/lib/server/runtime";

export async function GET(request: NextRequest) {
  const user = verifyToken(request.cookies.get("coinlit_token")?.value);
  if (!user) return NextResponse.json({ user: null }, { status: 401 });

  const pool = getPool();
  if (!pool) {
    if (isHostedDatabaseMissing()) return hostedDatabaseMissingResponse();
    const localUser = await findLocalUserById(user.id);
    if (!localUser || localUser.blocked) return NextResponse.json({ user: null }, { status: 401 });
    return NextResponse.json({
      user: { id: localUser.id, email: localUser.email, login: localUser.login, role: localUser.role },
      source: "local-file-db"
    });
  }

  await ensureSchema(pool);
  const [rows] = await pool.execute("SELECT id, email, login, role, blocked FROM users WHERE id = ? LIMIT 1", [user.id]);
  const dbUser = (
    rows as Array<{ id: number; email: string; login: string; role: "user" | "admin"; blocked: boolean }>
  )[0];
  if (!dbUser || dbUser.blocked) return NextResponse.json({ user: null }, { status: 401 });

  return NextResponse.json({
    user: { id: dbUser.id, email: dbUser.email, login: dbUser.login, role: dbUser.role },
    source: "mysql"
  });
}
