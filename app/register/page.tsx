import Link from "next/link";
import { AppHeader } from "@/components/layout/AppHeader";

export default async function RegisterPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const error = params?.error;

  return (
    <main className="page">
      <AppHeader />

      <section className="section section-top">
        <div className="container">
          <span className="eyebrow">Регистрация</span>
          <h1 className="section-title">5 шагов до старта обучения</h1>
          <p className="lead">Создай аккаунт, чтобы открыть курсы, синхронизировать прогресс и вести серверный журнал сделок.</p>

          {error && (
            <div className="card" style={{ minHeight: "auto", marginBottom: 18, borderColor: "rgba(240, 178, 191, 0.7)" }}>
              {error === "exists"
                ? "Пользователь с таким email или логином уже существует."
                : "Проверь введенные данные и попробуй снова."}
            </div>
          )}

          <form className="form glass" action="/api/auth/register" method="post" style={{ padding: 24, borderRadius: "var(--radius-lg)" }}>
            <label className="field">
              1. Почта
              <input className="input" name="email" type="email" required />
            </label>
            <label className="field">
              2. Логин
              <input className="input" name="login" minLength={3} required />
            </label>
            <label className="field">
              3. Пароль
              <input className="input" name="password" type="password" minLength={8} required />
            </label>
            <label className="field">
              4. Подтверждение пароля
              <input className="input" name="confirmPassword" type="password" minLength={8} required />
            </label>
            <label className="field">
              5. Дата рождения
              <input className="input" name="dateOfBirth" type="date" required />
            </label>
            <button className="btn" type="submit">
              Зарегистрироваться
            </button>
            <p className="muted">Регистрация доступна пользователям 18+.</p>
            <Link className="muted" href="/login">
              Уже есть аккаунт? Войти
            </Link>
          </form>
        </div>
      </section>
    </main>
  );
}
