import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Footer from "../components/Footer";
import SafeImage from "../components/SafeImage";
import { Badge, Button, Card } from "../components/ui";
import { getDefaultGallery, getDefaultSalonImages } from "../lib/media";
import { supabase } from "../lib/supabase";
import { isValidE164WithoutPlus, normalizeIraqiPhone } from "../lib/utils";
import "../styles/landing.css";

const PRODUCT_SHOTS = [
  {
    key: "admin",
    src: "/images/product/admin.png",
    title: "لوحة الإدارة",
    caption: "تشوف الحجوزات وتقبل/ترفض بسرعة.",
  },
  {
    key: "booking",
    src: "/images/product/booking.png",
    title: "رابط الحجز",
    caption: "العميلة تختار الخدمة والوقت بخطوات قصيرة.",
  },
  {
    key: "explore",
    src: "/images/product/explore.png",
    title: "إدارة الموظفين والخدمات",
    caption: "تنظيم كامل للخدمات والموظفين وساعات الدوام.",
  },
];

const FEATURES = [
  { icon: "🔗", title: "رابط حجز واحد", text: "كل الحجوزات تجي من رابط واضح وسهل." },
  { icon: "🧩", title: "تنظيم الموظفين والخدمات", text: "كل خدمة مربوطة بالموظف المناسب." },
  { icon: "✅", title: "قبول/رفض الحجوزات", text: "تحكم سريع بطلبات الحجز من نفس الشاشة." },
  { icon: "🕒", title: "ساعات عمل", text: "تحدد أيام وأوقات الدوام بدقة." },
  { icon: "🖼️", title: "صور للمركز", text: "تعرضين شغلج وصور المكان بشكل احترافي." },
  { icon: "💬", title: "إشعارات (واتساب قريباً)", text: "إشعارات ذكية حتى ما يضيع أي موعد." },
];

const FAQS = [
  {
    q: "برنامج لو تطبيق؟",
    a: "نظام ويب يفتح كرابط، ما يحتاج تنزيل تطبيق.",
  },
  {
    q: "ينفتح بأكثر من جهاز؟",
    a: "نعم، يشتغل على الموبايل واللابتوب بنفس الوقت.",
  },
  {
    q: "شلون أضيفه بالإنستغرام؟",
    a: "تحطين رابط الحجز بالبايو، والعميلات يحجزن مباشرة.",
  },
  {
    q: "شلون يتم تأكيد الحجز؟",
    a: "يوصل الطلب للوحة الإدارة، وتقدرين تقبلين أو ترفضين فوراً.",
  },
];

const TESTIMONIALS = [
  "رتبنا المواعيد وخفّت المكالمات.",
  "الحجوزات صارت أوضح للموظفات والعميلات.",
  "الرابط وحده خلّى الحجز أسرع واكثر ترتيب.",
];

export default function HomePage() {
  const [centersCount, setCentersCount] = useState(null);
  const [bookingsThisMonth, setBookingsThisMonth] = useState(null);

  const platformWhatsapp = normalizeIraqiPhone(import.meta.env.VITE_WHATSAPP_NUMBER || "");
  const hasPlatformWhatsapp = isValidE164WithoutPlus(platformWhatsapp);

  const contactMessage = encodeURIComponent(
    "مرحبا، اريد نسخة CareChair لمركزي. ممكن نحجز ديمو سريع؟"
  );

  const heroImage = getDefaultSalonImages("carechair-landing").cover;
  const heroGallery = getDefaultGallery("carechair-landing").slice(0, 3);

  useEffect(() => {
    async function loadStats() {
      if (!supabase) return;

      try {
        const salonsRes = await supabase
          .from("salons")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true);

        if (!salonsRes.error) {
          setCentersCount(salonsRes.count || 0);
        }

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const bookingsRes = await supabase
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .gte("created_at", monthStart);

        if (!bookingsRes.error) {
          setBookingsThisMonth(bookingsRes.count || 0);
        }
      } catch (err) {
        // Keep the page conversion-focused even if stats fail.
        console.error("Landing stats load failed:", err);
      }
    }

    loadStats();
  }, []);

  const proofLine = useMemo(() => {
    if (centersCount == null) return "مراكز بدأت تستخدم CareChair لتنظيم المواعيد";
    if (centersCount <= 8) return `مراكز بدأت تستخدم CareChair لتنظيم المواعيد (${centersCount})`;
    return `مراكز تستخدم CareChair لتنظيم المواعيد (${centersCount})`;
  }, [centersCount]);

  return (
    <div className="landing-page" dir="rtl">
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <Link className="landing-logo" to="/">
            CareChair
          </Link>

          <nav className="landing-links" aria-label="روابط الصفحة">
            <Link to="/explore">استكشف</Link>
            <a href="#for-centers">للمراكز</a>
            <a href="#pricing">الأسعار</a>
            <a href="#faq">الأسئلة</a>
          </nav>

          {hasPlatformWhatsapp ? (
            <Button
              as="a"
              href={`https://wa.me/${platformWhatsapp}?text=${contactMessage}`}
              target="_blank"
              rel="noreferrer"
              className="landing-nav-cta"
            >
              احجز ديمو واتساب
            </Button>
          ) : (
            <Button as={Link} to="/explore" className="landing-nav-cta">
              استعرض المراكز
            </Button>
          )}
        </div>
      </header>

      <main className="landing-main">
        <section className="landing-hero">
          <SafeImage
            src={heroImage}
            alt="صورة مركز تجميل"
            className="landing-hero-bg"
            fallbackIcon="✨"
          />
          <div className="landing-hero-overlay" />
          <div className="landing-hero-noise" />

          <div className="landing-hero-content">
            <Badge variant="featured">منصّة حجوزات للصالونات في العراق</Badge>
            <h1>حوّل فوضى الواتساب إلى نظام حجوزات مرتب</h1>
            <p>رابط حجز + لوحة إدارة + تذكير واتساب (قريباً) — خلال يوم واحد</p>

            <div className="landing-hero-cta">
              {hasPlatformWhatsapp ? (
                <Button
                  as="a"
                  href={`https://wa.me/${platformWhatsapp}?text=${contactMessage}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  اطلب نسخة لمركزك
                </Button>
              ) : (
                <Button as={Link} to="/explore">
                  استعرض المراكز
                </Button>
              )}
              <Button as={Link} to="/explore" variant="secondary">
                استعرض المراكز
              </Button>
            </div>

            <div className="landing-chips">
              <span>بدون تطبيق</span>
              <span>يفتح على كل الأجهزة</span>
              <span>إلغاء بأي وقت</span>
              <span>تركيب سريع</span>
            </div>
          </div>

          <div className="landing-hero-gallery">
            {heroGallery.map((img, idx) => (
              <SafeImage
                key={`${img}-${idx}`}
                src={img}
                alt={`معاينة ${idx + 1}`}
                className="landing-hero-thumb"
                fallbackIcon="🌸"
              />
            ))}
          </div>
        </section>

        <section className="landing-proof">
          <Card className="landing-proof-head">
            <b>{proofLine}</b>
            <small>
              {bookingsThisMonth != null
                ? `${bookingsThisMonth} حجز مسجل هذا الشهر`
                : "نساعد المراكز تبدأ الحجز المنظم بسرعة"}
            </small>
          </Card>

          <div className="landing-testimonials">
            {TESTIMONIALS.map((text, idx) => (
              <Card key={idx} className="landing-testimonial">
                <p>{text}</p>
                <span>مركز تجميل — بغداد</span>
              </Card>
            ))}
          </div>
        </section>

        <section id="for-centers" className="landing-section">
          <div className="landing-section-head">
            <h2>واجهة تبين إن عندكم نظام حقيقي</h2>
            <p>صور حقيقية، تجربة حجز سريعة، وإدارة مرتبة داخل المركز.</p>
          </div>

          <div className="landing-product-grid">
            {PRODUCT_SHOTS.map((shot) => (
              <Card key={shot.key} className="landing-shot-card">
                <SafeImage
                  src={shot.src}
                  alt={shot.title}
                  className="landing-shot-image"
                  fallbackIcon="🖥️"
                />
                <div className="landing-shot-meta">
                  <b>{shot.title}</b>
                  <p>{shot.caption}</p>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section className="landing-section">
          <div className="landing-section-head">
            <h2>كل اللي تحتاجه لإدارة المركز</h2>
            <p>أدوات يومية واضحة، مو تعقيد.</p>
          </div>
          <div className="landing-features-grid">
            {FEATURES.map((feature) => (
              <Card key={feature.title} className="landing-feature">
                <span className="feature-icon">{feature.icon}</span>
                <div>
                  <b>{feature.title}</b>
                  <p>{feature.text}</p>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section id="pricing" className="landing-section">
          <div className="landing-section-head">
            <h2>الأسعار</h2>
            <p>واضحة من البداية وبدون مفاجآت.</p>
          </div>

          <div className="landing-pricing-grid">
            <Card className="landing-price-card">
              <span className="price-label">تشغيل للمركز</span>
              <h3>$300–$500</h3>
              <p>مرة واحدة (غير مسترجع)</p>
            </Card>
            <Card className="landing-price-card">
              <span className="price-label">اشتراك شهري</span>
              <h3>$30–$50</h3>
              <p>/ شهر</p>
            </Card>
          </div>

          <Card className="landing-pricing-notes">
            <ul>
              <li>إلغاء بأي وقت</li>
              <li>الدعم متوفر</li>
              <li>الاشتراك يبقى فعال لحد نهاية الشهر المدفوع</li>
            </ul>
          </Card>
        </section>

        <section id="faq" className="landing-section">
          <div className="landing-section-head">
            <h2>الأسئلة الشائعة</h2>
          </div>
          <div className="landing-faq-grid">
            {FAQS.map((item) => (
              <Card key={item.q} className="landing-faq-item">
                <b>{item.q}</b>
                <p>{item.a}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="landing-final-cta">
          <Card className="landing-final-card">
            <h2>جاهز نخلي مركزك يستقبل حجوزات مرتبّة؟</h2>
            <p>نرتبها وياك بخطوات سريعة، وتبدين تستقبلين حجوزات من نفس اليوم.</p>
            <div className="landing-final-actions">
              {hasPlatformWhatsapp ? (
                <Button
                  as="a"
                  href={`https://wa.me/${platformWhatsapp}?text=${contactMessage}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  احجز ديمو 5 دقائق
                </Button>
              ) : (
                <Button as={Link} to="/explore">
                  استعرض المراكز
                </Button>
              )}
              <Button as={Link} to="/explore" variant="secondary">
                استعرض المراكز
              </Button>
            </div>
          </Card>
        </section>
      </main>

      <Footer />
    </div>
  );
}

