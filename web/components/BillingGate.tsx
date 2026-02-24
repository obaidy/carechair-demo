'use client';

import {useEffect} from 'react';
import {useParams} from 'next/navigation';
import {useRouter} from '@/i18n/navigation';
import {Button, Card} from '@/components/ui';
import {useTx} from '@/lib/messages-client';
import {deriveSalonAccess} from '@/lib/billing';

export default function BillingGate({
  salon,
  module,
  children
}: {
  salon: any;
  module: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const params = useParams<{slug?: string | string[]}>();
  const tx = useTx();
  const slugRaw = params?.slug;
  const slug = Array.isArray(slugRaw) ? slugRaw[0] : slugRaw;

  const t = (key: string, fallback: string) => tx(key, fallback);
  const access = deriveSalonAccess(salon, new Date(), t);

  useEffect(() => {
    if (!salon || !slug) return;
    if (module === 'billing') return;
    if (access.fullAccess) return;
    router.replace(`/s/${encodeURIComponent(String(slug))}/admin/billing` as any);
  }, [salon, slug, module, access.fullAccess, router]);

  if (module !== 'billing' && !access.fullAccess) {
    return (
      <Card className="billing-warning-box">
        <b>{t('billingGate.lockedTitle', 'Account locked')}</b>
        <p>{access.lockMessage || t('billingGate.lockedText', 'Your account is not active. Please complete trial/subscription setup in billing.')}</p>
        <Button type="button" onClick={() => router.push(`/s/${encodeURIComponent(String(slug || ''))}/admin/billing` as any)}>
          {t('billingGate.openBilling', 'Open billing')}
        </Button>
      </Card>
    );
  }

  return <>{children}</>;
}
