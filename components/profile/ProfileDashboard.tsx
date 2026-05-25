"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { buildLessonMilestoneAchievements } from "@/lib/achievements";
import { emitUserUpdated, openAuthDialog, readProgress } from "@/lib/client/coinlit-storage";
import { courseModules, courses } from "@/lib/content/learning-content";

type CompletedLesson = {
  id: string;
  title: string;
  courseTitle: string;
  courseId: string;
  completedAt: string;
  coins: number;
  testCorrect: boolean;
};

type TestResult = {
  title: string;
  score: number;
  total: number;
  completedAt: string;
};

type ProfileResponse = {
  user: {
    id: number;
    email: string;
    login: string;
    role: "user" | "admin";
    coins: number;
    streak: number;
    createdAt: string;
  };
  progress: {
    coursePercent: number;
    lessons: number;
    coins: number;
    streak: number;
    last3Days: number[];
  };
  completedLessons: CompletedLesson[];
  testResults: TestResult[];
  achievements: Array<{ code: string; title: string; date: string }>;
  trades: { total: number; pnl: number };
  level: string;
  birthdayMessage: string;
  courseBreakdown: Array<{
    id: string;
    title: string;
    totalLessons: number;
    completedLessons: number;
    percent: number;
    unlocked: boolean;
  }>;
  source?: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function hydrateLocalProgress(data: ProfileResponse): ProfileResponse {
  if (data.source !== "no-db") return data;

  const localProgress = readProgress();
  const completedLessons = localProgress.completedLessons
    .slice()
    .sort((left, right) => new Date(right.completedAt).getTime() - new Date(left.completedAt).getTime());
  const testResults = localProgress.testResults
    .slice()
    .sort((left, right) => new Date(right.completedAt).getTime() - new Date(left.completedAt).getTime());
  const totalLessons = courseModules.reduce((sum, module) => sum + module.lessons.length, 0);
  const completedCount = completedLessons.length;
  const coins = completedLessons.reduce((sum, lesson) => sum + lesson.coins, 0);
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
  const firstAchievement = completedLessons.length
    ? [
        {
          code: "first_lesson",
          title: "Первый урок",
          date: completedLessons[completedLessons.length - 1].completedAt
        }
      ]
    : [];
  const achievements = [...firstAchievement, ...buildLessonMilestoneAchievements(completedLessons)].sort(
    (left, right) => new Date(right.date).getTime() - new Date(left.date).getTime()
  );

  return {
    ...data,
    progress: {
      coursePercent: totalLessons ? Math.round((completedCount / totalLessons) * 100) : 0,
      lessons: completedCount,
      coins,
      streak: data.progress.streak,
      last3Days
    },
    completedLessons,
    testResults,
    achievements,
    courseBreakdown,
    user: {
      ...data.user,
      coins
    }
  };
}

export function ProfileDashboard() {
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showLessons, setShowLessons] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);

  const [login, setLogin] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/profile", { cache: "no-store" });
      if (!response.ok) {
        setData(null);
        return;
      }
      const next = hydrateLocalProgress((await response.json()) as ProfileResponse);
      setData(next);
      setLogin(next.user.login);
      setEmail(next.user.email);
    } catch {
      setError("Не удалось загрузить профиль. Попробуй обновить страницу.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener("coinlit:user-updated", refresh);
    window.addEventListener("coinlit:progress-updated", refresh);
    return () => {
      window.removeEventListener("coinlit:user-updated", refresh);
      window.removeEventListener("coinlit:progress-updated", refresh);
    };
  }, [refresh]);

  const recentTests = useMemo(() => data?.testResults.slice(0, 4) ?? [], [data?.testResults]);

  async function saveProfile() {
    if (!data) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login,
          email,
          currentPassword: currentPassword || undefined,
          newPassword: newPassword || undefined
        })
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(body.error ?? "Не удалось обновить профиль.");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      await refresh();
      emitUserUpdated();
    } catch {
      setError("Ошибка обновления профиля.");
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setData(null);
    emitUserUpdated();
  }

  if (loading) {
    return (
      <div className="card">
        <span className="chip">Профиль</span>
        <h2>Загрузка данных...</h2>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card">
        <span className="chip">Кабинет</span>
        <h2>Войди или зарегистрируйся</h2>
        <p className="muted">
          После входа профиль покажет прогресс треков, уроки, тесты, достижения и журнал сделок.
        </p>
        <div className="hero-actions">
          <button className="btn" type="button" onClick={() => openAuthDialog("register")}>Регистрация</button>
          <button className="btn secondary" type="button" onClick={() => openAuthDialog("login")}>Вход</button>
        </div>
      </div>
    );
  }

  return (
    <>
      {error && <p className="auth-error">{error}</p>}

      {data.birthdayMessage && (
        <article className="card" style={{ marginBottom: 18 }}>
          <span className="chip">Поздравление</span>
          <h2>{data.birthdayMessage}</h2>
        </article>
      )}

      <div className="grid">
        <article className="card">
          <span className="chip">Аккаунт</span>
          <h2>{data.user.login}</h2>
          <p className="muted">Уровень: {data.level}</p>
          <label className="field">
            Логин
            <input className="input" value={login} onChange={(event) => setLogin(event.target.value)} />
          </label>
          <label className="field">
            Email
            <input className="input" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="field">
            Текущий пароль
            <input className="input" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
          </label>
          <label className="field">
            Новый пароль
            <input className="input" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          </label>
          <div className="hero-actions">
            <button className="btn" type="button" disabled={saving} onClick={saveProfile}>
              {saving ? "Сохранение..." : "Сохранить изменения"}
            </button>
            <button className="btn secondary" type="button" onClick={logout}>Выйти</button>
          </div>
        </article>

        <article className="card">
          <span className="chip">Общий прогресс</span>
          <h2>
            {data.progress.lessons} уроков • {data.progress.coins} коинов
          </h2>
          <div className="progress-bar">
            <span style={{ width: `${data.progress.coursePercent}%` }} />
          </div>
          <p className="muted">Прогресс по всей платформе: {data.progress.coursePercent}%</p>
          <p className="muted">Серия активности: {data.progress.streak}</p>
          <p className="muted">Последние 3 дня: {data.progress.last3Days.join(" / ")} уроков</p>
          <button className="btn secondary" type="button" onClick={() => setShowLessons(true)}>Просмотреть уроки</button>
        </article>

        <article className="card">
          <span className="chip">Треки</span>
          <h2>Статус Base / Medium / High</h2>
          <div className="admin-list">
            {data.courseBreakdown.map((course) => (
              <div className="admin-row" key={course.id}>
                <b>{course.title}</b>
                <span>
                  {course.completedLessons}/{course.totalLessons} уроков • {course.percent}%
                </span>
                <span className="muted">{course.unlocked ? "Доступ открыт" : "Откроется после завершения предыдущего трека"}</span>
                <div className="progress-bar">
                  <span style={{ width: `${course.percent}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="card">
          <span className="chip">Тесты и сделки</span>
          <h2>{data.testResults.length} тестов сохранено</h2>
          {recentTests.length === 0 ? (
            <p className="muted">Пока нет завершенных тестов.</p>
          ) : (
            recentTests.map((test) => (
              <p className="muted" key={`${test.title}-${test.completedAt}`}>
                {test.title}: {test.score}/{test.total}
              </p>
            ))
          )}
          <p className="muted" style={{ marginTop: 12 }}>
            Журнал сделок: {data.trades.total} • PnL:{" "}
            <b className={data.trades.pnl >= 0 ? "badge-positive" : "badge-negative"}>{data.trades.pnl}$</b>
          </p>
        </article>
      </div>

      <article className="card" style={{ marginTop: 28 }}>
        <span className="chip">Достижения</span>
        <h2>{data.achievements.length ? `${data.achievements.length} получено` : "Достижений пока нет"}</h2>
        <p className="muted">Здесь фиксируются ключевые этапы обучения и дисциплины.</p>
        <button className="btn secondary" type="button" onClick={() => setShowAchievements(true)}>Открыть достижения</button>
      </article>

      {showLessons && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card glass">
            <button className="modal-close" type="button" onClick={() => setShowLessons(false)} aria-label="Закрыть">
              ×
            </button>
            <span className="eyebrow">Пройденные уроки</span>
            <h2>{data.completedLessons.length ? `${data.completedLessons.length} уроков` : "Уроков пока нет"}</h2>
            <div className="admin-list">
              {data.completedLessons.map((lesson) => (
                <div className="admin-row" key={`${lesson.id}-${lesson.completedAt}`}>
                  <b>{lesson.title}</b>
                  <span className="muted">{lesson.courseTitle}</span>
                  <span>
                    +{lesson.coins} коинов • тест {lesson.testCorrect ? "верно" : "с ошибкой"} • {formatDate(lesson.completedAt)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showAchievements && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card glass">
            <button className="modal-close" type="button" onClick={() => setShowAchievements(false)} aria-label="Закрыть">
              ×
            </button>
            <span className="eyebrow">Достижения</span>
            <h2>История прогресса</h2>
            <div className="admin-list">
              {data.achievements.map((achievement) => (
                <div className="admin-row" key={`${achievement.code}-${achievement.date}`}>
                  <b>{achievement.title}</b>
                  <span>{formatDate(achievement.date)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
