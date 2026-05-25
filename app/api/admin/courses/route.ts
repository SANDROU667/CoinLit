import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";
import {
  getAdminCourseCatalog,
  getStaticCourseArchiveDefaults,
  setCourseArchivedInMemory,
  upsertCourseInMemory,
  type CourseConfigLesson
} from "@/lib/server/course-catalog";
import { getAdminUserFromRequest } from "@/lib/server/admin-auth";
import { hostedDatabaseMissingResponse, isHostedDatabaseMissing } from "@/lib/server/runtime";

type CoursePayload = {
  slug?: string;
  title?: string;
  level?: string;
  direction?: string;
  price?: string;
  hours?: number;
  description?: string;
  requiredCoins?: number;
  lessons?: CourseConfigLesson[];
};

function assertAdmin(request: NextRequest) {
  const user = getAdminUserFromRequest(request);
  return user?.role === "admin" ? user : null;
}

function normalizeSlug(value: unknown, withFallback = false) {
  const candidate = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (candidate) return candidate;
  return withFallback ? `course-${Date.now()}` : "";
}

function normalizeLessons(lessons: unknown, slug: string, title: string): CourseConfigLesson[] {
  if (!Array.isArray(lessons) || lessons.length === 0) {
    return [
      {
        id: `${slug}-lesson-01`,
        title: `${title}: урок 1`,
        minutes: 15,
        material: "Заполните материал урока в админ-панели.",
        practice: "Добавьте практическое задание.",
        keyPoints: ["Цель урока", "Ключевая идея", "Практический результат"],
        test: {
          question: "Для чего нужен тест в уроке?",
          options: ["Чтобы закрепить материал", "Чтобы скрыть урок", "Чтобы пропустить тему"],
          answer: 0,
          explanation: "Тест помогает проверить и закрепить понимание темы."
        }
      }
    ];
  }

  return lessons.map((lesson, index) => {
    const item = (lesson ?? {}) as Partial<CourseConfigLesson>;
    const options = Array.isArray(item.test?.options) ? item.test.options.filter(Boolean).slice(0, 6) : [];
    return {
      id: item.id?.trim() || `${slug}-lesson-${String(index + 1).padStart(2, "0")}`,
      title: item.title?.trim() || `Урок ${index + 1}`,
      minutes: Number.isFinite(item.minutes) ? Math.max(5, Number(item.minutes)) : 15,
      material: item.material?.trim() || "Добавьте материал урока.",
      practice: item.practice?.trim() || "Добавьте практическую часть.",
      keyPoints:
        Array.isArray(item.keyPoints) && item.keyPoints.length
          ? item.keyPoints.map((point) => String(point).trim()).filter(Boolean).slice(0, 8)
          : ["Основной пункт"],
      test: {
        question: item.test?.question?.trim() || "Добавьте тестовый вопрос.",
        options: options.length >= 2 ? options : ["Вариант 1", "Вариант 2"],
        answer:
          typeof item.test?.answer === "number" && item.test.answer >= 0 && item.test.answer < (options.length >= 2 ? options.length : 2)
            ? item.test.answer
            : 0,
        explanation: item.test?.explanation?.trim() || "Добавьте объяснение правильного ответа."
      }
    };
  });
}

export async function GET(request: NextRequest) {
  if (!assertAdmin(request)) return NextResponse.json({ error: "Нужны права admin." }, { status: 403 });

  const pool = getPool();
  if (!pool && isHostedDatabaseMissing()) return hostedDatabaseMissingResponse();
  if (pool) await ensureSchema(pool);
  const catalog = await getAdminCourseCatalog(pool);
  return NextResponse.json({ courses: catalog, source: pool ? "postgres" : "memory" });
}

export async function POST(request: NextRequest) {
  if (!assertAdmin(request)) return NextResponse.json({ error: "Нужны права admin." }, { status: 403 });

  const body = (await request.json()) as CoursePayload;
  const title = String(body.title ?? "Новый курс").trim();
  const slug = normalizeSlug(body.slug ?? title, true);
  const level = String(body.level ?? "Base");
  const direction = String(body.direction ?? "Дополнительный трек");
  const price = String(body.price ?? "Бесплатно");
  const hours = Number(body.hours) > 0 ? Number(body.hours) : 1;
  const description = String(body.description ?? "").trim() || `Программа курса ${title}.`;
  const requiredCoins = Number.isFinite(body.requiredCoins) ? Math.max(0, Number(body.requiredCoins)) : 0;
  const lessons = normalizeLessons(body.lessons, slug, title);

  const pool = getPool();
  if (!pool) {
    if (isHostedDatabaseMissing()) return hostedDatabaseMissingResponse();
    await upsertCourseInMemory({
      slug,
      title,
      level,
      direction,
      price,
      hours,
      archived: false,
      description,
      requiredCoins,
      lessons
    });
    const catalog = await getAdminCourseCatalog(null);
    return NextResponse.json({ ok: true, courses: catalog, source: "memory" }, { status: 201 });
  }

  await ensureSchema(pool);
  await pool.execute(
    `INSERT INTO courses (slug, title, level, direction, price, hours, archived)
     VALUES (?, ?, ?, ?, ?, ?, FALSE)
     ON CONFLICT (slug) DO UPDATE SET
       title = EXCLUDED.title,
       level = EXCLUDED.level,
       direction = EXCLUDED.direction,
       price = EXCLUDED.price,
       hours = EXCLUDED.hours,
       archived = FALSE`,
    [slug, title, level, direction, price, hours]
  );

  await pool.execute(
    `INSERT INTO course_blueprints (slug, description, required_coins, lessons_json)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (slug) DO UPDATE SET
       description = EXCLUDED.description,
       required_coins = EXCLUDED.required_coins,
       lessons_json = EXCLUDED.lessons_json,
       updated_at = CURRENT_TIMESTAMP`,
    [slug, description, requiredCoins, JSON.stringify(lessons)]
  );

  const catalog = await getAdminCourseCatalog(pool);
  return NextResponse.json({ ok: true, courses: catalog }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  if (!assertAdmin(request)) return NextResponse.json({ error: "Нужны права admin." }, { status: 403 });
  const slug = normalizeSlug(request.nextUrl.searchParams.get("slug"));
  if (!slug) return NextResponse.json({ error: "slug обязателен." }, { status: 400 });

  const pool = getPool();
  if (!pool) {
    if (isHostedDatabaseMissing()) return hostedDatabaseMissingResponse();
    await setCourseArchivedInMemory(slug, true);
    const catalog = await getAdminCourseCatalog(null);
    return NextResponse.json({ archived: slug, courses: catalog, source: "memory" });
  }

  await ensureSchema(pool);
  const staticDefaults = getStaticCourseArchiveDefaults(slug);
  await pool.execute(
    `INSERT INTO courses (slug, title, level, direction, price, hours, archived)
     VALUES (?, ?, ?, ?, ?, ?, TRUE)
     ON CONFLICT (slug) DO UPDATE SET archived = TRUE`,
    [
      slug,
      staticDefaults?.title ?? slug.toUpperCase(),
      staticDefaults?.level ?? "Base",
      staticDefaults?.direction ?? "Архив",
      staticDefaults?.price ?? "Бесплатно",
      staticDefaults?.hours ?? 1
    ]
  );

  const catalog = await getAdminCourseCatalog(pool);
  return NextResponse.json({ archived: slug, courses: catalog });
}

export async function PATCH(request: NextRequest) {
  if (!assertAdmin(request)) return NextResponse.json({ error: "Нужны права admin." }, { status: 403 });
  const payload = (await request.json()) as { slug?: string };
  const slug = normalizeSlug(payload.slug);
  if (!slug) return NextResponse.json({ error: "slug обязателен." }, { status: 400 });

  const pool = getPool();
  if (!pool) {
    if (isHostedDatabaseMissing()) return hostedDatabaseMissingResponse();
    await setCourseArchivedInMemory(slug, false);
    const catalog = await getAdminCourseCatalog(null);
    return NextResponse.json({ restored: slug, courses: catalog, source: "memory" });
  }

  await ensureSchema(pool);
  await pool.execute("UPDATE courses SET archived = FALSE WHERE slug = ?", [slug]);
  const catalog = await getAdminCourseCatalog(pool);
  return NextResponse.json({ restored: slug, courses: catalog });
}
