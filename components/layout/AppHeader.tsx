"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const navItems = [
  { href: "/knowledge", label: "База знаний" },
  { href: "/tests", label: "Тесты" },
  { href: "/courses", label: "Обучение" },
  { href: "/tools", label: "Инструменты" }
];

export function AppHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <>
      <header className="app-header glass desktop-header">
        <div className="header-inner">
          <nav className="nav-side" aria-label="Навигация слева">
            {navItems.slice(0, 2).map((item) => (
              <Link className="nav-link" href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>

          <Link className="logo" href="/">
            CoinLit
          </Link>

          <nav className="nav-side right" aria-label="Навигация справа">
            {navItems.slice(2).map((item) => (
              <Link className="nav-link" href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
            <Link className="nav-link nav-pill" href="/profile" data-requires-auth>
              Кабинет
            </Link>
          </nav>
        </div>
      </header>

      <header className="mobile-header glass">
        <div className="mobile-header-row">
          <Link className="logo" href="/">
            CoinLit
          </Link>
          <button
            className={`mobile-menu-toggle ${menuOpen ? "open" : ""}`}
            type="button"
            aria-label="Открыть меню"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
        {menuOpen && (
          <nav className="mobile-menu" aria-label="Мобильная навигация">
            {navItems.map((item) => (
              <Link className="mobile-menu-link" href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
            <Link className="mobile-menu-link mobile-menu-link-accent" href="/profile" data-requires-auth>
              Кабинет
            </Link>
          </nav>
        )}
      </header>
    </>
  );
}
