import type { DbPool } from "@/lib/db";
import { promises as fs } from "fs";
import path from "path";
import {
  courseModules,
  courses,
  type Course,
  type CourseLesson,
  type CourseLevel,
  type TestQuestion
} from "@/lib/content/learning-content";

export type CourseConfigLesson = {
  id: string;
  title: string;
  minutes: number;
  material: string;
  practice: string;
  keyPoints: string[];
  test: TestQuestion;
};

export type CourseSummary = {
  id: string;
  title: string;
  level: CourseLevel;
  direction: string;
  price: string;
  hours: number;
  requiredCoins: number;
  description: string;
  lessonsCount: number;
  source: "static" | "admin";
  archived?: boolean;
  isCustom?: boolean;
};

export type CourseDetail = CourseSummary & {
  lessons: CourseConfigLesson[];
};

type AdminRow = {
  slug: string;
  title: string;
  level: string;
  direction: string;
  price: string;
  hours: number;
  archived: boolean;
  description: string | null;
  required_coins: number | null;
  lessons_json: string | null;
};

declare global {
  // eslint-disable-next-line no-var
  var coinlitCourseMemory:
    | {
        bySlug: Map<string, AdminRow>;
        loaded: boolean;
        writeQueue: Promise<void>;
      }
    | undefined;
}

const LEVEL_ORDER: Record<CourseLevel, number> = {
  Base: 0,
  Medium: 1,
  High: 2
};

function getStaticCourse(slug: string) {
  return courses.find((course) => normalizeSlug(course.id) === normalizeSlug(slug));
}

function normalizeLevel(value: unknown): CourseLevel {
  if (value === "Base" || value === "Medium" || value === "High") return value;
  return "Base";
}

function normalizeSlug(value: string) {
  return value.trim().toLowerCase();
}

function getMemoryState() {
  if (!global.coinlitCourseMemory) {
    global.coinlitCourseMemory = { bySlug: new Map<string, AdminRow>(), loaded: false, writeQueue: Promise.resolve() };
  }
  return global.coinlitCourseMemory;
}

const LOCAL_COURSE_DB_PATH = process.env.LOCAL_COURSE_DB_FILE
  ? path.resolve(process.env.LOCAL_COURSE_DB_FILE)
  : path.join(process.cwd(), "data", "coinlit-local-courses.json");

function sanitizeAdminRow(input: unknown): AdminRow | null {
  const row = (input ?? {}) as Partial<AdminRow>;
  if (!row.slug || !row.title) return null;

  return {
    slug: normalizeSlug(String(row.slug)),
    title: String(row.title),
    level: String(row.level ?? "Base"),
    direction: String(row.direction ?? "Additional track"),
    price: String(row.price ?? "Free"),
    hours: Number.isFinite(row.hours) ? Number(row.hours) : 1,
    archived: Boolean(row.archived),
    description: typeof row.description === "string" ? row.description : null,
    required_coins: Number.isFinite(row.required_coins) ? Number(row.required_coins) : 0,
    lessons_json: typeof row.lessons_json === "string" ? row.lessons_json : null
  };
}

async function ensureCourseMemoryLoaded() {
  const state = getMemoryState();
  if (state.loaded) return;

  try {
    const content = await fs.readFile(LOCAL_COURSE_DB_PATH, "utf8");
    const parsed = JSON.parse(content) as { rows?: unknown[] };
    const rows = Array.isArray(parsed.rows) ? parsed.rows : [];
    state.bySlug.clear();
    rows.forEach((rowLike) => {
      const row = sanitizeAdminRow(rowLike);
      if (row) state.bySlug.set(row.slug, row);
    });
  } catch {
    state.bySlug.clear();
  } finally {
    state.loaded = true;
  }
}

async function persistCourseMemory() {
  const state = getMemoryState();
  const rows = Array.from(state.bySlug.values());
  await fs.mkdir(path.dirname(LOCAL_COURSE_DB_PATH), { recursive: true });
  await fs.writeFile(LOCAL_COURSE_DB_PATH, JSON.stringify({ version: 1, rows }, null, 2), "utf8");
}

async function withCourseWriteLock(task: () => Promise<void>) {
  const state = getMemoryState();
  const run = state.writeQueue.then(task, task);
  state.writeQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function buildStaticSummary(course: Course): CourseSummary {
  const module = courseModules.find((item) => item.courseId === course.id);
  return {
    id: course.id,
    title: course.title,
    level: normalizeLevel(course.level),
    direction: course.direction,
    price: course.price,
    hours: course.hours,
    requiredCoins: course.requiredCoins,
    description: course.description,
    lessonsCount: module?.lessons.length ?? course.lessons.length,
    source: "static",
    isCustom: false
  };
}

function isStaticPlaceholderRow(row: AdminRow, slug: string) {
  return (
    row.title === slug.toUpperCase() &&
    row.direction === "Archived" &&
    row.price === "Free" &&
    Number(row.hours) === 1 &&
    Boolean(row.description?.includes("placeholder"))
  );
}

function buildStaticArchiveRow(slug: string, archived: boolean): AdminRow | null {
  const course = getStaticCourse(slug);
  if (!course) return null;
  return {
    slug: normalizeSlug(course.id),
    title: course.title,
    level: course.level,
    direction: course.direction,
    price: course.price,
    hours: course.hours,
    archived,
    description: course.description,
    required_coins: course.requiredCoins,
    lessons_json: null
  };
}

export function getStaticCourseArchiveDefaults(slug: string) {
  return buildStaticArchiveRow(slug, true);
}

function buildDefaultLesson(slug: string, title: string): CourseConfigLesson {
  return {
    id: `${slug}-lesson-01`,
    title: `${title}: стартовый урок`,
    minutes: 15,
    material:
      "Этот курс добавлен через админ-панель. Откройте конфигуратор курса и заполните полноценные уроки, материалы и тестовые вопросы.",
    practice: "Сформулируйте цель курса и ожидаемый практический результат после завершения урока.",
    keyPoints: [
      "Сформулируйте цель урока",
      "Добавьте структурированную теорию",
      "Добавьте тест с вариантами ответов и объяснением"
    ],
    test: {
      question: "Что важно сделать после создания курса?",
      options: [
        "Оставить курс без содержания",
        "Заполнить уроки и тесты в конфигураторе",
        "Удалить курс из каталога"
      ],
      answer: 1,
      explanation: "Курс становится полноценным после заполнения программы уроков и тестов."
    }
  };
}

function normalizeLesson(input: unknown, slug: string, index: number): CourseConfigLesson {
  const raw = (input ?? {}) as Partial<CourseConfigLesson>;
  const fallback = buildDefaultLesson(slug, `Урок ${index + 1}`);
  const options = Array.isArray(raw.test?.options)
    ? raw.test.options.filter((item) => typeof item === "string" && item.trim().length > 0).slice(0, 6)
    : [];

  const safeOptions = options.length >= 2 ? options : fallback.test.options;
  const safeAnswer =
    typeof raw.test?.answer === "number" && raw.test.answer >= 0 && raw.test.answer < safeOptions.length
      ? raw.test.answer
      : 0;

  const keyPoints = Array.isArray(raw.keyPoints)
    ? raw.keyPoints.filter((item) => typeof item === "string" && item.trim().length > 0).slice(0, 8)
    : [];

  return {
    id: typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : `${slug}-lesson-${String(index + 1).padStart(2, "0")}`,
    title: typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : `Урок ${index + 1}`,
    minutes: Number.isFinite(raw.minutes) ? Math.max(5, Number(raw.minutes)) : fallback.minutes,
    material: typeof raw.material === "string" && raw.material.trim() ? raw.material.trim() : fallback.material,
    practice: typeof raw.practice === "string" && raw.practice.trim() ? raw.practice.trim() : fallback.practice,
    keyPoints: keyPoints.length ? keyPoints : fallback.keyPoints,
    test: {
      question:
        typeof raw.test?.question === "string" && raw.test.question.trim()
          ? raw.test.question.trim()
          : fallback.test.question,
      options: safeOptions,
      answer: safeAnswer,
      explanation:
        typeof raw.test?.explanation === "string" && raw.test.explanation.trim()
          ? raw.test.explanation.trim()
          : fallback.test.explanation
    }
  };
}

function parseLessonsJson(lessonsJson: string | null, slug: string, title: string): CourseConfigLesson[] {
  if (!lessonsJson) return [buildDefaultLesson(slug, title)];
  try {
    const parsed = JSON.parse(lessonsJson) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return [buildDefaultLesson(slug, title)];
    return parsed.map((lesson, index) => normalizeLesson(lesson, slug, index));
  } catch {
    return [buildDefaultLesson(slug, title)];
  }
}

function serializeLessons(lessons: CourseConfigLesson[]) {
  return JSON.stringify(lessons);
}

function applyAdminRows(adminRows: AdminRow[], includeArchived = false): CourseSummary[] {
  const staticMap = new Map(courses.map((course) => [course.id, buildStaticSummary(course)]));
  const archivedStatic = new Set<string>();
  const custom: CourseSummary[] = [];
  const archived: CourseSummary[] = [];

  for (const row of adminRows) {
    const slug = normalizeSlug(row.slug);
    const lessonsFromConfig = row.lessons_json ? parseLessonsJson(row.lessons_json, slug, row.title) : [];
    const staticCourse = staticMap.get(slug);

    if (staticCourse) {
      const isPlaceholder = isStaticPlaceholderRow(row, slug);
      const mergedStatic: CourseSummary = {
        ...staticCourse,
        title: isPlaceholder ? staticCourse.title : row.title || staticCourse.title,
        level: isPlaceholder ? staticCourse.level : normalizeLevel(row.level),
        direction: isPlaceholder ? staticCourse.direction : row.direction || staticCourse.direction,
        price: isPlaceholder ? staticCourse.price : row.price || staticCourse.price,
        hours: isPlaceholder || !Number.isFinite(row.hours) ? staticCourse.hours : row.hours,
        description: isPlaceholder ? staticCourse.description : row.description?.trim() || staticCourse.description,
        requiredCoins:
          isPlaceholder || !Number.isFinite(row.required_coins) ? staticCourse.requiredCoins : Number(row.required_coins),
        lessonsCount: isPlaceholder ? staticCourse.lessonsCount : lessonsFromConfig.length || staticCourse.lessonsCount,
        source: isPlaceholder ? "static" : "admin",
        archived: Boolean(row.archived),
        isCustom: false
      };

      if (row.archived) {
        archivedStatic.add(slug);
        if (includeArchived) archived.push(mergedStatic);
        continue;
      }

      staticMap.set(slug, mergedStatic);
      continue;
    }

    const customSummary: CourseSummary = {
      id: slug,
      title: row.title || `Course ${slug}`,
      level: normalizeLevel(row.level),
      direction: row.direction || "Additional track",
      price: row.price || "Free",
      hours: Number.isFinite(row.hours) ? row.hours : 1,
      requiredCoins: Number.isFinite(row.required_coins) ? Number(row.required_coins) : 0,
      description: row.description?.trim() || "Курс, созданный в админ-панели.",
      lessonsCount: lessonsFromConfig.length || 1,
      source: "admin",
      archived: Boolean(row.archived),
      isCustom: true
    };

    if (row.archived) {
      if (includeArchived) archived.push(customSummary);
      continue;
    }

    custom.push(customSummary);
  }

  const base = Array.from(staticMap.values()).filter((course) => !archivedStatic.has(course.id));
  return [...base, ...custom, ...archived];
}

async function listAdminRows(pool: DbPool | null): Promise<AdminRow[]> {
  if (!pool) {
    await ensureCourseMemoryLoaded();
    return Array.from(getMemoryState().bySlug.values());
  }

  const [rows] = await pool.query(
    `SELECT
      c.slug,
      c.title,
      c.level,
      c.direction,
      c.price,
      c.hours,
      c.archived,
      b.description,
      b.required_coins,
      b.lessons_json
     FROM courses c
     LEFT JOIN course_blueprints b ON b.slug = c.slug
     ORDER BY c.id ASC`
  );
  return rows as AdminRow[];
}

function staticCourseLessons(courseId: string): CourseLesson[] {
  return courseModules.find((module) => module.courseId === courseId)?.lessons ?? [];
}

export async function getCourseCatalog(pool: DbPool | null): Promise<CourseSummary[]> {
  const rows = await listAdminRows(pool);
  return applyAdminRows(rows);
}

export async function getAdminCourseCatalog(pool: DbPool | null): Promise<CourseSummary[]> {
  const rows = await listAdminRows(pool);
  return applyAdminRows(rows, true);
}

export async function getCourseDetail(pool: DbPool | null, courseId: string): Promise<CourseDetail | null> {
  const slug = normalizeSlug(courseId);
  const catalog = await getCourseCatalog(pool);
  const summary = catalog.find((item) => normalizeSlug(item.id) === slug);
  if (!summary) return null;

  const adminRows = await listAdminRows(pool);
  const row = adminRows.find((item) => normalizeSlug(item.slug) === slug);
  const rowIsStaticPlaceholder = row ? isStaticPlaceholderRow(row, slug) && !summary.isCustom : false;

  if (row?.lessons_json && !rowIsStaticPlaceholder) {
    return {
      ...summary,
      lessons: parseLessonsJson(row.lessons_json, slug, summary.title)
    };
  }

  const staticLessons = staticCourseLessons(slug);
  if (staticLessons.length && !summary.isCustom) {
    return {
      ...summary,
      lessons: staticLessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        minutes: lesson.minutes,
        material: lesson.material,
        practice: lesson.practice,
        keyPoints: lesson.keyPoints,
        test: lesson.test
      }))
    };
  }

  const lessons = parseLessonsJson(row?.lessons_json ?? null, slug, summary.title);
  return {
    ...summary,
    lessons
  };
}

export async function upsertCourseInMemory(
  row: Omit<AdminRow, "archived" | "description" | "required_coins" | "lessons_json"> & {
    archived?: boolean;
    description?: string | null;
    requiredCoins?: number;
    lessons?: CourseConfigLesson[];
  }
) {
  await ensureCourseMemoryLoaded();
  const state = getMemoryState();
  const lessons = row.lessons && row.lessons.length ? row.lessons : [buildDefaultLesson(row.slug, row.title)];
  state.bySlug.set(row.slug, {
    slug: row.slug,
    title: row.title,
    level: row.level,
    direction: row.direction,
    price: row.price,
    hours: row.hours,
    archived: Boolean(row.archived),
    description: row.description ?? "Курс, созданный в админ-панели.",
    required_coins: Number.isFinite(row.requiredCoins) ? Number(row.requiredCoins) : 0,
    lessons_json: serializeLessons(lessons)
  });
  await persistCourseMemory();
}

export async function setCourseArchivedInMemory(slug: string, archived: boolean) {
  await ensureCourseMemoryLoaded();
  const key = normalizeSlug(slug);
  const state = getMemoryState();
  const current = state.bySlug.get(key);
  if (current) {
    const staticArchiveRow = isStaticPlaceholderRow(current, key) ? buildStaticArchiveRow(key, archived) : null;
    state.bySlug.set(key, staticArchiveRow ?? { ...current, archived });
    await persistCourseMemory();
    return;
  }

  const staticArchiveRow = buildStaticArchiveRow(key, archived);
  state.bySlug.set(key, staticArchiveRow ?? {
    slug: key,
    title: key.toUpperCase(),
    level: "Base",
    direction: "Archived",
    price: "Free",
    hours: 1,
    archived,
    description: "Курс создан автоматически как placeholder для архивной записи.",
    required_coins: 0,
    lessons_json: serializeLessons([buildDefaultLesson(key, key.toUpperCase())])
  });
  await persistCourseMemory();
}
