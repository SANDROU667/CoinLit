"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { emptyProgress, readProgress, type ProgressState } from "@/lib/client/coinlit-storage";
import { courseModules } from "@/lib/content/learning-content";
import { fetchCourseCatalog, getStaticCourseCatalog } from "@/lib/client/course-catalog";
import type { CourseSummary } from "@/lib/server/course-catalog";

function formatDuration(hours: number) {
  return `${hours} ч`;
}

export function CourseLearning() {
  const [progress, setProgress] = useState<ProgressState>(emptyProgress);
  const [catalog, setCatalog] = useState<CourseSummary[]>(getStaticCourseCatalog());

  const refreshProgress = useCallback(async () => {
    try {
      const response = await fetch("/api/progress", { cache: "no-store" });
      if (!response.ok) throw new Error("unauthorized");
      const data = (await response.json()) as ProgressState & { source?: string };
      if (data.source === "no-db") {
        setProgress(readProgress());
        return;
      }
      setProgress({
        completedLessons: data.completedLessons ?? [],
        testResults: data.testResults ?? []
      });
    } catch {
      setProgress(readProgress());
    }
  }, []);

  useEffect(() => {
    refreshProgress();
    fetchCourseCatalog().then(setCatalog);
    window.addEventListener("coinlit:progress-updated", refreshProgress);
    window.addEventListener("coinlit:user-updated", refreshProgress);
    return () => {
      window.removeEventListener("coinlit:progress-updated", refreshProgress);
      window.removeEventListener("coinlit:user-updated", refreshProgress);
    };
  }, [refreshProgress]);

  const completedLessonsByCourse = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const lesson of progress.completedLessons) {
      grouped.set(lesson.courseId, (grouped.get(lesson.courseId) ?? 0) + 1);
    }
    return grouped;
  }, [progress.completedLessons]);

  const requiredLessons = useMemo(() => {
    const map = new Map<string, number>();
    for (const module of courseModules) {
      map.set(module.courseId, module.lessons.length);
    }
    return map;
  }, []);

  const baseDone = (completedLessonsByCourse.get("base") ?? 0) >= (requiredLessons.get("base") ?? 0);
  const mediumDone = (completedLessonsByCourse.get("medium") ?? 0) >= (requiredLessons.get("medium") ?? 0);

  const isUnlocked = useCallback(
    (courseId: string) => {
      if (courseId === "base") return true;
      if (courseId === "medium") return baseDone;
      if (courseId === "high") return mediumDone;
      return true;
    },
    [baseDone, mediumDone]
  );

  return (
    <div className="course-layout">
      <article className="card">
        <span className="chip">Образовательная платформа</span>
        <h2>Бесплатное развитие с практикой и дисциплиной</h2>
        <p className="muted">
          CoinLit — это не просто список курсов, а образовательная экосистема: база знаний, треки обучения, тесты,
          разборы решений, словарь терминов и личный профиль прогресса.
        </p>
      </article>

      <div className="grid" style={{ marginTop: 4 }}>
        {catalog.map((course) => {
          const completed = completedLessonsByCourse.get(course.id) ?? 0;
          const lessonsCount = course.lessonsCount || requiredLessons.get(course.id) || 0;
          const percent = lessonsCount > 0 ? Math.round((completed / lessonsCount) * 100) : 0;
          const unlocked = isUnlocked(course.id);
          const hasProgram = lessonsCount > 0;

          return (
            <article className="card" key={course.id}>
              <span className="chip">
                {course.level} • {formatDuration(course.hours)}
              </span>
              <h2>{course.title}</h2>
              <p className="muted">{course.description}</p>
              <p>
                <b>Доступ:</b>{" "}
                {unlocked ? "открыт" : course.id === "medium" ? "после полного BASE" : "после полного MEDIUM"}
              </p>
              {!hasProgram && <p className="muted">Программа уроков для этого курса пока не опубликована.</p>}
              <p>
                <b>Уроков:</b> {lessonsCount} • завершено: {completed} ({percent}%)
              </p>
              <div className="progress-bar">
                <span style={{ width: `${percent}%` }} />
              </div>
              <div className="hero-actions" style={{ marginTop: 14 }}>
                <Link
                  className="btn secondary"
                  href={unlocked && hasProgram ? `/courses/${course.id}` : "/courses"}
                  data-requires-auth
                  aria-disabled={!unlocked || !hasProgram}
                >
                  {unlocked ? (hasProgram ? "Открыть программу" : "Ожидает публикации") : "Трек пока закрыт"}
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
