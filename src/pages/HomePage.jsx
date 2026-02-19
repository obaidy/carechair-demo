import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Footer from "../components/Footer";
import SafeImage from "../components/SafeImage";
import { Badge, Button, Card, Skeleton } from "../components/ui";
import { getDefaultSalonImages } from "../lib/media";
import { supabase } from "../lib/supabase";
import { isValidE164WithoutPlus, normalizeIraqiPhone } from "../lib/utils";
import "../styles/landing.css";

// TODO: add real screenshots under /public/images/product/
const PRODUCT_SHOTS = [
  {
    key: "admin",
    src: "/images/product/admin.png",
    title: "لوحة الإدارة",
    caption: "كل الحجوزات والحالات بواجهة وحدة واضحة.",
  },
  {
    key: "booking",
    src: "/images/product/booking.png",
    title: "صفحة الحجز",
    caption: "العميلة تختار الخدمة والموعد بثواني.",
  },
  {
    key: "explore",
    src: "/images/product/explore.png",
    title: "الاستكشاف",
    caption: "واجهة احترافية تعرض المراكز وتفاصيلها.",
  },
];

const QUICK_FEATURES = [
  { icon: "🔗", title: "رابط حجز واحد", text: "تنشرين رابط واحد بكل منصاتك." },
  { icon: "🧩", title: "تنظيم الموظفين والخدمات", text: "كل خدمة ويا الموظف المناسب." },
  { icon: "✅", title: "قبول/رفض الحجوزات", text: "قرار سريع بدون ضياع محادثات." },
  { icon: "🕒", title: "ساعات عمل", text: "تتحكمين بالدوام يوم بيوم." },
  { icon: "🖼️", title: "صور للمركز", text: "تعرضين المكان والشغل بشكل جذاب." },
  { icon: "💬", title: "إشعارات (واتساب قريباً)", text: "تنبيهات تساعدك ما يفوت موعد." },
];

const STEPS = [
  { no: "01", title: "نسوي إعداد أولي", text: "خدمات، موظفين، وساعات عمل." },
  { no: "02", title: "نشارك رابط الحجز", text: "على الانستغرام والواتساب." },
  { no: "03", title: "تبدين تستقبلين الحجوزات", text: "وتديرينها من لوحة واضحة." },
];

const FAQS = [
  {
    q: "برنامج لو تطبيق؟",
    a: "يشتغل من الرابط على أي جهاز وما يحتاج تنزيل.",
  },
  {
    q: "ينفتح بأكثر من جهاز؟",
    a: "نعم، تگدرين تفتحينه من موبايل ولابتوب بنفس الوقت.",
  },
  {
    q: "شلون أضيفه بالإنستغرام؟",
    a: "تحطين رابط الحجز بالبايو أو الستوري والعميلات يدخلن مباشرة.",
  },
  {
    q: "شلون يتم تأكيد الحجز؟",
    a: "يوصل الطلب للوحة الإدارة وتقدرين تقبلين أو ترفضين فوراً.",
  },
];

const TESTIMONIALS = [
  "رتبنا المواعيد وخفّت المكالمات.",
  "الحجز صار أسرع وواضح للعميلات.",
  "يوم العمل صار أهدأ وأكثر ترتيب.",
];

export default function HomePage() {
  const [centersCount, setCentersCount] = useState(0);
  const [bookingsThisMonth, setBookingsThisMonth] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);

  const platformWhatsapp = normalizeIraqiPhone(
    import.meta.env.VITE_PLATFORM_WHATSAPP_NUMBER || import.meta.env.VITE_WHATSAPP_NUMBER || ""
  );
  const hasPlatformWhatsapp = isValidE164WithoutPlus(platformWhatsapp);

  const contactMessage = encodeURIComponent(
    "مرحبا، اريد نسخة CareChair لمركزي. ممكن نحجز ديمو سريع؟"
  );
  const whatsappDemoLink = hasPlatformWhatsapp
    ? `https://wa.me/${platformWhatsapp}?text=${contactMessage}`
    : "/explore";

  const heroImage = getDefaultSalonImages("carechair-premium-landing").cover;

  useEffect(() => {
    async function loadStats() {
      if (!supabase) {
        setStatsLoading(false);
        return;
      }

      setStatsLoading(true);
      try {
        const salonsRes = await supabase
          .from("salons")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true);
        if (!salonsRes.error) setCentersCount(salonsRes.count || 0);

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const bookingsRes = await supabase
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .gte("created_at", monthStart);
        if (!bookingsRes.error) setBookingsThisMonth(bookingsRes.count || 0);
      } catch (err) {
        console.error("Landing stats load failed:", err);
      } finally {
        setStatsLoading(false);
      }
    }

    loadStats();
  }, []);

  const socialProofText = useMemo(() => {
    if (centersCount <= 8) return `مراكز بدأت تستخدم CareChair (${centersCount})`;
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

          <Button
            as={hasPlatformWhatsapp ? "a" : Link}
            to={!hasPlatformWhatsapp ? "/explore" : undefined}
            href={hasPlatformWhatsapp ? whatsappDemoLink : undefined}
            target={hasPlatformWhatsapp ? "_blank" : undefined}
            rel={hasPlatformWhatsapp ? "noreferrer" : undefined}
            className="landing-nav-cta"
          >
            احجز ديمو واتساب
          </Button>
        </div>
      </header>

      <main className="landing-main">
        <section className="landing-hero">
          <SafeImage src={heroImage} alt="صورة مركز تجميل" className="landing-hero-bg" fallbackIcon="✨" />
          <div className="landing-hero-overlay" />
          <div className="landing-hero-noise" />

          <div className="landing-hero-content">
            <Badge variant="featured">منصّة حجوزات للصالونات و مراكز التجميل</Badge>
            <h1>حوّل فوضى الواتساب إلى نظام حجوزات مرتب</h1>
            <p>رابط حجز + لوحة إدارة + تذكير واتساب (قريباً) — خلال يوم واحد</p>

            <div className="landing-hero-cta">
              <Button
                as={hasPlatformWhatsapp ? "a" : Link}
                to={!hasPlatformWhatsapp ? "/explore" : undefined}
                href={hasPlatformWhatsapp ? whatsappDemoLink : undefined}
                target={hasPlatformWhatsapp ? "_blank" : undefined}
                rel={hasPlatformWhatsapp ? "noreferrer" : undefined}
              >
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
                <b>{socialProofText}</b>
                <small>{bookingsThisMonth} حجز مسجل هذا الشهر</small>
              </>
            )}
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

        <section className="landing-section">
          <div className="landing-section-head">
            <h2>شوف النظام</h2>
            <p>واجهة حقيقية تبين إن مركزك منظم واحترافي.</p>
          </div>

          <div className="landing-product-grid">
            {PRODUCT_SHOTS.map((shot) => (
              <Card key={shot.key} className="landing-shot-card">
                <div className="device-frame">
                  <div className="device-notch" />
                  <SafeImage
                    src={shot.src}
                    alt={shot.title}
                    className="landing-shot-image"
                    fallbackIcon="🖥️"
                    fallbackText="واجهة المنتج"
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

        <section id="for-centers" className="landing-section">
          <div className="landing-section-head">
            <h2>مميزات سريعة</h2>
            <p>أدوات عملية تخدم يوم المركز من أول حجز لآخر حجز.</p>
          </div>

          <div className="landing-features-grid">
            {QUICK_FEATURES.map((feature) => (
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
            <p>واضحة من البداية ومناسبة للانطلاق.</p>
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
            <p>احجز ديمو سريع وشوف شلون يصير يومك أخف وترتيبك أعلى.</p>
            <div className="landing-final-actions">
              <Button
                as={hasPlatformWhatsapp ? "a" : Link}
                to={!hasPlatformWhatsapp ? "/explore" : undefined}
                href={hasPlatformWhatsapp ? whatsappDemoLink : undefined}
                target={hasPlatformWhatsapp ? "_blank" : undefined}
                rel={hasPlatformWhatsapp ? "noreferrer" : undefined}
              >
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
        <Button
          as={hasPlatformWhatsapp ? "a" : Link}
          to={!hasPlatformWhatsapp ? "/explore" : undefined}
          href={hasPlatformWhatsapp ? whatsappDemoLink : undefined}
          target={hasPlatformWhatsapp ? "_blank" : undefined}
          rel={hasPlatformWhatsapp ? "noreferrer" : undefined}
        >
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

