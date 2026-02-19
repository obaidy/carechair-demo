function toMs(value) {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : 0;
}

export function deriveSalonAccess(salon, now = new Date()) {
  const nowMs = now instanceof Date ? now.getTime() : Date.now();
  const billingStatus = String(salon?.billing_status || "inactive");
  const setupRequired = Boolean(salon?.setup_required ?? true);
  const setupPaid = Boolean(salon?.setup_paid);
  const trialEnabled = Boolean(salon?.trial_enabled);
  const trialEndMs = toMs(salon?.trial_end);
  const manualOverrideActive = Boolean(salon?.manual_override_active);

  if (manualOverrideActive) {
    return {
      code: "override",
      fullAccess: true,
      canManage: true,
      canCreateBookings: true,
      isLocked: false,
      badgeLabel: "مفعل يدوياً",
      badgeVariant: "confirmed",
      lockMessage: "",
    };
  }

  if (billingStatus === "suspended") {
    return {
      code: "suspended",
      fullAccess: false,
      canManage: false,
      canCreateBookings: false,
      isLocked: true,
      badgeLabel: "موقوف",
      badgeVariant: "cancelled",
      lockMessage: "الحساب موقوف حالياً. يرجى التواصل مع الإدارة.",
    };
  }

  if (trialEnabled && trialEndMs > nowMs) {
    return {
      code: "trialing",
      fullAccess: true,
      canManage: true,
      canCreateBookings: true,
      isLocked: false,
      badgeLabel: "فترة تجريبية",
      badgeVariant: "pending",
      lockMessage: "",
    };
  }

  if (setupRequired && !setupPaid) {
    return {
      code: "pending_setup",
      fullAccess: false,
      canManage: false,
      canCreateBookings: false,
      isLocked: true,
      badgeLabel: "بانتظار رسوم الإعداد",
      badgeVariant: "cancelled",
      lockMessage: "حسابك غير مفعل. لإكمال الاستخدام: ادفع رسوم الإعداد + فعّل الاشتراك الشهري.",
    };
  }

  if (billingStatus === "active") {
    return {
      code: "active",
      fullAccess: true,
      canManage: true,
      canCreateBookings: true,
      isLocked: false,
      badgeLabel: "فعال",
      badgeVariant: "confirmed",
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
      badgeLabel: "دفع متأخر",
      badgeVariant: "pending",
      lockMessage: "الاشتراك متأخر. يرجى تحديث الدفع لتفعيل الحساب.",
    };
  }

  return {
    code: billingStatus || "inactive",
    fullAccess: false,
    canManage: false,
    canCreateBookings: false,
    isLocked: true,
    badgeLabel: "غير مفعل",
    badgeVariant: "cancelled",
    lockMessage: "الحساب غير مفعل حالياً. يرجى إكمال الإعدادات والدفع.",
  };
}

export function formatBillingDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ar-IQ", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getBillingStatusLabel(status) {
  const key = String(status || "inactive");
  if (key === "inactive") return "غير مفعل";
  if (key === "trialing") return "تجريبي";
  if (key === "active") return "فعال";
  if (key === "past_due") return "متأخر بالدفع";
  if (key === "canceled") return "ملغي";
  if (key === "suspended") return "موقوف";
  return key;
}

export function getTrialRemainingLabel(trialEnd, now = new Date()) {
  if (!trialEnd) return "";
  const endMs = toMs(trialEnd);
  const nowMs = now instanceof Date ? now.getTime() : Date.now();
  const diffMs = endMs - nowMs;
  if (diffMs <= 0) return "انتهت";
  const hours = Math.ceil(diffMs / (1000 * 60 * 60));
  if (hours < 24) return `${hours} ساعة`;
  const days = Math.ceil(hours / 24);
  return `${days} يوم`;
}

export function computeIsActiveFromBilling(salon, now = new Date()) {
  return deriveSalonAccess(salon, now).fullAccess;
}
