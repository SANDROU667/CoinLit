"use client";

import { courseModules, courses } from "@/lib/content/learning-content";
import type { CourseSummary } from "@/lib/server/course-catalog";

const staticCatalog: CourseSummary[] = courses.map((course) => {
  const module = courseModules.find((item) => item.courseId === course.id);
  return {
    ...course,
    lessonsCount: module?.lessons.length ?? course.lessons.length,
    source: "static"
  };
});

export async function fetchCourseCatalog(): Promise<CourseSummary[]> {
  try {
    const response = await fetch("/api/courses", { cache: "no-store" });
    if (!response.ok) throw new Error("bad-response");
    const body = (await response.json()) as { courses?: CourseSummary[] };
    if (!Array.isArray(body.courses) || !body.courses.length) return staticCatalog;
    return body.courses;
  } catch {
    return staticCatalog;
  }
}

export function getStaticCourseCatalog() {
  return staticCatalog;
}
