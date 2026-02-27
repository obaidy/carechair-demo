import {useCallback} from 'react';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {api} from './index';
import {qk} from './queryKeys';
import {useAuthStore} from '../state/authStore';
import {hydrateAuthState, logoutSession} from '../auth/session';
import {pushDevLog} from '../lib/devLogger';

export function useBootstrapAuth() {
  const setSession = useAuthStore((state) => state.setSession);
  const setContext = useAuthStore((state) => state.setContext);
  const setMemberships = useAuthStore((state) => state.setMemberships);
  const setActiveSalonId = useAuthStore((state) => state.setActiveSalonId);
  const setPendingJoinToken = useAuthStore((state) => state.setPendingJoinToken);
  const setBootstrapError = useAuthStore((state) => state.setBootstrapError);
  const setHydrated = useAuthStore((state) => state.setHydrated);
  const clear = useAuthStore((state) => state.clear);

  return useCallback(async function bootstrap() {
    try {
      const hydrated = await hydrateAuthState({
        pendingToken: useAuthStore.getState().pendingJoinToken || undefined,
        acceptPendingToken: true
      });
      if (!hydrated) {
        clear();
        return;
      }
      setSession(hydrated.session);
      setContext(hydrated.context);
      setMemberships(hydrated.memberships);
      setActiveSalonId(hydrated.activeSalonId);
      setPendingJoinToken(null);
      setBootstrapError(null);
      setHydrated(true);
    } catch (error: any) {
      const message = String(error?.message || 'BOOTSTRAP_FAILED');
      pushDevLog('error', 'auth.bootstrap', 'Auth bootstrap failed', {message});
      if (message === 'NO_SESSION') {
        clear();
        return;
      }
      if (useAuthStore.getState().session) {
        setBootstrapError(message);
        setHydrated(true);
        return;
      }
      clear();
    }
  }, [clear, setActiveSalonId, setBootstrapError, setContext, setHydrated, setMemberships, setPendingJoinToken, setSession]);
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
  const setBootstrapError = useAuthStore((state) => state.setBootstrapError);
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
        setBootstrapError(null);
      } else {
        setBootstrapError('MEMBERSHIP_FETCH_EMPTY');
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
