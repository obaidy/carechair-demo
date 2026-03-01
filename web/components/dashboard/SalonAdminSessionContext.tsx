'use client';

import {createContext, useContext, useMemo, useState} from 'react';

type SalonAdminSessionContextValue = {
  unlocked: boolean;
  setUnlocked: (next: boolean) => void;
};

const SalonAdminSessionContext = createContext<SalonAdminSessionContextValue | null>(null);

export function SalonAdminSessionProvider({children, initialUnlocked = false}: {children: React.ReactNode; initialUnlocked?: boolean}) {
  const [unlocked, setUnlocked] = useState(initialUnlocked);
  const value = useMemo(() => ({unlocked, setUnlocked}), [unlocked]);
  return <SalonAdminSessionContext.Provider value={value}>{children}</SalonAdminSessionContext.Provider>;
}

export function useSalonAdminSession() {
  const ctx = useContext(SalonAdminSessionContext);
  if (!ctx) {
    throw new Error('useSalonAdminSession must be used inside SalonAdminSessionProvider');
  }
  return ctx;
}
