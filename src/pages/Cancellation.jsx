import React from "react";
import PageShell from "../components/PageShell";

export default function Cancellation() {
  return (
    <PageShell title="الإلغاء والتعليق" subtitle="ملخص بالعربي وبعدين النص القانوني بالإنكليزي">
      <section className="panel legal-summary">
        <h3>ملخص سريع</h3>
        <ul>
          <li>تكدرين تلغين الاشتراك بأي وقت بدون فترة إشعار.</li>
          <li>الإلغاء يوقف التجديد القادم، مو يقطع الوصول فوراً.</li>
          <li>يبقى عندج وصول لنهاية دورة الدفع الحالية.</li>
          <li>بعد نهاية الدورة، الحساب يصير غير نشط.</li>
          <li>إذا ماكو دفع، النظام يعلّق الحساب تلقائياً.</li>
          <li>نقدر نعلّق الحساب لأسباب أمان أو إساءة استخدام.</li>
          <li>أي نزاع قانوني يخضع لقانون ومحاكم التشيك.</li>
        </ul>
      </section>

      <article className="panel legal-body" dir="ltr">
        <h2>Cancellation + Suspension Policy</h2>
        <p>
          Effective date: February 19, 2026. This policy applies to CareChair, operated by Infraengineering s.r.o.
          (IČO: 24192953), Rybná 716/24, Staré Město, 110 00 Praha, Czech Republic.
        </p>

        <h3>1. Customer Cancellation</h3>
        <p>
          You may cancel your subscription at any time with no mandatory notice period. Cancellation prevents renewal of
          the next billing cycle.
        </p>

        <h3>2. Access After Cancellation</h3>
        <p>
          After cancellation, your access remains active until the end of your already-paid billing period. No pro-rata
          refund applies.
        </p>

        <h3>3. Non-Payment Suspension</h3>
        <p>
          If payment is not successfully collected on time, your account may be suspended automatically. Access can be
          restored after successful settlement, subject to platform checks.
        </p>

        <h3>4. Platform Suspension Rights</h3>
        <p>
          We may suspend or restrict access for fraud risk, legal obligations, security incidents, abuse, or violations
          of Terms of Service.
        </p>

        <h3>5. Data Handling at End of Service</h3>
        <p>
          Following cancellation or suspension, we may retain limited records required for legal, accounting, fraud, and
          dispute purposes. Operational data may be deleted according to retention schedules.
        </p>

        <h3>6. Governing Law and Venue</h3>
        <p>
          This policy is governed by the laws of the Czech Republic. Disputes are subject to competent Czech courts.
        </p>

        <h3>7. Contact</h3>
        <p>
          Infraengineering s.r.o. | IČO: 24192953 | Rybná 716/24, Staré Město, 110 00 Praha, Czech Republic |
          aka.obaidy@gmail.com.
        </p>
      </article>
    </PageShell>
  );
}
