import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PageShell from "../components/PageShell";
import SafeImage from "../components/SafeImage";
import Toast from "../components/Toast";
import { Badge, Button, Card, SelectInput, Skeleton, TextInput } from "../components/ui";
import { supabase } from "../lib/supabase";
import { getSalonMedia, hashStringToIndex } from "../lib/media";
import {
  formatCurrencyIQD,
  isValidE164WithoutPlus,
  normalizeIraqiPhone,
  sortByOrderThenName,
} from "../lib/utils";
import { useToast } from "../lib/useToast";

const CATEGORY_CHIPS = [
  { key: "all", label: "الكل", keywords: [] },
  { key: "haircut", label: "قص شعر", keywords: ["قص", "شعر"] },
  { key: "color", label: "صبغ", keywords: ["صبغ", "لون"] },
  { key: "nails", label: "أظافر", keywords: ["اظافر", "أظافر", "مانيكير", "باديكير"] },
  { key: "facial", label: "بشرة", keywords: ["بشرة", "تنظيف"] },
  { key: "makeup", label: "مكياج", keywords: ["مكياج", "ميكاب"] },
];

export default function ExplorePage() {
  const { toast, showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [salons, setSalons] = useState([]);
  const [services, setServices] = useState([]);
  const [areaFilter, setAreaFilter] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  useEffect(() => {
    async function loadExplore() {
      if (!supabase) {
        setLoading(false);
        showToast("error", "إعدادات Supabase غير مكتملة.");
        return;
      }

      setLoading(true);
      try {
        const salonsRes = await supabase
          .from("salons")
          .select("*")
          .eq("is_active", true)
          .eq("is_listed", true)
          .order("name", { ascending: true });

        if (salonsRes.error) throw salonsRes.error;

        const salonRows = salonsRes.data || [];
        setSalons(salonRows);

        if (salonRows.length === 0) {
          setServices([]);
          return;
        }

        const serviceRes = await supabase
          .from("services")
          .select("id, salon_id, name, duration_minutes, price, sort_order")
          .eq("is_active", true)
          .in(
            "salon_id",
            salonRows.map((s) => s.id)
          );

        if (serviceRes.error) throw serviceRes.error;
        setServices((serviceRes.data || []).sort(sortByOrderThenName));
      } catch (err) {
        showToast("error", `تعذر تحميل صفحة الاستكشاف: ${err?.message || err}`);
      } finally {
        setLoading(false);
      }
    }

    loadExplore();
  }, [showToast]);

  const servicesBySalon = useMemo(() => {
    const map = {};
    for (const row of services) {
      if (!map[row.salon_id]) map[row.salon_id] = [];
      map[row.salon_id].push(row);
    }
    return map;
  }, [services]);

  const areaOptions = useMemo(() => {
    const set = new Set(salons.map((s) => s.area).filter(Boolean));
    return Array.from(set).sort((a, b) => String(a).localeCompare(String(b), "ar"));
  }, [salons]);

  const filteredSalons = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    const activeCategory = CATEGORY_CHIPS.find((x) => x.key === categoryFilter) || CATEGORY_CHIPS[0];

    const list = salons.filter((salon) => {
      if (areaFilter !== "all" && salon.area !== areaFilter) return false;
      const salonServices = servicesBySalon[salon.id] || [];
      const normalizedServiceNames = salonServices.map((s) => String(s.name || "").toLowerCase());
      const hasService = normalizedServiceNames.some((name) => name.includes(q));
      const salonNameMatch = String(salon.name || "").toLowerCase().includes(q);
      if (q && !hasService && !salonNameMatch) return false;

      if (activeCategory.key !== "all") {
        const matchesCategory = normalizedServiceNames.some((name) =>
          activeCategory.keywords.some((keyword) => name.includes(keyword))
        );
        if (!matchesCategory) return false;
      }

      return true;
    });

    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      }
      if (sortBy === "top-rated") {
        return hashStringToIndex(String(b.slug || b.id), 100) - hashStringToIndex(String(a.slug || a.id), 100);
      }
      if (sortBy === "most-booked") {
        const bCount = (servicesBySalon[b.id] || []).length;
        const aCount = (servicesBySalon[a.id] || []).length;
        return bCount - aCount;
      }
      return String(a.name || "").localeCompare(String(b.name || ""), "ar");
    });
    return sorted;
  }, [salons, servicesBySalon, areaFilter, searchText, categoryFilter, sortBy]);

  const socialProofText =
    salons.length <= 5
      ? `مراكز بدأت تستخدم CareChair لتنظيم المواعيد (${salons.length})`
      : `مراكز تستخدم CareChair لتنظيم المواعيد (${salons.length})`;

  return (
    <PageShell title="استكشاف الصالونات" subtitle="اختاري المنطقة والخدمة وشوفي أفضل المراكز القريبة">
      <Card className="explore-social-proof">
        <b>{socialProofText}</b>
      </Card>

      <Card className="explore-hero">
        <div>
          <Badge variant="featured">منصّة CareChair</Badge>
          <h2>اكتشفي أفضل صالونات بغداد</h2>
          <p>اختاري الخدمة، قارني المراكز، واحجزي بنفس اللحظة.</p>
        </div>
      </Card>

      <Card>
        <div className="category-chips-wrap">
          {CATEGORY_CHIPS.map((chip) => (
            <button
              type="button"
              key={chip.key}
              className={`category-chip ${categoryFilter === chip.key ? "active" : ""}`}
              onClick={() => setCategoryFilter(chip.key)}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="grid three">
          <SelectInput label="المنطقة" value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)}>
            <option value="all">كل المناطق</option>
            {areaOptions.map((area) => (
              <option value={area} key={area}>
                {area}
              </option>
            ))}
          </SelectInput>

          <TextInput
            label="بحث بالصالون أو الخدمة"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="مثال: صبغ، تنظيف بشرة، المنصور"
          />

          <SelectInput label="الترتيب" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="nearest">الأقرب (قريباً)</option>
            <option value="top-rated">الأعلى تقييماً</option>
            <option value="most-booked">الأكثر حجزاً</option>
            <option value="newest">الأحدث</option>
          </SelectInput>
        </div>
      </Card>

      {loading ? (
        <section className="explore-grid">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Card className="explore-card" key={`sk-${idx}`}>
              <Skeleton className="skeleton-cover" />
              <Skeleton className="skeleton-line" />
              <Skeleton className="skeleton-line short" />
              <Skeleton className="skeleton-line" />
            </Card>
          ))}
        </section>
      ) : filteredSalons.length === 0 ? (
        <Card>
          <p className="muted">حالياً ماكو صالونات مطابقة للفلتر المختار.</p>
        </Card>
      ) : (
        <section className="explore-grid">
          {filteredSalons.map((salon) => {
            const previewServices = (servicesBySalon[salon.id] || []).slice(0, 3);
            const allServices = servicesBySalon[salon.id] || [];
            const minPrice = allServices.reduce(
              (min, row) => (Number(row.price) < min ? Number(row.price) : min),
              Number.POSITIVE_INFINITY
            );
            const phone = normalizeIraqiPhone(salon.whatsapp || "");
            const hasWhats = isValidE164WithoutPlus(phone);
            const media = getSalonMedia(salon);

            return (
              <article className="explore-card" key={salon.id}>
                <div className="explore-cover-wrap">
                  <SafeImage src={media.cover} alt={salon.name} className="explore-cover" fallbackIcon="✨" />
                  <Badge variant="featured" className="floating-featured">
                    مميز
                  </Badge>
                </div>

                <Card className="explore-card-body">
                  <div className="explore-head">
                    <h3>{salon.name}</h3>
                    <span className="area-badge">{salon.area || "بغداد"}</span>
                  </div>

                  <div className="salon-trust-badges">
                    <Badge variant="neutral">تأكيد سريع</Badge>
                    <Badge variant="neutral">حجز سهل</Badge>
                    {hasWhats ? <Badge variant="featured">واتساب متوفر</Badge> : null}
                  </div>

                  {Number.isFinite(minPrice) ? (
                    <p className="starting-price">يبدأ من {formatCurrencyIQD(minPrice)}</p>
                  ) : null}

                  <div className="mini-services">
                    {previewServices.length === 0 ? (
                      <p className="muted">لا توجد خدمات مفعلة بعد.</p>
                    ) : (
                      previewServices.map((srv) => (
                        <span className="service-tag" key={srv.id}>
                          {srv.name} • {formatCurrencyIQD(srv.price)}
                        </span>
                      ))
                    )}
                  </div>

                  <div className="row-actions">
                    <Button as={Link} to={`/s/${salon.slug}`} variant="primary">
                      احجز الآن
                    </Button>
                    {hasWhats ? (
                      <Button as="a" variant="secondary" href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer">
                        واتساب
                      </Button>
                    ) : null}
                  </div>
                </Card>
              </article>
            );
          })}
        </section>
      )}

      <Toast {...toast} />
    </PageShell>
  );
}
