import { CourseLearning } from "@/components/courses/CourseLearning";
import { AppHeader } from "@/components/layout/AppHeader";

export default function CoursesPage() {
  return (
    <main className="page">
      <AppHeader />

      <section className="section section-top">
        <div className="container">
          <span className="eyebrow">Обучение</span>
          <h1 className="section-title">Образовательные треки: теория, практика, тесты и личная дисциплина</h1>
          <p className="lead">
            Платформа строит последовательный путь: сначала Base, затем Medium, и только после него High.
            Каждый урок открывается отдельно как в приложении: теория, затем тест, затем переход к следующему шагу.
          </p>
          <CourseLearning />
        </div>
      </section>
    </main>
  );
}
