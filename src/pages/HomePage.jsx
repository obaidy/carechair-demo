import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import BrandLogo from "../components/BrandLogo";
import Footer from "../components/Footer";
import SafeImage from "../components/SafeImage";
import { Badge, Button, Card, Skeleton } from "../components/ui";
import { getDefaultGallery, getDefaultSalonImages } from "../lib/media";
import { supabase } from "../lib/supabase";
import "../styles/landing.css";

const PLATFORM_WHATSAPP_LINK =
  "https://wa.me/9647700603080?text=%D9%85%D8%B1%D8%AD%D8%A8%D8%A7%20%D8%A7%D8%B1%D9%8A%D8%AF%20%D8%A7%D8%B9%D8%B1%D9%81%20%D8%A7%D9%83%D8%AB%D8%B1%20%D8%B9%D9%86%20CareChair%20%D9%84%D9%85%D8%B1%D9%83%D8%B2%D9%8A";

const PRODUCT_SHOTS = [
  {
    key: "admin",
    src: "/images/product/mock-admin-dashboard.webp",
    title: "لوحة الإدارة",
    caption: "حالة الحجوزات، القبول والرفض، وكل شي واضح.",
  },
  {
    key: "booking",
    src: "/images/product/mock-booking-mobile.webp",
    title: "صفحة الحجز",
    caption: "تجربة سريعة للعميلة من أول ضغطه.",
  },
  {
    key: "explore",
    src: "/images/product/mock-explore-marketplace.webp",
    title: "الاستكشاف",
    caption: "واجهة حديثة تعرض المراكز بطريقة احترافية.",
  },
];

const PROMISE_BULLETS = [
  "نضيف الخدمات والأسعار",
  "نرتب الموظفين",
  "نحدد ساعات العمل",
  "نسلمك رابط حجز جاهز",
];

const FEATURES = [
  { icon: "🔗", title: "رابط حجز واحد", text: "رابط واضح لكل منصاتك." },
  { icon: "🧩", title: "تنظيم الموظفين والخدمات", text: "توزيع ذكي لكل خدمة." },
  { icon: "✅", title: "قبول/رفض الحجوزات", text: "تأكيد سريع من لوحة الإدارة." },
  { icon: "🕒", title: "ساعات عمل", text: "تتحكم بالدوام حسب أيام الأسبوع." },
  { icon: "🖼️", title: "صور للمركز", text: "تعرض الشغل والمكان بشكل جذاب." },
  { icon: "💬", title: "إشعارات (واتساب قريباً)", text: "تنبيهات أسهل لتنظيم اليوم." },
];

const STEPS = [
  { no: "1", title: "إعداد المركز", text: "الخدمات، الموظفين، وساعات العمل." },
  { no: "2", title: "نشر رابط الحجز", text: "بالإنستغرام، الواتساب، والبايو." },
  { no: "3", title: "بدء الحجوزات", text: "طلبات مرتبة وقرارات أسرع." },
];

const FAQS = [
  { q: "برنامج لو تطبيق؟", a: "يشتغل من الرابط على أي جهاز." },
  { q: "ينفتح بأكثر من جهاز؟", a: "نعم، موبايل + لابتوب بنفس الوقت." },
  { q: "شلون أضيف رابط الحجز بالإنستغرام؟", a: "ينضاف مباشرة بالبايو والستوري." },
  { q: "شلون يتم تأكيد الحجز؟", a: "من لوحة الإدارة: قبول أو رفض فوراً." },
];

const TESTIMONIALS = [
  "رتبنا المواعيد وخفّت المكالمات.",
  "الحجز صار أسرع للعميلات.",
  "يوم المركز صار منظم وواضح.",
];

export default function HomePage() {
  const [statsLoading, setStatsLoading] = useState(true);
  const [centersCount, setCentersCount] = useState(0);
  const [bookingsThisMonth, setBookingsThisMonth] = useState(0);

  const heroFallback = getDefaultSalonImages("carechair-home").cover;
  const showcaseFallbacks = getDefaultGallery("carechair-showcase").slice(0, 3);

  useEffect(() => {
    async function loadStats() {
      if (!supabase) {
        setStatsLoading(false);
        return;
      }

      setStatsLoading(true);
      try {
        const [salonsRes, bookingsRes] = await Promise.all([
          supabase.from("salons").select("id", { count: "exact", head: true }).eq("is_active", true),
          supabase
            .from("bookings")
            .select("id", { count: "exact", head: true })
            .gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
        ]);

        if (!salonsRes.error) setCentersCount(salonsRes.count || 0);
        if (!bookingsRes.error) setBookingsThisMonth(bookingsRes.count || 0);
      } catch (err) {
        console.error("landing stats error", err);
      } finally {
        setStatsLoading(false);
      }
    }

    loadStats();
  }, []);

  const socialText = useMemo(() => {
    if (centersCount <= 8) return `عدد المراكز المسجله معنا (${centersCount})`;
    return `مراكز تستخدم CareChair لتنظيم المواعيد (${centersCount})`;
  }, [centersCount]);

  return (
    <div className="landing-page" dir="rtl">
      <header className="landing-nav">
        <div className="landing-nav-inner cc-container">
          <BrandLogo className="landing-logo-main" />

          <nav className="landing-links" aria-label="روابط الصفحة">
            <Link to="/explore">استكشف</Link>
            <a href="#for-centers">للمراكز</a>
            <a href="#pricing">الأسعار</a>
            <a href="#faq">الأسئلة</a>
          </nav>

          <Button as="a" href={PLATFORM_WHATSAPP_LINK} target="_blank" rel="noreferrer" className="landing-nav-cta">
            ديمو واتساب
          </Button>
        </div>
      </header>

      <main className="landing-main cc-container">
        <section className="landing-hero">
          <SafeImage
            src="/images/hero/hero-salon-baghdad-01.webp"
            alt="صالون في بغداد"
            className="landing-hero-bg"
            fallbackIcon="✨"
            style={{ backgroundImage: `url('${heroFallback}')` }}
          />
          <div className="landing-hero-overlay" />
          <div className="landing-hero-noise" />

          <div className="landing-hero-content">
            <Badge variant="featured">منصّة حجوزات للصالونات و مراكز التجميل</Badge>
            <h1>حوّل فوضى الواتساب إلى نظام حجوزات مرتب</h1>
            <p>رابط حجز + لوحة إدارة + تذكير واتساب (قريباً) — خلال يوم واحد</p>

            <div className="landing-hero-cta">
              <Button as="a" href={PLATFORM_WHATSAPP_LINK} target="_blank" rel="noreferrer">
                اطلب نسخة لمركزك
              </Button>
              <Button as={Link} to="/explore" variant="secondary">
                استعرض المراكز
              </Button>
            </div>

            <div className="landing-proof-inline">
              <span>يفتح على أكثر من جهاز</span>
              <span>ترتيب المواعيد</span>
              <span>إلغاء بأي وقت</span>
            </div>
          </div>
        </section>

        <section className="landing-proof">
          <Card className="landing-proof-head">
            {statsLoading ? (
              <div className="landing-proof-skeleton">
                <Skeleton className="skeleton-line" />
                <Skeleton className="skeleton-line short" />
              </div>
            ) : (
              <>
                <b>{socialText}</b>
                <small>{bookingsThisMonth} حجز مسجل هذا الشهر</small>
              </>
            )}
          </Card>

          <div className="landing-testimonials">
            {TESTIMONIALS.map((line, idx) => (
              <Card className="landing-testimonial" key={idx}>
                <p>{line}</p>
                <span>مركز تجميل — بغداد</span>
              </Card>
            ))}
          </div>
        </section>

        <section id="for-centers" className="landing-section landing-promise">
          <div className="landing-section-head">
            <h2>للمراكز — نجهز مركزك خلال يوم واحد</h2>
          </div>

          <div className="landing-promise-grid">
            <Card className="landing-promise-card">
              <ul>
                {PROMISE_BULLETS.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </Card>

            <Card className="landing-promise-image-card">
              <SafeImage
                src="/images/sections/owner-tablet.webp"
                alt="صاحب مركز يستخدم التابلت"
                className="landing-promise-image"
                fallbackIcon="📱"
              />
            </Card>
          </div>
        </section>

        <section className="landing-section">
          <div className="landing-section-head">
            <h2>شوف النظام</h2>
          </div>

          <div className="landing-product-grid">
            {PRODUCT_SHOTS.map((shot, idx) => (
              <Card key={shot.key} className="landing-shot-card">
                <div className="device-frame">
                  <div className="device-notch" />
                  <SafeImage
                    src={shot.src}
                    alt={shot.title}
                    className="landing-shot-image"
                    fallbackIcon="🖥️"
                    style={{ backgroundImage: `url('${showcaseFallbacks[idx] || showcaseFallbacks[0]}')` }}
                  />
                </div>
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
            <h2>شلون يشتغل؟</h2>
          </div>
          <div className="landing-steps-modern">
            {STEPS.map((step) => (
              <article key={step.no} className="landing-step-pill">
                <span>{step.no}</span>
                <div>
                  <b>{step.title}</b>
                  <p>{step.text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section">
          <div className="landing-section-head">
            <h2>مميزات سريعة</h2>
          </div>

          <div className="landing-features-grid">
            {FEATURES.map((feature) => (
              <Card className="landing-feature" key={feature.title}>
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
          </div>

          <div className="landing-pricing-grid">
            <Card className="landing-price-card">
              <span className="price-label">تشغيل أول مرة</span>
              <h3>$300–$500</h3>
              <p>مرة واحدة، غير مسترجعة</p>
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
            <Button as="a" href={PLATFORM_WHATSAPP_LINK} target="_blank" rel="noreferrer" className="pricing-cta-btn">
              تواصل معنا على واتساب
            </Button>
          </Card>
        </section>

        <section className="landing-section">
          <Card className="landing-future-app">
            <div className="future-icon">📲</div>
            <div>
              <h3>قريباً تطبيق للعملاء</h3>
              <p>بعد ما يكبر عدد المراكز، راح نطلق تطبيق لاكتشاف المراكز والحجز بسهولة.</p>
            </div>
          </Card>
        </section>

        <section id="faq" className="landing-section">
          <div className="landing-section-head">
            <h2>الأسئلة الشائعة</h2>
          </div>
          <div className="landing-faq-grid">
            {FAQS.map((item) => (
              <Card className="landing-faq-item" key={item.q}>
                <b>{item.q}</b>
                <p>{item.a}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="landing-final-cta">
          <Card className="landing-final-card">
            <h2>جاهز نخلي مركزك يستقبل حجوزات مرتبّة؟</h2>
            <p>نجهز النظام وياك بسرعة وتبدي تستقبل حجوزاتك بثقة.</p>
            <div className="landing-final-actions">
              <Button as="a" href={PLATFORM_WHATSAPP_LINK} target="_blank" rel="noreferrer">
                احجز ديمو 5 دقائق
              </Button>
              <Button as={Link} to="/explore" variant="secondary">
                استعرض المراكز
              </Button>
            </div>
          </Card>
        </section>
      </main>

      <div className="mobile-sticky-cta">
        <Button as="a" href={PLATFORM_WHATSAPP_LINK} target="_blank" rel="noreferrer">
          احجز ديمو واتساب
        </Button>
        <Button as={Link} to="/explore" variant="secondary">
          استعرض المراكز
        </Button>
      </div>

      <Footer />
    </div>
  );
}
