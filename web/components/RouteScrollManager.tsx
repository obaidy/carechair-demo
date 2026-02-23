'use client';

import {useEffect, useRef} from 'react';
import {usePathname} from 'next/navigation';

export default function RouteScrollManager() {
  const pathname = usePathname();
  const popNavigationRef = useRef(false);

  useEffect(() => {
    const onPopState = () => {
      popNavigationRef.current = true;
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (popNavigationRef.current) {
      popNavigationRef.current = false;
      return;
    }

    window.scrollTo({top: 0, behavior: 'auto'});
  }, [pathname]);

  return null;
}
