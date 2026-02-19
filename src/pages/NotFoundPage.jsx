import React from "react";
import { Link } from "react-router-dom";
import PageShell from "../components/PageShell";

export default function NotFoundPage() {
  return (
    <PageShell title="الصفحة غير موجودة" subtitle="تحققي من الرابط">
      <section className="panel">
        <p className="muted">الرابط غير موجود.</p>
        <Link className="ghost-link" to="/explore">
          العودة إلى الاستكشاف
        </Link>
      </section>
    </PageShell>
  );
}
