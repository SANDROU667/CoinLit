import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { buildLessonMilestoneAchievements, type AchievementItem } from "@/lib/achievements";
import { getAuthorizedUser } from "@/lib/server/require-user";
import { hostedDatabaseMissingResponse, isHostedDatabaseMissing } from "@/lib/server/runtime";

type LessonPayload = {
  courseId: string;
  lessonId: string;
  lessonTitle: string;
  courseTitle: string;
  testCorrect: boolean;
  coins: number;
};

async function grantLessonMilestoneAchievements(pool: NonNullable<ReturnType<typeof getPool>>, userId: number) {
  const [lessonRows] = await pool.execute(
    `SELECT completed_at
     FROM lesson_progress
     WHERE user_id = ?
     ORDER BY completed_at ASC, id ASC`,
    [userId]
  );
  const milestones = buildLessonMilestoneAchievements(
    (lessonRows as Array<{ completed_at: string }>).map((row) => ({
      completedAt: new Date(row.completed_at).toISOString()
    }))
  );

  if (!milestones.length) return [];

  const [achievementRows] = await pool.execute("SELECT code FROM achievements WHERE user_id = ?", [userId]);
  const existingCodes = new Set((achievementRows as Array<{ code: string }>).map((row) => row.code));
  const newAchievements: AchievementItem[] = [];

  for (const achievement of milestones) {
    if (existingCodes.has(achievement.code)) continue;
    await pool.execute(
      `INSERT INTO achievements (user_id, code, title, earned_at)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE title = VALUES(title)`,
      [userId, achievement.code, achievement.title, new Date(achievement.date)]
    );
    existingCodes.add(achievement.code);
    newAchievements.push(achievement);
  }

  return newAchievements;
}

export async function POST(request: NextRequest) {
  const user = await getAuthorizedUser(request);
  if (!user) return NextResponse.json({ error: "Требуется вход." }, { status: 401 });

  const body = (await request.json()) as LessonPayload;
  if (!body.courseId || !body.lessonId || !body.lessonTitle || !body.courseTitle) {
    return NextResponse.json({ error: "Некорректные данные урока." }, { status: 400 });
  }

  const pool = getPool();
  if (!pool) {
    if (isHostedDatabaseMissing()) return hostedDatabaseMissingResponse();
    return NextResponse.json({
      ok: true,
      inserted: true,
      fallback: true
    });
  }

  const [result] = await pool.execute(
    `INSERT IGNORE INTO lesson_progress
     (user_id, course_id, course_title, lesson_id, lesson_title, test_correct, coins)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      user.id,
      body.courseId,
      body.courseTitle,
      body.lessonId,
      body.lessonTitle,
      body.testCorrect ? 1 : 0,
      Math.max(0, Number(body.coins) || 0)
    ]
  );

  const inserted = Number((result as { affectedRows: number }).affectedRows) > 0;
  if (inserted) {
    await pool.execute("UPDATE users SET coins = coins + ? WHERE id = ?", [Math.max(0, Number(body.coins) || 0), user.id]);
  }

  const achievements = inserted ? await grantLessonMilestoneAchievements(pool, user.id) : [];

  return NextResponse.json({ ok: true, inserted, achievements });
}
