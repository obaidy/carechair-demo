import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PageShell from "../components/PageShell";
import SafeImage from "../components/SafeImage";
import Toast from "../components/Toast";
import { Badge, Button, Card, SelectInput, Skeleton, TextInput } from "../components/ui";
import { supabase } from "../lib/supabase";
import { getInitials, getSalonMedia, hashStringToIndex } from "../lib/media";
import {
  formatSalonOperationalCurrency,
  isValidE164WithoutPlus,
  normalizeIraqiPhone,
  sortByOrderThenName,
} from "../lib/utils";
import { useToast } from "../lib/useToast";

export default function ExplorePage() {
  const { t, i18n } = useTranslation();
  const { toast, showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [salons, setSalons] = useState([]);
  const [services, setServices] = useState([]);
  const [areaFilter, setAreaFilter] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const chips = useMemo(
    () => [
      { key: "all", label: t("explore.categories.all"), keywords: [] },
      { key: "haircut", label: t("explore.categories.haircut"), keywords: ["قص", "شعر", "hair", "cut"] },
      { key: "color", label: t("explore.categories.color"), keywords: ["صبغ", "لون", "color"] },
      { key: "nails", label: t("explore.categories.nails"), keywords: ["اظافر", "أظافر", "مانيكير", "باديكير", "nail"] },
      { key: "facial", label: t("explore.categories.facial"), keywords: ["بشرة", "تنظيف", "facial", "skin"] },
      { key: "makeup", label: t("explore.categories.makeup"), keywords: ["مكياج", "ميكاب", "makeup"] },
    ],
    [t]
  );

  useEffect(() => {
    async function loadExplore() {
      if (!supabase) {
        setLoading(false);
        showToast("error", t("errors.supabaseConfigMissing"));
        return;
      }

      setLoading(true);
      try {
        const salonsRes = await supabase
          .from("salons")
          .select("*")
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
        showToast("error", t("explore.errors.loadFailed", { message: err?.message || err }));
      } finally {
        setLoading(false);
      }
    }

    loadExplore();
  }, [showToast, t]);

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
    return Array.from(set).sort((a, b) => String(a).localeCompare(String(b), i18n.language || "en"));
  }, [salons, i18n.language]);

  const filteredSalons = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    const activeCategory = chips.find((x) => x.key === categoryFilter) || chips[0];

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
      return String(a.name || "").localeCompare(String(b.name || ""), i18n.language || "en");
    });
    return sorted;
  }, [salons, servicesBySalon, areaFilter, searchText, categoryFilter, sortBy, i18n.language, chips]);

  const socialProofText =
    salons.length <= 5
      ? t("explore.socialProofEarly", { count: salons.length })
      : t("explore.socialProof", { count: salons.length });

  return (
    <PageShell title={t("common.explore")} subtitle={t("explore.subtitle")}>
      <Card className="explore-social-proof">
        <b>{socialProofText}</b>
      </Card>

      <Card className="explore-hero">
        <div>
          <Badge variant="featured">{t("explore.platformBadge")}</Badge>
          <h2>{t("explore.heroTitle")}</h2>
          <p>{t("explore.heroText")}</p>
        </div>
      </Card>

      <Card>
        <div className="category-chips-wrap">
          {chips.map((chip) => (
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
          <SelectInput label={t("explore.filters.area")} value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)}>
            <option value="all">{t("explore.filters.allAreas")}</option>
            {areaOptions.map((area) => (
              <option value={area} key={area}>
                {area}
              </option>
            ))}
          </SelectInput>

          <TextInput
            label={t("explore.filters.search")}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={t("explore.filters.searchPlaceholder")}
          />

          <SelectInput label={t("explore.filters.sort")} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="nearest">{t("explore.sort.nearest")}</option>
            <option value="top-rated">{t("explore.sort.topRated")}</option>
            <option value="most-booked">{t("explore.sort.mostBooked")}</option>
            <option value="newest">{t("explore.sort.newest")}</option>
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
          <p className="muted">{t("explore.empty")}</p>
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
            const salonActive = Boolean(salon.is_active);

            return (
              <article className="explore-card" key={salon.id}>
                <div className="explore-cover-wrap">
                  <SafeImage src={media.cover} alt={salon.name} className="explore-cover" fallbackIcon="✨" />
                  <Badge variant="featured" className="floating-featured">
                    {t("explore.featured")}
                  </Badge>
                </div>

                <Card className="explore-card-body">
                  <div className="explore-head">
                    <div className="explore-head-main">
                      <SafeImage
                        src={salon.logo_url || ""}
                        alt={`شعار ${salon.name}`}
                        className="explore-logo"
                        fallbackText={getInitials(salon.name)}
                      />
                      <h3>{salon.name}</h3>
                    </div>
                    <span className="area-badge">{salon.area || t("explore.defaultArea")}</span>
                  </div>

                  <div className="salon-trust-badges">
                    <Badge variant="neutral">{t("explore.badges.fastConfirm")}</Badge>
                    <Badge variant="neutral">{t("explore.badges.easyBooking")}</Badge>
                    {hasWhats ? <Badge variant="featured">{t("explore.badges.whatsappAvailable")}</Badge> : null}
                    {!salonActive ? <Badge variant="pending">{t("explore.badges.pendingActivation")}</Badge> : null}
                  </div>

                  {Number.isFinite(minPrice) ? (
                    <p className="starting-price">
                      {t("explore.startingFrom")} {formatSalonOperationalCurrency(minPrice, salon, i18n.language)}
                    </p>
                  ) : null}

                  <div className="mini-services">
                    {previewServices.length === 0 ? (
                      <p className="muted">{t("explore.noServices")}</p>
                    ) : (
                      previewServices.map((srv) => (
                        <span className="service-tag" key={srv.id}>
                          {srv.name} • {formatSalonOperationalCurrency(srv.price, salon, i18n.language)}
                        </span>
                      ))
                    )}
                  </div>

                  <div className="row-actions">
                    <Button
                      as={Link}
                      to={`/s/${salon.slug}`}
                      variant="primary"
                    >
                      {t("explore.bookNow")}
                    </Button>
                    {hasWhats ? (
                      <Button as="a" variant="secondary" href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer">
                        {t("common.whatsapp")}
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
