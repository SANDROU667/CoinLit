import { notFound } from "next/navigation";
import { AppHeader } from "@/components/layout/AppHeader";
import { CoursePlayer } from "@/components/courses/CoursePlayer";
import { ensureSchema, getPool } from "@/lib/db";
import { getCourseDetail } from "@/lib/server/course-catalog";

export default async function CourseDetailPage({
  params
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const pool = getPool();
  if (pool) await ensureSchema(pool);

  const detail = await getCourseDetail(pool, courseId);
  if (!detail) notFound();

  const overrideCourse = {
    id: detail.id,
    title: detail.title,
    level: detail.level,
    direction: detail.direction,
    price: detail.price,
    hours: detail.hours,
    description: detail.description,
    lessons: detail.lessons.map((lesson) => lesson.title),
    requiredCoins: detail.requiredCoins
  };

  const overrideLessons = detail.lessons.map((lesson) => ({
    id: lesson.id,
    title: lesson.title,
    minutes: lesson.minutes,
    material: lesson.material,
    practice: lesson.practice,
    keyPoints: lesson.keyPoints,
    test: lesson.test
  }));

  return (
    <main className="page">
      <AppHeader />
      <section className="section section-top">
        <div className="container">
          <CoursePlayer
            courseId={detail.id}
            overrideCourse={overrideCourse}
            overrideLessons={overrideLessons}
            standaloneCourse={Boolean(detail.isCustom)}
          />
        </div>
      </section>
    </main>
  );
}
