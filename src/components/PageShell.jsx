import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Footer from "./Footer";
import BrandLogo from "./BrandLogo";
import MobileDrawer from "./MobileDrawer";
import LanguageSwitcher from "./LanguageSwitcher";

export default function PageShell({ title, subtitle, right, children, mobileMenuDisabled = false }) {
  const location = useLocation();
  const { i18n, t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const dir = i18n.dir();
  const isSuperadminRoute = location.pathname.startsWith("/admin") || location.pathname.startsWith("/superadmin");

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.search]);

  return (
    <div className="platform-page" dir={dir}>
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
            {t("common.explore")}
          </Link>
          <Link className={`ghost-link${location.pathname === "/pricing" ? " is-active" : ""}`} to="/pricing">
            {t("nav.pricing")}
          </Link>
          <Link className={`ghost-link${isSuperadminRoute ? " is-active" : ""}`} to="/admin">
            {t("nav.superadmin")}
          </Link>
          <LanguageSwitcher />
          {right}
        </div>
      </header>
      {!mobileMenuDisabled ? (
        <MobileDrawer open={menuOpen} onClose={() => setMenuOpen(false)} id="platform-mobile-drawer" title={t("nav.menu")}>
          <div className="platform-mobile-drawer-links">
            <Link
              className={`platform-mobile-link${location.pathname === "/explore" ? " is-active" : ""}`}
              to="/explore"
              onClick={() => setMenuOpen(false)}
            >
              {t("common.explore")}
            </Link>
            <Link
              className={`platform-mobile-link${location.pathname === "/pricing" ? " is-active" : ""}`}
              to="/pricing"
              onClick={() => setMenuOpen(false)}
            >
              {t("nav.pricing")}
            </Link>
            <Link
              className={`platform-mobile-link${isSuperadminRoute ? " is-active" : ""}`}
              to="/admin"
              onClick={() => setMenuOpen(false)}
            >
              {t("nav.superadmin")}
            </Link>
            <LanguageSwitcher className="platform-mobile-lang" />
            {right ? <div className="platform-mobile-extra">{right}</div> : null}
          </div>
        </MobileDrawer>
      ) : null}
      <main className="platform-main">{children}</main>
      <Footer />
    </div>
  );
}
