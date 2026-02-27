import 'react-native-url-polyfill/auto';
import {createClient} from '@supabase/supabase-js';
import {env, hasSupabaseConfig} from '../../utils/env';
import {createSecureStorageAdapter} from '../../utils/secureStore';
import {pushDevLog} from '../../lib/devLogger';

const baseFetch: typeof fetch = fetch;

const instrumentedFetch: typeof fetch = async (input, init) => {
  try {
    const response = await baseFetch(input, init);
    if (__DEV__ && !response.ok) {
      let body = '';
      try {
        body = await response.clone().text();
      } catch {
        body = '';
      }
      pushDevLog('error', 'supabase.fetch', 'Non-2xx Supabase response', {
        method: init?.method || 'GET',
        url: String(input),
        status: response.status,
        statusText: response.statusText,
        requestBody: typeof init?.body === 'string' ? init.body.slice(0, 2000) : undefined,
        responseBody: body.slice(0, 4000),
      });
    }
    return response;
  } catch (error: any) {
    if (__DEV__) {
      pushDevLog('error', 'supabase.fetch', 'Supabase fetch threw', {
        method: init?.method || 'GET',
        url: String(input),
        message: String(error?.message || error),
      });
    }
    throw error;
  }
};

export const supabase = hasSupabaseConfig
  ? createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storage: createSecureStorageAdapter('cc_prof_supabase')
      },
      global: {
        fetch: instrumentedFetch,
      },
    })
  : null;
