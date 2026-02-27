import {env} from '../utils/env';
import {mockApi} from './mock';
import {supabaseApi} from './supabase';
import type {CareChairApi} from './types';
import {pushDevLog} from '../lib/devLogger';
import {hasSupabaseConfig, supabaseHost} from '../utils/env';

if (__DEV__) {
  pushDevLog('info', 'startup.api', 'API mode selected', {
    useMockApi: env.useMockApi,
    useInvitesV2: String(process.env.EXPO_PUBLIC_USE_INVITES_V2 || '').trim() || '(default)',
    devOtpBypass: __DEV__ && env.devOtpBypass,
    supabaseHost: supabaseHost || '(missing)',
    buildEnv: env.buildEnv,
  });
  if (!env.useMockApi && !hasSupabaseConfig) {
    pushDevLog('error', 'startup.api', 'Supabase config missing while mock mode is OFF');
  }
}

export const api: CareChairApi = env.useMockApi ? mockApi : supabaseApi;

export function activeApiMode() {
  return env.useMockApi ? 'mock' : 'supabase';
}
