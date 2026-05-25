import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getAuthorizedUser } from "@/lib/server/require-user";
import { hostedDatabaseMissingResponse, isHostedDatabaseMissing } from "@/lib/server/runtime";

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET(request: NextRequest) {
  const user = await getAuthorizedUser(request);
  if (!user) return NextResponse.json({ error: "Требуется вход." }, { status: 401 });

  const pool = getPool();
  if (!pool) {
    if (isHostedDatabaseMissing()) return hostedDatabaseMissingResponse();
    return NextResponse.json({
      completedLessons: [],
      testResults: [],
      coins: 0,
      source: "no-db"
    });
  }

  const [lessonRows] = await pool.execute(
    `SELECT lesson_id, lesson_title, course_title, course_id, completed_at, coins, test_correct
     FROM lesson_progress
     WHERE user_id = ?
     ORDER BY completed_at ASC`,
    [user.id]
  );

  const [testRows] = await pool.execute(
    `SELECT title, score, total, completed_at
     FROM test_results
     WHERE user_id = ?
     ORDER BY completed_at ASC`,
    [user.id]
  );

  const completedLessons = (
    lessonRows as Array<{
      lesson_id: string;
      lesson_title: string;
      course_title: string;
      course_id: string;
      completed_at: string;
      coins: number | string;
      test_correct: number | boolean;
    }>
  ).map((row) => ({
    id: row.lesson_id,
    title: row.lesson_title,
    courseTitle: row.course_title,
    courseId: row.course_id,
    completedAt: new Date(row.completed_at).toISOString(),
    coins: toNumber(row.coins),
    testCorrect: Boolean(row.test_correct)
  }));

  const testResults = (
    testRows as Array<{
      title: string;
      score: number | string;
      total: number | string;
      completed_at: string;
    }>
  ).map((row) => ({
    title: row.title,
    score: toNumber(row.score),
    total: toNumber(row.total),
    completedAt: new Date(row.completed_at).toISOString()
  }));

  const coins = completedLessons.reduce((sum, lesson) => sum + lesson.coins, 0);
  return NextResponse.json({ completedLessons, testResults, coins, source: "mysql" });
}
