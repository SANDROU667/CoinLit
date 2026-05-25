"use client";

import { FormEvent, useEffect, useState } from "react";
import { emitUserUpdated } from "@/lib/client/coinlit-storage";

type SessionUser = {
  id: number;
  email: string;
  login: string;
  role: "user" | "admin";
};

export function AuthDialog() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("register");
  const [error, setError] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);

  async function refreshSession() {
    try {
      const response = await fetch("/api/auth/session", { cache: "no-store" });
      if (!response.ok) {
        setIsAuthenticated(false);
        return;
      }
      const data = (await response.json()) as { user: SessionUser };
      setIsAuthenticated(Boolean(data.user));
    } catch {
      setIsAuthenticated(false);
    }
  }

  useEffect(() => {
    const openModal = (event: Event) => {
      const custom = event as CustomEvent<{ mode?: "login" | "register" }>;
      setMode(custom.detail?.mode ?? "register");
      setOpen(true);
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const gated = target?.closest("[data-requires-auth]");
      if (!gated || isAuthenticated) return;
      event.preventDefault();
      setMode("register");
      setOpen(true);
    };

    refreshSession();
    window.addEventListener("coinlit:auth", openModal);
    window.addEventListener("coinlit:user-updated", refreshSession);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("coinlit:auth", openModal);
      window.removeEventListener("coinlit:user-updated", refreshSession);
      document.removeEventListener("click", onClick, true);
    };
  }, [isAuthenticated]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const login = String(form.get("login") ?? "");
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");
    const dateOfBirth = String(form.get("dateOfBirth") ?? "");

    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
    const payload = mode === "login" ? { email, password } : { email, login, password, confirmPassword, dateOfBirth };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({ error: "Ошибка авторизации." }))) as { error?: string };
        setError(data.error ?? "Ошибка авторизации.");
        return;
      }

      setOpen(false);
      setError("");
      await refreshSession();
      emitUserUpdated();
    } catch {
      setError("Не удалось выполнить запрос. Проверь соединение и повтори попытку.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card glass">
        <button className="modal-close" type="button" onClick={() => setOpen(false)} aria-label="Закрыть">
          ×
        </button>
        <span className="eyebrow">{mode === "login" ? "Вход" : "Регистрация"}</span>
        <h2>{mode === "login" ? "Войти в CoinLit" : "Создать аккаунт CoinLit"}</h2>
        <div className="auth-tabs">
          <button
            className={`btn ${mode === "register" ? "" : "secondary"}`}
            type="button"
            onClick={() => {
              setMode("register");
              setError("");
            }}
          >
            Регистрация
          </button>
          <button
            className={`btn ${mode === "login" ? "" : "secondary"}`}
            type="button"
            onClick={() => {
              setMode("login");
              setError("");
            }}
          >
            Вход
          </button>
        </div>
        {error && <p className="auth-error">{error}</p>}
        <form className="form" onSubmit={submit}>
          <label className="field">
            Почта
            <input className="input" name="email" type="email" required />
          </label>
          {mode === "register" && (
            <>
              <label className="field">
                Логин
                <input className="input" name="login" minLength={3} required />
              </label>
              <label className="field">
                Дата рождения
                <input className="input" name="dateOfBirth" type="date" required />
              </label>
            </>
          )}
          <label className="field">
            Пароль
            <input className="input" name="password" type="password" minLength={mode === "register" ? 8 : 1} required />
          </label>
          {mode === "register" && (
            <label className="field">
              Подтверждение пароля
              <input className="input" name="confirmPassword" type="password" minLength={8} required />
            </label>
          )}
          <button className="btn" type="submit" disabled={loading}>
            {loading ? "Обработка..." : mode === "login" ? "Войти" : "Зарегистрироваться"}
          </button>
        </form>
      </div>
    </div>
  );
}
