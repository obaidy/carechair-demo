import i18n from "../i18n";

function toMs(value) {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : 0;
}

function getStatus(salon) {
  return String(salon?.status || salon?.subscription_status || salon?.billing_status || "draft");
}

export function deriveSalonAccess(salon, now = new Date()) {
  const nowMs = now instanceof Date ? now.getTime() : Date.now();
  const billingStatus = getStatus(salon);
  const manualOverrideUntilMs = toMs(salon?.manual_override_until);
  const manualOverrideActive = Boolean(salon?.manual_override_active) || manualOverrideUntilMs > nowMs;
  const isSalonActive = Boolean(salon?.is_active ?? true);

  if (manualOverrideActive) {
    return {
      code: "override",
      fullAccess: true,
      canManage: true,
      canCreateBookings: true,
      isLocked: false,
      badgeLabel: i18n.t("billingAccess.badges.override"),
      badgeVariant: "confirmed",
      lockMessage: "",
    };
  }

  if (!isSalonActive) {
    return {
      code: "inactive_flag",
      fullAccess: false,
      canManage: false,
      canCreateBookings: false,
      isLocked: true,
      badgeLabel: i18n.t("billingAccess.badges.inactive"),
      badgeVariant: "cancelled",
      lockMessage: i18n.t("billingAccess.lockMessages.inactive"),
    };
  }

  if (["pending_approval", "pending_billing", "rejected", "suspended"].includes(billingStatus)) {
    return {
      code: billingStatus,
      fullAccess: false,
      canManage: false,
      canCreateBookings: false,
      isLocked: true,
      badgeLabel: i18n.t(`status.${billingStatus}`),
      badgeVariant: "pending",
      lockMessage:
        billingStatus === "pending_approval"
          ? i18n.t("billingAccess.lockMessages.pendingApproval", {
              defaultValue: i18n.t("billingAccess.lockMessages.default"),
            })
          : billingStatus === "pending_billing"
            ? i18n.t("billingAccess.lockMessages.pendingBilling", {
                defaultValue: i18n.t("billingAccess.lockMessages.default"),
              })
            : billingStatus === "suspended"
              ? i18n.t("billingAccess.lockMessages.suspended")
              : i18n.t("billingAccess.lockMessages.rejected", {
                  defaultValue: i18n.t("billingAccess.lockMessages.default"),
                }),
    };
  }

  if ((billingStatus === "trialing" || billingStatus === "active") && isSalonActive) {
    return {
      code: billingStatus,
      fullAccess: true,
      canManage: true,
      canCreateBookings: true,
      isLocked: false,
      badgeLabel: billingStatus === "trialing" ? i18n.t("billingAccess.badges.trialing") : i18n.t("billingAccess.badges.active"),
      badgeVariant: billingStatus === "trialing" ? "pending" : "confirmed",
      lockMessage: "",
    };
  }

  if (billingStatus === "past_due") {
    return {
      code: "past_due",
      fullAccess: false,
      canManage: false,
      canCreateBookings: false,
      isLocked: true,
      badgeLabel: i18n.t("billingAccess.badges.pastDue"),
      badgeVariant: "pending",
      lockMessage: i18n.t("billingAccess.lockMessages.pastDue"),
    };
  }

  return {
    code: billingStatus || "draft",
    fullAccess: false,
    canManage: false,
    canCreateBookings: false,
    isLocked: true,
    badgeLabel: i18n.t("billingAccess.badges.inactive"),
    badgeVariant: "cancelled",
    lockMessage: i18n.t("billingAccess.lockMessages.default"),
  };
}

export function formatBillingDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(i18n.language || "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getBillingStatusLabel(status) {
  const key = String(status || "draft");
  if (key === "draft") return i18n.t("status.draft");
  if (key === "pending_approval") return i18n.t("status.pending_approval");
  if (key === "pending_billing") return i18n.t("status.pending_billing");
  if (key === "inactive") return i18n.t("status.inactive");
  if (key === "trialing") return i18n.t("status.trialing");
  if (key === "active") return i18n.t("status.active");
  if (key === "past_due") return i18n.t("status.past_due");
  if (key === "canceled") return i18n.t("status.canceled");
  if (key === "suspended") return i18n.t("status.suspended");
  if (key === "rejected") return i18n.t("status.rejected");
  return key;
}

export function getTrialRemainingLabel(trialEnd, now = new Date()) {
  if (!trialEnd) return "";
  const endMs = toMs(trialEnd);
  const nowMs = now instanceof Date ? now.getTime() : Date.now();
  const diffMs = endMs - nowMs;
  if (diffMs <= 0) return i18n.t("billingAccess.trialEnded");
  const hours = Math.ceil(diffMs / (1000 * 60 * 60));
  if (hours < 24) return i18n.t("billingAccess.hoursRemaining", { count: hours });
  const days = Math.ceil(hours / 24);
  return i18n.t("billingAccess.daysRemaining", { count: days });
}

export function computeIsActiveFromBilling(salon, now = new Date()) {
  const access = deriveSalonAccess(salon, now);
  return access.code === "active" || access.code === "trialing" || access.code === "override";
}
