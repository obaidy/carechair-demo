'use client';

import {useEffect} from 'react';
import {createPortal} from 'react-dom';

type MobileDrawerProps = {
  open: boolean;
  onClose?: () => void;
  title?: string;
  children: React.ReactNode;
  id?: string;
  className?: string;
};

export default function MobileDrawer({
  open,
  onClose,
  title = 'Menu',
  children,
  id,
  className = ''
}: MobileDrawerProps) {
  const direction = typeof document !== 'undefined' ? document.documentElement.getAttribute('dir') || 'ltr' : 'ltr';

  useEffect(() => {
    if (!open || typeof window === 'undefined') return undefined;
    const prevOverflow = document.body.style.overflow || '';
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose?.();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onEsc);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onEsc);
    };
  }, [open, onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div className={`cc-mobile-drawer-backdrop${open ? ' open' : ''}`} onClick={() => onClose?.()} aria-hidden={!open} />
      <aside
        id={id}
        className={`cc-mobile-drawer-panel${open ? ' open' : ''}${className ? ` ${className}` : ''}`}
        dir={direction}
        aria-hidden={!open}
        role="dialog"
        aria-modal="true"
      >
        <header className="cc-mobile-drawer-header">
          <h3>{title}</h3>
          <button type="button" className="cc-mobile-drawer-close" onClick={() => onClose?.()} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="cc-mobile-drawer-body">{children}</div>
      </aside>
    </>,
    document.body
  );
}
