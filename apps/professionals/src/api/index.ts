import {env} from '../utils/env';
import {mockApi} from './mock';
import {supabaseApi} from './supabase';
import type {CareChairApi} from './types';

export const api: CareChairApi = env.useMockApi ? mockApi : supabaseApi;

export function activeApiMode() {
  return env.useMockApi ? 'mock' : 'supabase';
}
