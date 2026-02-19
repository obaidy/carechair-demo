import React from "react";
import PageShell from "../components/PageShell";

export default function Privacy() {
  return (
    <PageShell title="سياسة الخصوصية" subtitle="ملخص بالعربي وبعدين النص القانوني بالإنكليزي">
      <section className="panel legal-summary">
        <h3>ملخص سريع</h3>
        <ul>
          <li>احنا نجمع بيانات ضرورية لإدارة حجوزات الصالون وتشغيل النظام.</li>
          <li>البيانات تشمل معلومات الصالون، الموظفين، الزبائن، والمواعيد.</li>
          <li>نستخدم مزودين مثل Supabase وStripe وMeta WhatsApp وNetlify.</li>
          <li>نلتزم بمبادئ GDPR مثل الشفافية وتقليل البيانات والحق بالوصول.</li>
          <li>ما نبيع بياناتج، ونشاركها فقط للتشغيل أو الالتزام القانوني.</li>
          <li>عندج حق طلب نسخة، تصحيح، أو حذف حسب المتطلبات القانونية.</li>
          <li>أي استفسار خصوصية تواصلين ويانا عبر الإيميل الرسمي.</li>
        </ul>
      </section>

      <article className="panel legal-body" dir="ltr">
        <h2>Privacy Policy (GDPR-Friendly)</h2>
        <p>
          Effective date: February 19, 2026. This Privacy Policy explains how CareChair processes personal data.
          CareChair is operated by Infraengineering s.r.o. (IČO: 24192953), Rybná 716/24, Staré Město, 110 00 Praha,
          Czech Republic. Contact: aka.obaidy@gmail.com. VAT: Not registered.
        </p>

        <h3>1. Roles and Scope</h3>
        <p>
          For salon customer data processed inside salon workspaces, salon operators are generally controllers and
          CareChair acts as processor. For account, billing, security, and platform operations data, CareChair acts as
          controller.
        </p>

        <h3>2. Data We Process</h3>
        <p>
          We may process business contact details, salon profile data, staff records, service configuration, booking
          details, metadata, support communications, and billing records.
        </p>

        <h3>3. Purposes and Legal Bases</h3>
        <p>
          Processing is based on contract performance, legitimate interests (security, service improvement, fraud
          prevention), legal obligations, and consent where required.
        </p>

        <h3>4. Processors and Third Parties</h3>
        <p>
          We use service providers including Stripe (payments), Supabase (EU region database and backend), Meta
          WhatsApp (messaging), and Netlify (hosting/deployment). We use contractual safeguards where appropriate.
        </p>

        <h3>5. International Transfers</h3>
        <p>
          Data may be processed in jurisdictions outside your country depending on provider infrastructure. We aim to
          use EU region hosting where available and apply lawful transfer mechanisms when required.
        </p>

        <h3>6. Data Retention</h3>
        <p>
          We retain data only as long as needed for service delivery, legal compliance, dispute resolution, and
          legitimate business records.
        </p>

        <h3>7. Security</h3>
        <p>
          We implement reasonable technical and organizational controls. No online service can be guaranteed 100%
          secure, but we continuously work to protect data confidentiality, integrity, and availability.
        </p>

        <h3>8. Data Subject Rights</h3>
        <p>
          Subject to applicable law, you may request access, rectification, deletion, restriction, objection, and data
          portability. You may also lodge a complaint with a competent supervisory authority.
        </p>

        <h3>9. Cookies and Analytics</h3>
        <p>
          We may use essential technical cookies and limited analytics needed for functionality, reliability, and abuse
          prevention.
        </p>

        <h3>10. Future Features</h3>
        <p>
          If CareChair launches public listing/explore enhancements or commission-based marketplace features, we may
          update this Policy to describe new data categories and purposes before rollout.
        </p>

        <h3>11. Contact</h3>
        <p>
          Infraengineering s.r.o., Rybná 716/24, Staré Město, 110 00 Praha, Czech Republic, IČO: 24192953,
          aka.obaidy@gmail.com.
        </p>
      </article>
    </PageShell>
  );
}
