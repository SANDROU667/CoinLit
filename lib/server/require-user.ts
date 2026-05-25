import { NextRequest } from "next/server";
import { verifyToken, type SessionUser } from "@/lib/auth";
import { ensureSchema, getPool } from "@/lib/db";
import { findLocalUserById } from "@/lib/server/local-db";
import { isHostedDatabaseMissing } from "@/lib/server/runtime";

export async function getAuthorizedUser(request: NextRequest): Promise<SessionUser | null> {
  const session = verifyToken(request.cookies.get("coinlit_token")?.value);
  if (!session) return null;

  const pool = getPool();
  if (!pool) {
    if (isHostedDatabaseMissing()) return null;
    const localUser = await findLocalUserById(session.id);
    if (!localUser || localUser.blocked) return null;
    return {
      id: localUser.id,
      email: localUser.email,
      login: localUser.login,
      role: localUser.role
    };
  }

  await ensureSchema(pool);
  const [rows] = await pool.execute("SELECT id, email, login, role, blocked FROM users WHERE id = ? LIMIT 1", [session.id]);
  const user = (rows as Array<{ id: number; email: string; login: string; role: "user" | "admin"; blocked: boolean }>)[0];
  if (!user || user.blocked) return null;

  return { id: user.id, email: user.email, login: user.login, role: user.role };
}
