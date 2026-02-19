import React from "react";
import { Link } from "react-router-dom";
import Footer from "./Footer";
import BrandLogo from "./BrandLogo";

export default function PageShell({ title, subtitle, right, children }) {
  return (
    <div className="platform-page" dir="rtl">
      <header className="platform-header">
        <div>
          <BrandLogo className="platform-brand" />
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        <div className="header-actions">
          <Link className="ghost-link" to="/explore">
            استكشاف
          </Link>
          <Link className="ghost-link" to="/admin">
            سوبر أدمن
          </Link>
          {right}
        </div>
      </header>
      <main className="platform-main">{children}</main>
      <Footer />
    </div>
  );
}
