import Link from "next/link";
import { AppHeader } from "@/components/layout/AppHeader";

export default async function LoginPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const hasError = params?.error === "bad-credentials";
  const isBlocked = params?.error === "blocked";

  return (
    <main className="page">
      <AppHeader />

      <section className="section section-top">
        <div className="container">
          <span className="eyebrow">Авторизация</span>
          <h1 className="section-title">Войти в CoinLit</h1>
          <p className="lead">После входа будут доступны курсы, профиль, серверный прогресс и синхронизация сделок.</p>

          {(hasError || isBlocked) && (
            <div className="card" style={{ minHeight: "auto", marginBottom: 18, borderColor: "rgba(240, 178, 191, 0.7)" }}>
              {isBlocked
                ? "Ваш аккаунт заблокирован администратором. Обратитесь в поддержку или к владельцу платформы."
                : "Неверные данные входа. Проверьте email и пароль."}
            </div>
          )}

          <form className="form glass" action="/api/auth/login" method="post" style={{ padding: 24, borderRadius: "var(--radius-lg)" }}>
            <label className="field">
              Email
              <input className="input" name="email" type="email" required />
            </label>
            <label className="field">
              Пароль
              <input className="input" name="password" type="password" required />
            </label>
            <button className="btn" type="submit">
              Войти
            </button>
            <Link className="muted" href="/register">
              Нет аккаунта? Зарегистрироваться
            </Link>
          </form>
        </div>
      </section>
    </main>
  );
}
