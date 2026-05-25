import { getDatabaseUrl } from "@/lib/db";
import { NextResponse } from "next/server";

export function isHostedRuntime() {
  return process.env.VERCEL === "1";
}

export function isHostedDatabaseMissing() {
  return isHostedRuntime() && !getDatabaseUrl();
}

export function hostedDatabaseMissingResponse() {
  return NextResponse.json(
    {
      error:
        "На хостинге нужна база Postgres. Подключи Neon или Vercel Postgres в Storage, чтобы появились POSTGRES_URL или DATABASE_URL, и перезапусти деплой."
    },
    { status: 503 }
  );
}

export function secureCookieOptions() {
  return process.env.NODE_ENV === "production" ? { secure: true } : {};
}
