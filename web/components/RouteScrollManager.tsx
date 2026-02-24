'use client';

import {useEffect, useRef} from 'react';
import {usePathname} from 'next/navigation';

export default function RouteScrollManager() {
  const pathname = usePathname();
  const popNavigationRef = useRef(false);

  useEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';

    const scrollTop = () => window.scrollTo({top: 0, left: 0, behavior: 'auto'});
    const onPageShow = () => scrollTop();

    scrollTop();
    window.addEventListener('pageshow', onPageShow);

    return () => {
      window.removeEventListener('pageshow', onPageShow);
      window.history.scrollRestoration = previous;
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
