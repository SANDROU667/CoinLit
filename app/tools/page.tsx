import { AppHeader } from "@/components/layout/AppHeader";
import { FinanceTools } from "@/components/tools/FinanceTools";

export default function ToolsPage() {
  return (
    <main className="page">
      <AppHeader />

      <section className="section section-top">
        <div className="container">
          <span className="eyebrow">Инструменты</span>
          <h1 className="section-title">Практические калькуляторы и аналитика сделок</h1>
          <p className="lead">
            Раздел помогает применять учебные принципы в действиях: расчет риска, ведение журнала, контроль PnL,
            проверка сценария и дисциплины исполнения.
          </p>
          <FinanceTools />
        </div>
      </section>
    </main>
  );
}
