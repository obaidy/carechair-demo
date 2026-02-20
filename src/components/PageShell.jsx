import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Footer from "./Footer";
import BrandLogo from "./BrandLogo";
import MobileDrawer from "./MobileDrawer";

export default function PageShell({ title, subtitle, right, children, mobileMenuDisabled = false }) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.search]);

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
        {!mobileMenuDisabled ? (
          <button
            type="button"
            className="platform-menu-toggle"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-controls="platform-mobile-drawer"
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        ) : null}
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
      {!mobileMenuDisabled ? (
        <MobileDrawer open={menuOpen} onClose={() => setMenuOpen(false)} id="platform-mobile-drawer" title="القائمة">
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
        </MobileDrawer>
      ) : null}
      <main className="platform-main">{children}</main>
      <Footer />
    </div>
  );
}
