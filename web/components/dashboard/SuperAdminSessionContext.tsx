'use client';

import {createContext, useContext, useMemo, useState} from 'react';

type SuperAdminSessionContextValue = {
  unlocked: boolean;
  setUnlocked: (next: boolean) => void;
};

const SuperAdminSessionContext = createContext<SuperAdminSessionContextValue | null>(null);

export function SuperAdminSessionProvider({children}: {children: React.ReactNode}) {
  const [unlocked, setUnlocked] = useState(false);
  const value = useMemo(() => ({unlocked, setUnlocked}), [unlocked]);
  return <SuperAdminSessionContext.Provider value={value}>{children}</SuperAdminSessionContext.Provider>;
}

export function useSuperAdminSession() {
  const ctx = useContext(SuperAdminSessionContext);
  if (!ctx) {
    throw new Error('useSuperAdminSession must be used inside SuperAdminSessionProvider');
  }
  return ctx;
}
