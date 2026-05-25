"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";

type SessionResponse = {
  admin: null | { login: string; role: string };
};

export function AdminAccessGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function refreshSession() {
    try {
      const response = await fetch("/api/admin/auth/session", { cache: "no-store" });
      if (!response.ok) {
        setAuthorized(false);
        return;
      }
      const body = (await response.json()) as SessionResponse;
      setAuthorized(Boolean(body.admin));
    } catch {
      setAuthorized(false);
    } finally {
      setReady(true);
    }
  }

  useEffect(() => {
    refreshSession();
  }, []);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const loginValue = String(form.get("login") ?? "");
    const password = String(form.get("password") ?? "");

    try {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: loginValue, password })
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({ error: "Ошибка авторизации." }))) as { error?: string };
        setError(body.error ?? "Ошибка авторизации.");
        return;
      }
      setAuthorized(true);
    } catch {
      setError("Не удалось выполнить вход. Проверьте соединение и повторите попытку.");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/auth/logout", { method: "POST" }).catch(() => undefined);
    setAuthorized(false);
    setReady(true);
  }

  if (!ready) {
    return (
      <article className="card" style={{ minHeight: "auto" }}>
        <span className="chip">Проверка доступа</span>
        <p className="muted">Проверяем админ-сессию...</p>
      </article>
    );
  }

  if (!authorized) {
    return (
      <article className="card" style={{ minHeight: "auto" }}>
        <span className="chip">Админ-доступ</span>
        <h2>Вход в админ-панель</h2>
        <p className="muted">Для входа используйте логин и пароль администратора.</p>
        {error && <p className="auth-error">{error}</p>}
        <form className="form" onSubmit={login}>
          <label className="field">
            Логин
            <input className="input" name="login" autoComplete="username" required />
          </label>
          <label className="field">
            Пароль
            <input className="input" name="password" type="password" autoComplete="current-password" required />
          </label>
          <button className="btn" type="submit" disabled={loading}>
            {loading ? "Вход..." : "Войти в админку"}
          </button>
        </form>
      </article>
    );
  }

  return (
    <div className="course-layout">
      <div className="hero-actions" style={{ justifyContent: "flex-end" }}>
        <button className="btn secondary" type="button" onClick={logout}>
          Выйти из админки
        </button>
      </div>
      {children}
    </div>
  );
}
