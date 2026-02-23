import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PageShell from "../components/PageShell";
import LanguageSwitcher from "../components/LanguageSwitcher";
import Toast from "../components/Toast";
import { Badge, Button, Card, ConfirmModal, SelectInput, TextInput } from "../components/ui";
import { supabase } from "../lib/supabase";
import { DEFAULT_HOURS, DEFAULT_SERVICES, DEFAULT_STAFF } from "../lib/utils";
import { computeIsActiveFromBilling, deriveSalonAccess, formatBillingDate, getTrialRemainingLabel } from "../lib/billing";
import { normalizeSalonSlug } from "../lib/slug";
import { useToast } from "../lib/useToast";

const SUPER_ADMIN_CODE = String(
  import.meta.env.VITE_SUPERADMIN_CODE ||
    import.meta.env.VITE_SUPER_ADMIN_CODE ||
    import.meta.env.VITE_SUPER_ADMIN ||
    import.meta.env.VITE_SUPER_ADMIN_PASSCODE ||
    "1989"
).trim();

const SALON_STATUSES = [
  "draft",
  "pending_approval",
  "pending_billing",
  "trialing",
  "active",
  "past_due",
  "suspended",
  "rejected",
];

const FALLBACK_COUNTRIES = [
  {
    code: "IQ",
    name_en: "Iraq",
    name_ar: "العراق",
    name_cs: "Irák",
    name_ru: "Ирак",
    default_currency: "USD",
    timezone_default: "Asia/Baghdad",
    trial_days_default: 7,
    vat_percent: 0,
    is_enabled: true,
  },
  {
    code: "AE",
    name_en: "United Arab Emirates",
    name_ar: "الإمارات",
    name_cs: "Spojené arabské emiráty",
    name_ru: "ОАЭ",
    default_currency: "AED",
    timezone_default: "Asia/Dubai",
    trial_days_default: 7,
    vat_percent: 0,
    is_enabled: true,
  },
  {
    code: "CZ",
    name_en: "Czech Republic",
    name_ar: "التشيك",
    name_cs: "Česká republika",
    name_ru: "Чехия",
    default_currency: "CZK",
    timezone_default: "Europe/Prague",
    trial_days_default: 7,
    vat_percent: 0,
    is_enabled: true,
  },
  {
    code: "EU",
    name_en: "Europe",
    name_ar: "أوروبا",
    name_cs: "Evropa",
    name_ru: "Европа",
    default_currency: "EUR",
    timezone_default: "Europe/Berlin",
    trial_days_default: 7,
    vat_percent: 0,
    is_enabled: true,
  },
];

function isMissingColumnError(error, column) {
  const message = String(error?.message || "").toLowerCase();
  return error?.code === "42703" || message.includes("column") && message.includes(String(column).toLowerCase());
}

function isMissingRelationError(error, relation) {
  const message = String(error?.message || "").toLowerCase();
  return error?.code === "42p01" || message.includes("relation") && message.includes(String(relation).toLowerCase());
}

function normalizeSalon(row) {
  const status = String(row?.status || row?.subscription_status || row?.billing_status || "draft");
  const billingStatus = String(row?.subscription_status || row?.billing_status || billingStatusFromSalonStatus(status));
  return {
    ...row,
    status,
    subscription_status: billingStatus,
    billing_status: billingStatus,
  };
}

function billingStatusFromSalonStatus(status) {
  const key = String(status || "draft");
  if (key === "trialing") return "trialing";
  if (key === "active") return "active";
  if (key === "past_due") return "past_due";
  if (key === "suspended") return "suspended";
  if (key === "rejected") return "canceled";
  return "inactive";
}

function addDaysIso(days) {
  const d = new Date();
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString();
}

export default function SuperAdminPage() {
  const { toast, showToast } = useToast();
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { id: detailSalonId } = useParams();

  const [unlocked, setUnlocked] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [verifiedCode, setVerifiedCode] = useState("");
  const [adminSessionId] = useState(() => {
    try {
      const key = "carechair_superadmin_session_id";
      const current = window.localStorage.getItem(key);
      if (current) return current;
      const next = crypto.randomUUID();
      window.localStorage.setItem(key, next);
      return next;
    } catch {
      return "00000000-0000-0000-0000-000000000000";
    }
  });

  const [loading, setLoading] = useState(true);
  const [salons, setSalons] = useState([]);
  const [countries, setCountries] = useState([]);
  const [staffCounts, setStaffCounts] = useState({});
  const [serviceCounts, setServiceCounts] = useState({});
  const [rowLoading, setRowLoading] = useState("");
  const [actionsLoading, setActionsLoading] = useState(false);
  const [salonActions, setSalonActions] = useState([]);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [salonHealthRows, setSalonHealthRows] = useState([]);
  const [globalStats, setGlobalStats] = useState(null);

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    area: "",
    whatsapp: "",
    admin_passcode: "",
    country_code: "IQ",
    seed_defaults: true,
  });

  const [editingPasscodeSalonId, setEditingPasscodeSalonId] = useState("");
  const [newPasscode, setNewPasscode] = useState("");
  const [editingSalonId, setEditingSalonId] = useState("");
  const [salonEditDraft, setSalonEditDraft] = useState({
    name: "",
    slug: "",
    area: "",
    whatsapp: "",
    country_code: "IQ",
  });

  const [statusFilter, setStatusFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [countriesAvailable, setCountriesAvailable] = useState(true);
  const [activeMainTab, setActiveMainTab] = useState(() => {
    try {
      const stored = window.localStorage.getItem("carechair_superadmin_main_tab");
      return stored || "overview";
    } catch {
      return "overview";
    }
  });

  const [countryDrafts, setCountryDrafts] = useState({});
  const [confirmState, setConfirmState] = useState(null);
  const [overrideUntilInput, setOverrideUntilInput] = useState("");

  const isOverviewPage = location.pathname.startsWith("/superadmin/overview") || location.pathname.startsWith("/admin/overview");
  const isApprovalsPage = location.pathname.startsWith("/superadmin/approvals") || location.pathname.startsWith("/admin/approvals");
  const isDetailPage = Boolean(detailSalonId);
  const isMainPage = !isOverviewPage && !isApprovalsPage && !isDetailPage;

  async function loadAll() {
    if (!supabase) {
      setLoading(false);
      showToast("error", t("errors.supabaseConfigMissing"));
      return;
    }

    setLoading(true);
    try {
      const [salonsRes, countriesRes, staffRes, servicesRes] = await Promise.all([
        supabase.from("salons").select("*").order("created_at", { ascending: false }),
        supabase.from("countries").select("*").order("code", { ascending: true }),
        supabase.from("staff").select("id,salon_id"),
        supabase.from("services").select("id,salon_id"),
      ]);

      if (salonsRes.error) throw salonsRes.error;

      const salonRows = (salonsRes.data || []).map(normalizeSalon);
      setSalons(salonRows);

      if (!staffRes.error) {
        const staffMap = {};
        for (const row of staffRes.data || []) {
          const key = String(row.salon_id || "");
          if (!key) continue;
          staffMap[key] = (staffMap[key] || 0) + 1;
        }
        setStaffCounts(staffMap);
      }

      if (!servicesRes.error) {
        const servicesMap = {};
        for (const row of servicesRes.data || []) {
          const key = String(row.salon_id || "");
          if (!key) continue;
          servicesMap[key] = (servicesMap[key] || 0) + 1;
        }
        setServiceCounts(servicesMap);
      }

      let countryRows = countriesRes.data || [];
      if (countriesRes.error) {
        if (isMissingRelationError(countriesRes.error, "countries")) {
          setCountriesAvailable(false);
          countryRows = FALLBACK_COUNTRIES;
          showToast("error", t("superadmin.errors.countriesMigrationMissing"));
        } else {
          throw countriesRes.error;
        }
      } else {
        setCountriesAvailable(true);
      }

      if (!countryRows.length) countryRows = FALLBACK_COUNTRIES;
      setCountries(countryRows);

      const draftMap = {};
      for (const row of countryRows) {
        draftMap[row.code] = {
          stripe_price_id_basic: String(row.stripe_price_id_basic || ""),
          stripe_price_id_pro: String(row.stripe_price_id_pro || ""),
          trial_days_default: String(row.trial_days_default ?? 7),
          vat_percent: String(row.vat_percent ?? 0),
          is_enabled: Boolean(row.is_enabled),
        };
      }
      setCountryDrafts(draftMap);

      if (unlocked) {
        const adminCode = verifiedCode || codeInput.trim() || SUPER_ADMIN_CODE;
        const [salonHealthRes, globalStatsRes] = await Promise.all([
          supabase.rpc("superadmin_overview_salons", { p_admin_code: adminCode }),
          supabase.rpc("superadmin_overview_stats", { p_admin_code: adminCode }),
        ]);
        if (!salonHealthRes.error) {
          setSalonHealthRows(salonHealthRes.data || []);
        }
        if (!globalStatsRes.error) {
          const statsRow = Array.isArray(globalStatsRes.data) ? globalStatsRes.data[0] || null : globalStatsRes.data || null;
          setGlobalStats(statsRow);
        }
      }
    } catch (err) {
      showToast("error", t("superadmin.errors.loadFailed", { message: err?.message || err }));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (unlocked) void loadAll();
  }, [unlocked]);

  async function logAdminAction(salonId, actionType, payload = {}) {
    if (!supabase || !unlocked || !salonId) return;
    try {
      await supabase.rpc("admin_actions_write", {
        p_admin_code: verifiedCode || codeInput.trim() || SUPER_ADMIN_CODE,
        p_admin_user_id: adminSessionId,
        p_salon_id: salonId,
        p_action_type: actionType,
        p_payload: payload,
      });
    } catch {
      // Don't block primary admin flows if audit logging fails.
    }
  }

  async function loadSalonActions(salonId) {
    if (!supabase || !unlocked || !salonId) return;
    setActionsLoading(true);
    try {
      const { data, error } = await supabase.rpc("admin_actions_list", {
        p_admin_code: verifiedCode || codeInput.trim() || SUPER_ADMIN_CODE,
        p_salon_id: salonId,
        p_limit: 100,
      });
      if (error) throw error;
      setSalonActions(data || []);
    } catch {
      setSalonActions([]);
    } finally {
      setActionsLoading(false);
    }
  }

  async function loadOverviewMetrics() {
    if (!supabase || !unlocked) return;
    setOverviewLoading(true);
    try {
      const adminCode = verifiedCode || codeInput.trim() || SUPER_ADMIN_CODE;
      const [salonHealthRes, globalStatsRes] = await Promise.all([
        supabase.rpc("superadmin_overview_salons", { p_admin_code: adminCode }),
        supabase.rpc("superadmin_overview_stats", { p_admin_code: adminCode }),
      ]);

      if (salonHealthRes.error) throw salonHealthRes.error;
      if (globalStatsRes.error) throw globalStatsRes.error;

      setSalonHealthRows(salonHealthRes.data || []);
      const statsRow = Array.isArray(globalStatsRes.data) ? globalStatsRes.data[0] || null : globalStatsRes.data || null;
      setGlobalStats(statsRow);
    } catch (err) {
      setSalonHealthRows([]);
      setGlobalStats(null);
      showToast("error", t("superadmin.errors.metricsLoadFailed", "Failed to load overview metrics: {{message}}", { message: err?.message || err }));
    } finally {
      setOverviewLoading(false);
    }
  }

  async function seedDefaults(salonId) {
    if (!supabase) return;

    const hoursPayload = DEFAULT_HOURS.map((x) => ({
      salon_id: salonId,
      day_of_week: x.day_of_week,
      open_time: `${x.open_time}:00`,
      close_time: `${x.close_time}:00`,
      is_closed: x.is_closed,
    }));

    const hoursRes = await supabase.from("salon_hours").upsert(hoursPayload, { onConflict: "salon_id,day_of_week" });
    if (hoursRes.error) throw hoursRes.error;

    const staffPayload = DEFAULT_STAFF.map((x) => ({
      salon_id: salonId,
      name: x.name,
      is_active: true,
      sort_order: x.sort_order,
    }));

    const staffRes = await supabase.from("staff").insert(staffPayload).select("id");
    if (staffRes.error) throw staffRes.error;

    const servicesPayload = DEFAULT_SERVICES.map((x) => ({
      salon_id: salonId,
      name: x.name,
      duration_minutes: x.duration_minutes,
      price: x.price,
      is_active: true,
      sort_order: x.sort_order,
    }));

    const servicesRes = await supabase.from("services").insert(servicesPayload).select("id");
    if (servicesRes.error) throw servicesRes.error;

    const links = [];
    for (const st of staffRes.data || []) {
      for (const sv of servicesRes.data || []) {
        links.push({ salon_id: salonId, staff_id: st.id, service_id: sv.id });
      }
    }

    if (links.length > 0) {
      const linksRes = await supabase.from("staff_services").upsert(links, { onConflict: "staff_id,service_id" });
      if (linksRes.error) throw linksRes.error;
    }
  }

  async function createSalon(event) {
    event.preventDefault();
    if (!supabase) return;

    const name = form.name.trim();
    const slug = normalizeSalonSlug(form.slug || form.name);
    const area = form.area.trim();
    const passcode = form.admin_passcode.trim();
    const countryCode = String(form.country_code || "IQ");

    if (name.length < 2) return showToast("error", t("superadmin.errors.invalidSalonName"));
    if (!slug) return showToast("error", t("superadmin.errors.invalidSlug"));
    if (area.length < 2) return showToast("error", t("superadmin.errors.invalidArea"));
    if (passcode.length < 3) return showToast("error", t("superadmin.errors.invalidAdminPass"));

    const country = countries.find((x) => x.code === countryCode) || countries.find((x) => x.code === "IQ");
    if (!country) return showToast("error", t("superadmin.errors.countryMissing"));

    setCreating(true);
    try {
      const payload = {
        name,
        slug,
        area,
        whatsapp: form.whatsapp.trim() || null,
        admin_passcode: passcode,
        country_code: country.code,
        currency_code: country.default_currency,
        timezone: country.timezone_default,
        language_default: "en",
        setup_required: true,
        setup_paid: false,
        status: "pending_approval",
        subscription_status: "inactive",
        billing_status: "inactive",
        trial_end_at: null,
        trial_end: null,
        is_active: true,
        is_listed: false,
      };

      let ins = await supabase
        .from("salons")
        .insert([payload])
        .select("*")
        .single();

      if (ins.error && isMissingColumnError(ins.error, "subscription_status")) {
        const legacyPayload = { ...payload };
        delete legacyPayload.subscription_status;
        delete legacyPayload.trial_end_at;
        ins = await supabase.from("salons").insert([legacyPayload]).select("*").single();
      }

      if (ins.error) throw ins.error;

      await logAdminAction(ins.data.id, "salon_created", {
        mode: "superadmin_quick_create",
        country_code: country.code,
        status: "pending_approval",
      });

      if (form.seed_defaults) await seedDefaults(ins.data.id);

      setForm({
        name: "",
        slug: "",
        area: "",
        whatsapp: "",
        admin_passcode: "",
        country_code: country.code,
        seed_defaults: true,
      });

      showToast("success", t("superadmin.messages.salonCreated"));
      if (!isApprovalsPage) {
        navigate("/superadmin/approvals");
      }
      await loadAll();
    } catch (err) {
      showToast("error", t("superadmin.errors.createFailed", { message: err?.message || err }));
    } finally {
      setCreating(false);
    }
  }

  async function patchSalon(row, patch, successMessage, options = { recomputeActive: true }) {
    if (!supabase || !row?.id) return;

    const loadingKey = `${row.id}-${Object.keys(patch).join("-")}`;
    setRowLoading(loadingKey);
    try {
      const normalizedSalonStatus = String(
        patch.status || row.status || patch.subscription_status || patch.billing_status || row.subscription_status || row.billing_status || "draft"
      );
      const normalizedBillingStatus = String(
        patch.subscription_status || patch.billing_status || row.subscription_status || row.billing_status || billingStatusFromSalonStatus(normalizedSalonStatus)
      );
      const merged = {
        ...row,
        ...patch,
        status: normalizedSalonStatus,
        subscription_status: normalizedBillingStatus,
        billing_status: normalizedBillingStatus,
      };
      const finalPatch = {
        ...patch,
        status: normalizedSalonStatus,
        subscription_status: normalizedBillingStatus,
        billing_status: normalizedBillingStatus,
        ...(patch.trial_end_at ? { trial_end: patch.trial_end_at } : {}),
      };

      if (options.recomputeActive) {
        finalPatch.is_active = computeIsActiveFromBilling(merged);
      }

      let up = await supabase.from("salons").update(finalPatch).eq("id", row.id).select("*").single();
      if (up.error && isMissingColumnError(up.error, "subscription_status")) {
        const legacyPatch = { ...finalPatch };
        delete legacyPatch.subscription_status;
        if (legacyPatch.trial_end_at) {
          legacyPatch.trial_end = legacyPatch.trial_end_at;
          delete legacyPatch.trial_end_at;
        }
        up = await supabase.from("salons").update(legacyPatch).eq("id", row.id).select("*").single();
      }
      if (up.error) throw up.error;

      setSalons((prev) => prev.map((x) => (x.id === row.id ? normalizeSalon({ ...x, ...up.data }) : x)));
      showToast("success", successMessage || t("superadmin.messages.saved"));
      return up.data;
    } catch (err) {
      showToast("error", t("superadmin.errors.updateFailed", { message: err?.message || err }));
      return null;
    } finally {
      setRowLoading("");
    }
  }

  function startEditSalon(row) {
    setEditingPasscodeSalonId("");
    setNewPasscode("");
    setEditingSalonId(row.id);
    setSalonEditDraft({
      name: String(row.name || ""),
      slug: normalizeSalonSlug(row.slug || row.name || ""),
      area: String(row.area || ""),
      whatsapp: String(row.whatsapp || ""),
      country_code: String(row.country_code || "IQ"),
    });
  }

  function stopEditSalon() {
    setEditingSalonId("");
    setSalonEditDraft({
      name: "",
      slug: "",
      area: "",
      whatsapp: "",
      country_code: "IQ",
    });
  }

  async function saveSalonInfo(row) {
    const name = salonEditDraft.name.trim();
    const slug = normalizeSalonSlug(salonEditDraft.slug || salonEditDraft.name);
    const area = salonEditDraft.area.trim();
    const countryCode = String(salonEditDraft.country_code || "IQ");
    if (name.length < 2) return showToast("error", t("superadmin.errors.invalidSalonName"));
    if (!slug) return showToast("error", t("superadmin.errors.invalidSlug"));
    if (area.length < 2) return showToast("error", t("superadmin.errors.invalidArea"));

    const slugTaken = salons.some((x) => x.id !== row.id && String(x.slug || "").toLowerCase() === slug.toLowerCase());
    if (slugTaken) {
      showToast("error", t("superadmin.errors.slugTaken", "Slug is already used by another salon."));
      return;
    }

    const country = countries.find((x) => x.code === countryCode);
    const patch = {
      name,
      slug,
      area,
      whatsapp: salonEditDraft.whatsapp.trim() || null,
      country_code: countryCode,
      ...(country
        ? {
            currency_code: country.default_currency,
            timezone: country.timezone_default,
          }
        : {}),
    };

    const updated = await patchSalon(row, patch, t("superadmin.messages.salonInfoUpdated", "Salon info updated."));
    if (updated) {
      await logAdminAction(row.id, "edit_salon_info", {
        name,
        slug,
        area,
        country_code: countryCode,
      });
      stopEditSalon();
    }
  }

  async function deleteSalon(row) {
    if (!supabase || !row?.id) return;
    setRowLoading(`delete-${row.id}`);
    try {
      const adminCode = verifiedCode || codeInput.trim() || SUPER_ADMIN_CODE;
      const { data, error } = await supabase.rpc("admin_delete_salon", {
        p_admin_code: adminCode,
        p_salon_id: row.id,
        p_admin_user_id: adminSessionId,
        p_payload: {
          name: row.name,
          slug: row.slug,
        },
      });
      if (error) throw error;
      if (!data?.ok) {
        throw new Error("salon_not_deleted");
      }

      setSalons((prev) => prev.filter((x) => x.id !== row.id));
      if (selectedSalon?.id === row.id) {
        navigate("/superadmin/overview");
      }
      showToast("success", t("superadmin.messages.deleted", "Salon deleted."));
      stopEditSalon();
      await loadAll();
    } catch (err) {
      showToast("error", t("superadmin.errors.deleteFailed", "Failed to delete salon: {{message}}", { message: err?.message || err }));
    } finally {
      setRowLoading("");
    }
  }

  async function updateSalonPasscode(rowId) {
    if (!supabase) return;
    const passcode = newPasscode.trim();
    if (passcode.length < 3) {
      showToast("error", t("superadmin.errors.passcodeTooShort"));
      return;
    }

    const loadingKey = `admin_passcode-${rowId}`;
    setRowLoading(loadingKey);
    try {
      const up = await supabase.from("salons").update({ admin_passcode: passcode }).eq("id", rowId);
      if (up.error) throw up.error;
      showToast("success", t("superadmin.messages.passcodeUpdated"));
      setEditingPasscodeSalonId("");
      setNewPasscode("");
    } catch (err) {
      showToast("error", t("superadmin.errors.passcodeUpdateFailed", { message: err?.message || err }));
    } finally {
      setRowLoading("");
    }
  }

  async function saveCountryConfig(code) {
    if (!supabase) return;
    const draft = countryDrafts[code];
    if (!draft) return;

    setRowLoading(`country-${code}`);
    try {
      const payload = {
        stripe_price_id_basic: draft.stripe_price_id_basic || null,
        stripe_price_id_pro: draft.stripe_price_id_pro || null,
        trial_days_default: Math.max(0, Number(draft.trial_days_default || 0)),
        vat_percent: Number(draft.vat_percent || 0),
        is_enabled: Boolean(draft.is_enabled),
      };
      if (!countriesAvailable) {
        showToast("error", t("superadmin.errors.countriesMigrationMissing"));
        return;
      }

      const up = await supabase.from("countries").update(payload).eq("code", code);
      if (up.error) throw up.error;
      showToast("success", t("superadmin.messages.countrySaved", { code }));
      await loadAll();
    } catch (err) {
      showToast("error", t("superadmin.errors.countrySaveFailed", { message: err?.message || err }));
    } finally {
      setRowLoading("");
    }
  }

  const filteredSalons = useMemo(() => {
    const sorted = [...salons].sort((a, b) => String(a.name).localeCompare(String(b.name), i18n.language || "en"));
    return sorted.filter((row) => {
      if (countryFilter !== "all" && String(row.country_code || "IQ") !== countryFilter) return false;
      if (statusFilter === "all") return true;
      const effectiveStatus = String(row.status || row.subscription_status || row.billing_status || "draft");
      return effectiveStatus === statusFilter;
    });
  }, [salons, countryFilter, statusFilter, i18n.language]);

  const pendingApprovalSalons = useMemo(
    () => filteredSalons.filter((row) => String(row.status || "draft") === "pending_approval"),
    [filteredSalons]
  );

  const selectedSalon = useMemo(
    () => salons.find((row) => String(row.id) === String(detailSalonId || "")) || null,
    [salons, detailSalonId]
  );

  const countryNameByCode = useMemo(() => {
    const map = {};
    for (const row of countries) map[row.code] = row;
    return map;
  }, [countries]);

  const countryNameField = i18n.language === "ar" ? "name_ar" : i18n.language === "cs" ? "name_cs" : i18n.language === "ru" ? "name_ru" : "name_en";

  const mainTabs = useMemo(
    () => [
      { key: "overview", label: t("superadmin.tabs.overview", "Overview") },
      { key: "salons", label: t("superadmin.tabs.salons", "Salons") },
      { key: "create", label: t("superadmin.tabs.create", "Create salon") },
      { key: "countries", label: t("superadmin.tabs.countries", "Countries") },
    ],
    [t]
  );

  const mainKpis = useMemo(() => {
    const total = salons.length;
    const pending = salons.filter((row) => String(row.status || "draft") === "pending_approval").length;
    const active = salons.filter((row) => {
      const status = String(row.status || "draft");
      return (status === "trialing" || status === "active") && Boolean(row.is_active);
    }).length;
    const suspended = salons.filter((row) => String(row.status || "draft") === "suspended").length;
    return { total, pending, active, suspended };
  }, [salons]);

  const countryBreakdownRows = useMemo(() => {
    const map = new Map();
    for (const row of salonHealthRows) {
      const key = String(row.country_code || "IQ");
      const current = map.get(key) || {
        country_code: key,
        salons: 0,
        active: 0,
        bookings_30: 0,
        customers_30: 0,
      };
      current.salons += 1;
      if ((row.status === "active" || row.status === "trialing") && row.is_active) current.active += 1;
      current.bookings_30 += Number(row.bookings_last_30_days || 0);
      current.customers_30 += Number(row.customers_last_30_days || 0);
      map.set(key, current);
    }
    return Array.from(map.values()).sort((a, b) => b.bookings_30 - a.bookings_30);
  }, [salonHealthRows]);

  const topSalonsByBookings7d = useMemo(
    () =>
      [...salonHealthRows]
        .sort((a, b) => Number(b.bookings_last_7_days || 0) - Number(a.bookings_last_7_days || 0))
        .slice(0, 12),
    [salonHealthRows]
  );

  const salonsAtRisk = useMemo(() => {
    const nowMs = Date.now();
    const threeDaysMs = nowMs + 3 * 24 * 60 * 60 * 1000;
    return salonHealthRows.filter((row) => {
      const trialEndMs = row.trial_end_at ? new Date(row.trial_end_at).getTime() : 0;
      const trialEndingSoon = trialEndMs > nowMs && trialEndMs <= threeDaysMs;
      const noRecentBookings = Number(row.bookings_last_7_days || 0) === 0;
      return trialEndingSoon || noRecentBookings;
    });
  }, [salonHealthRows]);

  const selectedSalonHealth = useMemo(
    () => salonHealthRows.find((row) => String(row.salon_id) === String(selectedSalon?.id || "")) || null,
    [salonHealthRows, selectedSalon?.id]
  );

  useEffect(() => {
    if (!isMainPage) return;
    if (!mainTabs.some((tab) => tab.key === activeMainTab)) {
      setActiveMainTab("overview");
    }
  }, [isMainPage, mainTabs, activeMainTab]);

  useEffect(() => {
    if (!isMainPage) return;
    try {
      window.localStorage.setItem("carechair_superadmin_main_tab", activeMainTab);
    } catch {
      // ignore storage write errors
    }
  }, [activeMainTab, isMainPage]);

  useEffect(() => {
    if (!isOverviewPage) return;
    if (activeMainTab !== "overview") {
      setActiveMainTab("overview");
    }
  }, [isOverviewPage, activeMainTab]);

  useEffect(() => {
    if (!unlocked) return;
    if (!isOverviewPage && !isDetailPage) return;
    void loadOverviewMetrics();
  }, [unlocked, isOverviewPage, isDetailPage]);

  useEffect(() => {
    if (!unlocked) return;
    if (!detailSalonId) {
      setSalonActions([]);
      return;
    }
    if (!selectedSalon) return;
    void loadSalonActions(selectedSalon.id);
  }, [unlocked, detailSalonId, selectedSalon?.id]);

  async function approveSalon(row) {
    const isIraq = String(row.country_code || "IQ").toUpperCase() === "IQ";
    const nowIso = new Date().toISOString();
    if (isIraq) {
      const trialEnd = addDaysIso(7);
      await patchSalon(
        row,
        {
          status: "trialing",
          subscription_status: "trialing",
          billing_status: "trialing",
          trial_end_at: trialEnd,
          trial_end: trialEnd,
          is_active: true,
        },
        t("superadmin.messages.approvedTrialing")
      );
      await logAdminAction(row.id, "approve_salon", { mode: "iq_trial", approved_at: nowIso, trial_days: 7 });
      return;
    }

    await patchSalon(
      row,
      {
        status: "pending_billing",
        subscription_status: "inactive",
        billing_status: "inactive",
        is_active: true,
      },
      t("superadmin.messages.approvedPendingBilling")
    );
    await logAdminAction(row.id, "approve_salon", { mode: "pending_billing", approved_at: nowIso });
  }

  async function rejectSalon(row) {
    await patchSalon(
      row,
      {
        status: "rejected",
        is_active: false,
        subscription_status: "canceled",
        billing_status: "canceled",
      },
      t("superadmin.messages.rejected")
    );
    await logAdminAction(row.id, "reject_salon", { rejected_at: new Date().toISOString() });
  }

  async function extendTrial(row, days) {
    const trialEnd = addDaysIso(days);
    await patchSalon(
      row,
      {
        status: "trialing",
        subscription_status: "trialing",
        billing_status: "trialing",
        trial_end_at: trialEnd,
        trial_end: trialEnd,
        is_active: true,
      },
      t("superadmin.messages.trialExtended")
    );
    await logAdminAction(row.id, "extend_trial", { days, trial_end_at: trialEnd });
  }

  async function suspendSalon(row) {
    await patchSalon(
      row,
      {
        status: "suspended",
        subscription_status: "suspended",
        billing_status: "suspended",
        is_active: false,
        suspended_reason: "Suspended by superadmin",
      },
      t("superadmin.messages.suspended")
    );
    await logAdminAction(row.id, "suspend_salon", { at: new Date().toISOString() });
  }

  async function resumeSalon(row) {
    const now = Date.now();
    const trialMs = row.trial_end_at ? new Date(row.trial_end_at).getTime() : 0;
    const hasTrial = Number.isFinite(trialMs) && trialMs > now;
    const nextStatus = hasTrial ? "trialing" : row.status === "past_due" ? "past_due" : "active";
    const nextBilling = hasTrial ? "trialing" : nextStatus === "active" ? "active" : "inactive";
    await patchSalon(
      row,
      {
        status: nextStatus,
        subscription_status: nextBilling,
        billing_status: nextBilling,
        is_active: true,
        suspended_reason: null,
      },
      t("superadmin.messages.unsuspended")
    );
    await logAdminAction(row.id, "resume_salon", { at: new Date().toISOString(), next_status: nextStatus });
  }

  async function setManualOverride(row, untilIso) {
    await patchSalon(
      row,
      { manual_override_until: untilIso || null },
      untilIso ? t("superadmin.messages.overrideEnabled") : t("superadmin.messages.overrideDisabled"),
      { recomputeActive: false }
    );
    await logAdminAction(row.id, "manual_override_until", { until: untilIso || null });
  }

  return (
    <PageShell title={t("superadmin.title")} subtitle={t("superadmin.subtitle")}>
      {!unlocked ? (
        <section className="panel">
          <form
            className="admin-lock"
            onSubmit={(event) => {
              event.preventDefault();
              if (!SUPER_ADMIN_CODE) {
                showToast("error", t("superadmin.errors.codeMissing"));
                return;
              }
              if (codeInput.trim() === SUPER_ADMIN_CODE) {
                setUnlocked(true);
                setVerifiedCode(codeInput.trim());
                showToast("success", t("superadmin.messages.unlocked"));
              } else {
                showToast("error", t("superadmin.errors.invalidCode"));
              }
            }}
          >
            <LanguageSwitcher />
            <label className="field">
              <span>{t("superadmin.codeLabel")}</span>
              <input className="input" value={codeInput} onChange={(e) => setCodeInput(e.target.value)} />
            </label>
            <button className="submit-main">{t("superadmin.login")}</button>
          </form>
        </section>
      ) : (
        <>
          <Card className="billing-warning-box">
            <b>{t("superadmin.internalOnly")}</b>
            <p className="muted">{t("superadmin.internalSubtitle")}</p>
          </Card>

          <Card className="panel-soft">
            <div className="row-actions">
              <Button
                type="button"
                variant={isOverviewPage ? "primary" : "ghost"}
                onClick={() => navigate("/superadmin/overview")}
              >
                {t("superadmin.tabs.overview", "Overview")}
              </Button>
              <Button
                type="button"
                variant={isMainPage ? "primary" : "ghost"}
                onClick={() => navigate("/superadmin")}
              >
                {t("superadmin.salonControl")}
              </Button>
              <Button
                type="button"
                variant={isApprovalsPage ? "primary" : "ghost"}
                onClick={() => navigate("/superadmin/approvals")}
              >
                {t("superadmin.approvals")}
              </Button>
              {isDetailPage && selectedSalon ? (
                <Badge variant="neutral">{selectedSalon.name}</Badge>
              ) : null}
            </div>
          </Card>

          {isOverviewPage ? (
          <section className="panel superadmin-overview-page">
            <div className="row-actions space-between" style={{ marginBottom: 10 }}>
              <h3>{t("superadmin.overview.title", "Operational overview")}</h3>
              <Button type="button" variant="ghost" onClick={loadOverviewMetrics}>
                {overviewLoading ? t("common.loading") : t("common.refresh")}
              </Button>
            </div>

            <div className="superadmin-kpi-grid superadmin-kpi-grid-wide">
              <Card className="superadmin-kpi-card">
                <span>{t("superadmin.overview.cards.totalSalons", "Total salons")}</span>
                <strong>{Number(globalStats?.total_salons ?? mainKpis.total ?? 0)}</strong>
              </Card>
              <Card className="superadmin-kpi-card">
                <span>{t("superadmin.overview.cards.activeSalons", "Active salons")}</span>
                <strong>{Number(globalStats?.active_count ?? 0)}</strong>
              </Card>
              <Card className="superadmin-kpi-card">
                <span>{t("superadmin.overview.cards.trialing", "Trialing")}</span>
                <strong>{Number(globalStats?.trialing_count ?? 0)}</strong>
              </Card>
              <Card className="superadmin-kpi-card">
                <span>{t("superadmin.overview.cards.pendingApproval", "Pending approval")}</span>
                <strong>{Number(globalStats?.pending_approval_count ?? mainKpis.pending ?? 0)}</strong>
              </Card>
              <Card className="superadmin-kpi-card">
                <span>{t("superadmin.overview.cards.pastDue", "Past due")}</span>
                <strong>{Number(globalStats?.past_due_count ?? 0)}</strong>
              </Card>
              <Card className="superadmin-kpi-card">
                <span>{t("superadmin.overview.cards.bookings30", "Total bookings (30d)")}</span>
                <strong>{Number(globalStats?.bookings_last_30_days ?? 0)}</strong>
              </Card>
              <Card className="superadmin-kpi-card">
                <span>{t("superadmin.overview.cards.customers30", "Total customers (30d)")}</span>
                <strong>{Number(globalStats?.customers_last_30_days ?? 0)}</strong>
              </Card>
            </div>

            <Card className="superadmin-table-card">
              <div className="row-actions space-between" style={{ marginBottom: 8 }}>
                <b>{t("superadmin.overview.countryBreakdown", "Country breakdown")}</b>
              </div>
              <div className="superadmin-table-wrap">
                <table className="superadmin-table">
                  <thead>
                    <tr>
                      <th>{t("superadmin.overview.table.country", "Country")}</th>
                      <th>{t("superadmin.overview.table.salons", "Salons")}</th>
                      <th>{t("superadmin.overview.table.active", "Active")}</th>
                      <th>{t("superadmin.overview.table.bookings30", "Bookings (30d)")}</th>
                      <th>{t("superadmin.overview.table.customers30", "Customers (30d)")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {countryBreakdownRows.length === 0 ? (
                      <tr>
                        <td colSpan={5}>{t("superadmin.overview.empty", "No data yet.")}</td>
                      </tr>
                    ) : (
                      countryBreakdownRows.map((row) => (
                        <tr key={`country-${row.country_code}`}>
                          <td>{row.country_code} - {(countryNameByCode[row.country_code] || {})[countryNameField] || row.country_code}</td>
                          <td>{row.salons}</td>
                          <td>{row.active}</td>
                          <td>{row.bookings_30}</td>
                          <td>{row.customers_30}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="superadmin-table-card">
              <div className="row-actions space-between" style={{ marginBottom: 8 }}>
                <b>{t("superadmin.overview.topSalons7d", "Top salons by bookings (7d)")}</b>
              </div>
              <div className="superadmin-table-wrap">
                <table className="superadmin-table">
                  <thead>
                    <tr>
                      <th>{t("superadmin.overview.table.salon", "Salon")}</th>
                      <th>{t("superadmin.overview.table.country", "Country")}</th>
                      <th>{t("superadmin.overview.table.bookings7", "Bookings 7d")}</th>
                      <th>{t("superadmin.overview.table.customers30", "Customers 30d")}</th>
                      <th>{t("superadmin.overview.table.lastBooking", "Last booking")}</th>
                      <th>{t("superadmin.overview.table.status", "Status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topSalonsByBookings7d.length === 0 ? (
                      <tr>
                        <td colSpan={6}>{t("superadmin.overview.empty", "No data yet.")}</td>
                      </tr>
                    ) : (
                      topSalonsByBookings7d.map((row) => (
                        <tr key={`top-${row.salon_id}`}>
                          <td>{row.salon_name}</td>
                          <td>{row.country_code}</td>
                          <td>{Number(row.bookings_last_7_days || 0)}</td>
                          <td>{Number(row.customers_last_30_days || 0)}</td>
                          <td>{formatBillingDate(row.last_booking_at)}</td>
                          <td>
                            <Badge variant={deriveSalonAccess(row).badgeVariant}>{t(`status.${row.status || "draft"}`, row.status || "draft")}</Badge>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="superadmin-table-card">
              <div className="row-actions space-between" style={{ marginBottom: 8 }}>
                <b>{t("superadmin.overview.atRisk", "Salons at risk")}</b>
              </div>
              <div className="superadmin-table-wrap">
                <table className="superadmin-table">
                  <thead>
                    <tr>
                      <th>{t("superadmin.overview.table.salon", "Salon")}</th>
                      <th>{t("superadmin.overview.table.country", "Country")}</th>
                      <th>{t("superadmin.overview.table.bookings7", "Bookings 7d")}</th>
                      <th>{t("superadmin.trialEnd")}</th>
                      <th>{t("superadmin.overview.table.risk", "Risk")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salonsAtRisk.length === 0 ? (
                      <tr>
                        <td colSpan={5}>{t("superadmin.overview.noRisk", "No risk salons right now.")}</td>
                      </tr>
                    ) : (
                      salonsAtRisk.map((row) => {
                        const trialEndMs = row.trial_end_at ? new Date(row.trial_end_at).getTime() : 0;
                        const nowMs = Date.now();
                        const trialSoon = trialEndMs > nowMs && trialEndMs <= nowMs + 3 * 24 * 60 * 60 * 1000;
                        const zeroBookings = Number(row.bookings_last_7_days || 0) === 0;
                        return (
                          <tr key={`risk-${row.salon_id}`}>
                            <td>{row.salon_name}</td>
                            <td>{row.country_code}</td>
                            <td>{Number(row.bookings_last_7_days || 0)}</td>
                            <td>{formatBillingDate(row.trial_end_at)}</td>
                            <td>
                              <div className="row-actions">
                                {trialSoon ? <Badge variant="pending">{t("superadmin.overview.risks.trialEnding", "Trial ending soon")}</Badge> : null}
                                {zeroBookings ? <Badge variant="cancelled">{t("superadmin.overview.risks.zeroBookings", "0 bookings in 7d")}</Badge> : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </section>
          ) : null}

          {isMainPage ? (
          <>
          <section className="panel superadmin-tabs-panel">
            <div className="superadmin-main-tabs" role="tablist" aria-label={t("superadmin.salonControl")}>
              {mainTabs.map((tab) => (
                <Button
                  key={tab.key}
                  type="button"
                  variant={activeMainTab === tab.key ? "primary" : "ghost"}
                  className="superadmin-main-tab-btn"
                  onClick={() => setActiveMainTab(tab.key)}
                  role="tab"
                  aria-selected={activeMainTab === tab.key}
                >
                  {tab.label}
                </Button>
              ))}
            </div>
          </section>

          {activeMainTab === "overview" ? (
          <section className="panel superadmin-overview-panel">
            <div className="row-actions space-between" style={{ marginBottom: 10 }}>
              <h3>{t("superadmin.tabs.overview", "Overview")}</h3>
              <Button type="button" variant="ghost" onClick={loadAll}>
                {loading ? t("common.loading") : t("common.refresh")}
              </Button>
            </div>
            <div className="superadmin-kpi-grid">
              <Card className="superadmin-kpi-card">
                <span>{t("superadmin.kpis.totalSalons", "Total salons")}</span>
                <strong>{mainKpis.total}</strong>
              </Card>
              <Card className="superadmin-kpi-card">
                <span>{t("superadmin.kpis.pendingApproval", "Pending approval")}</span>
                <strong>{mainKpis.pending}</strong>
              </Card>
              <Card className="superadmin-kpi-card">
                <span>{t("superadmin.kpis.active", "Active / Trialing")}</span>
                <strong>{mainKpis.active}</strong>
              </Card>
              <Card className="superadmin-kpi-card">
                <span>{t("superadmin.kpis.suspended", "Suspended")}</span>
                <strong>{mainKpis.suspended}</strong>
              </Card>
            </div>

            <div className="row-actions" style={{ marginTop: 12 }}>
              <Button type="button" variant="secondary" onClick={() => setActiveMainTab("create")}>
                {t("superadmin.createSalon")}
              </Button>
              <Button type="button" variant="ghost" onClick={() => navigate("/superadmin/approvals")}>
                {t("superadmin.approvals")}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setActiveMainTab("salons")}>
                {t("superadmin.tabs.salons", "Salons")}
              </Button>
            </div>
          </section>
          ) : null}

          {activeMainTab === "create" ? (
          <section className="panel superadmin-create-panel">
            <div className="row-actions space-between" style={{ marginBottom: 10 }}>
              <h3>{t("superadmin.createSalon")}</h3>
              <Button as={Link} to="/onboarding/salon-setup" variant="secondary">
                {t("onboarding.title", "Salon onboarding setup")}
              </Button>
            </div>
            <form className="grid two" onSubmit={createSalon}>
              <label className="field">
                <span>{t("superadmin.form.salonName")}</span>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      name: e.target.value,
                      slug: p.slug ? p.slug : normalizeSalonSlug(e.target.value),
                    }))
                  }
                />
              </label>

              <label className="field">
                <span>{t("superadmin.form.slug")}</span>
                <input className="input" value={form.slug} onChange={(e) => setForm((p) => ({ ...p, slug: normalizeSalonSlug(e.target.value) }))} />
              </label>

              <label className="field">
                <span>{t("superadmin.form.area")}</span>
                <input className="input" value={form.area} onChange={(e) => setForm((p) => ({ ...p, area: e.target.value }))} />
              </label>

              <label className="field">
                <span>{t("superadmin.form.whatsapp")}</span>
                <input className="input" value={form.whatsapp} onChange={(e) => setForm((p) => ({ ...p, whatsapp: e.target.value }))} />
              </label>

              <label className="field">
                <span>{t("superadmin.form.adminPasscode")}</span>
                <input className="input" value={form.admin_passcode} onChange={(e) => setForm((p) => ({ ...p, admin_passcode: e.target.value }))} />
              </label>

              <SelectInput label={t("superadmin.country")} value={form.country_code} onChange={(e) => setForm((p) => ({ ...p, country_code: e.target.value }))}>
                {countries.map((country) => (
                  <option value={country.code} key={country.code}>
                    {country.code} - {country[countryNameField] || country.name_en}
                  </option>
                ))}
              </SelectInput>

              <label className="switch-pill">
                <input
                  type="checkbox"
                  checked={form.seed_defaults}
                  onChange={(e) => setForm((p) => ({ ...p, seed_defaults: e.target.checked }))}
                />
                {t("superadmin.form.seedDefaults")}
              </label>

              <button className="submit-main" disabled={creating}>
                {creating ? t("superadmin.form.creating") : t("superadmin.form.create")}
              </button>
            </form>
          </section>
          ) : null}

          {activeMainTab === "salons" ? (
          <section className="panel superadmin-salons-panel">
            <div className="row-actions space-between" style={{ marginBottom: 10 }}>
              <h3>{t("superadmin.salonControl")}</h3>
              <button className="ghost-btn" type="button" onClick={loadAll}>
                {loading ? t("common.loading") : t("common.refresh")}
              </button>
            </div>

            <div className="grid three" style={{ marginBottom: 10 }}>
              <SelectInput label={t("superadmin.statusFilter")} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">{t("common.all")}</option>
                {SALON_STATUSES.map((status) => (
                  <option value={status} key={status}>{t(`status.${status}`, status)}</option>
                ))}
              </SelectInput>

              <SelectInput label={t("superadmin.country")} value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)}>
                <option value="all">{t("superadmin.allCountries")}</option>
                {countries.map((country) => (
                  <option value={country.code} key={country.code}>{country.code} - {country[countryNameField] || country.name_en}</option>
                ))}
              </SelectInput>
            </div>

            {loading ? (
              <p className="muted">{t("common.loading")}</p>
            ) : filteredSalons.length === 0 ? (
              <p className="muted">{t("superadmin.noSalons")}</p>
            ) : (
              <div className="settings-list superadmin-salons-list">
                {filteredSalons.map((row) => {
                  const access = deriveSalonAccess(row);
                  const loadingThisRow = rowLoading.includes(row.id);
                  const country = countryNameByCode[row.country_code || "IQ"];
                  const effectiveStatus = String(row.status || row.subscription_status || row.billing_status || "draft");
                  return (
                    <div className="settings-row superadmin-salon-row" key={row.id}>
                      <div className="superadmin-salon-info">
                        <div className="row-actions" style={{ alignItems: "center" }}>
                          <b>{row.name}</b>
                          <Badge variant={access.badgeVariant}>{access.badgeLabel}</Badge>
                          <Badge variant="neutral">{row.country_code || "IQ"}</Badge>
                          <Badge variant={row.setup_paid ? "confirmed" : "pending"}>
                            {row.setup_paid ? t("superadmin.setupPaid") : t("superadmin.setupPending")}
                          </Badge>
                        </div>

                        <p className="muted">
                          {country ? `${country[countryNameField] || country.name_en} • ` : ""}
                          {row.area} • /s/{row.slug}
                        </p>
                        <p className="muted">
                          {t("common.subscription")}: {t(`status.${effectiveStatus}`, effectiveStatus)} • {t("superadmin.endsAt")}: {formatBillingDate(row.current_period_end)}
                        </p>
                        <p className="muted">{t("superadmin.trialEnd")}: {formatBillingDate(row.trial_end_at || row.trial_end)}</p>
                        {row.suspended_reason ? <p className="muted">{t("superadmin.suspensionReason")}: {row.suspended_reason}</p> : null}

                        <div className="row-actions" style={{ marginTop: 8 }}>
                          <Link className="ghost-link" to={`/s/${row.slug}`}>{t("superadmin.bookingPage")}</Link>
                          <Link className="ghost-link" to={`/s/${row.slug}/admin`}>{t("superadmin.salonAdmin")}</Link>
                          <button
                            type="button"
                            className="row-btn"
                            onClick={() => {
                              if (editingSalonId === row.id) {
                                stopEditSalon();
                              } else {
                                startEditSalon(row);
                              }
                            }}
                          >
                            {editingSalonId === row.id ? t("common.cancel") : t("common.edit")}
                          </button>
                          <button
                            type="button"
                            className="row-btn"
                            onClick={() => {
                              if (editingPasscodeSalonId === row.id) {
                                setEditingPasscodeSalonId("");
                                setNewPasscode("");
                              } else {
                                setEditingPasscodeSalonId(row.id);
                              }
                            }}
                          >
                            {editingPasscodeSalonId === row.id ? t("common.cancel") : t("superadmin.changePasscode")}
                          </button>
                        </div>

                        {editingPasscodeSalonId === row.id ? (
                          <form className="row-actions" style={{ marginTop: 8 }} onSubmit={(e) => { e.preventDefault(); updateSalonPasscode(row.id); }}>
                            <input
                              className="input"
                              style={{ minWidth: 220 }}
                              type="password"
                              placeholder={t("superadmin.newPasscode")}
                              value={newPasscode}
                              onChange={(e) => setNewPasscode(e.target.value)}
                            />
                            <button type="submit" className="submit-main" disabled={rowLoading === `admin_passcode-${row.id}`}>
                              {rowLoading === `admin_passcode-${row.id}` ? t("superadmin.saving") : t("superadmin.savePasscode")}
                            </button>
                          </form>
                        ) : null}

                        {editingSalonId === row.id ? (
                          <form
                            className="grid two"
                            style={{ marginTop: 8 }}
                            onSubmit={(e) => {
                              e.preventDefault();
                              void saveSalonInfo(row);
                            }}
                          >
                            <TextInput
                              label={t("superadmin.form.salonName")}
                              value={salonEditDraft.name}
                              onChange={(e) => setSalonEditDraft((p) => ({ ...p, name: e.target.value }))}
                            />
                            <TextInput
                              label={t("superadmin.form.slug")}
                              value={salonEditDraft.slug}
                              onChange={(e) => setSalonEditDraft((p) => ({ ...p, slug: normalizeSalonSlug(e.target.value) }))}
                            />
                            <TextInput
                              label={t("superadmin.form.area")}
                              value={salonEditDraft.area}
                              onChange={(e) => setSalonEditDraft((p) => ({ ...p, area: e.target.value }))}
                            />
                            <TextInput
                              label={t("superadmin.form.whatsapp")}
                              value={salonEditDraft.whatsapp}
                              onChange={(e) => setSalonEditDraft((p) => ({ ...p, whatsapp: e.target.value }))}
                            />
                            <SelectInput
                              label={t("superadmin.country")}
                              value={salonEditDraft.country_code}
                              onChange={(e) => setSalonEditDraft((p) => ({ ...p, country_code: e.target.value }))}
                            >
                              {countries.map((country) => (
                                <option value={country.code} key={`edit-country-${row.id}-${country.code}`}>
                                  {country.code} - {country[countryNameField] || country.name_en}
                                </option>
                              ))}
                            </SelectInput>
                            <div className="row-actions" style={{ alignSelf: "end" }}>
                              <Button type="submit" variant="primary" disabled={rowLoading.includes(row.id)}>
                                {rowLoading.includes(row.id) ? t("superadmin.saving") : t("common.save")}
                              </Button>
                              <Button type="button" variant="ghost" onClick={stopEditSalon}>
                                {t("common.cancel")}
                              </Button>
                            </div>
                          </form>
                        ) : null}
                      </div>

                      <div className="row-actions superadmin-salon-actions">
                        <Button
                          variant="ghost"
                          disabled={loadingThisRow}
                          onClick={() =>
                            patchSalon(
                              row,
                              { is_listed: !row.is_listed },
                              row.is_listed ? t("superadmin.messages.hiddenFromExplore") : t("superadmin.messages.shownInExplore")
                            )
                          }
                        >
                          {row.is_listed ? t("superadmin.hideFromExplore") : t("superadmin.showInExplore")}
                        </Button>

                        <Button
                          variant="ghost"
                          disabled={loadingThisRow}
                          onClick={() =>
                            patchSalon(
                              row,
                              { setup_paid: !row.setup_paid },
                              row.setup_paid ? t("superadmin.messages.setupPaymentCleared") : t("superadmin.messages.setupPaymentMarked")
                            )
                          }
                        >
                          {row.setup_paid ? t("superadmin.clearSetupPaid") : t("superadmin.markSetupPaid")}
                        </Button>

                        <Button
                          variant="ghost"
                          disabled={loadingThisRow}
                          onClick={() => {
                            const days = Number(country?.trial_days_default || 7);
                            patchSalon(
                              row,
                              {
                                status: "trialing",
                                trial_end_at: addDaysIso(days),
                                trial_end: addDaysIso(days),
                                subscription_status: "trialing",
                                billing_status: "trialing",
                                is_active: true,
                              },
                              t("superadmin.messages.trialExtended")
                            );
                          }}
                        >
                          {t("superadmin.extendTrial")}
                        </Button>

                        <SelectInput
                          label={t("superadmin.forceStatus")}
                          value={effectiveStatus}
                          onChange={(e) => {
                            const status = e.target.value;
                            patchSalon(
                              row,
                              {
                                status,
                                subscription_status: billingStatusFromSalonStatus(status),
                                billing_status: billingStatusFromSalonStatus(status),
                                suspended_reason: status === "suspended" ? "Suspended by superadmin" : null,
                                is_active: !["suspended", "rejected"].includes(status),
                              },
                              t("superadmin.messages.statusUpdated")
                            );
                          }}
                        >
                          {SALON_STATUSES.map((status) => (
                            <option value={status} key={status}>{t(`status.${status}`, status)}</option>
                          ))}
                        </SelectInput>

                        <Button
                          variant={row.manual_override_until ? "danger" : "secondary"}
                          disabled={loadingThisRow}
                          onClick={() => {
                            const nextUntil = row.manual_override_until ? null : addDaysIso(1);
                            patchSalon(
                              row,
                              { manual_override_until: nextUntil },
                              row.manual_override_until ? t("superadmin.messages.overrideDisabled") : t("superadmin.messages.overrideEnabled"),
                              { recomputeActive: false }
                            );
                          }}
                        >
                          {row.manual_override_until ? t("superadmin.disableOverride") : t("superadmin.enableOverride")}
                        </Button>

                        <Button
                          variant="danger"
                          disabled={loadingThisRow || rowLoading === `delete-${row.id}`}
                          onClick={() => {
                            if (effectiveStatus === "suspended") {
                              void patchSalon(
                                row,
                                { status: "draft", subscription_status: "inactive", billing_status: "inactive", suspended_reason: null, is_active: true },
                                t("superadmin.messages.unsuspended")
                              );
                              return;
                            }

                            setConfirmState({
                              title: t("superadmin.confirmSuspendTitle"),
                              text: t("superadmin.confirmSuspendText", { name: row.name }),
                              onConfirm: async () => {
                                await patchSalon(
                                  row,
                                  {
                                    status: "suspended",
                                    subscription_status: "suspended",
                                    billing_status: "suspended",
                                    suspended_reason: "Suspended by superadmin",
                                    is_active: false,
                                  },
                                  t("superadmin.messages.suspended")
                                );
                              },
                            });
                          }}
                        >
                          {effectiveStatus === "suspended" ? t("superadmin.unsuspend") : t("superadmin.suspend")}
                        </Button>

                        <Button
                          variant="danger"
                          disabled={loadingThisRow || rowLoading === `delete-${row.id}`}
                          onClick={() =>
                            setConfirmState({
                              title: t("superadmin.confirmDeleteTitle", "Delete salon"),
                              text: t("superadmin.confirmDeleteText", { name: row.name, defaultValue: "Are you sure you want to permanently delete {{name}}?" }),
                              onConfirm: async () => {
                                await deleteSalon(row);
                              },
                            })
                          }
                        >
                          {t("common.delete")}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
          ) : null}
          </>
          ) : null}

          {isApprovalsPage ? (
            <section className="panel superadmin-salons-panel">
              <div className="row-actions space-between" style={{ marginBottom: 10 }}>
                <h3>{t("superadmin.approvalsQueue")}</h3>
                <button className="ghost-btn" type="button" onClick={loadAll}>
                  {loading ? t("common.loading") : t("common.refresh")}
                </button>
              </div>
              {loading ? (
                <p className="muted">{t("common.loading")}</p>
              ) : pendingApprovalSalons.length === 0 ? (
                <p className="muted">{t("superadmin.noPendingApprovals")}</p>
              ) : (
                <div className="settings-list superadmin-salons-list">
                  {pendingApprovalSalons.map((row) => {
                    const country = countryNameByCode[row.country_code || "IQ"];
                    const rowBusy = rowLoading.includes(row.id);
                    return (
                      <div className="settings-row superadmin-salon-row" key={`approval-${row.id}`}>
                        <div className="superadmin-salon-info">
                          <div className="row-actions" style={{ alignItems: "center" }}>
                            <b>{row.name}</b>
                            <Badge variant="pending">{t("status.pending_approval")}</Badge>
                            <Badge variant="neutral">{row.country_code || "IQ"}</Badge>
                          </div>
                          <p className="muted">
                            {country ? `${country[countryNameField] || country.name_en} • ` : ""}
                            {row.area || "-"}
                          </p>
                          <p className="muted">
                            {t("superadmin.counts.staff")}: {staffCounts[row.id] || 0} • {t("superadmin.counts.services")}: {serviceCounts[row.id] || 0}
                          </p>
                          <p className="muted">
                            {t("superadmin.submittedAt")}: {formatBillingDate(row.created_at)}
                          </p>

                          {editingSalonId === row.id ? (
                            <form
                              className="grid two"
                              style={{ marginTop: 8 }}
                              onSubmit={(e) => {
                                e.preventDefault();
                                void saveSalonInfo(row);
                              }}
                            >
                              <TextInput
                                label={t("superadmin.form.salonName")}
                                value={salonEditDraft.name}
                                onChange={(e) => setSalonEditDraft((p) => ({ ...p, name: e.target.value }))}
                              />
                              <TextInput
                                label={t("superadmin.form.slug")}
                                value={salonEditDraft.slug}
                                onChange={(e) => setSalonEditDraft((p) => ({ ...p, slug: normalizeSalonSlug(e.target.value) }))}
                              />
                              <TextInput
                                label={t("superadmin.form.area")}
                                value={salonEditDraft.area}
                                onChange={(e) => setSalonEditDraft((p) => ({ ...p, area: e.target.value }))}
                              />
                              <TextInput
                                label={t("superadmin.form.whatsapp")}
                                value={salonEditDraft.whatsapp}
                                onChange={(e) => setSalonEditDraft((p) => ({ ...p, whatsapp: e.target.value }))}
                              />
                              <SelectInput
                                label={t("superadmin.country")}
                                value={salonEditDraft.country_code}
                                onChange={(e) => setSalonEditDraft((p) => ({ ...p, country_code: e.target.value }))}
                              >
                                {countries.map((country) => (
                                  <option value={country.code} key={`approval-edit-country-${row.id}-${country.code}`}>
                                    {country.code} - {country[countryNameField] || country.name_en}
                                  </option>
                                ))}
                              </SelectInput>
                              <div className="row-actions" style={{ alignSelf: "end" }}>
                                <Button type="submit" variant="primary" disabled={rowLoading.includes(row.id)}>
                                  {rowLoading.includes(row.id) ? t("superadmin.saving") : t("common.save")}
                                </Button>
                                <Button type="button" variant="ghost" onClick={stopEditSalon}>
                                  {t("common.cancel")}
                                </Button>
                              </div>
                            </form>
                          ) : null}
                        </div>
                        <div className="row-actions superadmin-salon-actions">
                          <Button
                            variant="ghost"
                            disabled={rowBusy}
                            onClick={() => startEditSalon(row)}
                          >
                            {t("common.edit")}
                          </Button>
                          <Button
                            variant="success"
                            disabled={rowBusy}
                            onClick={() =>
                              setConfirmState({
                                title: t("superadmin.confirmApproveTitle"),
                                text: t("superadmin.confirmApproveText", { name: row.name }),
                                onConfirm: async () => {
                                  await approveSalon(row);
                                },
                              })
                            }
                          >
                            {t("superadmin.approve")}
                          </Button>
                          <Button
                            variant="danger"
                            disabled={rowBusy}
                            onClick={() =>
                              setConfirmState({
                                title: t("superadmin.confirmRejectTitle"),
                                text: t("superadmin.confirmRejectText", { name: row.name }),
                                onConfirm: async () => {
                                  await rejectSalon(row);
                                },
                              })
                            }
                          >
                            {t("superadmin.reject")}
                          </Button>
                          <Button variant="ghost" onClick={() => navigate(`/superadmin/salons/${row.id}`)}>
                            {t("superadmin.view")}
                          </Button>
                          <Button
                            variant="danger"
                            disabled={rowBusy || rowLoading === `delete-${row.id}`}
                            onClick={() =>
                              setConfirmState({
                                title: t("superadmin.confirmDeleteTitle", "Delete salon"),
                                text: t("superadmin.confirmDeleteText", { name: row.name, defaultValue: "Are you sure you want to permanently delete {{name}}?" }),
                                onConfirm: async () => {
                                  await deleteSalon(row);
                                },
                              })
                            }
                          >
                            {t("common.delete")}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          ) : null}

          {isDetailPage ? (
            <section className="panel superadmin-salons-panel">
              {!selectedSalon ? (
                <p className="muted">{t("superadmin.errors.salonNotFound")}</p>
              ) : (
                <>
                  <div className="row-actions space-between" style={{ marginBottom: 10 }}>
                    <h3>{selectedSalon.name}</h3>
                    <div className="row-actions">
                      <Badge variant={deriveSalonAccess(selectedSalon).badgeVariant}>
                        {deriveSalonAccess(selectedSalon).badgeLabel}
                      </Badge>
                      <Badge variant="neutral">{t(`status.${selectedSalon.status || "draft"}`)}</Badge>
                    </div>
                  </div>

                  <div className="settings-list">
                    <div className="settings-row">
                      <div>
                        <b>{t("superadmin.detail.statusSection")}</b>
                        <p className="muted">{t("superadmin.detail.statusHint")}</p>
                      </div>
                      <div className="row-actions superadmin-salon-actions">
                        {selectedSalon.status === "suspended" || !selectedSalon.is_active ? (
                          <Button
                            variant="success"
                            disabled={rowLoading.includes(selectedSalon.id)}
                            onClick={() => resumeSalon(selectedSalon)}
                          >
                            {t("superadmin.resume")}
                          </Button>
                        ) : (
                          <Button
                            variant="danger"
                            disabled={rowLoading.includes(selectedSalon.id)}
                            onClick={() =>
                              setConfirmState({
                                title: t("superadmin.confirmSuspendTitle"),
                                text: t("superadmin.confirmSuspendText", { name: selectedSalon.name }),
                                onConfirm: async () => {
                                  await suspendSalon(selectedSalon);
                                },
                              })
                            }
                          >
                            {t("superadmin.suspend")}
                          </Button>
                        )}
                        <SelectInput
                          label={t("superadmin.forceStatus")}
                          value={String(selectedSalon.status || "draft")}
                          onChange={(e) => {
                            const nextStatus = e.target.value;
                            const nextBilling = billingStatusFromSalonStatus(nextStatus);
                            void patchSalon(
                              selectedSalon,
                              {
                                status: nextStatus,
                                subscription_status: nextBilling,
                                billing_status: nextBilling,
                                is_active: !["suspended", "rejected"].includes(nextStatus),
                              },
                              t("superadmin.messages.statusUpdated")
                            ).then(() => logAdminAction(selectedSalon.id, "force_status", { status: nextStatus }));
                          }}
                        >
                          {SALON_STATUSES.map((status) => (
                            <option value={status} key={`status-${status}`}>{t(`status.${status}`, status)}</option>
                          ))}
                        </SelectInput>
                      </div>
                    </div>

                    <div className="settings-row">
                      <div>
                        <b>{t("superadmin.detail.trialSection")}</b>
                        <p className="muted">{t("superadmin.detail.trialHint")}</p>
                      </div>
                      <div className="row-actions superadmin-salon-actions">
                        <Button variant="secondary" onClick={() => extendTrial(selectedSalon, 3)}>+3</Button>
                        <Button variant="secondary" onClick={() => extendTrial(selectedSalon, 7)}>+7</Button>
                        <Button variant="secondary" onClick={() => extendTrial(selectedSalon, 14)}>+14</Button>
                      </div>
                    </div>

                    <div className="settings-row">
                      <div>
                        <b>{t("superadmin.detail.overrideSection")}</b>
                        <p className="muted">{t("superadmin.detail.overrideHint")}</p>
                      </div>
                      <div className="row-actions superadmin-salon-actions">
                        <input
                          className="input"
                          type="datetime-local"
                          value={overrideUntilInput}
                          onChange={(e) => setOverrideUntilInput(e.target.value)}
                        />
                        <Button
                          variant="secondary"
                          onClick={() => {
                            const until = overrideUntilInput ? new Date(overrideUntilInput).toISOString() : null;
                            void setManualOverride(selectedSalon, until);
                          }}
                        >
                          {t("superadmin.applyOverride")}
                        </Button>
                        <Button variant="ghost" onClick={() => setManualOverride(selectedSalon, null)}>
                          {t("superadmin.clearOverride")}
                        </Button>
                      </div>
                    </div>

                    <div className="settings-row">
                      <div>
                        <b>{t("superadmin.detail.visibilitySection")}</b>
                        <p className="muted">{t("superadmin.detail.visibilityHint")}</p>
                      </div>
                      <div className="row-actions superadmin-salon-actions">
                        <Button
                          variant="ghost"
                          onClick={() =>
                            patchSalon(
                              selectedSalon,
                              { is_listed: !selectedSalon.is_listed },
                              selectedSalon.is_listed ? t("superadmin.messages.hiddenFromExplore") : t("superadmin.messages.shownInExplore")
                            ).then(() => logAdminAction(selectedSalon.id, "toggle_listed", { is_listed: !selectedSalon.is_listed }))
                          }
                        >
                          {selectedSalon.is_listed ? t("superadmin.hideFromExplore") : t("superadmin.showInExplore")}
                        </Button>
                      </div>
                    </div>

                    <div className="settings-row">
                      <div>
                        <b>{t("superadmin.editSalonInfo", "Salon information")}</b>
                        <p className="muted">{t("superadmin.editSalonInfoHint", "Edit name, URL slug and contact before approving.")}</p>
                      </div>
                      <div style={{ width: "100%" }}>
                        <form
                          className="grid two"
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (editingSalonId !== selectedSalon.id) {
                              startEditSalon(selectedSalon);
                              return;
                            }
                            void saveSalonInfo(selectedSalon);
                          }}
                        >
                          <TextInput
                            label={t("superadmin.form.salonName")}
                            value={editingSalonId === selectedSalon.id ? salonEditDraft.name : selectedSalon.name || ""}
                            onChange={(e) => {
                              if (editingSalonId !== selectedSalon.id) startEditSalon(selectedSalon);
                              setSalonEditDraft((p) => ({ ...p, name: e.target.value }));
                            }}
                          />
                          <TextInput
                            label={t("superadmin.form.slug")}
                            value={editingSalonId === selectedSalon.id ? salonEditDraft.slug : normalizeSalonSlug(selectedSalon.slug || selectedSalon.name || "")}
                            onChange={(e) => {
                              if (editingSalonId !== selectedSalon.id) startEditSalon(selectedSalon);
                              setSalonEditDraft((p) => ({ ...p, slug: normalizeSalonSlug(e.target.value) }));
                            }}
                          />
                          <TextInput
                            label={t("superadmin.form.area")}
                            value={editingSalonId === selectedSalon.id ? salonEditDraft.area : selectedSalon.area || ""}
                            onChange={(e) => {
                              if (editingSalonId !== selectedSalon.id) startEditSalon(selectedSalon);
                              setSalonEditDraft((p) => ({ ...p, area: e.target.value }));
                            }}
                          />
                          <TextInput
                            label={t("superadmin.form.whatsapp")}
                            value={editingSalonId === selectedSalon.id ? salonEditDraft.whatsapp : selectedSalon.whatsapp || ""}
                            onChange={(e) => {
                              if (editingSalonId !== selectedSalon.id) startEditSalon(selectedSalon);
                              setSalonEditDraft((p) => ({ ...p, whatsapp: e.target.value }));
                            }}
                          />
                          <SelectInput
                            label={t("superadmin.country")}
                            value={editingSalonId === selectedSalon.id ? salonEditDraft.country_code : selectedSalon.country_code || "IQ"}
                            onChange={(e) => {
                              if (editingSalonId !== selectedSalon.id) startEditSalon(selectedSalon);
                              setSalonEditDraft((p) => ({ ...p, country_code: e.target.value }));
                            }}
                          >
                            {countries.map((country) => (
                              <option value={country.code} key={`detail-country-${country.code}`}>
                                {country.code} - {country[countryNameField] || country.name_en}
                              </option>
                            ))}
                          </SelectInput>
                          <div className="row-actions" style={{ alignSelf: "end" }}>
                            <Button type="submit" variant="primary" disabled={rowLoading.includes(selectedSalon.id)}>
                              {rowLoading.includes(selectedSalon.id) ? t("superadmin.saving") : t("common.save")}
                            </Button>
                            <Button type="button" variant="ghost" onClick={stopEditSalon}>
                              {t("common.cancel")}
                            </Button>
                            <Button
                              type="button"
                              variant="danger"
                              onClick={() =>
                                setConfirmState({
                                  title: t("superadmin.confirmDeleteTitle", "Delete salon"),
                                  text: t("superadmin.confirmDeleteText", {
                                    name: selectedSalon.name,
                                    defaultValue: "Are you sure you want to permanently delete {{name}}?",
                                  }),
                                  onConfirm: async () => {
                                    await deleteSalon(selectedSalon);
                                  },
                                })
                              }
                            >
                              {t("common.delete")}
                            </Button>
                          </div>
                        </form>
                      </div>
                    </div>
                  </div>

                  <Card className="superadmin-health-panel" style={{ marginTop: 12 }}>
                    <div className="row-actions space-between" style={{ marginBottom: 8 }}>
                      <b>{t("superadmin.health.title", "Salon health")}</b>
                      <Button type="button" variant="ghost" onClick={loadOverviewMetrics}>
                        {overviewLoading ? t("common.loading") : t("common.refresh")}
                      </Button>
                    </div>
                    {selectedSalonHealth ? (
                      <div className="superadmin-health-grid">
                        {(() => {
                          const totalCustomers = Number(selectedSalonHealth.total_customers || 0);
                          const customers30 = Number(selectedSalonHealth.customers_last_30_days || 0);
                          const repeat30 = Number(selectedSalonHealth.repeat_customers_last_30_days || 0);
                          const new30 = Number(selectedSalonHealth.new_customers_last_30_days || 0);
                          const repeatRate = customers30 > 0 ? Math.round((repeat30 / customers30) * 100) : 0;
                          const engagementScore = Number(selectedSalonHealth.bookings_last_7_days || 0) * 2 + repeat30;
                          return (
                            <>
                              <div className="superadmin-health-metric">
                                <span>{t("superadmin.health.totalCustomers", "Total customers")}</span>
                                <strong>{totalCustomers}</strong>
                              </div>
                              <div className="superadmin-health-metric">
                                <span>{t("superadmin.health.newCustomers30", "New customers (30d)")}</span>
                                <strong>{new30}</strong>
                              </div>
                              <div className="superadmin-health-metric">
                                <span>{t("superadmin.health.repeatRate", "Repeat rate")}</span>
                                <strong>{repeatRate}%</strong>
                              </div>
                              <div className="superadmin-health-metric">
                                <span>{t("superadmin.health.bookings7", "Bookings 7d")}</span>
                                <strong>{Number(selectedSalonHealth.bookings_last_7_days || 0)}</strong>
                              </div>
                              <div className="superadmin-health-metric">
                                <span>{t("superadmin.health.bookings30", "Bookings 30d")}</span>
                                <strong>{Number(selectedSalonHealth.bookings_last_30_days || 0)}</strong>
                              </div>
                              <div className="superadmin-health-metric">
                                <span>{t("superadmin.health.lastBooking", "Last booking")}</span>
                                <strong>{formatBillingDate(selectedSalonHealth.last_booking_at)}</strong>
                              </div>
                              <div className="superadmin-health-metric">
                                <span>{t("superadmin.health.trialCountdown", "Trial countdown")}</span>
                                <strong>{getTrialRemainingLabel(selectedSalon.trial_end_at || selectedSalon.trial_end) || "-"}</strong>
                              </div>
                              <div className="superadmin-health-metric">
                                <span>{t("superadmin.health.engagementScore", "Engagement score")}</span>
                                <strong>{engagementScore}</strong>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    ) : (
                      <p className="muted">{t("superadmin.overview.empty", "No data yet.")}</p>
                    )}
                  </Card>

                  {(() => {
                    const country = countryNameByCode[selectedSalon.country_code || "IQ"];
                    const needsStripe = String(selectedSalon.country_code || "IQ").toUpperCase() !== "IQ";
                    const stripeMissing = needsStripe && (!country?.stripe_price_id_basic || !country?.stripe_price_id_pro);
                    if (!stripeMissing) return null;
                    return (
                      <Card className="billing-warning-box" style={{ marginTop: 12 }}>
                        <b>{t("superadmin.stripeConfigWarning")}</b>
                        <p className="muted">{t("superadmin.stripeConfigWarningText")}</p>
                      </Card>
                    );
                  })()}

                  <Card style={{ marginTop: 12 }}>
                    <div className="row-actions space-between" style={{ marginBottom: 8 }}>
                      <b>{t("superadmin.auditLog")}</b>
                      <Button variant="ghost" onClick={() => loadSalonActions(selectedSalon.id)}>
                        {actionsLoading ? t("common.loading") : t("common.refresh")}
                      </Button>
                    </div>
                    {actionsLoading ? (
                      <p className="muted">{t("common.loading")}</p>
                    ) : salonActions.length === 0 ? (
                      <p className="muted">{t("superadmin.noAuditLogs")}</p>
                    ) : (
                      <div className="settings-list">
                        {salonActions.map((row) => (
                          <div className="settings-row" key={row.id}>
                            <div>
                              <b>{row.action_type}</b>
                              <p className="muted">{formatBillingDate(row.created_at)}</p>
                            </div>
                            <pre className="json-preview">{JSON.stringify(row.payload || {}, null, 2)}</pre>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </>
              )}
            </section>
          ) : null}

          {isMainPage && activeMainTab === "countries" ? (
          <section className="panel superadmin-salons-panel">
            <h3>{t("superadmin.countriesConfig")}</h3>
            <div className="settings-list">
              {countries.map((country) => {
                const draft = countryDrafts[country.code] || {
                  stripe_price_id_basic: "",
                  stripe_price_id_pro: "",
                  trial_days_default: "7",
                  vat_percent: "0",
                  is_enabled: true,
                };
                return (
                  <div className="settings-row" key={country.code}>
                    <div>
                      <b>{country.code} - {country[countryNameField] || country.name_en}</b>
                      <p className="muted">{t("superadmin.currency")}: {country.default_currency} • {t("superadmin.timezone")}: {country.timezone_default}</p>
                    </div>

                    <div className="grid two" style={{ width: "100%" }}>
                      <TextInput
                        label={t("superadmin.basicPriceId")}
                        value={draft.stripe_price_id_basic}
                        onChange={(e) => setCountryDrafts((prev) => ({
                          ...prev,
                          [country.code]: { ...draft, stripe_price_id_basic: e.target.value },
                        }))}
                      />

                      <TextInput
                        label={t("superadmin.proPriceId")}
                        value={draft.stripe_price_id_pro}
                        onChange={(e) => setCountryDrafts((prev) => ({
                          ...prev,
                          [country.code]: { ...draft, stripe_price_id_pro: e.target.value },
                        }))}
                      />

                      <TextInput
                        label={t("superadmin.trialDays")}
                        type="number"
                        value={draft.trial_days_default}
                        onChange={(e) => setCountryDrafts((prev) => ({
                          ...prev,
                          [country.code]: { ...draft, trial_days_default: e.target.value },
                        }))}
                      />

                      <TextInput
                        label={t("superadmin.vatPercent")}
                        type="number"
                        value={draft.vat_percent}
                        onChange={(e) => setCountryDrafts((prev) => ({
                          ...prev,
                          [country.code]: { ...draft, vat_percent: e.target.value },
                        }))}
                      />

                      <label className="switch-pill" style={{ gridColumn: "1 / -1" }}>
                        <input
                          type="checkbox"
                          checked={Boolean(draft.is_enabled)}
                          onChange={(e) => setCountryDrafts((prev) => ({
                            ...prev,
                            [country.code]: { ...draft, is_enabled: e.target.checked },
                          }))}
                        />
                        {draft.is_enabled ? t("superadmin.disableCountry") : t("superadmin.enableCountry")}
                      </label>

                      <Button
                        type="button"
                        onClick={() => saveCountryConfig(country.code)}
                        disabled={rowLoading === `country-${country.code}`}
                        style={{ gridColumn: "1 / -1" }}
                      >
                        {rowLoading === `country-${country.code}` ? t("superadmin.saving") : t("common.save")}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
          ) : null}
        </>
      )}

      <ConfirmModal
        open={Boolean(confirmState)}
        title={confirmState?.title || t("common.confirm")}
        text={confirmState?.text || ""}
        loading={Boolean(rowLoading)}
        onCancel={() => !rowLoading && setConfirmState(null)}
        onConfirm={async () => {
          if (!confirmState?.onConfirm) return;
          await confirmState.onConfirm();
          setConfirmState(null);
        }}
        confirmText={t("common.confirm")}
      />

      <Toast {...toast} />
    </PageShell>
  );
}
