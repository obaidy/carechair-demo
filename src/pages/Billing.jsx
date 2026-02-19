import React, { useState } from "react";
import PageShell from "../components/PageShell";

export default function Billing() {
  const [agree, setAgree] = useState(false);

  return (
    <PageShell title="الفوترة والاسترجاع" subtitle="ملخص بالعربي وبعدين النص القانوني بالإنكليزي">
      <section className="panel legal-summary">
        <h3>ملخص سريع</h3>
        <ul>
          <li>ماكو تجربة مجانية حالياً لخدمة CareChair.</li>
          <li>رسوم الإعداد تتراوح بين 300 و 500 دولار وغير قابلة للاسترجاع.</li>
          <li>الاشتراك الشهري بين 30 و 50 دولار ويندفع مقدماً.</li>
          <li>الدفع يتم عبر Stripe، وممكن تصير خصومات حسب الاتفاق.</li>
          <li>ماكو استرجاع للاشتراك بعد إصدار الفاتورة.</li>
          <li>إذا تم الإلغاء، الوصول يبقى لنهاية الفترة المدفوعة فقط.</li>
          <li>تأخير الدفع يسبب تعليق تلقائي للخدمة.</li>
        </ul>
      </section>

      <article className="panel legal-body" dir="ltr">
        <h2>Billing + Refund Policy</h2>
        <p>
          Effective date: February 19, 2026. This Billing Policy applies to CareChair, operated by Infraengineering
          s.r.o. (IČO: 24192953), Rybná 716/24, Staré Město, 110 00 Praha, Czech Republic. Contact:
          aka.obaidy@gmail.com.
        </p>

        <h3>1. Fees and Commercial Structure</h3>
        <p>
          Setup fee: USD 300–500 (one-time) based on implementation scope. Monthly subscription: USD 30–50 billed in
          advance. No free trial. Promotional discounts may apply at Company discretion.
        </p>

        <h3>2. Payment Method and Timing</h3>
        <p>
          Subscription charges are billed in advance through Stripe on the agreed billing cycle. You authorize recurring
          charges for active subscriptions until cancellation.
        </p>

        <h3>3. Refund Rules</h3>
        <p>
          Setup fee is non-refundable. Subscription fees are non-refundable once billed. If you cancel, your access
          remains available until the end of the paid billing period, after which subscription access ends.
        </p>

        <h3>4. Non-Payment and Suspension</h3>
        <p>
          If payment fails or an invoice remains unpaid, CareChair may be suspended automatically until payment is
          settled. We may limit or disable service features during suspension.
        </p>

        <h3>5. Taxes</h3>
        <p>
          VAT status: Not registered. You remain responsible for any local taxes, bank charges, transfer fees, or legal
          charges applicable in your jurisdiction.
        </p>

        <h3>6. Future Billing Models</h3>
        <p>
          If CareChair introduces marketplace/public listing enhancements, we may add commission-based or lead-based
          commercial models. Any new pricing terms will be published before activation.
        </p>

        <h3>7. Contact</h3>
        <p>
          Infraengineering s.r.o., Rybná 716/24, Staré Město, 110 00 Praha, Czech Republic | IČO: 24192953 |
          aka.obaidy@gmail.com.
        </p>
      </article>

      <section className="panel subscription-mock" dir="ltr">
        <h3>Start Subscription (Mock)</h3>
        <p>
          This is a UI mock showing mandatory legal consent before checkout. Connect this block to your real Stripe
          checkout when ready.
        </p>
        <label className="consent-row" dir="ltr">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>
            I agree to the <a href="/terms">Terms of Service</a> and <a href="/privacy">Privacy Policy</a>.
          </span>
        </label>
        <button className="primary-link" disabled={!agree} type="button">
          Start Subscription
        </button>
      </section>
    </PageShell>
  );
}
