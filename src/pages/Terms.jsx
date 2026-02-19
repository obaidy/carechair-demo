import React from "react";
import PageShell from "../components/PageShell";

export default function Terms() {
  return (
    <PageShell title="شروط الخدمة" subtitle="ملخص بالعربي وبعدين النص القانوني بالإنكليزي">
      <section className="panel legal-summary">
        <h3>ملخص سريع</h3>
        <ul>
          <li>CareChair منصة حجوزات للصالونات، وتشغّلها شركة Infraengineering s.r.o.</li>
          <li>الخدمة موجهة للأعمال (B2B) مو للاستخدام الشخصي.</li>
          <li>رسوم الإعداد مرة وحدة وغير قابلة للاسترجاع.</li>
          <li>الاشتراك الشهري ينحسب مقدماً، وتكدرين توقفينه بأي وقت.</li>
          <li>بالإلغاء، يبقى الوصول لنهاية الدورة المدفوعة فقط.</li>
          <li>إذا ماكو دفع، الحساب يتعلّق تلقائياً لحين تسوية الفاتورة.</li>
          <li>المرجعية القانونية هي قانون جمهورية التشيك ومحاكمها.</li>
        </ul>
      </section>

      <article className="panel legal-body" dir="ltr">
        <h2>Terms of Service</h2>
        <p>
          Effective date: February 19, 2026. These Terms govern your access to and use of CareChair, a SaaS booking
          system for salons. CareChair is operated by Infraengineering s.r.o. (IČO: 24192953), Rybná 716/24, Staré
          Město, 110 00 Praha, Czech Republic ("Company", "we", "us"). Contact: aka.obaidy@gmail.com.
        </p>

        <h3>1. Scope and Eligibility</h3>
        <p>
          CareChair is a business-to-business software service intended for salon operators and their authorized staff.
          By using the service, you confirm that you are entering these Terms on behalf of a business.
        </p>

        <h3>2. Service Description</h3>
        <p>
          CareChair provides booking workflows, scheduling tools, salon profile controls, and communication workflows,
          including integrations with third-party providers. We may improve, modify, or expand features over time.
        </p>

        <h3>3. Account and Access</h3>
        <p>
          You are responsible for protecting your admin passcodes, credentials, and internal user access. You are
          responsible for all actions taken through your account and salon workspace.
        </p>

        <h3>4. Acceptable Use</h3>
        <p>
          You must use CareChair lawfully and may not abuse, interfere with, reverse engineer, or attempt unauthorized
          access to the service, data, infrastructure, or connected systems.
        </p>

        <h3>5. Third-Party Services</h3>
        <p>
          CareChair depends on third-party infrastructure and APIs, including Stripe, Supabase (EU region), Meta
          WhatsApp, and Netlify. Availability of certain features may depend on these providers.
        </p>

        <h3>6. Billing and Commercial Terms</h3>
        <p>
          Fees, payment timing, and refund rules are defined in our Billing + Refund Policy, which forms part of these
          Terms. By subscribing, you agree to those billing conditions.
        </p>

        <h3>7. Future Platform Features</h3>
        <p>
          We may introduce marketplace-style features in the future, including public listing/explore visibility,
          lead-based models, and potential commission structures. If such features are launched, additional commercial
          terms may apply and will be published in advance.
        </p>

        <h3>8. Disclaimer</h3>
        <p>
          The service is provided on an "as is" and "as available" basis. To the extent permitted by law, we disclaim
          implied warranties including merchantability, fitness for a particular purpose, and non-infringement.
        </p>

        <h3>9. Limitation of Liability</h3>
        <p>
          To the maximum extent permitted by law, Company liability arising from or related to CareChair is limited to
          the total fees paid by you in the three (3) months preceding the event giving rise to liability. We are not
          liable for indirect, incidental, special, consequential, or lost-profit damages.
        </p>

        <h3>10. Suspension and Termination</h3>
        <p>
          We may suspend access for non-payment, abuse, legal risk, or security threats. You may cancel anytime per the
          Cancellation Policy. Upon termination, access ends according to the applicable billing cycle.
        </p>

        <h3>11. Governing Law and Jurisdiction</h3>
        <p>
          These Terms are governed by the laws of the Czech Republic. Any dispute shall be subject to the competent
          courts of the Czech Republic.
        </p>

        <h3>12. Company Details</h3>
        <p>
          Legal entity: Infraengineering s.r.o. | VAT: Not registered. Registered office: Rybná 716/24, Staré Město,
          110 00 Praha, Czech Republic. Contact: aka.obaidy@gmail.com.
        </p>
      </article>
    </PageShell>
  );
}
