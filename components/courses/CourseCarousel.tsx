"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchCourseCatalog, getStaticCourseCatalog } from "@/lib/client/course-catalog";
import type { CourseSummary } from "@/lib/server/course-catalog";

function formatHours(hours: number) {
  return `${Math.max(1, hours)} ч`;
}

export function CourseCarousel() {
  const [catalog, setCatalog] = useState<CourseSummary[]>(getStaticCourseCatalog());

  useEffect(() => {
    fetchCourseCatalog().then(setCatalog);
  }, []);

  return (
    <div className="slider" aria-label="Слайдер курсов">
      {catalog.map((course) => (
        <article className="card" key={course.id}>
          <span className="chip">
            {course.level} • {formatHours(course.hours)}
          </span>
          <h3>{course.title}</h3>
          <p className="muted">{course.description}</p>
          <p>
            <b>Направление:</b> {course.direction}
          </p>
          <p>
            <b>Детализация:</b> {course.lessonsCount} уроков, теория + тест + разбор ошибок.
          </p>
          {course.lessonsCount === 0 && <p className="muted">Курс добавлен в каталог, но программа уроков еще не опубликована.</p>}
          <div className="hero-actions">
            {course.lessonsCount > 0 ? (
              <Link className="btn secondary" href={`/courses/${course.id}`} data-requires-auth>
                Открыть курс
              </Link>
            ) : (
              <span className="pill">Скоро в программе</span>
            )}
            <Link className="btn ghost" href="/courses">
              В каталог
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
