import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";
import { getCourseCatalog } from "@/lib/server/course-catalog";

export async function GET() {
  const pool = getPool();
  if (pool) await ensureSchema(pool);

  const catalog = await getCourseCatalog(pool);
  return NextResponse.json({ courses: catalog, source: pool ? "mysql" : "memory" });
}
