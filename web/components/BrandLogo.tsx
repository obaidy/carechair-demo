'use client';

import {useState} from 'react';
import {Link} from '@/i18n/navigation';

type BrandLogoProps = {
  href?: string;
  className?: string;
};

export default function BrandLogo({href = '/', className = ''}: BrandLogoProps) {
  const [failed, setFailed] = useState(false);

  return (
    <Link href={href} className={`brand-logo ${className}`.trim()} aria-label="CareChair">
      {!failed ? (
        <img src="/images/brand/carechair-lockup.png" alt="CareChair" onError={() => setFailed(true)} />
      ) : (
        <span className="brand-fallback">CareChair</span>
      )}
    </Link>
  );
}
