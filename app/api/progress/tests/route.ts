import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getAuthorizedUser } from "@/lib/server/require-user";
import { hostedDatabaseMissingResponse, isHostedDatabaseMissing } from "@/lib/server/runtime";

type TestPayload = {
  title: string;
  score: number;
  total: number;
};

export async function POST(request: NextRequest) {
  const user = await getAuthorizedUser(request);
  if (!user) return NextResponse.json({ error: "Требуется вход." }, { status: 401 });

  const body = (await request.json()) as TestPayload;
  if (!body.title || !Number.isFinite(body.score) || !Number.isFinite(body.total) || body.total <= 0) {
    return NextResponse.json({ error: "Некорректные данные теста." }, { status: 400 });
  }

  const pool = getPool();
  if (!pool) {
    if (isHostedDatabaseMissing()) return hostedDatabaseMissingResponse();
    return NextResponse.json({ ok: true, fallback: true });
  }

  await pool.execute("INSERT INTO test_results (user_id, title, score, total) VALUES (?, ?, ?, ?)", [
    user.id,
    body.title,
    Math.max(0, Math.floor(body.score)),
    Math.max(1, Math.floor(body.total))
  ]);

  return NextResponse.json({ ok: true });
}
