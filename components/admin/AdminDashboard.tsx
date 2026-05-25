"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getStaticCourseCatalog } from "@/lib/client/course-catalog";
import type { CourseConfigLesson, CourseSummary } from "@/lib/server/course-catalog";

type AdminCourse = CourseSummary & {
  archived?: boolean;
};

type AdminUser = {
  id: number;
  email: string;
  login: string;
  role: "user" | "admin";
  blocked: boolean;
  createdAt: string;
};

type LessonEditor = {
  id: string;
  title: string;
  minutes: string;
  material: string;
  practice: string;
  keyPointsText: string;
  testQuestion: string;
  testOptionsText: string;
  testAnswer: string;
  testExplanation: string;
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createLessonEditor(index: number): LessonEditor {
  const number = index + 1;
  return {
    id: `lesson-${String(number).padStart(2, "0")}`,
    title: `Урок ${number}`,
    minutes: "15",
    material: "",
    practice: "",
    keyPointsText: "",
    testQuestion: "",
    testOptionsText: "Вариант 1\nВариант 2\nВариант 3",
    testAnswer: "1",
    testExplanation: ""
  };
}

function toCourseLesson(lesson: LessonEditor, index: number, slug: string): CourseConfigLesson {
  const options = lesson.testOptionsText
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 6);
  const safeOptions = options.length >= 2 ? options : ["Вариант 1", "Вариант 2"];
  const answerFromForm = Number(lesson.testAnswer) - 1;
  const safeAnswer =
    Number.isInteger(answerFromForm) && answerFromForm >= 0 && answerFromForm < safeOptions.length ? answerFromForm : 0;
  const keyPoints = lesson.keyPointsText
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);

  return {
    id: lesson.id.trim() || `${slug}-lesson-${String(index + 1).padStart(2, "0")}`,
    title: lesson.title.trim() || `Урок ${index + 1}`,
    minutes: Math.max(5, Number(lesson.minutes) || 15),
    material: lesson.material.trim() || "Добавьте материал урока.",
    practice: lesson.practice.trim() || "Добавьте практику.",
    keyPoints: keyPoints.length ? keyPoints : ["Основной пункт"],
    test: {
      question: lesson.testQuestion.trim() || "Добавьте тестовый вопрос.",
      options: safeOptions,
      answer: safeAnswer,
      explanation: lesson.testExplanation.trim() || "Добавьте объяснение правильного ответа."
    }
  };
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

export function AdminDashboard() {
  const [notice, setNotice] = useState("Публикация курса сразу обновляет страницу обучения.");
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState<AdminCourse[]>(getStaticCourseCatalog());
  const [form, setForm] = useState({
    slug: "",
    title: "",
    level: "Base",
    direction: "",
    price: "Бесплатно",
    hours: "2",
    requiredCoins: "0",
    description: "",
    lessons: [createLessonEditor(0)]
  });

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersNotice, setUsersNotice] = useState("Введите логин, email или ID для быстрого поиска.");
  const [usersQuery, setUsersQuery] = useState("");

  const activeCourses = useMemo(() => courses.filter((course) => !course.archived), [courses]);
  const archivedCourses = useMemo(() => courses.filter((course) => course.archived), [courses]);

  const refreshCourses = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/courses", { cache: "no-store" });
      if (!response.ok) throw new Error("catalog-load-failed");
      const body = (await response.json()) as { courses?: AdminCourse[] };
      if (Array.isArray(body.courses)) {
        setCourses(body.courses);
      }
    } catch {
      setNotice("Не удалось обновить каталог через API. Остался предыдущий срез.");
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshUsers = useCallback(async (query = "") => {
    setUsersLoading(true);
    try {
      const response = await fetch(`/api/admin/users?q=${encodeURIComponent(query)}`, { cache: "no-store" });
      const body = (await response.json().catch(() => ({}))) as { users?: AdminUser[]; error?: string };
      if (!response.ok) {
        setUsersNotice(body.error ?? "Не удалось загрузить список пользователей.");
        return;
      }
      setUsers(Array.isArray(body.users) ? body.users : []);
      setUsersNotice(query ? `Результаты по запросу: "${query}"` : "Показаны последние зарегистрированные пользователи.");
    } catch {
      setUsersNotice("Ошибка загрузки пользователей. Проверьте соединение и повторите попытку.");
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshCourses();
    refreshUsers("");
  }, [refreshCourses, refreshUsers]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      refreshUsers(usersQuery.trim());
    }, 250);
    return () => clearTimeout(timeout);
  }, [usersQuery, refreshUsers]);

  function updateLesson(index: number, patch: Partial<LessonEditor>) {
    setForm((current) => ({
      ...current,
      lessons: current.lessons.map((lesson, lessonIndex) => (lessonIndex === index ? { ...lesson, ...patch } : lesson))
    }));
  }

  function addLesson() {
    setForm((current) => ({
      ...current,
      lessons: [...current.lessons, createLessonEditor(current.lessons.length)]
    }));
  }

  function removeLesson(index: number) {
    setForm((current) => {
      if (current.lessons.length <= 1) return current;
      return {
        ...current,
        lessons: current.lessons.filter((_, lessonIndex) => lessonIndex !== index)
      };
    });
  }

  function moveLesson(index: number, direction: -1 | 1) {
    setForm((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.lessons.length) return current;
      const next = [...current.lessons];
      const temp = next[index];
      next[index] = next[target];
      next[target] = temp;
      return { ...current, lessons: next };
    });
  }

  function resetForm() {
    setForm({
      slug: "",
      title: "",
      level: "Base",
      direction: "",
      price: "Бесплатно",
      hours: "2",
      requiredCoins: "0",
      description: "",
      lessons: [createLessonEditor(0)]
    });
  }

  async function addCourse() {
    const title = form.title.trim();
    if (!title) {
      setNotice("Введите название курса.");
      return;
    }

    const slug = form.slug.trim() || slugify(title);
    if (!slug) {
      setNotice("Не удалось сформировать slug. Укажите slug вручную.");
      return;
    }

    const lessons = form.lessons.map((lesson, index) => toCourseLesson(lesson, index, slug));
    const response = await fetch("/api/admin/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug,
        title,
        level: form.level,
        direction: form.direction.trim() || "Дополнительный трек",
        price: form.price.trim() || "Бесплатно",
        hours: Number(form.hours) || 1,
        requiredCoins: Math.max(0, Number(form.requiredCoins) || 0),
        description: form.description.trim() || `Программа курса ${title}.`,
        lessons
      })
    });

    const body = (await response.json().catch(() => ({}))) as { error?: string; courses?: AdminCourse[] };
    if (!response.ok) {
      setNotice(body.error ?? "Не удалось добавить курс. Проверьте админ-доступ и поля формы.");
      return;
    }

    if (Array.isArray(body.courses)) {
      setCourses(body.courses);
    } else {
      await refreshCourses();
    }
    setNotice(`Курс "${title}" опубликован и доступен в каталоге обучения.`);
    resetForm();
  }

  async function archiveCourse(id: string) {
    const response = await fetch(`/api/admin/courses?slug=${encodeURIComponent(id)}`, { method: "DELETE" });
    const body = (await response.json().catch(() => ({}))) as { error?: string; courses?: AdminCourse[] };
    if (!response.ok) {
      setNotice(body.error ?? "Не удалось отправить курс в архив.");
      return;
    }
    if (Array.isArray(body.courses)) setCourses(body.courses);
    setNotice("Курс отправлен в архив.");
  }

  async function restoreCourse(id: string) {
    const response = await fetch("/api/admin/courses", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: id })
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string; courses?: AdminCourse[] };
    if (!response.ok) {
      setNotice(body.error ?? "Не удалось восстановить курс.");
      return;
    }
    if (Array.isArray(body.courses)) setCourses(body.courses);
    setNotice("Курс восстановлен и снова отображается в каталоге.");
  }

  async function updateUserBlocked(userId: number, blocked: boolean) {
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, blocked })
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setUsersNotice(body.error ?? "Не удалось изменить статус пользователя.");
      return;
    }
    setUsers((current) => current.map((user) => (user.id === userId ? { ...user, blocked } : user)));
    setUsersNotice(blocked ? "Пользователь заблокирован." : "Пользователь разблокирован.");
  }

  return (
    <div className="admin-layout">
      <article className="card">
        <span className="chip">Конфигуратор курса</span>
        <h2>Создание и публикация</h2>
        <p className="muted">{notice}</p>

        <label className="field">
          Название курса
          <input
            className="input"
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            placeholder="Например: Алгоритмическая торговля для новичков"
          />
        </label>

        <label className="field">
          Slug (URL)
          <div className="hero-actions">
            <input
              className="input"
              value={form.slug}
              onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
              placeholder="algotrade-base"
            />
            <button
              className="btn secondary"
              type="button"
              onClick={() => setForm((current) => ({ ...current, slug: slugify(current.title) }))}
            >
              Сгенерировать slug
            </button>
          </div>
        </label>

        <div className="admin-meta-grid">
          <label className="field">
            Уровень
            <select className="input" value={form.level} onChange={(event) => setForm((current) => ({ ...current, level: event.target.value }))}>
              <option>Base</option>
              <option>Medium</option>
              <option>High</option>
            </select>
          </label>
          <label className="field">
            Направление
            <input
              className="input"
              value={form.direction}
              onChange={(event) => setForm((current) => ({ ...current, direction: event.target.value }))}
              placeholder="Риск-менеджмент и системная торговля"
            />
          </label>
          <label className="field">
            Цена
            <input className="input" value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} />
          </label>
          <label className="field">
            Часы
            <input
              className="input"
              type="number"
              min={1}
              value={form.hours}
              onChange={(event) => setForm((current) => ({ ...current, hours: event.target.value }))}
            />
          </label>
          <label className="field">
            Требуемые коины
            <input
              className="input"
              type="number"
              min={0}
              value={form.requiredCoins}
              onChange={(event) => setForm((current) => ({ ...current, requiredCoins: event.target.value }))}
            />
          </label>
        </div>

        <label className="field">
          Описание курса
          <textarea
            className="input admin-textarea"
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            placeholder="Кратко опишите цель курса и результат для ученика."
          />
        </label>

        <div className="admin-lessons">
          <div className="hero-actions" style={{ justifyContent: "space-between" }}>
            <h3 style={{ margin: 0 }}>Программа уроков</h3>
            <button className="btn secondary" type="button" onClick={addLesson}>
              Добавить урок
            </button>
          </div>

          {form.lessons.map((lesson, index) => (
            <article className="admin-lesson" key={`${lesson.id}-${index}`}>
              <div className="hero-actions" style={{ justifyContent: "space-between" }}>
                <span className="chip">Урок {index + 1}</span>
                <div className="hero-actions">
                  <button className="btn ghost" type="button" onClick={() => moveLesson(index, -1)} disabled={index === 0}>
                    ↑
                  </button>
                  <button
                    className="btn ghost"
                    type="button"
                    onClick={() => moveLesson(index, 1)}
                    disabled={index === form.lessons.length - 1}
                  >
                    ↓
                  </button>
                  <button className="btn ghost" type="button" onClick={() => removeLesson(index)} disabled={form.lessons.length === 1}>
                    Удалить
                  </button>
                </div>
              </div>

              <div className="admin-meta-grid">
                <label className="field">
                  ID урока
                  <input className="input" value={lesson.id} onChange={(event) => updateLesson(index, { id: event.target.value })} />
                </label>
                <label className="field">
                  Название урока
                  <input className="input" value={lesson.title} onChange={(event) => updateLesson(index, { title: event.target.value })} />
                </label>
                <label className="field">
                  Длительность (мин)
                  <input
                    className="input"
                    type="number"
                    min={5}
                    value={lesson.minutes}
                    onChange={(event) => updateLesson(index, { minutes: event.target.value })}
                  />
                </label>
              </div>

              <label className="field">
                Теория урока
                <textarea className="input admin-textarea" value={lesson.material} onChange={(event) => updateLesson(index, { material: event.target.value })} />
              </label>

              <label className="field">
                Практическое задание
                <textarea className="input admin-textarea" value={lesson.practice} onChange={(event) => updateLesson(index, { practice: event.target.value })} />
              </label>

              <label className="field">
                Ключевые пункты (каждый с новой строки)
                <textarea
                  className="input admin-textarea"
                  value={lesson.keyPointsText}
                  onChange={(event) => updateLesson(index, { keyPointsText: event.target.value })}
                />
              </label>

              <label className="field">
                Тест: вопрос
                <input className="input" value={lesson.testQuestion} onChange={(event) => updateLesson(index, { testQuestion: event.target.value })} />
              </label>

              <label className="field">
                Тест: варианты ответа (каждый с новой строки)
                <textarea
                  className="input admin-textarea"
                  value={lesson.testOptionsText}
                  onChange={(event) => updateLesson(index, { testOptionsText: event.target.value })}
                />
              </label>

              <div className="admin-meta-grid">
                <label className="field">
                  Номер правильного ответа
                  <input
                    className="input"
                    type="number"
                    min={1}
                    value={lesson.testAnswer}
                    onChange={(event) => updateLesson(index, { testAnswer: event.target.value })}
                  />
                </label>
                <label className="field">
                  Объяснение правильного ответа
                  <input
                    className="input"
                    value={lesson.testExplanation}
                    onChange={(event) => updateLesson(index, { testExplanation: event.target.value })}
                  />
                </label>
              </div>
            </article>
          ))}
        </div>

        <div className="hero-actions">
          <button className="btn" type="button" onClick={addCourse}>
            Опубликовать курс
          </button>
          <button className="btn secondary" type="button" onClick={refreshCourses} disabled={loading}>
            {loading ? "Обновление..." : "Обновить список курсов"}
          </button>
          <button className="btn ghost" type="button" onClick={resetForm}>
            Сбросить форму
          </button>
        </div>
      </article>

      <article className="card">
        <span className="chip">Каталог</span>
        <h2>Активные курсы</h2>
        <div className="admin-list">
          {activeCourses.map((course) => (
            <div className="admin-row" key={course.id}>
              <b>{course.title}</b>
              <span className="muted">
                {course.level} • {course.direction}
              </span>
              <span className="muted">
                {course.lessonsCount} уроков • {course.hours} ч • {course.price}
              </span>
              <span className="muted">Slug: {course.id}</span>
              <div className="hero-actions">
                <button className="btn secondary" type="button" onClick={() => archiveCourse(course.id)}>
                  Архивировать
                </button>
              </div>
            </div>
          ))}
        </div>
      </article>

      <article className="card">
        <span className="chip">Архив</span>
        <h2>Архивные курсы</h2>
        {archivedCourses.length === 0 ? (
          <p className="muted">Архив пуст.</p>
        ) : (
          <div className="admin-list">
            {archivedCourses.map((course) => (
              <div className="admin-row" key={course.id}>
                <b>{course.title}</b>
                <span className="muted">Slug: {course.id}</span>
                <div className="hero-actions">
                  <button className="btn secondary" type="button" onClick={() => restoreCourse(course.id)}>
                    Восстановить
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </article>

      <article className="card">
        <span className="chip">Пользователи</span>
        <h2>Поиск и модерация</h2>
        <p className="muted">{usersNotice}</p>
        <div className="hero-actions admin-users-toolbar">
          <input
            className="input"
            value={usersQuery}
            onChange={(event) => setUsersQuery(event.target.value)}
            placeholder="Поиск по email, логину или ID"
          />
          <button className="btn secondary" type="button" onClick={() => refreshUsers(usersQuery.trim())} disabled={usersLoading}>
            {usersLoading ? "Загрузка..." : "Обновить"}
          </button>
        </div>

        {users.length === 0 ? (
          <p className="muted">Пользователи не найдены.</p>
        ) : (
          <div className="admin-list">
            {users.map((adminUser) => (
              <div className="admin-row" key={adminUser.id}>
                <b>{adminUser.login}</b>
                <span className="muted">{adminUser.email}</span>
                <span className="muted">
                  ID: {adminUser.id} • Роль: {adminUser.role} • Статус: {adminUser.blocked ? "Заблокирован" : "Активен"} • Регистрация:{" "}
                  {formatDate(adminUser.createdAt)}
                </span>
                <div className="hero-actions">
                  <button
                    className="btn secondary"
                    type="button"
                    onClick={() => updateUserBlocked(adminUser.id, !adminUser.blocked)}
                    disabled={adminUser.role === "admin"}
                    title={adminUser.role === "admin" ? "Администратора блокировать нельзя" : ""}
                  >
                    {adminUser.blocked ? "Разбанить" : "Забанить"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </article>
    </div>
  );
}
