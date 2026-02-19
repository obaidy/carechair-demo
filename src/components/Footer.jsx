import React from "react";
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="footer-brand">
          <h4>CareChair</h4>
          <p className="footer-en" dir="ltr">
            CareChair is operated by Infraengineering s.r.o.
          </p>
          <p className="footer-ar">CareChair هو نظام حجوزات تديره شركة Infraengineering s.r.o.</p>
        </div>

        <nav className="footer-links" aria-label="روابط قانونية">
          <Link to="/terms">شروط الخدمة</Link>
          <Link to="/privacy">سياسة الخصوصية</Link>
          <Link to="/billing">الفوترة والاسترجاع</Link>
          <Link to="/cancellation">الإلغاء والتعليق</Link>
        </nav>

        <div className="footer-meta" dir="ltr">
          <p>Infraengineering s.r.o. | IČO: 24192953</p>
          <p>Rybná 716/24, Staré Město, 110 00 Praha, Czech Republic</p>
          <p>aka.obaidy@gmail.com</p>
        </div>
      </div>
    </footer>
  );
}
