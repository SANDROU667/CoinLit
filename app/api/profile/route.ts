import { NextRequest, NextResponse } from "next/server";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { buildLessonMilestoneAchievements } from "@/lib/achievements";
import { getPool } from "@/lib/db";
import { courses, courseModules } from "@/lib/content/learning-content";
import { findLocalUserById, updateLocalUser } from "@/lib/server/local-db";
import { getAuthorizedUser } from "@/lib/server/require-user";
import { hostedDatabaseMissingResponse, isHostedDatabaseMissing } from "@/lib/server/runtime";

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getLevelByCoins(coins: number) {
  if (coins >= 600) return "Криптан";
  if (coins >= 420) return "Инвестор";
  if (coins >= 260) return "Начинающий инвестор";
  if (coins >= 120) return "Любитель";
  return "Новичок";
}

export async function GET(request: NextRequest) {
  const user = await getAuthorizedUser(request);
  if (!user) return NextResponse.json({ error: "Требуется вход." }, { status: 401 });

  const pool = getPool();
  if (!pool) {
    if (isHostedDatabaseMissing()) return hostedDatabaseMissingResponse();
    const localUser = await findLocalUserById(user.id);
    if (!localUser) return NextResponse.json({ error: "Пользователь не найден." }, { status: 404 });

    const fallbackBreakdown = courses.map((course) => ({
      id: course.id,
      title: course.title,
      totalLessons: courseModules.find((module) => module.courseId === course.id)?.lessons.length ?? course.lessons.length,
      completedLessons: 0,
      percent: 0,
      unlocked: course.id === "base"
    }));

    return NextResponse.json({
      user: {
        id: localUser.id,
        email: localUser.email,
        login: localUser.login,
        role: localUser.role,
        coins: localUser.coins,
        streak: localUser.streak,
        createdAt: localUser.createdAt
      },
      progress: {
        coursePercent: 0,
        lessons: 0,
        coins: localUser.coins,
        streak: localUser.streak,
        last3Days: [0, 0, 0]
      },
      completedLessons: [],
      testResults: [],
      achievements: [],
      trades: { total: 0, pnl: 0 },
      level: getLevelByCoins(localUser.coins),
      courseBreakdown: fallbackBreakdown,
      birthdayMessage: "",
      source: "no-db"
    });
  }

  const [userRows] = await pool.execute(
    "SELECT id, email, login, role, coins, streak, date_of_birth, created_at FROM users WHERE id = ? LIMIT 1",
    [user.id]
  );
  const dbUser = (
    userRows as Array<{
      id: number;
      email: string;
      login: string;
      role: "user" | "admin";
      coins: number | string;
      streak: number | string;
      date_of_birth: string;
      created_at: string;
    }>
  )[0];
  if (!dbUser) return NextResponse.json({ error: "Пользователь не найден." }, { status: 404 });

  const [lessonRows] = await pool.execute(
    `SELECT lesson_id, lesson_title, course_title, course_id, completed_at, coins, test_correct
     FROM lesson_progress
     WHERE user_id = ?
     ORDER BY completed_at DESC`,
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

  const [testRows] = await pool.execute(
    `SELECT title, score, total, completed_at
     FROM test_results
     WHERE user_id = ?
     ORDER BY completed_at DESC`,
    [user.id]
  );
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

  const [achievementRows] = await pool.execute(
    "SELECT code, title, earned_at FROM achievements WHERE user_id = ? ORDER BY earned_at DESC",
    [user.id]
  );
  const dbAchievements = (
    achievementRows as Array<{ code: string; title: string; earned_at: string }>
  ).map((row) => ({
    code: row.code,
    title: row.title,
    date: new Date(row.earned_at).toISOString()
  }));

  const [tradeRows] = await pool.execute(
    "SELECT COUNT(*) AS total, COALESCE(SUM(pnl), 0) AS pnl FROM trades WHERE user_id = ?",
    [user.id]
  );
  const tradeSummary = (
    tradeRows as Array<{ total: number | string; pnl: number | string }>
  )[0] ?? { total: 0, pnl: 0 };

  const totalLessons = courseModules.reduce((sum, module) => sum + module.lessons.length, 0);
  const completedCount = completedLessons.length;
  const computedCoins = completedLessons.reduce((sum, lesson) => sum + lesson.coins, 0);
  const correctTests = completedLessons.filter((lesson) => lesson.testCorrect).length;
  const percent = totalLessons ? Math.round((completedCount / totalLessons) * 100) : 0;
  const coins = Math.max(computedCoins, toNumber(dbUser.coins));
  const completedByCourse = new Map<string, number>();

  completedLessons.forEach((lesson) => {
    completedByCourse.set(lesson.courseId, (completedByCourse.get(lesson.courseId) ?? 0) + 1);
  });

  const baseTotal = courseModules.find((module) => module.courseId === "base")?.lessons.length ?? 0;
  const mediumTotal = courseModules.find((module) => module.courseId === "medium")?.lessons.length ?? 0;
  const baseDone = (completedByCourse.get("base") ?? 0) >= baseTotal;
  const mediumDone = (completedByCourse.get("medium") ?? 0) >= mediumTotal;
  const courseBreakdown = courses.map((course) => {
    const total = courseModules.find((module) => module.courseId === course.id)?.lessons.length ?? course.lessons.length;
    const completed = completedByCourse.get(course.id) ?? 0;
    const unlocked = course.id === "base" || (course.id === "medium" ? baseDone : course.id === "high" ? mediumDone : true);
    return {
      id: course.id,
      title: course.title,
      totalLessons: total,
      completedLessons: completed,
      percent: total ? Math.round((completed / total) * 100) : 0,
      unlocked
    };
  });

  const last3Days = [2, 1, 0].map((offset) => {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    const key = date.toISOString().slice(0, 10);
    return completedLessons.filter((lesson) => lesson.completedAt.slice(0, 10) === key).length;
  });

  const derivedAchievements: Array<{ code: string; title: string; date: string }> = buildLessonMilestoneAchievements(completedLessons);
  if (completedCount > 0) {
    derivedAchievements.push({
      code: "first_lesson",
      title: "Первый урок",
      date: completedLessons[completedLessons.length - 1].completedAt
    });
  }
  if (percent >= 50) {
    derivedAchievements.push({
      code: "half_course",
      title: "50% курса",
      date: completedLessons[0]?.completedAt ?? new Date().toISOString()
    });
  }
  if (correctTests >= 8) {
    derivedAchievements.push({
      code: "risk_mastery",
      title: "Риск под контролем",
      date: completedLessons.find((lesson) => lesson.testCorrect)?.completedAt ?? new Date().toISOString()
    });
  }
  if (coins >= 420) {
    derivedAchievements.push({
      code: "investor",
      title: "Инвестор",
      date: completedLessons[0]?.completedAt ?? new Date().toISOString()
    });
  }

  const uniqueAchievements = new Map<string, { code: string; title: string; date: string }>();
  [...dbAchievements, ...derivedAchievements].forEach((item) => {
    if (!uniqueAchievements.has(item.code)) uniqueAchievements.set(item.code, item);
  });
  const achievements = Array.from(uniqueAchievements.values()).sort(
    (left, right) => new Date(right.date).getTime() - new Date(left.date).getTime()
  );

  const today = new Date();
  const birth = new Date(dbUser.date_of_birth);
  const isBirthday = today.getDate() === birth.getDate() && today.getMonth() === birth.getMonth();
  const birthdayMessage = isBirthday
    ? `С днем рождения, ${dbUser.login}! Команда CoinLit желает стабильного роста и дисциплины.`
    : "";

  return NextResponse.json({
    user: {
      id: dbUser.id,
      email: dbUser.email,
      login: dbUser.login,
      role: dbUser.role,
      coins,
      streak: toNumber(dbUser.streak),
      createdAt: new Date(dbUser.created_at).toISOString()
    },
    progress: {
      coursePercent: percent,
      lessons: completedCount,
      coins,
      streak: toNumber(dbUser.streak),
      last3Days
    },
    completedLessons,
    testResults,
    achievements,
    trades: { total: toNumber(tradeSummary.total), pnl: toNumber(tradeSummary.pnl) },
    level: getLevelByCoins(coins),
    availableCourses: courses.map((course) => ({
      id: course.id,
      title: course.title,
      requiredCoins: course.requiredCoins
    })),
    courseBreakdown,
    birthdayMessage
  });
}

export async function PATCH(request: NextRequest) {
  const user = await getAuthorizedUser(request);
  if (!user) return NextResponse.json({ error: "Требуется вход." }, { status: 401 });

  const body = (await request.json()) as {
    login?: string;
    email?: string;
    currentPassword?: string;
    newPassword?: string;
  };

  const pool = getPool();
  if (!pool) {
    if (isHostedDatabaseMissing()) return hostedDatabaseMissingResponse();
    const localUser = await findLocalUserById(user.id);
    if (!localUser) return NextResponse.json({ error: "Пользователь не найден." }, { status: 404 });

    const nextLogin = body.login?.trim();
    const nextEmail = body.email?.trim().toLowerCase();
    const patch: { login?: string; email?: string; passwordHash?: string } = {};

    if (nextLogin && nextLogin.length >= 3 && nextLogin !== localUser.login) {
      patch.login = nextLogin;
    }

    if (nextEmail && nextEmail.includes("@") && nextEmail !== localUser.email) {
      patch.email = nextEmail;
    }

    if (body.newPassword) {
      if (!body.currentPassword) {
        return NextResponse.json({ error: "Укажи текущий пароль." }, { status: 400 });
      }
      if (!verifyPassword(body.currentPassword, localUser.passwordHash)) {
        return NextResponse.json({ error: "Текущий пароль неверный." }, { status: 403 });
      }
      if (body.newPassword.length < 8) {
        return NextResponse.json({ error: "Новый пароль должен быть не короче 8 символов." }, { status: 400 });
      }
      patch.passwordHash = hashPassword(body.newPassword);
    }

    if (!Object.keys(patch).length) return NextResponse.json({ ok: true, unchanged: true });

    const updateResult = await updateLocalUser(user.id, patch);
    if (!updateResult.ok) {
      return NextResponse.json({ error: "Не удалось обновить профиль. Возможно email или логин уже заняты." }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  }

  const [rows] = await pool.execute("SELECT id, email, login, password_hash FROM users WHERE id = ? LIMIT 1", [user.id]);
  const dbUser = (
    rows as Array<{ id: number; email: string; login: string; password_hash: string }>
  )[0];
  if (!dbUser) return NextResponse.json({ error: "Пользователь не найден." }, { status: 404 });

  const nextLogin = body.login?.trim();
  const nextEmail = body.email?.trim().toLowerCase();
  const updates: string[] = [];
  const values: Array<string | number> = [];

  if (nextLogin && nextLogin.length >= 3 && nextLogin !== dbUser.login) {
    updates.push("login = ?");
    values.push(nextLogin);
  }

  if (nextEmail && nextEmail.includes("@") && nextEmail !== dbUser.email) {
    updates.push("email = ?");
    values.push(nextEmail);
  }

  if (body.newPassword) {
    if (!body.currentPassword) {
      return NextResponse.json({ error: "Укажи текущий пароль." }, { status: 400 });
    }
    if (!verifyPassword(body.currentPassword, dbUser.password_hash)) {
      return NextResponse.json({ error: "Текущий пароль неверный." }, { status: 403 });
    }
    if (body.newPassword.length < 8) {
      return NextResponse.json({ error: "Новый пароль должен быть не короче 8 символов." }, { status: 400 });
    }
    updates.push("password_hash = ?");
    values.push(hashPassword(body.newPassword));
  }

  if (!updates.length) return NextResponse.json({ ok: true, unchanged: true });

  values.push(user.id);
  try {
    await pool.execute(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, values);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Не удалось обновить профиль. Возможно email или логин уже заняты." }, { status: 409 });
  }
}
