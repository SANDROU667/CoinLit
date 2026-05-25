import Link from "next/link";
import { AppHeader } from "@/components/layout/AppHeader";

const sections = [
  {
    category: "Основы",
    title: "Bitcoin: ценность, эмиссия и роль в портфеле",
    body: "Bitcoin используют как дефицитный цифровой актив. Ключевые параметры: ограниченная эмиссия, цикл халвинга, ликвидность и макрочувствительность.",
    checklist: ["Эмиссия и халвинг", "Ликвидность и волатильность", "Роль BTC в долгом горизонте"]
  },
  {
    category: "Основы",
    title: "Ethereum и экономика сети",
    body: "ETH — инфраструктурный актив экосистемы смарт-контрактов. Для анализа важны комиссии, активность сети, обновления протокола и метрики ончейн.",
    checklist: ["Gas и комиссии", "Активность dApps", "Доходность/риск стейкинга"]
  },
  {
    category: "Безопасность",
    title: "Кошельки, seed-фраза и защита доступа",
    body: "Главный риск новичка — компрометация ключей. Безопасность строится на офлайн-хранении seed, 2FA, отдельной почте и проверке адресов.",
    checklist: ["Seed только офлайн", "2FA + сложные пароли", "Whitelist адресов"]
  },
  {
    category: "Риск",
    title: "Размер позиции и стоп-логика",
    body: "Решение начинается не с точки входа, а с лимита потерь. Сначала фиксируем риск на сделку, затем считаем допустимый объем позиции.",
    checklist: ["Риск 1-2%", "Стоп заранее", "Оценка R-multiple"]
  },
  {
    category: "Психология",
    title: "FOMO, паника и когнитивные ошибки",
    body: "Эмоции усиливаются на волатильности. Сценарный подход и пауза перед сделкой снижают импульсивные решения и повышают стабильность процесса.",
    checklist: ["Проверка сценария", "Пауза перед входом", "Пост-анализ после сделки"]
  },
  {
    category: "DeFi",
    title: "Доходность в протоколах: что считать",
    body: "Высокий APY не равен чистой доходности. Учитывай комиссию сети, риск смарт-контракта, ликвидность пула и корреляцию рынка.",
    checklist: ["Net APY после комиссий", "Контрактные риски", "Лимиты на DeFi-экспозицию"]
  }
];

export default function KnowledgePage() {
  return (
    <main className="page">
      <AppHeader />

      <section className="section section-top">
        <div className="container">
          <span className="eyebrow">База знаний</span>
          <h1 className="section-title">Образовательная библиотека платформы CoinLit</h1>
          <p className="lead">
            Здесь собраны фундаментальные темы крипторынка, риск-менеджмент, практики безопасности и поведенческая дисциплина.
            Материалы обновляются под структуру треков Base/Medium/High.
          </p>

          <div className="grid" style={{ marginTop: 24 }}>
            {sections.map((article) => (
              <article className="card" key={article.title}>
                <span className="chip">{article.category}</span>
                <h2>{article.title}</h2>
                <p className="article-body">{article.body}</p>
                {article.checklist.map((item) => (
                  <p className="muted" key={item}>• {item}</p>
                ))}
              </article>
            ))}
          </div>

          <div className="cta-band glass" style={{ marginTop: 28 }}>
            <div>
              <h2>Сначала теория, затем применение</h2>
              <p className="muted">
                Прочитай материал, закрепи тестами и переходи в треки обучения: на платформе это связанный цикл,
                а не разрозненные статьи.
              </p>
            </div>
            <div className="hero-actions">
              <Link className="btn" href="/courses" data-requires-auth>
                Перейти к трекам
              </Link>
              <Link className="btn secondary" href="/tests">
                Проверить знания
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
