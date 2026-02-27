import {useCallback} from 'react';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {api} from './index';
import {qk} from './queryKeys';
import {useAuthStore} from '../state/authStore';
import {hydrateAuthState, logoutSession} from '../auth/session';

export function useBootstrapAuth() {
  const setSession = useAuthStore((state) => state.setSession);
  const setContext = useAuthStore((state) => state.setContext);
  const setMemberships = useAuthStore((state) => state.setMemberships);
  const setActiveSalonId = useAuthStore((state) => state.setActiveSalonId);
  const setPendingJoinToken = useAuthStore((state) => state.setPendingJoinToken);
  const setHydrated = useAuthStore((state) => state.setHydrated);
  const clear = useAuthStore((state) => state.clear);

  return useCallback(async function bootstrap() {
    const existingSession = useAuthStore.getState().session;
    try {
      const hydrated = await hydrateAuthState({
        pendingToken: useAuthStore.getState().pendingJoinToken || undefined,
        acceptPendingToken: true
      });
      if (!hydrated) {
        if (existingSession) {
          setHydrated(true);
          return;
        }
        clear();
        return;
      }
      setSession(hydrated.session);
      setContext(hydrated.context);
      setMemberships(hydrated.memberships);
      setActiveSalonId(hydrated.activeSalonId);
      setPendingJoinToken(null);
      setHydrated(true);
    } catch {
      if (existingSession) {
        setHydrated(true);
        return;
      }
      clear();
    }
  }, [clear, setActiveSalonId, setContext, setHydrated, setMemberships, setPendingJoinToken, setSession]);
}

export function useSendOtp() {
  return useMutation({
    mutationFn: (phone: string) => api.auth.sendOtp(phone)
  });
}

export function useVerifyOtp() {
  const queryClient = useQueryClient();
  const setSession = useAuthStore((state) => state.setSession);
  const setContext = useAuthStore((state) => state.setContext);
  const setMemberships = useAuthStore((state) => state.setMemberships);
  const setActiveSalonId = useAuthStore((state) => state.setActiveSalonId);
  const setPendingJoinToken = useAuthStore((state) => state.setPendingJoinToken);
  const setHydrated = useAuthStore((state) => state.setHydrated);

  return useMutation({
    mutationFn: (payload: {phone: string; code: string}) => api.auth.verifyOtp(payload.phone, payload.code),
    onSuccess: async (session) => {
      setSession(session);
      const hydrated = await hydrateAuthState({
        pendingToken: useAuthStore.getState().pendingJoinToken || undefined,
        acceptPendingToken: true
      });
      if (hydrated) {
        setSession(hydrated.session);
        setContext(hydrated.context);
        setMemberships(hydrated.memberships);
        setActiveSalonId(hydrated.activeSalonId);
        setPendingJoinToken(null);
      } else {
        setContext(null);
        setMemberships([]);
        setActiveSalonId(null);
      }
      setHydrated(true);
      queryClient.invalidateQueries({queryKey: qk.ownerContext});
    }
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  const clear = useAuthStore((state) => state.clear);

  return useMutation({
    mutationFn: () => logoutSession(),
    onSuccess: () => {
      clear();
      queryClient.clear();
    }
  });
}
