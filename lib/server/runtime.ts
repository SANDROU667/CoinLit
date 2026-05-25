import { NextResponse } from "next/server";

export function isHostedRuntime() {
  return process.env.VERCEL === "1";
}

export function isHostedDatabaseMissing() {
  return isHostedRuntime() && !process.env.DATABASE_URL;
}

export function hostedDatabaseMissingResponse() {
  return NextResponse.json(
    {
      error:
        "На хостинге нужна переменная DATABASE_URL. Добавь MySQL-подключение в Vercel Environment Variables и перезапусти деплой."
    },
    { status: 503 }
  );
}

export function secureCookieOptions() {
  return process.env.NODE_ENV === "production" ? { secure: true } : {};
}
