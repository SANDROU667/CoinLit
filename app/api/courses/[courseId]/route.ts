import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";
import { getCourseDetail } from "@/lib/server/course-catalog";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params;
  const pool = getPool();
  if (pool) await ensureSchema(pool);

  const course = await getCourseDetail(pool, courseId);
  if (!course) return NextResponse.json({ error: "Курс не найден." }, { status: 404 });
  return NextResponse.json({ course, source: pool ? "mysql" : "memory" });
}
