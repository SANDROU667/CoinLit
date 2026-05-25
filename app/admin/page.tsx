import { AdminAccessGate } from "@/components/admin/AdminAccessGate";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { AppHeader } from "@/components/layout/AppHeader";

export default function AdminPage() {
  return (
    <main className="page">
      <AppHeader />
      <section className="section section-top">
        <div className="container">
          <span className="eyebrow">Админ-панель</span>
          <h1 className="section-title">Управление образовательной платформой</h1>
          <p className="lead">
            Здесь настраивается каталог курсов, программа уроков и публикация материалов в учебном разделе.
          </p>
          <AdminAccessGate>
            <AdminDashboard />
          </AdminAccessGate>
        </div>
      </section>
    </main>
  );
}
