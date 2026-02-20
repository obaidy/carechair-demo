import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Footer from "./Footer";
import BrandLogo from "./BrandLogo";

export default function PageShell({ title, subtitle, right, children }) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!menuOpen || typeof window === "undefined") return undefined;
    const previousOverflow = document.body.style.overflow || "";
    const onEsc = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onEsc);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onEsc);
    };
  }, [menuOpen]);

  return (
    <div className="platform-page" dir="rtl">
      <header className="platform-header">
        <div className="platform-header-main">
          <BrandLogo className="platform-brand" />
          <div className="platform-header-copy">
            <h1>{title}</h1>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
        </div>
        <button
          type="button"
          className="platform-menu-toggle"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-controls="platform-mobile-drawer"
        >
          {menuOpen ? "✕" : "☰"}
        </button>
        <div className="header-actions">
          <Link className={`ghost-link${location.pathname === "/explore" ? " is-active" : ""}`} to="/explore">
            استكشاف
          </Link>
          <Link className={`ghost-link${location.pathname === "/admin" || location.pathname === "/superadmin" ? " is-active" : ""}`} to="/admin">
            سوبر أدمن
          </Link>
          {right}
        </div>
      </header>
      <div
        className={`platform-mobile-backdrop${menuOpen ? " open" : ""}`}
        onClick={() => setMenuOpen(false)}
        aria-hidden={!menuOpen}
      />
      <aside id="platform-mobile-drawer" className={`platform-mobile-drawer${menuOpen ? " open" : ""}`} aria-hidden={!menuOpen}>
        <div className="platform-mobile-drawer-links">
          <Link
            className={`platform-mobile-link${location.pathname === "/explore" ? " is-active" : ""}`}
            to="/explore"
            onClick={() => setMenuOpen(false)}
          >
            استكشاف
          </Link>
          <Link
            className={`platform-mobile-link${location.pathname === "/admin" || location.pathname === "/superadmin" ? " is-active" : ""}`}
            to="/admin"
            onClick={() => setMenuOpen(false)}
          >
            سوبر أدمن
          </Link>
          {right ? <div className="platform-mobile-extra">{right}</div> : null}
        </div>
      </aside>
      <main className="platform-main">{children}</main>
      <Footer />
    </div>
  );
}
