import {create} from 'zustand';
import type {AuthSession, OwnerContext} from '../types/models';
import type {Membership} from '../api/invites';

type AuthState = {
  session: AuthSession | null;
  context: OwnerContext | null;
  memberships: Membership[];
  activeSalonId: string | null;
  pendingJoinToken: string | null;
  pendingPhone: string;
  bootstrapError: string | null;
  hydrated: boolean;
  setSession: (session: AuthSession | null) => void;
  setContext: (context: OwnerContext | null) => void;
  setMemberships: (memberships: Membership[]) => void;
  setActiveSalonId: (salonId: string | null) => void;
  setPendingJoinToken: (token: string | null) => void;
  setPendingPhone: (phone: string) => void;
  setBootstrapError: (message: string | null) => void;
  setHydrated: (hydrated: boolean) => void;
  clear: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  context: null,
  memberships: [],
  activeSalonId: null,
  pendingJoinToken: null,
  pendingPhone: '',
  bootstrapError: null,
  hydrated: false,
  setSession: (session) => set({session}),
  setContext: (context) => set({context}),
  setMemberships: (memberships) => set({memberships}),
  setActiveSalonId: (activeSalonId) => set({activeSalonId}),
  setPendingJoinToken: (pendingJoinToken) => set({pendingJoinToken}),
  setPendingPhone: (pendingPhone) => set({pendingPhone}),
  setBootstrapError: (bootstrapError) => set({bootstrapError}),
  setHydrated: (hydrated) => set({hydrated}),
  clear: () =>
    set({
      session: null,
      context: null,
      memberships: [],
      activeSalonId: null,
      pendingJoinToken: null,
      pendingPhone: '',
      bootstrapError: null,
      hydrated: true
    })
}));
