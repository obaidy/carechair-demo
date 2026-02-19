import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PageShell from "../components/PageShell";
import Toast from "../components/Toast";
import { supabase } from "../lib/supabase";
import { DEFAULT_HOURS, DEFAULT_SERVICES, DEFAULT_STAFF } from "../lib/utils";
import { useToast } from "../lib/useToast";

const SUPER_ADMIN_CODE = String(
  import.meta.env.VITE_SUPER_ADMIN_CODE || import.meta.env.VITE_SUPER_ADMIN || ""
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
        .select("id, slug, name, area, whatsapp, is_active, is_listed, created_at")
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
            is_active: true,
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

  async function toggleSalonFlag(row, key) {
    if (!supabase) return;

    const loadingKey = `${key}-${row.id}`;
    setRowLoading(loadingKey);
    try {
      const up = await supabase
        .from("salons")
        .update({ [key]: !row[key] })
        .eq("id", row.id);

      if (up.error) throw up.error;

      setSalons((prev) =>
        prev.map((x) => (x.id === row.id ? { ...x, [key]: !row[key] } : x))
      );
      showToast("success", "تم تحديث الصالون.");
    } catch (err) {
      showToast("error", `تعذر تحديث الصالون: ${err?.message || err}`);
    } finally {
      setRowLoading("");
    }
  }

  const sortedSalons = useMemo(
    () => [...salons].sort((a, b) => String(a.name).localeCompare(String(b.name), "ar")),
    [salons]
  );

  return (
    <PageShell title="لوحة السوبر أدمن" subtitle="إدارة جميع الصالونات ضمن نفس المنصة">
      {!unlocked ? (
        <section className="panel">
          <form
            className="admin-lock"
            onSubmit={(e) => {
              e.preventDefault();
              if (!SUPER_ADMIN_CODE) {
                showToast("error", "متغير السوبر أدمن غير موجود (VITE_SUPER_ADMIN_CODE).");
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
              <h3>كل الصالونات</h3>
              <button className="ghost-btn" type="button" onClick={loadSalons}>
                {loading ? "جاري التحديث..." : "تحديث"}
              </button>
            </div>

            {loading ? (
              <p className="muted">جاري التحميل...</p>
            ) : sortedSalons.length === 0 ? (
              <p className="muted">لا توجد صالونات بعد.</p>
            ) : (
              <div className="settings-list">
                {sortedSalons.map((row) => (
                  <div className="settings-row" key={row.id}>
                    <div>
                      <b>{row.name}</b>
                      <p className="muted">
                        {row.area} • /s/{row.slug}
                      </p>
                      <div className="row-actions">
                        <Link className="ghost-link" to={`/s/${row.slug}`}>
                          صفحة الحجز
                        </Link>
                        <Link className="ghost-link" to={`/s/${row.slug}/admin`}>
                          إدارة الصالون
                        </Link>
                      </div>
                    </div>

                    <div className="row-actions">
                      <button
                        type="button"
                        className="row-btn"
                        onClick={() => toggleSalonFlag(row, "is_active")}
                        disabled={rowLoading === `is_active-${row.id}`}
                      >
                        {rowLoading === `is_active-${row.id}`
                          ? "جاري..."
                          : row.is_active
                            ? "تعطيل"
                            : "تفعيل"}
                      </button>
                      <button
                        type="button"
                        className="row-btn"
                        onClick={() => toggleSalonFlag(row, "is_listed")}
                        disabled={rowLoading === `is_listed-${row.id}`}
                      >
                        {rowLoading === `is_listed-${row.id}`
                          ? "جاري..."
                          : row.is_listed
                            ? "إخفاء من الاستكشاف"
                            : "إظهار بالاستكشاف"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <Toast {...toast} />
    </PageShell>
  );
}
