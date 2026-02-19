import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PageShell from "../components/PageShell";
import Toast from "../components/Toast";
import { Badge, Button, Card, ConfirmModal } from "../components/ui";
import { supabase } from "../lib/supabase";
import { DEFAULT_HOURS, DEFAULT_SERVICES, DEFAULT_STAFF } from "../lib/utils";
import { computeIsActiveFromBilling, deriveSalonAccess, formatBillingDate, getBillingStatusLabel } from "../lib/billing";
import { useToast } from "../lib/useToast";

const SUPER_ADMIN_CODE = String(
  import.meta.env.VITE_SUPERADMIN_CODE ||
    import.meta.env.VITE_SUPER_ADMIN_CODE ||
    import.meta.env.VITE_SUPER_ADMIN ||
    import.meta.env.VITE_SUPER_ADMIN_PASSCODE ||
    "1989"
).trim();

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u0600-\u06FF-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function SuperAdminPage() {
  const { toast, showToast } = useToast();

  const [unlocked, setUnlocked] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [salons, setSalons] = useState([]);

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    area: "",
    whatsapp: "",
    admin_passcode: "",
    seed_defaults: true,
  });

  const [rowLoading, setRowLoading] = useState("");
  const [editingPasscodeSalonId, setEditingPasscodeSalonId] = useState("");
  const [newPasscode, setNewPasscode] = useState("");
  const [filter, setFilter] = useState("all");
  const [confirmState, setConfirmState] = useState(null);

  async function loadSalons() {
    if (!supabase) {
      setLoading(false);
      showToast("error", "إعدادات Supabase غير مكتملة.");
      return;
    }

    setLoading(true);
    try {
      const res = await supabase
        .from("salons")
        .select(
          [
            "id",
            "slug",
            "name",
            "area",
            "whatsapp",
            "created_at",
            "admin_passcode",
            "setup_paid",
            "setup_required",
            "billing_status",
            "stripe_customer_id",
            "stripe_subscription_id",
            "current_period_end",
            "trial_enabled",
            "trial_end",
            "manual_override_active",
            "manual_override_reason",
            "suspended_reason",
            "is_listed",
            "is_active",
          ].join(",")
        )
        .order("created_at", { ascending: false });
      if (res.error) throw res.error;
      setSalons(res.data || []);
    } catch (err) {
      showToast("error", `تعذر تحميل الصالونات: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (unlocked) {
      loadSalons();
    }
  }, [unlocked]);

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

    const staffRes = await supabase
      .from("staff")
      .insert(staffPayload)
      .select("id, salon_id");
    if (staffRes.error) throw staffRes.error;

    const servicesPayload = DEFAULT_SERVICES.map((x) => ({
      salon_id: salonId,
      name: x.name,
      duration_minutes: x.duration_minutes,
      price: x.price,
      is_active: true,
      sort_order: x.sort_order,
    }));

    const servicesRes = await supabase
      .from("services")
      .insert(servicesPayload)
      .select("id, salon_id");
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

  async function createSalon(e) {
    e.preventDefault();
    if (!supabase) return;

    const name = form.name.trim();
    const slug = slugify(form.slug || form.name);
    const area = form.area.trim();
    const passcode = form.admin_passcode.trim();

    if (name.length < 2) return showToast("error", "اكتبي اسم صالون صحيح.");
    if (!slug) return showToast("error", "اكتبي slug صحيح.");
    if (area.length < 2) return showToast("error", "اكتبي المنطقة.");
    if (passcode.length < 3) return showToast("error", "اكتبي رمز إدارة للصالون.");

    setCreating(true);
    try {
      const ins = await supabase
        .from("salons")
        .insert([
          {
            name,
            slug,
            area,
            whatsapp: form.whatsapp.trim() || null,
            admin_passcode: passcode,
            setup_required: true,
            setup_paid: false,
            billing_status: "inactive",
            is_active: false,
            is_listed: false,
          },
        ])
        .select("*")
        .single();

      if (ins.error) throw ins.error;

      if (form.seed_defaults) {
        await seedDefaults(ins.data.id);
      }

      setForm({
        name: "",
        slug: "",
        area: "",
        whatsapp: "",
        admin_passcode: "",
        seed_defaults: true,
      });

      showToast("success", "تم إنشاء الصالون بنجاح.");
      await loadSalons();
    } catch (err) {
      showToast("error", `تعذر إنشاء الصالون: ${err?.message || err}`);
    } finally {
      setCreating(false);
    }
  }

  async function patchSalon(row, patch, successMessage, options = { recomputeActive: true }) {
    if (!supabase || !row?.id) return;

    const loadingKey = `${row.id}-${Object.keys(patch).join("-")}`;
    setRowLoading(loadingKey);
    try {
      const merged = { ...row, ...patch };
      const finalPatch = options.recomputeActive
        ? { ...patch, is_active: computeIsActiveFromBilling(merged) }
        : patch;

      const up = await supabase
        .from("salons")
        .update(finalPatch)
        .eq("id", row.id)
        .select("*")
        .single();
      if (up.error) throw up.error;

      setSalons((prev) => prev.map((x) => (x.id === row.id ? { ...x, ...up.data } : x)));
      showToast("success", successMessage || "تم حفظ التحديث.");
    } catch (err) {
      showToast("error", `تعذر تحديث الصالون: ${err?.message || err}`);
    } finally {
      setRowLoading("");
    }
  }

  async function updateSalonPasscode(rowId) {
    if (!supabase) return;

    const passcode = newPasscode.trim();
    if (passcode.length < 3) {
      showToast("error", "رمز الإدارة لازم يكون 3 خانات أو أكثر.");
      return;
    }

    const loadingKey = `admin_passcode-${rowId}`;
    setRowLoading(loadingKey);
    try {
      const up = await supabase.from("salons").update({ admin_passcode: passcode }).eq("id", rowId);
      if (up.error) throw up.error;

      showToast("success", "تم تغيير رمز إدارة الصالون.");
      setEditingPasscodeSalonId("");
      setNewPasscode("");
    } catch (err) {
      showToast("error", `تعذر تغيير الرمز: ${err?.message || err}`);
    } finally {
      setRowLoading("");
    }
  }

  const filteredSalons = useMemo(() => {
    const sorted = [...salons].sort((a, b) => String(a.name).localeCompare(String(b.name), "ar"));
    if (filter === "all") return sorted;
    if (filter === "inactive") return sorted.filter((row) => !row.is_active);
    if (filter === "active") return sorted.filter((row) => row.is_active);
    if (filter === "suspended") return sorted.filter((row) => row.billing_status === "suspended");
    if (filter === "trialing") {
      return sorted.filter((row) => deriveSalonAccess(row).code === "trialing");
    }
    return sorted;
  }, [salons, filter]);

  return (
    <PageShell title="لوحة السوبر أدمن" subtitle="تحكم كامل بالتفعيل والفوترة لكل الصالونات">
      {!unlocked ? (
        <section className="panel">
          <form
            className="admin-lock"
            onSubmit={(e) => {
              e.preventDefault();
              if (!SUPER_ADMIN_CODE) {
                showToast("error", "رمز السوبر أدمن غير مضبوط. تأكد من VITE_SUPER_ADMIN_CODE ثم أعد تشغيل dev.");
                return;
              }

              if (codeInput.trim() === SUPER_ADMIN_CODE) {
                setUnlocked(true);
                showToast("success", "تم فتح لوحة السوبر أدمن.");
              } else {
                showToast("error", "رمز السوبر أدمن غير صحيح.");
              }
            }}
          >
            <label className="field">
              <span>رمز السوبر أدمن</span>
              <input className="input" value={codeInput} onChange={(e) => setCodeInput(e.target.value)} />
            </label>
            <button className="submit-main">دخول</button>
          </form>
        </section>
      ) : (
        <>
          <Card className="billing-warning-box">
            <b>للاستخدام الداخلي فقط</b>
            <p className="muted">هذه الشاشة خاصة بإدارة CareChair لتفعيل/تعليق الصالونات واختبار الفوترة.</p>
          </Card>

          <section className="panel">
            <h3>إنشاء صالون جديد</h3>
            <form className="grid two" onSubmit={createSalon}>
              <label className="field">
                <span>اسم الصالون</span>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      name: e.target.value,
                      slug: p.slug ? p.slug : slugify(e.target.value),
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>Slug (رابط الصالون)</span>
                <input
                  className="input"
                  value={form.slug}
                  onChange={(e) => setForm((p) => ({ ...p, slug: slugify(e.target.value) }))}
                  placeholder="queen-baghdad"
                />
              </label>
              <label className="field">
                <span>المنطقة</span>
                <input
                  className="input"
                  value={form.area}
                  onChange={(e) => setForm((p) => ({ ...p, area: e.target.value }))}
                  placeholder="المنصور"
                />
              </label>
              <label className="field">
                <span>واتساب</span>
                <input
                  className="input"
                  value={form.whatsapp}
                  onChange={(e) => setForm((p) => ({ ...p, whatsapp: e.target.value }))}
                  placeholder="96477..."
                />
              </label>
              <label className="field">
                <span>رمز إدارة الصالون</span>
                <input
                  className="input"
                  value={form.admin_passcode}
                  onChange={(e) => setForm((p) => ({ ...p, admin_passcode: e.target.value }))}
                />
              </label>
              <label className="switch-pill">
                <input
                  type="checkbox"
                  checked={form.seed_defaults}
                  onChange={(e) => setForm((p) => ({ ...p, seed_defaults: e.target.checked }))}
                />
                إنشاء ساعات/خدمات/موظفات افتراضية
              </label>
              <button className="submit-main" disabled={creating}>
                {creating ? "جاري الإنشاء..." : "إنشاء الصالون"}
              </button>
            </form>
          </section>

          <section className="panel">
            <div className="row-actions space-between">
              <h3>التحكم بالصالونات</h3>
              <button className="ghost-btn" type="button" onClick={loadSalons}>
                {loading ? "جاري التحديث..." : "تحديث"}
              </button>
            </div>

            <div className="tabs-inline" style={{ marginBottom: 10 }}>
              <Button variant={filter === "all" ? "primary" : "ghost"} onClick={() => setFilter("all")}>الكل</Button>
              <Button variant={filter === "inactive" ? "primary" : "ghost"} onClick={() => setFilter("inactive")}>غير مفعل</Button>
              <Button variant={filter === "trialing" ? "primary" : "ghost"} onClick={() => setFilter("trialing")}>تجريبي</Button>
              <Button variant={filter === "active" ? "primary" : "ghost"} onClick={() => setFilter("active")}>فعال</Button>
              <Button variant={filter === "suspended" ? "primary" : "ghost"} onClick={() => setFilter("suspended")}>موقوف</Button>
            </div>

            {loading ? (
              <p className="muted">جاري التحميل...</p>
            ) : filteredSalons.length === 0 ? (
              <p className="muted">لا توجد صالونات ضمن هذا الفلتر.</p>
            ) : (
              <div className="settings-list">
                {filteredSalons.map((row) => {
                  const access = deriveSalonAccess(row);
                  const loadingThisRow = rowLoading.includes(row.id);
                  return (
                    <div className="settings-row" key={row.id}>
                      <div>
                        <div className="row-actions" style={{ alignItems: "center" }}>
                          <b>{row.name}</b>
                          <Badge variant={access.badgeVariant}>{access.badgeLabel}</Badge>
                          <Badge variant={row.setup_paid ? "confirmed" : "pending"}>
                            {row.setup_paid ? "رسوم الإعداد مدفوعة" : "رسوم الإعداد غير مدفوعة"}
                          </Badge>
                          {row.is_listed ? <Badge variant="neutral">ظاهر بالاستكشاف</Badge> : null}
                        </div>

                        <p className="muted">{row.area} • /s/{row.slug}</p>
                        <p className="muted">
                          الاشتراك: {getBillingStatusLabel(row.billing_status)} • ينتهي: {formatBillingDate(row.current_period_end)}
                        </p>
                        {row.trial_enabled ? (
                          <p className="muted">تجريبي حتى: {formatBillingDate(row.trial_end)}</p>
                        ) : null}
                        {row.suspended_reason ? <p className="muted">سبب الإيقاف: {row.suspended_reason}</p> : null}
                        {row.manual_override_active ? (
                          <p className="muted">Manual override: {row.manual_override_reason || "بدون سبب"}</p>
                        ) : null}

                        <div className="row-actions" style={{ marginTop: 8 }}>
                          <Link className="ghost-link" to={`/s/${row.slug}`}>صفحة الحجز</Link>
                          <Link className="ghost-link" to={`/s/${row.slug}/admin`}>إدارة الصالون</Link>
                          <button
                            type="button"
                            className="row-btn"
                            onClick={() => {
                              if (editingPasscodeSalonId === row.id) {
                                setEditingPasscodeSalonId("");
                                setNewPasscode("");
                                return;
                              }
                              setEditingPasscodeSalonId(row.id);
                              setNewPasscode("");
                            }}
                          >
                            {editingPasscodeSalonId === row.id ? "إلغاء تغيير الرمز" : "تغيير رمز الإدارة"}
                          </button>
                        </div>

                        {editingPasscodeSalonId === row.id ? (
                          <form
                            className="row-actions"
                            style={{ marginTop: 8 }}
                            onSubmit={(e) => {
                              e.preventDefault();
                              updateSalonPasscode(row.id);
                            }}
                          >
                            <input
                              className="input"
                              style={{ minWidth: 220 }}
                              type="password"
                              placeholder="الرمز الجديد"
                              value={newPasscode}
                              onChange={(e) => setNewPasscode(e.target.value)}
                            />
                            <button type="submit" className="submit-main" disabled={rowLoading === `admin_passcode-${row.id}`}>
                              {rowLoading === `admin_passcode-${row.id}` ? "جاري الحفظ..." : "حفظ الرمز"}
                            </button>
                          </form>
                        ) : null}
                      </div>

                      <div className="row-actions" style={{ maxWidth: 420 }}>
                        <Button
                          variant="ghost"
                          disabled={loadingThisRow}
                          onClick={() => patchSalon(row, { is_listed: !row.is_listed }, row.is_listed ? "تم إخفاء الصالون." : "تم إظهار الصالون.")}
                        >
                          {row.is_listed ? "إخفاء من الاستكشاف" : "إظهار بالاستكشاف"}
                        </Button>

                        <Button
                          variant="ghost"
                          disabled={loadingThisRow}
                          onClick={() => patchSalon(row, { setup_paid: !row.setup_paid }, row.setup_paid ? "تم إلغاء دفع الإعداد." : "تم تعليم رسوم الإعداد كمدفوعة.")}
                        >
                          {row.setup_paid ? "إلغاء دفع الإعداد" : "تعيين الإعداد مدفوع"}
                        </Button>

                        <Button
                          variant="ghost"
                          disabled={loadingThisRow}
                          onClick={() => {
                            const trialEnd = new Date();
                            trialEnd.setDate(trialEnd.getDate() + 3);
                            patchSalon(
                              row,
                              {
                                trial_enabled: true,
                                trial_end: trialEnd.toISOString(),
                                billing_status: "trialing",
                              },
                              "تم تفعيل تجربة 3 أيام."
                            );
                          }}
                        >
                          تفعيل تجربة 3 أيام
                        </Button>

                        <Button
                          variant="ghost"
                          disabled={loadingThisRow}
                          onClick={() => patchSalon(row, { trial_enabled: false, trial_end: null }, "تم تعطيل الفترة التجريبية.")}
                        >
                          تعطيل التجربة
                        </Button>

                        <Button
                          variant={row.manual_override_active ? "danger" : "secondary"}
                          disabled={loadingThisRow}
                          onClick={() =>
                            patchSalon(
                              row,
                              row.manual_override_active
                                ? { manual_override_active: false, manual_override_reason: null }
                                : { manual_override_active: true, manual_override_reason: "Super admin override" },
                              row.manual_override_active ? "تم إلغاء الـ override." : "تم تفعيل الـ override."
                            )
                          }
                        >
                          {row.manual_override_active ? "إلغاء Override" : "تفعيل Override"}
                        </Button>

                        <Button
                          variant="danger"
                          disabled={loadingThisRow}
                          onClick={() => {
                            if (row.billing_status === "suspended") {
                              patchSalon(row, { billing_status: "inactive", suspended_reason: null }, "تم رفع الإيقاف.");
                              return;
                            }
                            const reason =
                              (typeof window !== "undefined"
                                ? window.prompt("سبب الإيقاف (اختياري)", "تم الإيقاف من السوبر أدمن")
                                : "") || "تم الإيقاف من السوبر أدمن";
                            setConfirmState({
                              title: "إيقاف الصالون",
                              text: `هل تريد إيقاف ${row.name}؟`,
                              onConfirm: async () => {
                                await patchSalon(
                                  row,
                                  {
                                    billing_status: "suspended",
                                    suspended_reason: reason,
                                  },
                                  "تم إيقاف الصالون."
                                );
                              },
                            });
                          }}
                        >
                          {row.billing_status === "suspended" ? "رفع الإيقاف" : "إيقاف"}
                        </Button>

                        <Button
                          variant="success"
                          disabled={loadingThisRow}
                          onClick={() =>
                            patchSalon(
                              row,
                              {
                                setup_paid: true,
                                setup_required: false,
                                billing_status: "active",
                                manual_override_active: true,
                                manual_override_reason: "Force activate (testing)",
                                is_active: true,
                              },
                              "تم التفعيل الإجباري للاختبار.",
                              { recomputeActive: false }
                            )
                          }
                        >
                          تفعيل إجباري للاختبار
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      <ConfirmModal
        open={Boolean(confirmState)}
        title={confirmState?.title || "تأكيد"}
        text={confirmState?.text || ""}
        loading={Boolean(rowLoading)}
        onCancel={() => !rowLoading && setConfirmState(null)}
        onConfirm={async () => {
          if (!confirmState?.onConfirm) return;
          await confirmState.onConfirm();
          setConfirmState(null);
        }}
        confirmText="تأكيد"
      />

      <Toast {...toast} />
    </PageShell>
  );
}
