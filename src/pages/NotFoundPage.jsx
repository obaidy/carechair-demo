import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PageShell from "../components/PageShell";

export default function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <PageShell title={t("notFound.title")} subtitle={t("notFound.subtitle")}>
      <section className="panel">
        <p className="muted">{t("notFound.text")}</p>
        <Link className="ghost-link" to="/explore">
          {t("notFound.backToExplore")}
        </Link>
      </section>
    </PageShell>
  );
}
