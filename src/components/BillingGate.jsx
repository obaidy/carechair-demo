import React, { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button, Card } from "./ui";
import { deriveSalonAccess } from "../lib/billing";

export default function BillingGate({ salon, module, children }) {
  const navigate = useNavigate();
  const { slug } = useParams();
  const { t } = useTranslation();

  const access = deriveSalonAccess(salon);

  useEffect(() => {
    if (!salon || !slug) return;
    if (module === "billing") return;
    if (access.fullAccess) return;
    navigate(`/s/${encodeURIComponent(slug)}/admin/billing`, { replace: true });
  }, [salon, slug, module, access.fullAccess, navigate]);

  if (module !== "billing" && !access.fullAccess) {
    return (
      <Card className="billing-warning-box">
        <b>{t("billingGate.lockedTitle")}</b>
        <p>{access.lockMessage || t("billingGate.lockedText")}</p>
        <Button type="button" onClick={() => navigate(`/s/${encodeURIComponent(slug || "")}/admin/billing`)}>
          {t("billingGate.openBilling")}
        </Button>
      </Card>
    );
  }

  return children;
}
