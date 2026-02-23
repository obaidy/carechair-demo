import React from "react";
import { useTranslation } from "react-i18next";
import PageShell from "../components/PageShell";
import { Button, Card } from "../components/ui";

const PLATFORM_WHATSAPP_LINK =
  "https://wa.me/9647700603080?text=Hello%20CareChair%2C%20I%20want%20to%20talk%20to%20sales%20about%20plans";

export default function PricingPage() {
  const { t } = useTranslation();

  return (
    <PageShell title={t("pricing.title")} subtitle={t("pricing.subtitle")}>
      <Card className="billing-warning-box">
        <b>{t("pricing.noPublicPrices")}</b>
        <p>{t("pricing.subtitle")}</p>
      </Card>

      <section className="landing-pricing-grid">
        <Card className="landing-price-card">
          <span className="price-label">{t("pricing.basic")}</span>
          <h3>{t("common.talkToSales")}</h3>
          <ul>
            <li>Booking page + dashboard</li>
            <li>Staff and services scheduling</li>
            <li>Monthly Stripe subscription</li>
          </ul>
          <Button as="a" href={PLATFORM_WHATSAPP_LINK} target="_blank" rel="noreferrer">
            {t("common.talkToSales")}
          </Button>
        </Card>

        <Card className="landing-price-card monthly">
          <span className="price-label">{t("pricing.pro")}</span>
          <h3>{t("common.bookDemo")}</h3>
          <ul>
            <li>Everything in Basic</li>
            <li>Multi-country and language setup</li>
            <li>Priority onboarding support</li>
          </ul>
          <Button as="a" href={PLATFORM_WHATSAPP_LINK} target="_blank" rel="noreferrer">
            {t("common.bookDemo")}
          </Button>
        </Card>

        <Card className="landing-price-card">
          <span className="price-label">{t("pricing.enterprise")}</span>
          <h3>{t("common.talkToSales")}</h3>
          <ul>
            <li>Custom architecture and reports</li>
            <li>Dedicated account support</li>
            <li>Rollout across multiple regions</li>
          </ul>
          <Button as="a" href={PLATFORM_WHATSAPP_LINK} target="_blank" rel="noreferrer" variant="secondary">
            {t("common.talkToSales")}
          </Button>
        </Card>
      </section>
    </PageShell>
  );
}
