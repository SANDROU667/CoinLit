import { AppHeader } from "@/components/layout/AppHeader";
import { ProfileDashboard } from "@/components/profile/ProfileDashboard";

export default function ProfilePage() {
  return (
    <main className="page">
      <AppHeader />

      <section className="section section-top">
        <div className="container">
          <span className="eyebrow">Профиль</span>
          <h1 className="section-title">Твой прогресс, статистика и управление аккаунтом</h1>
          <p className="lead">
            В кабинете хранится весь путь обучения: треки Base/Medium/High, пройденные уроки, тесты, достижения,
            коины и журнал сделок. Это центр персональной аналитики платформы.
          </p>
          <ProfileDashboard />
        </div>
      </section>
    </main>
  );
}
