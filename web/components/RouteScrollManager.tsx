'use client';

import {useEffect, useRef} from 'react';
import {usePathname} from 'next/navigation';

export default function RouteScrollManager() {
  const pathname = usePathname();
  const popNavigationRef = useRef(false);

  useEffect(() => {
    const historyApi = window.history;
    const previous =
      historyApi && typeof historyApi.scrollRestoration === 'string'
        ? historyApi.scrollRestoration
        : null;
    if (historyApi && typeof historyApi.scrollRestoration === 'string') {
      try {
        historyApi.scrollRestoration = 'manual';
      } catch {
        // Ignore browsers/webviews that disallow setting this property.
      }
    }

    const scrollTop = () => window.scrollTo({top: 0, left: 0, behavior: 'auto'});
    const onPageShow = () => scrollTop();

    scrollTop();
    window.addEventListener('pageshow', onPageShow);

    return () => {
      window.removeEventListener('pageshow', onPageShow);
      if (historyApi && typeof historyApi.scrollRestoration === 'string' && previous) {
        try {
          historyApi.scrollRestoration = previous;
        } catch {
          // No-op.
        }
      }
    };
  }, []);

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

    window.scrollTo({top: 0, left: 0, behavior: 'auto'});
  }, [pathname]);

  return null;
}
