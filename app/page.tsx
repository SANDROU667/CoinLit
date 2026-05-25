import Link from "next/link";
import { CourseCarousel } from "@/components/courses/CourseCarousel";
import { AppHeader } from "@/components/layout/AppHeader";

const cleanTestimonials = [
  {
    name: "Алина",
    role: "Новичок",
    rating: 5,
    text: "Перестала принимать решения на эмоциях. Появился понятный процесс входа и контроля риска.",
    result: "Собрала личный чек-лист перед сделкой"
  },
  {
    name: "Руслан",
    role: "Любитель",
    rating: 5,
    text: "Medium помог стабилизировать просадку: теперь считаю риск заранее и фиксирую решения в журнале.",
    result: "Снизил средний риск с 5% до 1.5%"
  },
  {
    name: "Марина",
    role: "Начинающий инвестор",
    rating: 4,
    text: "Сильный формат обучения: теория, затем тест, затем применение. Это реально дисциплинирует.",
    result: "Убрала импульсивные входы на волатильности"
  },
  {
    name: "Денис",
    role: "Инвестор",
    rating: 5,
    text: "В High понравилась связка макро-контекста, ончейн метрик и риск-протоколов в одной системе.",
    result: "Сформировал IPS и план на 12 месяцев"
  }
];

export default function Home() {
  return (
    <main className="page">
      <AppHeader />

      <section className="hero">
        <div className="container hero-layout hero-layout-single">
          <div>
            <span className="eyebrow">CoinLit • crypto literacy</span>
            <h1>Финансовая грамотность в криптовалютах: системно, безопасно, бесплатно</h1>
            <p className="lead" style={{ marginTop: 18 }}>
              CoinLit — образовательная платформа, где люди учатся понимать рынок, управлять риском,
              разбирать терминологию и строить инвестиционную дисциплину без паники и хаоса.
            </p>
            <div className="hero-lines">
              <span className="hero-line">Пошаговая траектория: Base → Medium → High</span>
              <span className="hero-line">Уроки как в приложении: теория, тест, мгновенный разбор</span>
              <span className="hero-line">Словарь терминов, риск-протоколы и практические сценарии</span>
              <span className="hero-line">Бесплатное образовательное развитие для всех участников</span>
            </div>
            <div className="hero-actions">
              <Link className="btn" href="/courses" data-requires-auth>
                Начать обучение
              </Link>
              <Link className="btn secondary" href="/knowledge" data-requires-auth>
                Открыть базу знаний
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="courses">
        <div className="container">
          <span className="eyebrow">Треки</span>
          <h2 className="section-title">Маршрут развития от новичка до системного инвестора</h2>
          <p className="lead">
            Платформа объединяет практику и теорию: словарь терминов, сценарные задания,
            контроль эмоций, инструменты расчета риска, тесты и персональный кабинет прогресса.
          </p>
          <CourseCarousel />
        </div>
      </section>

      <section className="section">
        <div className="container">
          <span className="eyebrow">Платформа</span>
          <h2 className="section-title">Что ты получаешь кроме курсов</h2>
          <div className="info-list">
            <article className="card">
              <h3>База знаний</h3>
              <p className="muted">Системные материалы по BTC/ETH, DeFi, безопасности кошельков и рыночной психологии.</p>
            </article>
            <article className="card">
              <h3>Тесты и диагностика</h3>
              <p className="muted">Тестовые блоки с объяснениями помогают закрепить тему и увидеть пробелы до реальных сделок.</p>
            </article>
            <article className="card">
              <h3>Инструменты инвестора</h3>
              <p className="muted">Калькуляторы риска, журнал сделок, сценарные чек-листы и разбор качества решений.</p>
            </article>
            <article className="card">
              <h3>Профиль прогресса</h3>
              <p className="muted">Достижения, пройденные уроки, монеты, темп развития и динамика обучения в одном месте.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <span className="eyebrow">Отзывы</span>
          <h2 className="section-title">Реальный прогресс участников CoinLit</h2>
          <div className="slider">
            {cleanTestimonials.map((item) => (
              <article className="card" key={item.name}>
                <span className="chip">{item.role}</span>
                <h3>{item.name}</h3>
                <p className="rating">{"★".repeat(item.rating)}{"☆".repeat(5 - item.rating)}</p>
                <p className="muted">{item.text}</p>
                <span className="pill">{item.result}</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="cta-band glass">
            <div>
              <span className="eyebrow">Старт</span>
              <h2>Открой образовательную платформу и начни развиваться уже сегодня</h2>
              <p className="muted">База знаний и структура обучения доступны бесплатно, чтобы каждый мог развиваться в крипте осознанно.</p>
            </div>
            <div className="hero-actions">
              <Link className="btn" href="/courses" data-requires-auth>
                Перейти к обучению
              </Link>
              <Link className="btn secondary" href="/profile" data-requires-auth>
                Открыть профиль
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
