'use client';

import {useState} from 'react';
import {Link} from '@/i18n/navigation';

type BrandLogoProps = {
  to?: string;
  compact?: boolean;
  className?: string;
};

export default function BrandLogo({to = '/', compact = false, className = ''}: BrandLogoProps) {
  const [markFailed, setMarkFailed] = useState(false);
  const [lockupFailed, setLockupFailed] = useState(false);

  if (compact) {
    return (
      <Link href={to as any} className={`brand-logo compact ${className}`.trim()} aria-label="CareChair">
        {!markFailed ? (
          <img src="/images/brand/carechair-mark.png" alt="CareChair" onError={() => setMarkFailed(true)} />
        ) : (
          <span className="brand-fallback-mark">C</span>
        )}
      </Link>
    );
  }

  return (
    <Link href={to as any} className={`brand-logo ${className}`.trim()} aria-label="CareChair">
      {!lockupFailed ? (
        <img src="/images/brand/carechair-lockup.png" alt="CareChair" onError={() => setLockupFailed(true)} />
      ) : (
        <span className="brand-fallback-inline">
          {!markFailed ? (
            <img src="/images/brand/carechair-mark.png" alt="CareChair" onError={() => setMarkFailed(true)} />
          ) : (
            <span className="brand-fallback-mark">C</span>
          )}
          <span className="brand-fallback-text">CareChair</span>
        </span>
      )}
    </Link>
  );
}
